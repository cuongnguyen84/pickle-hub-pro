#!/usr/bin/env python3
"""
ThePickleHub - Data Import Script (v2)
Imports CSV files from Lovable Supabase to new self-hosted Supabase
Uses psycopg2 for direct PostgreSQL access with type conversion
"""

import os
import sys
import csv
import json
import argparse
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("ERROR: pip install psycopg2-binary")
    sys.exit(1)

DATA_DIR = Path("./migration_data")
BATCH_SIZE = 500

TABLES_ORDER = [
    "organizations", "profiles", "user_roles", "api_keys", "system_settings",
    "master_teams", "master_team_roster", "parent_tournaments", "tournaments",
    "livestreams", "vi_blog_posts", "news_items", "videos", "forum_categories",
    "quick_tables", "quick_table_groups", "quick_table_teams", "quick_table_players",
    "quick_table_pair_requests", "quick_table_partner_invitations",
    "quick_table_matches", "quick_table_referees", "quick_table_registrations",
    "doubles_elimination_tournaments", "doubles_elimination_teams",
    "doubles_elimination_matches", "doubles_elimination_referees",
    "flex_tournaments", "flex_groups", "flex_teams", "flex_team_members",
    "flex_players", "flex_group_items", "flex_matches", "flex_player_stats",
    "flex_pair_stats",
    "team_match_tournaments", "team_match_teams", "team_match_groups",
    "team_match_roster", "team_match_game_templates", "team_match_matches",
    "team_match_games", "team_match_referees",
    "follows", "likes", "comments", "forum_posts", "forum_comments", "forum_likes",
    "blocked_users", "content_reports", "notifications", "push_tokens",
    "chat_room_settings", "chat_messages", "chat_message_likes",
    "chat_pinned_messages", "chat_highlighted_users", "chat_mutes", "view_counts",
]

LARGE_TABLES = ["view_events", "audit_logs"]


def get_column_info(conn, schema, table):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type, udt_name, is_generated
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table))
        return {row[0]: {"data_type": row[1], "udt_name": row[2], "is_generated": row[3]}
                for row in cur.fetchall()}


def detect_delimiter(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        first_line = f.readline()
    return ";" if first_line.count(";") > first_line.count(",") else ","


def parse_value(value, col_info):
    if value == "" or value is None:
        return None

    data_type = col_info["data_type"]

    if data_type == "boolean":
        return value.lower() in ("true", "t", "1", "yes")

    if data_type in ("integer", "bigint", "smallint"):
        try:
            return int(value)
        except ValueError:
            return None

    if data_type in ("numeric", "double precision", "real"):
        try:
            return float(value)
        except ValueError:
            return None

    if data_type == "ARRAY":
        # udt_name format: "_<element_type>" e.g. "_uuid", "_text", "_int4"
        elem_type = col_info.get("udt_name", "_text").lstrip("_")
        
        # Parse array from JSON or PG format
        items = None
        if value.startswith("[") and value.endswith("]"):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    items = parsed
            except (json.JSONDecodeError, ValueError):
                pass
        if items is None and value.startswith("{") and value.endswith("}"):
            inner = value[1:-1]
            if not inner:
                items = []
            else:
                items = [s.strip().strip('"').strip("'") for s in inner.split(",")]
        if items is None:
            items = [value]
        
        # For uuid arrays, return as PG array literal string with cast
        # psycopg2 handles list-to-array conversion based on element type
        # but uuid[] needs explicit handling
        if elem_type == "uuid":
            # Return as formatted array literal that PG can cast
            # Use psycopg2's Json adapter approach
            from psycopg2.extensions import AsIs
            if not items:
                return AsIs("'{}'::uuid[]")
            uuid_items = ",".join(f'"{u}"' for u in items)
            return AsIs(f"'{{{uuid_items}}}'::uuid[]")
        
        # For int arrays
        if elem_type in ("int4", "int8", "int2"):
            return [int(x) for x in items if x]
        
        # Default: text array (psycopg2 handles list of strings)
        return items

    if data_type in ("json", "jsonb"):
        try:
            json.loads(value)
            return value
        except (json.JSONDecodeError, ValueError):
            return json.dumps(value)

    return value


def read_csv_rows(filepath):
    delimiter = detect_delimiter(filepath)
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter=delimiter)
        headers = next(reader)
        rows = list(reader)
    return headers, rows


