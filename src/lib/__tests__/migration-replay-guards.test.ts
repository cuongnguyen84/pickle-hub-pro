import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const replayGuardFiles: Array<[string, string[]]> = [
  [
    "20260123031644_ba72a3b6-53eb-45e0-9817-8d6575716f12.sql",
    ["DROP FUNCTION IF EXISTS public.lookup_user_by_email(TEXT);"],
  ],
  [
    "20260422000001_admin_analytics.sql",
    [
      "DROP FUNCTION IF EXISTS public.get_new_users_daily(DATE, DATE);",
      "DROP FUNCTION IF EXISTS public.get_content_stats(DATE, DATE);",
      "DROP FUNCTION IF EXISTS public.get_engagement_stats(DATE, DATE);",
      "DROP FUNCTION IF EXISTS public.get_top_content(DATE, DATE);",
    ],
  ],
  [
    "20260422000002_homepage_stats_rpc.sql",
    ["DROP FUNCTION IF EXISTS public.get_homepage_stats();"],
  ],
  [
    "20260422000003_fix_homepage_stats_source.sql",
    ["DROP FUNCTION IF EXISTS public.get_homepage_stats();"],
  ],
  [
    "20260422000004_fix_homepage_stats_total_tournaments.sql",
    ["DROP FUNCTION IF EXISTS public.get_homepage_stats();"],
  ],
  [
    "20260425000000_blog_post_views.sql",
    [
      "DROP FUNCTION IF EXISTS public.get_blog_post_view_count(blog_lang, TEXT);",
      "DROP FUNCTION IF EXISTS public.get_blog_post_view_counts_batch(JSONB);",
    ],
  ],
  [
    "20260425000001_blog_post_seed_views.sql",
    [
      "DROP FUNCTION IF EXISTS public.get_blog_post_view_count(blog_lang, TEXT);",
      "DROP FUNCTION IF EXISTS public.get_blog_post_view_counts_batch(JSONB);",
    ],
  ],
  [
    "20260508120001_fix_feed_pagination_tiebreaker.sql",
    [
      "DROP FUNCTION IF EXISTS public.get_following_feed(UUID, INT, TIMESTAMPTZ, UUID);",
      "DROP FUNCTION IF EXISTS public.get_trending_feed(INT, TIMESTAMPTZ, UUID, INT, INT, INT);",
    ],
  ],
  [
    "20260512140001_create_social_event_with_payment_rpc.sql",
    [
      "DROP FUNCTION IF EXISTS public.create_social_event_with_payment(JSONB, JSONB);",
    ],
  ],
  [
    "20260512180000_event_registration_cancellation.sql",
    ["DROP FUNCTION IF EXISTS public.get_registration_by_token(UUID);"],
  ],
  [
    "20260513140000_event_prepayment_required.sql",
    [
      "DROP FUNCTION IF EXISTS public.create_social_event_with_payment(JSONB, JSONB);",
      "DROP FUNCTION IF EXISTS public.get_registration_by_token(UUID);",
    ],
  ],
  [
    "20260514100000_extend_get_registration_by_token.sql",
    ["DROP FUNCTION IF EXISTS public.get_registration_by_token(UUID);"],
  ],
  [
    "20260517000000_tournament_results_feed.sql",
    [
      "DROP FUNCTION IF EXISTS public.get_trending_feed(integer, timestamp with time zone, uuid, uuid, integer, integer, integer, integer);",
    ],
  ],
  [
    "20260521120000_social_event_slots.sql",
    [
      "DROP FUNCTION IF EXISTS public.create_social_event_with_payment(JSONB, JSONB);",
    ],
  ],
  [
    "20260521130000_club_managers.sql",
    ["DROP FUNCTION IF EXISTS public.search_profile_for_manager(TEXT);"],
  ],
  [
    "20260522120000_club_members.sql",
    [
      "DROP FUNCTION IF EXISTS public.list_club_members(UUID);",
      "DROP FUNCTION IF EXISTS public.register_event_as_member(UUID, TEXT);",
    ],
  ],
  [
    "20260522180000_authed_user_skip_otp.sql",
    ["DROP FUNCTION IF EXISTS public.register_event_as_member(UUID, TEXT);"],
  ],
  [
    "20260522190000_fix_register_member_ambiguous_column.sql",
    ["DROP FUNCTION IF EXISTS public.register_event_as_member(UUID, TEXT);"],
  ],
  [
    "20260525120000_club_match_log.sql",
    ["DROP FUNCTION IF EXISTS public.list_club_matches(UUID, INTEGER);"],
  ],
  [
    "20260527110000_club_members_gate_roster.sql",
    ["DROP FUNCTION IF EXISTS public.list_club_members(UUID);"],
  ],
  [
    "20260528010000_dupr_leaderboard_vietnam_rpc.sql",
    ["DROP FUNCTION IF EXISTS public.dupr_leaderboard_vietnam(TEXT, INT);"],
  ],
  [
    "20260528020000_dupr_players_near_rating_rpc.sql",
    [
      "DROP FUNCTION IF EXISTS public.dupr_players_near_rating(NUMERIC, NUMERIC, UUID, INT);",
    ],
  ],
  [
    "20260528040000_rpcs_filter_is_public_profile.sql",
    [
      "DROP FUNCTION IF EXISTS public.dupr_leaderboard_vietnam(TEXT, INT);",
      "DROP FUNCTION IF EXISTS public.dupr_players_near_rating(NUMERIC, NUMERIC, UUID, INT);",
    ],
  ],
  [
    "20260610100000_admin_analytics_guard.sql",
    [
      "DROP FUNCTION IF EXISTS public.get_new_users_daily(DATE, DATE);",
      "DROP FUNCTION IF EXISTS public.get_content_stats(DATE, DATE);",
      "DROP FUNCTION IF EXISTS public.get_engagement_stats(DATE, DATE);",
      "DROP FUNCTION IF EXISTS public.get_top_content(DATE, DATE);",
    ],
  ],
];

