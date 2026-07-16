#!/usr/bin/env node
// QA-03 — concurrency regression harness for the DB-01 capacity RPCs.
//
// pgTAP runs inside ONE transaction, so it can pin the functional contract
// but can never exercise the race itself (see event_capacity_rpc.test.sql
// header). This script runs against the same disposable local Supabase
// Postgres (`supabase db start`) and fires the capacity RPCs from TWO
// parallel psql sessions: the advisory lock inside each RPC must serialize
// them so exactly one wins. Repeats each race to make the interleaving
// window real rather than lucky.
//
// Usage: node scripts/qa/db-race.mjs   (DB_URL env overrides the default)

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const DB =
  process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ROUNDS = 15;

const psql = async (sql) =>
  (
    await run("psql", [DB, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql])
  ).stdout.trim();

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
    const call = (n) =>
      psql(
        `SELECT outcome FROM public.social_event_guest_register(
           '${EVENT}', NULL, '+849000${String(i).padStart(2, "0")}${n}',
           'Racer ${n}', NULL, 'unpaid', NULL, NULL)`,
      );
    const results = (await Promise.all([call(1), call(2)])).sort();
    check(
      results[0] === "event_full" && results[1] === "registered",
      `guest_register round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    const active = await psql(
      `SELECT COUNT(*) FROM public.event_registrations
       WHERE event_id = '${EVENT}' AND status <> 'cancelled'`,
    );
    check(active === "2", `guest_register round ${i + 1}: active == max_players (got: ${active})`);
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
    const reactivate = (id) =>
      psql(`SELECT public.social_event_reactivate_registration('${id}')`);
    const results = (
      await Promise.all([reactivate(CANCELLED_1), reactivate(CANCELLED_2)])
    ).sort();
    check(
      results[0] === "event_full" && results[1] === "reactivated",
      `reactivate round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    const active = await psql(
      `SELECT COUNT(*) FROM public.event_registrations
       WHERE event_id = '${EVENT}' AND status <> 'cancelled'`,
    );
    check(active === "2", `reactivate round ${i + 1}: active == max_players (got: ${active})`);
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

console.log(failures === 0 ? `\nAll ${ROUNDS * 4} race assertions passed.` : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
