// IndexNow singleton budget race; disposable local DB only. Requires migration.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const run = promisify(execFile);
const DEFAULT_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB = process.env.DB_URL ?? DEFAULT_DB;
const ROUNDS = 15;
const GATE = 430321; // advisory lock key for the start barrier

// Destructive-target guard (Codex P1, both rounds): this script DELETEs rows
// and toggles triggers. A hostname allowlist is not enough — localhost can be
// an SSH tunnel to production — so ANY override of the known disposable
// default requires an explicit opt-in.
if (DB !== DEFAULT_DB && process.env.QA_DB_RACE_ALLOW_REMOTE !== "yes") {
  console.error(
    `DB_URL overrides the default disposable target (supabase db start). ` +
      `This harness deletes rows and disables triggers — set ` +
      `QA_DB_RACE_ALLOW_REMOTE=yes only if the target is truly disposable.`,
  );
  process.exit(2);
}

const psql = async (sql) =>
  (
    await run("psql", [DB, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql])
  ).stdout.trim();

/** Run two SQL statements in two sessions released simultaneously by the
 *  gate lock. Returns their results once both complete. */
async function racePair(sqlA, sqlB) {
  // Coordinator session takes the exclusive gate lock and stays open.
  const holder = spawn("psql", [DB, "-X", "-A", "-t"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const holderDone = new Promise((res) => holder.on("close", res));
  holder.stdin.write(`SELECT pg_advisory_lock(${GATE});\n`);

  const waitFor = async (predicateSql, want, label) => {
    for (let t = 0; t < 200; t++) {
      if ((await psql(predicateSql)) === want) return;
      await sleep(25);
    }
    throw new Error(`timeout waiting for ${label}`);
  };

  await waitFor(
    `SELECT COUNT(*)::text FROM pg_locks
     WHERE locktype = 'advisory' AND objid = ${GATE} AND granted`,
    "1",
    "coordinator to hold the gate lock",
  );

  // Racers queue on a SHARED gate lock (blocked behind the exclusive one).
  // Gate + payload travel in ONE simple-query message (a single -c): after
  // the gate is granted there is NO client round-trip before the RPC, so
  // both sessions hit the capacity boundary back-to-back server-side
  // (Codex round 2: separate -c commands reopened a sequential window).
  const racer = (sql) =>
    run("psql", [
      DB,
      "-X",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT pg_advisory_lock_shared(${GATE}); ${sql}`,
    ]).then((r) => r.stdout.trim().split("\n").filter(Boolean).at(-1));

  const pA = racer(sqlA);
  const pB = racer(sqlB);

  await waitFor(
    `SELECT COUNT(*)::text FROM pg_locks
     WHERE locktype = 'advisory' AND objid = ${GATE} AND NOT granted`,
    "2",
    "both racers to queue on the gate",
  );

  // Drop the gate — both racers are granted the shared lock at once.
  holder.stdin.write(`SELECT pg_advisory_unlock(${GATE});\n\\q\n`);
  const results = await Promise.all([pA, pB]);
  await holderDone;
  return results;
}


for (let i=0; i<15; i++) {
  // Avoid a wall-clock minute rollover being mistaken for a lost update.
  if (Number(await psql("SELECT extract(second from clock_timestamp())")) > 50)
    await sleep(11000);
  await psql("DELETE FROM public.indexnow_rate_budget; INSERT INTO public.indexnow_rate_budget VALUES(true,date_trunc('minute',statement_timestamp()),9)");
  const result=await racePair("SELECT public.consume_indexnow_budget()", "SELECT public.consume_indexnow_budget()");
  if (result.sort().join() !== "f,t") throw Error(`round ${i}: expected one accepted and one denied`);
  if (await psql("SELECT used FROM public.indexnow_rate_budget") !== "10") throw Error("lost update");
}
await psql("DELETE FROM public.indexnow_rate_budget");
console.log("15 synchronized races passed; at most one of two consumes ninth remaining slot.");
