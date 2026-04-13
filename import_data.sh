#!/bin/bash
# ============================================================
# ThePickleHub Data Import Script
# ============================================================
# Imports CSV files exported from Lovable Supabase
# into new self-hosted Supabase instance
#
# Usage:
#   1. Set DATABASE_URL env var (Supabase new connection string)
#   2. Place CSV files in ./migration_data/
#   3. Run: bash import_data.sh [options]
#
# Options:
#   --dry-run        Show what would be imported, don't actually insert
#   --skip-large     Skip view_events + audit_logs
#   --skip-auth      Skip auth.users + auth.identities
#   --auth-only      Import only auth.users + auth.identities
#   --table NAME     Import only one specific table
# ============================================================

set -e  # Exit on first error
set -u  # Error on undefined vars

# ============================================================
# Config
# ============================================================
DATA_DIR="${DATA_DIR:-./migration_data}"
DRY_RUN=false
SKIP_LARGE=false
SKIP_AUTH=false
AUTH_ONLY=false
SINGLE_TABLE=""

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)    DRY_RUN=true; shift ;;
        --skip-large) SKIP_LARGE=true; shift ;;
        --skip-auth)  SKIP_AUTH=true; shift ;;
        --auth-only)  AUTH_ONLY=true; shift ;;
        --table)      SINGLE_TABLE="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

# Verify env
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: Set DATABASE_URL environment variable"
    echo ""
    echo "Example:"
    echo "  export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'"
    exit 1
fi

# Verify data dir
if [ ! -d "$DATA_DIR" ]; then
    echo "ERROR: Data directory not found: $DATA_DIR"
    echo "Create it and place CSV files there."
    exit 1
fi

# Test connection
echo "Testing connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to database"
    exit 1
fi
echo "✓ Connection OK"
echo ""

# ============================================================
# Tables in dependency order
# ============================================================
TABLES_P0=(
    "organizations"
    "profiles"
    "user_roles"
    "api_keys"
    "system_settings"
)

TABLES_P1=(
    "master_teams"
    "master_team_roster"
    "parent_tournaments"
    "tournaments"
    "livestreams"
    "vi_blog_posts"
    "news_items"
    "videos"
    "forum_categories"
)

TABLES_P2=(
    "quick_tables"
    "quick_table_groups"
    "quick_table_teams"
    "quick_table_players"
    "quick_table_pair_requests"
    "quick_table_partner_invitations"
    "quick_table_matches"
    "quick_table_referees"
    "quick_table_registrations"
    "doubles_elimination_tournaments"
    "doubles_elimination_teams"
    "doubles_elimination_matches"
    "doubles_elimination_referees"
    "flex_tournaments"
    "flex_groups"
    "flex_teams"
    "flex_team_members"
    "flex_players"
    "flex_group_items"
    "flex_matches"
    "flex_player_stats"
    "flex_pair_stats"
    "team_match_tournaments"
    "team_match_teams"
    "team_match_groups"
    "team_match_roster"
    "team_match_game_templates"
    "team_match_matches"
    "team_match_games"
    "team_match_referees"
)

TABLES_P3=(
    "follows"
    "likes"
    "comments"
    "forum_posts"
    "forum_comments"
    "forum_likes"
    "blocked_users"
    "content_reports"
    "notifications"
    "push_tokens"
    "chat_room_settings"
    "chat_messages"
    "chat_message_likes"
    "chat_pinned_messages"
    "chat_highlighted_users"
    "chat_mutes"
    "view_counts"
)

TABLES_LARGE=(
    "view_events"
    "audit_logs"
)

# Build full list
ALL_TABLES=("${TABLES_P0[@]}" "${TABLES_P1[@]}" "${TABLES_P2[@]}" "${TABLES_P3[@]}")
if [ "$SKIP_LARGE" = false ]; then
    ALL_TABLES+=("${TABLES_LARGE[@]}")
fi

# ============================================================
# Helper functions
# ============================================================

