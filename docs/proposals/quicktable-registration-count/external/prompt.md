# Brief: registration-count social-proof badge on tournament list cards

## Product
ThePickleHub — bilingual Vietnamese-English pickleball web app. Audience ~95% Vietnamese, mobile-dominant (mid-tier Android on 4G), also a Capacitor native shell. VI is the primary language; EN secondary. Users usually arrive from a Facebook deep link.

## The feature (approved by founder)
On the `/tournaments` list page, "Community" tab, "Quick Tables" format (a round-robin bracket tool), show the REAL number of people/teams who have registered for each open bracket, as a social-proof signal to pull more sign-ups. No hard capacity cap is shown — just the real count. Shown to anonymous users too.

Goal: social proof / momentum ("14 người đã đăng ký" makes others join). Founder's own caveat: social proof only works when the number is big enough; "1 người đã đăng ký" makes the bracket look DEAD and backfires.

## The exact current card (mobile, ~390px wide)
Each bracket is a compact horizontal ROW (not a big card), class `tl-bracket-row`:
- Left: 8px colored accent bar (format color).
- Body: bracket name (15px, one line, ellipsis) + a meta line in 11px monospace grey: currently `"Đôi · 16 người chơi · Round robin"` (Doubles · 16 players · Round robin) then `·` then relative time ("2 giờ trước").
- Middle-right: creator display name (11px grey, HIDDEN on narrow mobile).
- Far right: a status pill (uppercase 10px mono): e.g. "ĐANG MỞ ĐĂNG KÝ" (Registering, blue), "ĐANG DIỄN RA" (Live, green), "CHUẨN BỊ" (Setup, gold), "ĐÃ KẾT THÚC" (Completed, grey).

## Critical data reality (constraint)
- The `16 người chơi` number in the meta line today is the QUOTA / capacity set at creation, NOT the number registered. So the card already shows one number that looks like a count.
- The REAL registered count lives in a separate table and only exists for brackets created with `requires_registration = true`. Many Quick Tables are ad-hoc: the creator just types the players in directly, no "registration" concept — for those, count == the roster already playing.
- Getting the real count means one extra COUNT query per card (N+1 fan-out) on 4G. Perf budget: LCP ≤ 2.5s, INP ≤ 200ms on Vietnam-segment p75.
- The list includes brackets in statuses: setup, group_stage, playoff (ongoing), completed. A "registered" count only makes sense while registration is open (setup / "registration").

## Prior art in the same app
Social EVENT cards (different page, `/social`) show `12/16` with a small Users icon, plus "· còn ít chỗ" (few spots) when ≤4 spots remain. But social events HAVE a hard max; Quick Tables intentionally do NOT show a cap here.

## Questions — be concrete, give exact strings
1. Copy VI/EN. Singles vs doubles differ (người vs đội). Should it be "14 người đã đăng ký", short "14 đã đăng ký", or X/Y? Give the exact strings for singles and doubles, VI and EN, that fit an 11px meta line on 390px.
2. Anti-social-proof threshold. Below what N do we hide the count to avoid making brackets look dead? Give a number and reasoning. Or a different approach (e.g. show count only above N; below it show the existing "Đang mở đăng ký" pill).
3. Placement + hierarchy on this compact row. Where does the count go? Does it collide with the existing quota number (two numbers = confusion)? Should we REPLACE the quota "16 người chơi" with the live registered count for open-registration brackets? Should the count ever be more prominent than the status pill?
4. Should this only apply to `requires_registration=true` brackets in setup/registration status, and be omitted otherwise? What about doubles where count == teams?
5. Accessibility: color/contrast for the badge, aria/screen-reader wording, is it tappable (whole row is already a link).
6. Rank each recommendation as Blocker / Should-fix / Nit.

Name the exact element and the exact fix. No generic design platitudes.
