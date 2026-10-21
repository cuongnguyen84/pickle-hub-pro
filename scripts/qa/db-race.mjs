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
// First 12 hex chars must differ from USER: handle_new_user derives
// profiles.profile_slug from them (unique index).
const USER2 = "0a03f002-0000-4000-8000-000000000002";
const CANCELLED_1 = "00000000-0000-0000-0000-00000a03c001";
const CANCELLED_2 = "00000000-0000-0000-0000-00000a03c002";

// UX-07: doubles-elimination open registration. Four users — each racer
// registers a DISTINCT pair, so the (tournament_id, playerN_user_id) unique
// indexes cannot stand in for the missing lock; only the advisory lock in
// register_team_for_doubles_elimination can decide the winner.
// First 12 hex chars must differ per user (profile_slug is derived from them).
const DE_TOURNAMENT = "00000000-0000-0000-0000-00000a07d001";
const DE_USERS = [
  "0a07f001-0000-4000-8000-000000000001",
  "0a07f002-0000-4000-8000-000000000002",
  "0a07f003-0000-4000-8000-000000000003",
  "0a07f004-0000-4000-8000-000000000004",
];
// doubles_elimination_tournaments_team_count_check requires team_count >= 40,
// so "one seat left" means 39 seeded teams, not 1.
const DE_CAPACITY = 40;

// Shop Phase 3: two buyers, one unit left. The invariant this protects is the
// SELECT ... FOR UPDATE inside shop_order_create — without it both racers read
// stock_on_hand = 1, both pass the sufficiency check, and both get an order.
// pgTAP cannot see that: it runs in ONE transaction, so it can pin the contract
// and never the race.
// First 12 hex chars differ per user (profile_slug is derived from them).
const P3_OWNER = "0a03e001-0000-4000-8000-000000000001";
const P3_BUYER1 = "0a03e002-0000-4000-8000-000000000002";
const P3_BUYER2 = "0a03e003-0000-4000-8000-000000000003";
const P3_SHOP = "0a03e101-0000-4000-8000-000000000001";
const P3_PRODUCT = "0a03e201-0000-4000-8000-000000000001";
const P3_VARIANT = "0a03e301-0000-4000-8000-000000000001";
const P3_PRICE = 1500000;
// Race 6 needs the PENDING CEILING to be the only thing that can refuse, so its
// variant is deliberately uncounted (stock_on_hand NULL): no deduction, no
// insufficient_stock, nothing but D8 left to decide the winner. Its own product
// too — product_variants_guard_options has opinions about a second variant
// sharing a product's option schema, and this harness is not the place to
// learn them.
const P3_PRODUCT_NC = "0a03e202-0000-4000-8000-000000000002";
const P3_VARIANT_NC = "0a03e302-0000-4000-8000-000000000002";
const P3_PRICE_NC = 200000;

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
  DELETE FROM auth.users WHERE id = '${USER2}';
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '${USER2}', '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'qa03-race-2@thepicklehub.test', '', NOW(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"QA-03 Race 2"}'::jsonb, NOW(), NOW()
  );
  -- DB-01c member race calls register_event_as_member, whose INSERT copies
  -- display_name from profiles (NOT NULL on event_registrations). The
  -- handle_new_user trigger normally creates these rows; make them explicit
  -- so the harness does not depend on trigger drift in the local db.
  UPDATE public.profiles SET display_name = 'QA-03 Race'   WHERE id = '${USER}'  AND COALESCE(display_name, '') = '';
  UPDATE public.profiles SET display_name = 'QA-03 Race 2' WHERE id = '${USER2}' AND COALESCE(display_name, '') = '';
  -- Exception-safe wrapper: register_event_as_member RAISEs on a full event,
  -- which would abort the racer session under ON_ERROR_STOP. Map it to text.
  CREATE OR REPLACE FUNCTION public.qa03_try_member_register(p_event UUID)
  RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $qa03$
  BEGIN
    PERFORM * FROM public.register_event_as_member(p_event, NULL);
    RETURN 'registered';
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLERRM;
  END $qa03$;
  ALTER TABLE public.event_registrations DISABLE TRIGGER USER;
  INSERT INTO public.social_events (
    id, slug, title_vi, start_at, end_at, created_by, max_players
  ) VALUES (
    '${EVENT}', 'qa03-race', 'QA-03 Race',
    NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', '${USER}', 2
  );