def import_table(conn, schema, table, dry_run=False):
    csv_path = DATA_DIR / f"{table}.csv"
    if schema == "auth":
        csv_path = DATA_DIR / f"auth_{table}.csv"

    label = f"{schema}.{table}"

    if not csv_path.exists():
        print(f"  WARN  {label:45s}  CSV not found")
        return (0, 0)

    headers, rows = read_csv_rows(csv_path)

    if not rows:
        print(f"  SKIP  {label:45s}  empty (0 rows)")
        return (0, 0)

    if dry_run:
        print(f"  DRY   {label:45s}  would import {len(rows)} rows")
        return (len(rows), 0)

    col_info = get_column_info(conn, schema, table)

    valid_headers = [
        h for h in headers
        if h in col_info and col_info[h]["is_generated"] != "ALWAYS"
    ]

    skipped_cols = set(headers) - set(valid_headers)
    if skipped_cols:
        print(f"  INFO  {label}: skipping cols {skipped_cols}")

    header_indices = [headers.index(h) for h in valid_headers]

    parsed_rows = []
    parse_errors = 0
    for row_idx, row in enumerate(rows):
        try:
            parsed = []
            for hidx, hname in zip(header_indices, valid_headers):
                raw = row[hidx] if hidx < len(row) else ""
                parsed.append(parse_value(raw, col_info[hname]))
            parsed_rows.append(tuple(parsed))
        except Exception as e:
            parse_errors += 1
            if parse_errors <= 3:
                print(f"  WARN  Row {row_idx + 2}: {str(e)[:100]}")

    if not parsed_rows:
        print(f"  FAIL  {label:45s}  no rows after parsing")
        return (0, len(rows))

    try:
        with conn.cursor() as cur:
            cur.execute(f'TRUNCATE TABLE {schema}.{table} CASCADE;')
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"  WARN  Truncate failed: {str(e)[:100]}")

    cols_sql = ", ".join('"' + h + '"' for h in valid_headers)
    insert_sql = f'INSERT INTO {schema}.{table} ({cols_sql}) VALUES %s'

    inserted = 0
    failed = 0

    for i in range(0, len(parsed_rows), BATCH_SIZE):
        batch = parsed_rows[i:i + BATCH_SIZE]
        try:
            with conn.cursor() as cur:
                execute_values(cur, insert_sql, batch, page_size=BATCH_SIZE)
            conn.commit()
            inserted += len(batch)
        except Exception as e:
            conn.rollback()
            failed += len(batch)
            err = str(e)[:300].replace("\n", " ")
            print(f"  FAIL  {label} batch {i // BATCH_SIZE}: {err}")

    if failed == 0:
        print(f"  OK    {label:45s}  {inserted}/{len(rows)} rows imported")
    else:
        print(f"  PART  {label:45s}  {inserted}/{len(rows)} ({failed} failed)")

    return (inserted, failed)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-large", action="store_true")
    parser.add_argument("--table", type=str)
    parser.add_argument("--auth-only", action="store_true")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: Set DATABASE_URL env var")
        sys.exit(1)

    if not DATA_DIR.exists():
        print(f"ERROR: Data dir not found: {DATA_DIR.absolute()}")
        sys.exit(1)

    print("=" * 60)
    print("ThePickleHub Data Import (Python v2)")
    print("=" * 60)
    print(f"Data dir:   {DATA_DIR.absolute()}")
    print(f"Dry run:    {args.dry_run}")
    print(f"Skip large: {args.skip_large}")
    print()

    if args.dry_run:
        conn = None
    else:
        print("Connecting to database...")
        conn = psycopg2.connect(db_url)
        print("Connected")
        print()

        with conn.cursor() as cur:
            cur.execute("SET session_replication_role = 'replica';")
        conn.commit()

    try:
        if args.table:
            schema = "auth" if args.table in ("users", "identities") else "public"
            import_table(conn, schema, args.table, args.dry_run)
            return

        print("=== AUTH SCHEMA ===")
        import_table(conn, "auth", "users", args.dry_run)
        import_table(conn, "auth", "identities", args.dry_run)
        print()

        if args.auth_only:
            return

        tables = TABLES_ORDER.copy()
        if not args.skip_large:
            tables.extend(LARGE_TABLES)

        print(f"=== PUBLIC SCHEMA ({len(tables)} tables) ===")
        total_ok = 0
        total_fail = 0
        for table in tables:
            ok, fail = import_table(conn, "public", table, args.dry_run)
            total_ok += ok
            total_fail += fail

        print()
        print("=" * 60)
        print(f"Total: {total_ok} rows imported, {total_fail} failed")
        print("=" * 60)

    finally:
        if conn:
            with conn.cursor() as cur:
                cur.execute("SET session_replication_role = 'origin';")
            conn.commit()
            conn.close()


if __name__ == "__main__":
    main()
