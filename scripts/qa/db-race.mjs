#!/usr/bin/env node
// QA-03 — concurrency regression harness for the DB-01 capacity RPCs.
//
// pgTAP runs inside ONE transaction, so it can pin the functional contract
// but can never exercise the race itself (see event_capacity_rpc.test.sql
// header). This script runs against the disposable local Supabase Postgres
// (`supabase db start`) and fires the capacity RPCs from TWO psql sessions
// that are FORCED to overlap: both racers queue on a shared advisory "gate"
// lock held by a coordinator session, and are released simultaneously — so
// each round genuinely enters the capacity check concurrently instead of
// relying on process-spawn timing (Codex P2: Promise.all alone can degrade
// to sequential execution and false-green a removed advisory lock).
//
// Usage: node scripts/qa/db-race.mjs   (DB_URL env overrides the default)

import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const run = promisify(execFile);
const DEFAULT_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB = process.env.DB_URL ?? DEFAULT_DB;
const ROUNDS = 15;
const GATE = 430301; // advisory lock key for the start barrier

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

const EVENT = "00000000-0000-0000-0000-00000a03e001";
const USER = "0a03f001-0000-4000-8000-000000000001";
const CANCELLED_1 = "00000000-0000-0000-0000-00000a03c001";
const CANCELLED_2 = "00000000-0000-0000-0000-00000a03c002";

let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? "ok" : "not ok"} - ${label}`);
  if (!cond) failures++;
};

const resetRegistrations = () =>
  psql(`DELETE FROM public.event_registrations WHERE event_id = '${EVENT}'`);

const activeCount = () =>
  psql(
    `SELECT COUNT(*) FROM public.event_registrations
     WHERE event_id = '${EVENT}' AND status <> 'cancelled'`,
  );

// ─── Fixture ────────────────────────────────────────────────────────────────

await psql(`
  DELETE FROM public.event_registrations WHERE event_id = '${EVENT}';
  DELETE FROM public.social_events WHERE id = '${EVENT}';
  DELETE FROM auth.users WHERE id = '${USER}';
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '${USER}', '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'qa03-race@thepicklehub.test', '', NOW(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"QA-03 Race"}'::jsonb, NOW(), NOW()
  );
  ALTER TABLE public.event_registrations DISABLE TRIGGER USER;
  INSERT INTO public.social_events (
    id, slug, title_vi, start_at, end_at, created_by, max_players
  ) VALUES (
    '${EVENT}', 'qa03-race', 'QA-03 Race',
    NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', '${USER}', 2
  );
`);

try {
  // ─── Race 1: two concurrent guest registrations, one seat left ───────────
  for (let i = 0; i < ROUNDS; i++) {
    await resetRegistrations();
    await psql(
      `INSERT INTO public.event_registrations (event_id, phone, display_name, status)
       VALUES ('${EVENT}', '+84900030000', 'Seed', 'registered')`,
    );
    const reg = (n) =>
      `SELECT outcome FROM public.social_event_guest_register(
         '${EVENT}', NULL, '+849000${String(i).padStart(2, "0")}${n}',
         'Racer ${n}', NULL, 'unpaid', NULL, NULL)`;
    const results = (await racePair(reg(1), reg(2))).sort();
    check(
      results[0] === "event_full" && results[1] === "registered",
      `guest_register round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    check(
      (await activeCount()) === "2",
      `guest_register round ${i + 1}: active == max_players`,
    );
  }

  // ─── Race 2: two concurrent reactivations, one seat left ─────────────────
  for (let i = 0; i < ROUNDS; i++) {
    await resetRegistrations();
    await psql(`
      INSERT INTO public.event_registrations (id, event_id, phone, display_name, status, cancelled_at, cancelled_reason)
      VALUES
        (gen_random_uuid(), '${EVENT}', '+84900031000', 'Active', 'registered', NULL, NULL),
        ('${CANCELLED_1}', '${EVENT}', '+84900031001', 'Cancelled 1', 'cancelled', NOW(), 'qa03'),
        ('${CANCELLED_2}', '${EVENT}', '+84900031002', 'Cancelled 2', 'cancelled', NOW(), 'qa03');
    `);
    const results = (
      await racePair(
        `SELECT public.social_event_reactivate_registration('${CANCELLED_1}')`,
        `SELECT public.social_event_reactivate_registration('${CANCELLED_2}')`,
      )
    ).sort();
    check(
      results[0] === "event_full" && results[1] === "reactivated",
      `reactivate round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    check(
      (await activeCount()) === "2",
      `reactivate round ${i + 1}: active == max_players`,
    );
  }
} finally {
  // ─── Cleanup (the local db is disposable, but leave it consistent) ────────
  await psql(`
    ALTER TABLE public.event_registrations ENABLE TRIGGER USER;
    DELETE FROM public.event_registrations WHERE event_id = '${EVENT}';
    DELETE FROM public.social_events WHERE id = '${EVENT}';
    DELETE FROM auth.users WHERE id = '${USER}';
  `);
}

console.log(
  failures === 0 ? `\nAll ${ROUNDS * 4} race assertions passed.` : `\n${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