import_table() {
    local table="$1"
    local csv_file="$DATA_DIR/$table.csv"
    
    if [ ! -f "$csv_file" ]; then
        printf "  ⚠️  %-40s CSV not found\n" "$table"
        return 1
    fi
    
    local row_count=$(($(wc -l < "$csv_file") - 1))
    
    if [ "$row_count" -le 0 ]; then
        printf "  ⏭  %-40s empty (0 rows)\n" "$table"
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        printf "  🔍 %-40s would import %d rows\n" "$table" "$row_count"
        return 0
    fi
    
    # Detect delimiter from first line
    local first_line=$(head -1 "$csv_file")
    local DELIMITER=","
    if [[ "$first_line" == *";"* ]]; then
        local semi_count=$(echo "$first_line" | tr -cd ';' | wc -c)
        local comma_count=$(echo "$first_line" | tr -cd ',' | wc -c)
        if [ "$semi_count" -gt "$comma_count" ]; then
            DELIMITER=";"
        fi
    fi
    
    # Truncate first
    psql "$DATABASE_URL" -q -c "TRUNCATE TABLE public.$table CASCADE;" > /dev/null 2>&1 || true
    
    # COPY from CSV
    if psql "$DATABASE_URL" -q -c "\\COPY public.$table FROM '$csv_file' WITH (FORMAT csv, HEADER true, DELIMITER '$DELIMITER', NULL '');" 2>&1 | grep -v "^$"; then
        printf "  ✓ %-40s %d rows imported\n" "$table" "$row_count"
        return 0
    else
        printf "  ✗ %-40s FAILED\n" "$table"
        return 1
    fi
}

import_auth_users() {
    local csv_file="$DATA_DIR/auth_users.csv"
    
    if [ ! -f "$csv_file" ]; then
        echo "  ⚠️  auth_users.csv not found"
        return 1
    fi
    
    local row_count=$(($(wc -l < "$csv_file") - 1))
    
    if [ "$DRY_RUN" = true ]; then
        echo "  🔍 auth.users: would import $row_count users"
        return 0
    fi
    
    # Detect delimiter
    local first_line=$(head -1 "$csv_file")
    local DELIMITER=","
    if [[ "$first_line" == *";"* ]]; then
        local semi_count=$(echo "$first_line" | tr -cd ';' | wc -c)
        local comma_count=$(echo "$first_line" | tr -cd ',' | wc -c)
        if [ "$semi_count" -gt "$comma_count" ]; then
            DELIMITER=";"
        fi
    fi
    
    # Create temp table, import, then INSERT into auth.users
    psql "$DATABASE_URL" <<SQL
-- Create temp table matching auth.users structure
DROP TABLE IF EXISTS tmp_auth_users;
CREATE TABLE tmp_auth_users (LIKE auth.users INCLUDING ALL);

-- Import CSV into temp table
\COPY tmp_auth_users FROM '$csv_file' WITH (FORMAT csv, HEADER true, DELIMITER '$DELIMITER', NULL '');

-- Insert into auth.users (skip if id already exists)
INSERT INTO auth.users 
SELECT * FROM tmp_auth_users
ON CONFLICT (id) DO NOTHING;

-- Cleanup
DROP TABLE tmp_auth_users;
SQL
    
    if [ $? -eq 0 ]; then
        printf "  ✓ %-40s %d users imported\n" "auth.users" "$row_count"
    else
        printf "  ✗ %-40s FAILED\n" "auth.users"
        return 1
    fi
}