`);

// ─── Fixture: UX-07 doubles-elimination registration ────────────────────────

await psql(`
  DELETE FROM public.doubles_elimination_teams WHERE tournament_id = '${DE_TOURNAMENT}';
  DELETE FROM public.doubles_elimination_tournaments WHERE id = '${DE_TOURNAMENT}';
  DELETE FROM auth.users WHERE id IN (${DE_USERS.map((u) => `'${u}'`).join(", ")});
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
  ${DE_USERS.map(
    (u, i) => `(
      '${u}', '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'qa07-race-${i + 1}@thepicklehub.test', '', NOW(),
      '{"provider":"test","providers":["test"]}'::jsonb,
      '{"display_name":"QA-07 Racer ${i + 1}"}'::jsonb, NOW(), NOW()
    )`,
  ).join(",\n  ")};
  -- register_team_for_doubles_elimination rejects with MISSING_DUPR unless
  -- dupr_doubles_with_fallback returns a rating; that helper just reads
  -- profiles.dupr_doubles (falling back to dupr_singles), so seeding the
  -- column is enough — no dupr_link / webhook fixture needed.
  UPDATE public.profiles
  SET display_name = COALESCE(NULLIF(display_name, ''), 'QA-07 Racer'),
      dupr_doubles = 3.50
  WHERE id IN (${DE_USERS.map((u) => `'${u}'`).join(", ")});
  INSERT INTO public.doubles_elimination_tournaments (
    id, name, share_id, creator_user_id, team_count, status, rating_source
  ) VALUES (
    '${DE_TOURNAMENT}', 'QA-07 Race', 'qa07race', '${DE_USERS[0]}',
    ${DE_CAPACITY}, 'registration_open', 'dupr'
  );
