// Local restored-database verifier. Never restores or changes any database.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function validateLocalTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("RESTORE_DRILL_DATABASE_URL must be a PostgreSQL URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Only a disposable loopback restored database is allowed");
  }
  if (!url.pathname || url.pathname === "/") throw new Error("A database name is required");
  return url;
}
export const CHECK_SQL = `BEGIN READ ONLY;
SELECT json_build_object(
 'observed_at',now(),
 'profiles',(SELECT count(*) FROM public.profiles),
 'social_events',(SELECT count(*) FROM public.social_events),
 'event_registrations',(SELECT count(*) FROM public.event_registrations),
 'public_base_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
 'migration_versions',(SELECT count(*) FROM supabase_migrations.schema_migrations));
ROLLBACK;`;

export function localSnapshot(value, psql = "psql", run = execFileSync) {
  const u = validateLocalTarget(value);
  // Separate libpq variables prevent connection strings/passwords in argv.
  // No options/query from the URL are forwarded to libpq.
  return run(psql, ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", CHECK_SQL], {
    encoding: "utf8", timeout: 30000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME,
      PGHOST: u.hostname.replace(/^\[|\]$/g, ""), PGPORT: u.port || "5432",
      PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
      PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
      PGCONNECT_TIMEOUT: "5", PGOPTIONS: "-c default_transaction_read_only=on" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(localSnapshot(process.env.RESTORE_DRILL_DATABASE_URL, process.env.PSQL_BIN || "psql"));
  } catch {
    // Never print the raw driver error: it can include credentials/connection data.
    process.stderr.write("Restore snapshot failed: check disposable loopback target, psql and restored schema. No recovery PASS established.\n");
    process.exitCode = 1;
  }
}
