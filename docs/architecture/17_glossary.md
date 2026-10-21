# Project glossary

| Term | Meaning in this repository |
|---|---|
| ThePickleHub | Product/platform represented by this monorepo |
| The Line | Current global visual token/theme layer (`the-line.css`) |
| organization | Creator/publisher entity owning media and some tournaments |
| creator | role allowed to manage organization content; admin also satisfies creator UI checks |
| club | social-play community with managers/members/events; distinct from organization and DUPR club link |
| social event | club-hosted registration/live-match event, distinct from tournament-engine rows |
| quick table | lightweight tournament tool with groups, round robin and optional large playoff |
| parent tournament | container attaching multiple quick tables |
| team match | tournament where registered teams contest a configurable series of games |
| game template | definition/order of individual games inside each team-vs-team match |
| total score mode | team-match winner mode based on accumulated points rather than games won |
| RR / round robin | every entity in a group plays the other entities using circle-method scheduling |
| `rr_playoff` | team-match format with round-robin/group phase followed by elimination bracket |
| repechage / Tái sinh | optional secondary team-match playoff branch for lower-ranked qualifiers |
| doubles elimination | staged winner/loser/merge tournament followed by seeded single elimination |
| R1/R2/R3 | initial doubles-elimination winner, loser and merge stages |
| BO1/BO3/BO5 | best-of match formats requiring 1/2/3 game wins |
| flex tournament | configurable engine supporting players/teams/groups and parent-child matches |
| seed | deterministic ranking/position used to construct group or bracket pairings |
| wildcard | quick-table qualifier outside normal group seed selection |
| standings | aggregate match/game/point record used for display and seeding |
| score version | optimistic-concurrency integer required by atomic score RPCs |
| referee PIN | short-lived/scoped capability enabling score access without broad ownership |
| magic token | unguessable registration capability used by guests for recovery/payment/cancel/score |
| ghost profile | `profiles.is_ghost=true` participant identity without an `auth.users` account, created for guests/pro-tour/invites and mergeable into a verified real profile |
| DUPR | external pickleball rating/identity system |
| exact/approx DUPR seed | provenance indicating complete versus fallback/partial rating data |
| livestream scheduled/live/ended | persistent stream lifecycle states |
| live playback ID | Mux playback identifier used during a broadcast |
| asset playback ID | Mux VOD identifier used for ended-stream replay |
| stream key | secret Mux ingest credential used by OBS; never public content |
| presence | ephemeral Supabase Realtime membership used for concurrent viewers/users |
| view count | persisted/deduplicated aggregate, not equivalent to presence |
| crawler rendering | Cloudflare Pages path that returns metadata/content HTML rather than the SPA shell |
| mirrored route | one route definition rendered at both English and `/vi` paths |
| auth registry | strict JSON classification of every Edge Function's accepted actors/credentials |
| shop pilot | migration-backed seller application/approval surfaces; distinct from the prototype and broader native shop client whose backend contract is incomplete here |
| remote-wrapper mode | Capacitor mode where `server.url` loads the hosted site rather than primarily executing bundled `dist` assets |
| contract drift | a caller names a table/RPC/bucket not defined by included migrations/generated types; it may exist remotely but is not canonical evidence |
| Edge skeleton | registered handler that authenticates but deliberately performs no planned business operation (`leaderboard-compute`, `notification-send`) |
