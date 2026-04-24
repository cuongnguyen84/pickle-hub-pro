-- ============================================================================
-- Newsletter subscribers — The Daily Brief (homepage signup)
--
-- This migration is MANUAL: apply via Supabase Dashboard SQL Editor per
-- .claude/memory/lessons-learned.md (avoid CLI db push — 40+ stale
-- migrations in this project make push risky).
-- ============================================================================

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  language text check (language in ('en', 'vi')) default 'en',
  -- Where the signup came from (e.g. 'the-line-homepage') — attribution
  source text default 'the-line-homepage',
  -- Double-opt-in flag: set true after user clicks email confirmation link
  confirmed boolean default false,
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz
);

create index if not exists newsletter_subscribers_email_idx
  on public.newsletter_subscribers (email);

create index if not exists newsletter_subscribers_source_idx
  on public.newsletter_subscribers (source);

alter table public.newsletter_subscribers enable row level security;

-- Only service_role (edge function) can insert. Frontend cannot write
-- directly — it must go through the rate-limited edge function.
create policy "service role insert" on public.newsletter_subscribers
  for insert
  to service_role
  with check (true);

-- No SELECT policy for anon/authenticated — subscriber list is admin-only.
-- Admins read via service_role or a dedicated admin dashboard RPC.

-- Allow service_role to update (for confirmed_at, unsubscribed_at)
create policy "service role update" on public.newsletter_subscribers
  for update
  to service_role
  using (true);