`);

// ─── Fixture: Shop Phase 3 order race ───────────────────────────────────────

await psql(`
  DELETE FROM public.shop_orders WHERE shop_id = '${P3_SHOP}';
  -- inventory_movements is append-only by trigger. The local db is disposable
  -- and each round has to start from a clean ledger, so the trigger comes off
  -- for the duration and goes back on in the cleanup block.
  ALTER TABLE public.inventory_movements DISABLE TRIGGER inventory_movements_append_only_trg;
  DELETE FROM public.inventory_movements WHERE variant_id IN ('${P3_VARIANT}', '${P3_VARIANT_NC}');
  DELETE FROM public.product_variants WHERE id IN ('${P3_VARIANT}', '${P3_VARIANT_NC}');
  DELETE FROM public.products WHERE id IN ('${P3_PRODUCT}', '${P3_PRODUCT_NC}');
  DELETE FROM public.shop_members WHERE shop_id = '${P3_SHOP}';
  DELETE FROM public.shops WHERE id = '${P3_SHOP}';
  DELETE FROM auth.users WHERE id IN ('${P3_OWNER}', '${P3_BUYER1}', '${P3_BUYER2}');
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
  ${[P3_OWNER, P3_BUYER1, P3_BUYER2]
    .map(
      (u, i) => `(
      '${u}', '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'qa-p3-${i + 1}@thepicklehub.test', '', NOW(),
      '{"provider":"test","providers":["test"]}'::jsonb,
      '{"display_name":"QA P3 ${i + 1}"}'::jsonb, NOW(), NOW()
    )`,
    )
    .join(",\n  ")};
  INSERT INTO public.shops (id, slug, name, state, owner_user_id, ordering_enabled, shipping_fee_vnd)
  VALUES ('${P3_SHOP}', 'qa-p3-race', 'QA P3 Race', 'active', '${P3_OWNER}', true, 0);
  INSERT INTO public.shop_members (shop_id, user_id, role) VALUES ('${P3_SHOP}', '${P3_OWNER}', 'owner');
  -- status/is_published are pinned by products_guard_privileged_columns unless
  -- this flag is on; the shop RPCs set it the same way.
  SELECT set_config('shop.privileged_write', 'on', true);
  INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published)
  VALUES ('${P3_PRODUCT}', '${P3_SHOP}', 'qa-p3-vot-cuoi-cung', 'QA P3 Vợt Cuối Cùng',
          'Chỉ còn đúng một chiếc trong kho.', 'vot', 'approved', true);
  INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published)
  VALUES ('${P3_PRODUCT_NC}', '${P3_SHOP}', 'qa-p3-bong-khong-dem', 'QA P3 Bóng Không Đếm',
          'Shop này không đếm tồn của món này.', 'bong', 'approved', true);
  SELECT set_config('shop.privileged_write', 'off', true);
  INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, position)
  VALUES ('${P3_VARIANT}', '${P3_PRODUCT}', '${P3_SHOP}', ${P3_PRICE}, 1, 0);
  INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, position)
  VALUES ('${P3_VARIANT_NC}', '${P3_PRODUCT_NC}', '${P3_SHOP}', ${P3_PRICE_NC}, NULL, 0);
  -- shop_order_create RAISEs on refusal, which would abort the racer session
  -- under ON_ERROR_STOP before it could report anything. Map the refusal to
  -- text, keeping BOTH halves of the contract: the SQLSTATE and the reason.
  CREATE OR REPLACE FUNCTION public.qa_p3_try_order(p_token TEXT, p_variant UUID, p_price INT)
  RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $qap3$
  DECLARE _state TEXT; _detail TEXT; _reason TEXT;
  BEGIN
    PERFORM public.shop_order_create(
      p_token, 'cod', 'Người Mua QA', '0912345678',
      'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 0,
      jsonb_build_array(jsonb_build_object(
        'variant_id', p_variant, 'qty', 1,
        'expected_unit_price_vnd', p_price)));
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE, _detail = PG_EXCEPTION_DETAIL;
    BEGIN
      _reason := COALESCE((_detail::jsonb) ->> 'reason', '-');
    EXCEPTION WHEN OTHERS THEN
      _reason := '-';
    END;
    RETURN _state || '|' || _reason;
  END $qap3$;
