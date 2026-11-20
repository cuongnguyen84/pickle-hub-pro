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
// from the budget table. A hostname allowlist is not enough — localhost can be
// an SSH tunnel to production — so ANY override of the known disposable
// default requires an explicit opt-in.
if (DB !== DEFAULT_DB && process.env.QA_DB_RACE_ALLOW_REMOTE !== "yes") {
  console.error(
    `DB_URL overrides the default disposable target (supabase db start). ` +
      `This harness deletes budget rows — set ` +
      `QA_DB_RACE_ALLOW_REMOTE=yes only if the target is truly disposable.`,
  );
  process.exit(2);
}

const psql = async (sql) =>
  (
    await run("psql", [DB, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], { timeout: 10000 })
  ).stdout.trim();

/** Run two SQL statements in two sessions released simultaneously by the
 *  gate lock. Returns their results once both complete. */
async function racePair(sqlA, sqlB) {
  const holder = spawn("psql", [DB, "-X", "-A", "-t"], { stdio: ["pipe", "pipe", "pipe"] });
  // Drain output and suppress pipe errors during forced cleanup.
  holder.stdout.resume(); holder.stderr.resume(); holder.stdin.on("error", () => {});
  const holderDone = new Promise(resolve => { holder.on("close", resolve); holder.on("error", resolve); });
  const children = [holder];
  const racers = [];
  const waitFor = async (predicateSql, want, label) => {
    for (let t=0; t<200; t++) {
      if (await psql(predicateSql) === want) return;
      await sleep(25);
    }
    throw Error(`timeout waiting for ${label}`);
  };
  const racer = sql => {
    const pending = run("psql", [DB, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
      `SELECT pg_advisory_lock_shared(${GATE}); SET ROLE service_role; ${sql}`], { timeout: 15000 });
    children.push(pending.child);
    // Observe rejection immediately, even when barrier observation fails first.
    const observed = pending.then(r => ({ value:r.stdout.trim().split("\n").filter(Boolean).at(-1) }), error => ({ error }));
    racers.push(observed);
    return observed;
  };
  try {
    holder.stdin.write(`SELECT pg_advisory_lock(${GATE});\n`);
    await waitFor(`SELECT count(*)::text FROM pg_locks WHERE locktype='advisory' AND objid=${GATE} AND granted`, "1", "coordinator gate");
    const first = racer(sqlA), second = racer(sqlB);
    await waitFor(`SELECT count(*)::text FROM pg_locks WHERE locktype='advisory' AND objid=${GATE} AND NOT granted`, "2", "both racers");
    holder.stdin.end(`SELECT pg_advisory_unlock(${GATE});\n\\q\n`);
    const results = await Promise.all([first,second]);
    if (results.some(r => r.error)) throw Error("race psql session failed");
    return results.map(r => r.value);
  } finally {
    for (const child of children) if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await Promise.allSettled([...racers,holderDone]);
  }
}

try {
  for (let i=0; i<ROUNDS; i++) {
    // A rollover can legitimately open another bucket; avoid that boundary.
    if (Number(await psql("SELECT extract(second from clock_timestamp())")) > 50) await sleep(11000);
    await psql("DELETE FROM public.indexnow_rate_budget; INSERT INTO public.indexnow_rate_budget VALUES(true,date_trunc('minute',statement_timestamp()),9)");
    const result=await racePair("SELECT public.consume_indexnow_budget()", "SELECT public.consume_indexnow_budget()");
    if (result.sort().join() !== "f,t") throw Error(`round ${i}: expected one accepted and one denied`);
    if (await psql("SELECT used FROM public.indexnow_rate_budget") !== "10") throw Error("lost update");
  }
} finally {
  await psql("DELETE FROM public.indexnow_rate_budget");
}
console.log(`${ROUNDS} synchronized service-role races passed; exactly one caller consumes the final slot.`);