import_auth_identities() {
    local csv_file="$DATA_DIR/auth_identities.csv"
    
    if [ ! -f "$csv_file" ]; then
        echo "  ⚠️  auth_identities.csv not found"
        return 1
    fi
    
    local row_count=$(($(wc -l < "$csv_file") - 1))
    
    if [ "$DRY_RUN" = true ]; then
        echo "  🔍 auth.identities: would import $row_count identities"
        return 0
    fi
    
    local first_line=$(head -1 "$csv_file")
    local DELIMITER=","
    if [[ "$first_line" == *";"* ]]; then
        local semi_count=$(echo "$first_line" | tr -cd ';' | wc -c)
        local comma_count=$(echo "$first_line" | tr -cd ',' | wc -c)
        if [ "$semi_count" -gt "$comma_count" ]; then
            DELIMITER=";"
        fi
    fi
    
    psql "$DATABASE_URL" <<SQL
DROP TABLE IF EXISTS tmp_auth_identities;
CREATE TABLE tmp_auth_identities (LIKE auth.identities INCLUDING ALL);

\COPY tmp_auth_identities FROM '$csv_file' WITH (FORMAT csv, HEADER true, DELIMITER '$DELIMITER', NULL '');

INSERT INTO auth.identities 
SELECT * FROM tmp_auth_identities
ON CONFLICT (provider, provider_id) DO NOTHING;

DROP TABLE tmp_auth_identities;
SQL
    
    if [ $? -eq 0 ]; then
        printf "  ✓ %-40s %d identities imported\n" "auth.identities" "$row_count"
    else
        printf "  ✗ %-40s FAILED\n" "auth.identities"
        return 1
    fi
}

# ============================================================
# Main
# ============================================================

echo "============================================================"
echo "ThePickleHub Data Import"
echo "============================================================"
echo "Data dir:    $DATA_DIR"
echo "Tables:      ${#ALL_TABLES[@]}"
echo "Skip large:  $SKIP_LARGE"
echo "Skip auth:   $SKIP_AUTH"
echo "Auth only:   $AUTH_ONLY"
echo "Dry run:     $DRY_RUN"
[ -n "$SINGLE_TABLE" ] && echo "Single table: $SINGLE_TABLE"
echo ""

# Single table mode
if [ -n "$SINGLE_TABLE" ]; then
    echo "Importing single table: $SINGLE_TABLE"
    import_table "$SINGLE_TABLE"
    exit 0
fi

# Auth only mode
if [ "$AUTH_ONLY" = true ]; then
    echo "=== AUTH SCHEMA IMPORT ==="
    import_auth_users
    import_auth_identities
    exit 0
fi

# Disable triggers temporarily
if [ "$DRY_RUN" = false ]; then
    echo "Disabling triggers and FK constraints temporarily..."
    psql "$DATABASE_URL" -q -c "SET session_replication_role = 'replica';" > /dev/null 2>&1 || true
    echo ""
fi

# Step 1: Auth schema first (so profiles FK works)
if [ "$SKIP_AUTH" = false ]; then
    echo "=== STEP 1: AUTH SCHEMA ==="
    import_auth_users
    import_auth_identities
    echo ""
fi

# Step 2: Public tables in dependency order
echo "=== STEP 2: P0 Core (${#TABLES_P0[@]} tables) ==="
for table in "${TABLES_P0[@]}"; do
    import_table "$table" || true
done
echo ""

echo "=== STEP 3: P1 Content (${#TABLES_P1[@]} tables) ==="
for table in "${TABLES_P1[@]}"; do
    import_table "$table" || true
done
echo ""

echo "=== STEP 4: P2 Tools (${#TABLES_P2[@]} tables) ==="
for table in "${TABLES_P2[@]}"; do
    import_table "$table" || true
done
echo ""

echo "=== STEP 5: P3 Social (${#TABLES_P3[@]} tables) ==="
for table in "${TABLES_P3[@]}"; do
    import_table "$table" || true
done
echo ""

if [ "$SKIP_LARGE" = false ]; then
    echo "=== STEP 6: Large tables (${#TABLES_LARGE[@]} tables) ==="
    for table in "${TABLES_LARGE[@]}"; do
        import_table "$table" || true
    done
    echo ""
fi

# Re-enable triggers
if [ "$DRY_RUN" = false ]; then
    echo "Re-enabling triggers and FK constraints..."
    psql "$DATABASE_URL" -q -c "SET session_replication_role = 'origin';" > /dev/null 2>&1 || true
fi

echo ""
echo "============================================================"
echo "Import complete!"
echo "============================================================"
echo ""
echo "Verify with:"
echo "  psql \"\$DATABASE_URL\" -c \"SELECT count(*) FROM auth.users;\""
echo "  psql \"\$DATABASE_URL\" -c \"SELECT count(*) FROM public.profiles;\""
