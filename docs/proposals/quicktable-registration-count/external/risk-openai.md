## Verdict: reject

This ships two concrete production failures.

### 1. The badge reports false registration numbers

**Mechanism:** `count=exact` counts every RLS-visible row because there is no `status='approved'` filter.

**Trigger:** Any tournament retains pending or rejected registrations.

**User-visible symptom:** Rejected teams are advertised as active registrations. With current production data, the team-match badges would sum to **19 registered**, while only **15 are approved**. The three rejected and one pending teams inflate affected cards. QuickTable counts will have the same problem once visible rows exist.

For team matches, the query counts **teams**, not people, so `"12 registered"` is also ambiguous; it should at least say `"12 teams registered"`.

RLS makes QuickTable counts viewer-dependent rather than canonical. Anonymous users count only rows allowed by the parent-public policy, while a creator can count rows on their own non-public parent. If such a bracket appears on the public list, anonymous users can see `0 registered` while its creator sees a nonzero value.

### 2. It creates an avoidable request storm

**Mechanism:** One PostgREST request and one exact-count database statement per rendered card.

**Trigger:** Opening the completed tabs or moving through all list tabs.

**Operator/user symptom:**

- Completed QuickTables: up to **100** count requests.
- Completed team matches: up to **100** more.
- Open/active lists add up to roughly **60** more.
- A user visiting all relevant tabs can therefore generate about **260 extra REST/database operations**.

HTTP/2 may multiplex them, but it does not turn them into one database query. On mobile, badges will appear late or remain failed when requests time out or are throttled. Under concurrent traffic, Supabase receives bursts of independent exact-count queries for a decorative badge. Copying an existing N+1 hook does not make that acceptable for 100-card lists.

### Privacy finding

The proposed `HEAD` requests do **not directly return** `captain_user_id`, `invite_code`, or `payment_status`, so this change itself does not leak those values in its response body.

However, anonymous users can already retrieve those fields because of the existing team-match RLS/API exposure. That is a separate live security defect and should be fixed immediately. Rolling back this badge will not fix it.

### Rollback

Because there is no migration, frontend rollback is straightforward and stops new clients from issuing the requests. It cannot retract counts already observed, and it has no effect on the existing invite-code exposure.

### Required shape before shipping

Use one batched, public-safe query/RPC/view that returns grouped **approved** counts for all displayed parent IDs. Return only parent ID and count, and label team counts as teams. Also remove anonymous row-level access to team secrets rather than relying on clients to use `HEAD`.