describe("production-seeded migration replay guards", () => {
  it.each(replayGuardFiles)(
    "%s drops evolving RPC signatures before recreating them",
    (file, guards) => {
      const sql = readFileSync(
        new URL(`../../../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      );

      for (const guard of guards) {
        const dropIndex = sql.indexOf(guard);
        const functionName = guard.match(/public\.([a-z_]+)/)?.[1];
        const qualifiedCreate = `CREATE OR REPLACE FUNCTION public.${functionName}`;
        const unqualifiedCreate = `CREATE OR REPLACE FUNCTION ${functionName}`;
        const createIndex = Math.max(
          sql.indexOf(qualifiedCreate, dropIndex),
          sql.indexOf(unqualifiedCreate, dropIndex),
        );

        expect(dropIndex, `${file}: missing ${guard}`).toBeGreaterThanOrEqual(
          0,
        );
        expect(
          createIndex,
          `${file}: ${guard} must precede its CREATE OR REPLACE`,
        ).toBeGreaterThan(dropIndex);
      }
    },
  );

  it("defers and replaces the historical registration payment constraint", () => {
    const foundation = readFileSync(
      new URL(
        "../../../supabase/migrations/20260511120000_social_events_foundation.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const prepayment = readFileSync(
      new URL(
        "../../../supabase/migrations/20260513140000_event_prepayment_required.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(foundation).toContain(
      "CHECK (payment_status IN ('unpaid', 'paid', 'refunded')) NOT VALID;",
    );
    expect(prepayment).toContain(
      "DROP CONSTRAINT IF EXISTS event_registrations_payment_check;",
    );
    expect(
      prepayment.indexOf("event_registrations_payment_check;"),
    ).toBeLessThan(
      prepayment.indexOf(
        "ADD CONSTRAINT event_registrations_payment_status_check",
      ),
    );
  });

  it("creates the legacy user badge index only while user_id exists", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260512150000_user_badges.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const columnGuard = "AND column_name = 'user_id'";
    const legacyIndex = "CREATE INDEX IF NOT EXISTS idx_user_badges_user_id";

    expect(sql).toContain(columnGuard);
    expect(sql.indexOf(columnGuard)).toBeLessThan(sql.indexOf(legacyIndex));
  });

  it("drops the production club listing before replaying its older shape", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260512160000_clubs_self_service.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const dropView = "DROP VIEW IF EXISTS public.club_listing;";
    const createView = "CREATE VIEW public.club_listing AS";

    expect(sql).toContain(dropView);
    expect(sql.indexOf(dropView)).toBeLessThan(sql.indexOf(createView));
  });

  it("drops the existing news source foreign key before recreating it", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260519000000_news_aggregator_phase_1.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const dropConstraint =
      "DROP CONSTRAINT IF EXISTS news_items_source_id_fkey;";
    const addConstraint = "ADD CONSTRAINT news_items_source_id_fkey";

    expect(sql).toContain(dropConstraint);
    expect(sql.indexOf(dropConstraint)).toBeLessThan(
      sql.indexOf(addConstraint),
    );
  });

  it("drops the active news sources policy before recreating it", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260519000000_news_aggregator_phase_1.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const dropPolicy =
      'DROP POLICY IF EXISTS "Active news sources are publicly readable"';
    const createPolicy =
      'CREATE POLICY "Active news sources are publicly readable"';

    expect(sql).toContain(dropPolicy);
    expect(sql.indexOf(dropPolicy)).toBeLessThan(sql.indexOf(createPolicy));
  });

  it("drops every club manager policy before recreating it", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260521130000_club_managers.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const policies = [
      ...sql.matchAll(/CREATE POLICY "([^"]+)" ON public\.([a-z_]+)/g),
    ];

    expect(policies.length).toBeGreaterThan(0);

    for (const policy of policies) {
      const [, name, table] = policy;
      const dropPolicy = `DROP POLICY IF EXISTS "${name}" ON public.${table};`;
      const dropIndex = sql.indexOf(dropPolicy);

      expect(dropIndex, `missing ${dropPolicy}`).toBeGreaterThanOrEqual(0);
      expect(
        dropIndex,
        `${dropPolicy} must precede its CREATE POLICY`,
      ).toBeLessThan(policy.index);
    }
  });

  it("makes feed embed schema evolution replayable", () => {
    const feedEmbeds = readFileSync(
      new URL(
        "../../../supabase/migrations/20260704100000_feed_embeds.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const feedSources = readFileSync(
      new URL(
        "../../../supabase/migrations/20260704110000_feed_embed_sources.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(feedEmbeds).toContain(
      "CREATE TABLE IF NOT EXISTS public.feed_embeds",
    );
    expect(feedEmbeds).toContain(
      "CREATE INDEX IF NOT EXISTS idx_feed_embeds_active_published",
    );
    expect(feedSources).toContain(
      "CREATE TABLE IF NOT EXISTS public.feed_embed_sources",
    );
    expect(feedSources).toContain("ADD COLUMN IF NOT EXISTS shortcode text");
    expect(feedSources).toContain(
      "ADD COLUMN IF NOT EXISTS source_username text",
    );

    const dropConstraint =
      "DROP CONSTRAINT IF EXISTS feed_embeds_shortcode_key;";
    const addConstraint =
      "ADD CONSTRAINT feed_embeds_shortcode_key UNIQUE (shortcode);";
    expect(feedSources).toContain(dropConstraint);
    expect(feedSources.indexOf(dropConstraint)).toBeLessThan(
      feedSources.indexOf(addConstraint),
    );

    for (const sql of [feedEmbeds, feedSources]) {
      const policies = [
        ...sql.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.([a-z_]+)/g),
      ];
      expect(policies.length).toBeGreaterThan(0);

      for (const policy of policies) {
        const [, name, table] = policy;
        const dropPolicy = `DROP POLICY IF EXISTS "${name}" ON public.${table};`;
        expect(sql.indexOf(dropPolicy)).toBeLessThan(policy.index);
      }
    }
  });

  it("makes feed highlights setup replayable", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260705090000_feed_highlights.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.feed_highlights");
    expect(sql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_feed_highlights_active_published",
    );

    const policies = [
      ...sql.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.([a-z_]+)/g),
    ];
    expect(policies).toHaveLength(2);

    for (const policy of policies) {
      const [, name, table] = policy;
      const dropPolicy = `DROP POLICY IF EXISTS "${name}" ON public.${table};`;
      expect(sql.indexOf(dropPolicy)).toBeLessThan(policy.index);
    }
  });

  it("adds chat room settings to realtime only when absent", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260707140000_chat_room_settings_realtime.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const membershipGuard = "FROM pg_publication_tables";
    const addTable =
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_settings;";

    expect(sql).toContain("IF NOT EXISTS (");
    expect(sql).toContain(membershipGuard);
    expect(sql.indexOf(membershipGuard)).toBeLessThan(sql.indexOf(addTable));
  });
});