`);

const p3Reset = () =>
  psql(`
    DELETE FROM public.shop_orders WHERE shop_id = '${P3_SHOP}';
    DELETE FROM public.inventory_movements WHERE variant_id = '${P3_VARIANT}';
    SELECT set_config('shop.stock_write', 'on', true);
    UPDATE public.product_variants SET stock_on_hand = 1 WHERE id = '${P3_VARIANT}';
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

  // ─── Race 3 (DB-01c): two concurrent MEMBER registrations, one seat left ─
  // register_event_as_member (unlike the guest/reactivate RPCs) validates
  // event status; the fixture event is created in the default draft state.
  await psql(
    `UPDATE public.social_events SET status = 'published' WHERE id = '${EVENT}'`,
  );
  const memberReg = (uid) =>
    `SELECT set_config('request.jwt.claims',
       '{"sub":"${uid}","role":"authenticated"}', false);
     SELECT public.qa03_try_member_register('${EVENT}')`;
  for (let i = 0; i < ROUNDS; i++) {
    await resetRegistrations();
    await psql(
      `INSERT INTO public.event_registrations (event_id, phone, display_name, status)
       VALUES ('${EVENT}', '+84900033000', 'Seed', 'registered')`,
    );
    const results = (await racePair(memberReg(USER), memberReg(USER2))).sort();
    check(
      results[0] === "event_full" && results[1] === "registered",
      `member_register round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    check(
      (await activeCount()) === "2",
      `member_register round ${i + 1}: active == max_players`,
    );
  }

  // ─── Race 4 (UX-07): two concurrent DE registrations, one seat left ──────
  // The RPC reads auth.uid(), so the JWT claim and the call must share ONE
  // simple-query message (same reason as memberReg above). The RPC returns
  // JSON rather than raising, so map it to the error code or 'registered'.
  const deReg = (caller, partner) =>
    `SELECT set_config('request.jwt.claims',
       '{"sub":"${caller}","role":"authenticated"}', false);
     SELECT COALESCE(
       public.register_team_for_doubles_elimination(
         '${DE_TOURNAMENT}', '${partner}')->>'error',
       'registered')`;
  const deTeamCount = () =>
    psql(
      `SELECT COUNT(*) FROM public.doubles_elimination_teams
       WHERE tournament_id = '${DE_TOURNAMENT}'`,
    );
  for (let i = 0; i < ROUNDS; i++) {
    await psql(`
      DELETE FROM public.doubles_elimination_teams WHERE tournament_id = '${DE_TOURNAMENT}';
      INSERT INTO public.doubles_elimination_teams (tournament_id, team_name, player1_name)
      SELECT '${DE_TOURNAMENT}', 'Seed ' || g, 'Seed P' || g
      FROM generate_series(1, ${DE_CAPACITY - 1}) g;
    `);
    const results = (
      await racePair(
        deReg(DE_USERS[0], DE_USERS[1]),
        deReg(DE_USERS[2], DE_USERS[3]),
      )
    ).sort();
    check(
      results[0] === "TOURNAMENT_FULL" && results[1] === "registered",
      `de_register round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    check(
      (await deTeamCount()) === String(DE_CAPACITY),
      `de_register round ${i + 1}: teams == team_count`,
    );
  }

  // ─── Race 5 (Shop P3): two buyers, the LAST unit ─────────────────────────
  // The JWT claim and the RPC call travel in ONE simple-query message for the
  // same reason as memberReg: a client round-trip between them reopens the
  // sequential window that made this kind of test false-green before.
  const p3Order = (uid, token, variant = P3_VARIANT, price = P3_PRICE) =>
    `SELECT set_config('request.jwt.claims',
       '{"sub":"${uid}","role":"authenticated"}', false);
     SELECT public.qa_p3_try_order('${token}', '${variant}', ${price})`;

  for (let i = 0; i < ROUNDS; i++) {
    await p3Reset();
    const results = (
      await racePair(
        p3Order(P3_BUYER1, `qa-p3-${i}-1`),
        p3Order(P3_BUYER2, `qa-p3-${i}-2`),
      )
    ).sort();
    // 'PT409|insufficient_stock' sorts before 'ok'. Two 'ok's — the failure the
    // missing lock produces — fails here rather than being averaged away.
    check(
      results[0] === "PT409|insufficient_stock" && results[1] === "ok",
      `shop_order_create round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    check(
      (await psql(
        `SELECT COUNT(*) FROM public.shop_orders WHERE shop_id = '${P3_SHOP}'`,
      )) === "1",
      `shop_order_create round ${i + 1}: exactly one order exists`,
    );
    check(
      (await psql(
        `SELECT stock_on_hand FROM public.product_variants WHERE id = '${P3_VARIANT}'`,
      )) === "0",
      `shop_order_create round ${i + 1}: stock lands on 0 and never below`,
    );
    check(
      (await psql(
        `SELECT COUNT(*) FROM public.inventory_movements
         WHERE variant_id = '${P3_VARIANT}' AND reason = 'sale'`,
      )) === "1",
      `shop_order_create round ${i + 1}: exactly one 'sale' ledger row`,
    );
    check(
      (await psql(
        `SELECT COALESCE(SUM(delta), 0) FROM public.inventory_movements
         WHERE variant_id = '${P3_VARIANT}' AND reason = 'sale'`,
      )) === "-1",
      `shop_order_create round ${i + 1}: total 'sale' delta is -1`,
    );
  }

  // ─── Race 6 (Shop P3, D8): the FIFTH pending order, twice at once ────────
  // The ceiling is a COUNT followed by an INSERT, and the unique
  // (buyer_user_id, client_token) cannot referee it: the two requests carry
  // DIFFERENT tokens. Without pg_advisory_xact_lock in shop_order_create both
  // racers count 4, both insert, and the buyer holds 6 pending orders.
  // Uncounted variant on purpose — stock must have no say in who wins.
  for (let i = 0; i < ROUNDS; i++) {
    await psql(`
      DELETE FROM public.shop_orders WHERE shop_id = '${P3_SHOP}';
      SELECT set_config('request.jwt.claims',
        '{"sub":"${P3_BUYER1}","role":"authenticated"}', false);
      SELECT public.qa_p3_try_order('qa-p3-seed-${i}-' || g, '${P3_VARIANT_NC}', ${P3_PRICE_NC})
      FROM generate_series(1, 4) g;
    `);
    const results = (
      await racePair(
        p3Order(P3_BUYER1, `qa-p3-lim-${i}-a`, P3_VARIANT_NC, P3_PRICE_NC),
        p3Order(P3_BUYER1, `qa-p3-lim-${i}-b`, P3_VARIANT_NC, P3_PRICE_NC),
      )
    ).sort();
    // 'PT429|too_many_pending' sorts before 'ok'. Two 'ok's — what the missing
    // lock produces — fails here instead of being averaged away.
    check(
      results[0] === "PT429|too_many_pending" && results[1] === "ok",
      `pending_limit round ${i + 1}/${ROUNDS}: exactly one winner (got: ${results.join(", ")})`,
    );
    check(
      (await psql(
        `SELECT COUNT(*) FROM public.shop_orders
         WHERE buyer_user_id = '${P3_BUYER1}' AND status = 'pending'`,
      )) === "5",
      `pending_limit round ${i + 1}: buyer holds exactly 5 pending orders`,
    );
  }
} finally {
  // ─── Cleanup (the local db is disposable, but leave it consistent) ────────
  await psql(`
    ALTER TABLE public.event_registrations ENABLE TRIGGER USER;
    DROP FUNCTION IF EXISTS public.qa03_try_member_register(UUID);
    DELETE FROM public.event_registrations WHERE event_id = '${EVENT}';
    DELETE FROM public.social_events WHERE id = '${EVENT}';
    DELETE FROM auth.users WHERE id = '${USER}';
    DELETE FROM auth.users WHERE id = '${USER2}';
    DELETE FROM public.doubles_elimination_teams WHERE tournament_id = '${DE_TOURNAMENT}';
    DELETE FROM public.doubles_elimination_tournaments WHERE id = '${DE_TOURNAMENT}';
    DELETE FROM auth.users WHERE id IN (${DE_USERS.map((u) => `'${u}'`).join(", ")});
    DROP FUNCTION IF EXISTS public.qa_p3_try_order(TEXT, UUID, INT);
    DELETE FROM public.shop_orders WHERE shop_id = '${P3_SHOP}';
    DELETE FROM public.inventory_movements WHERE variant_id IN ('${P3_VARIANT}', '${P3_VARIANT_NC}');
    ALTER TABLE public.inventory_movements ENABLE TRIGGER inventory_movements_append_only_trg;
    DELETE FROM public.product_variants WHERE id IN ('${P3_VARIANT}', '${P3_VARIANT_NC}');
    DELETE FROM public.products WHERE id IN ('${P3_PRODUCT}', '${P3_PRODUCT_NC}');
    DELETE FROM public.shop_members WHERE shop_id = '${P3_SHOP}';
    DELETE FROM public.shops WHERE id = '${P3_SHOP}';
    DELETE FROM auth.users WHERE id IN ('${P3_OWNER}', '${P3_BUYER1}', '${P3_BUYER2}');
  `);
}

// 5 races × 2 assertions + 1 race × 5 assertions, every round.
console.log(
  failures === 0 ? `\nAll ${ROUNDS * 15} race assertions passed.` : `\n${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
