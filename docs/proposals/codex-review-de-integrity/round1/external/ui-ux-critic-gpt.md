# GPT-5.6 external review — ui-ux-critic

Model: openai/gpt-5.6 · via scripts/agents/ask-model.mjs · 2026-07-21

## PROMPT (brief sent)

```markdown
# UX review brief — ThePickleHub (pickleball app, ~95% Vietnamese, mobile-first, mid-tier Android on 4G)

Reviewer cannot see the repo. All context is here. Audience: Vietnamese pickleball players arriving from a Facebook deep link to a single tournament page, one-handed, court-side, 390px viewport. VI is primary language; EN is secondary. Bilingual required.

Two small user-facing UI changes are proposed (the rest of the parent task is hidden telemetry — ignore). Give specific, concrete critique: name the element, name the fix, give exact VI + EN copy. No platitudes.

## TOUCH POINT 1 — QuickTable "open registration" card, progress bar

Context: On home + tournament list, each open "QuickTable" (an ad-hoc tournament) renders a card. The card shows: an "OPEN" badge, the tournament name, "{player_count} players/pairs" (player_count = the CAPACITY configured at creation, e.g. 16), a small progress bar labeled "Slots filled" (VI: "Đã đăng ký"), and a "Register Now" button.

The bug: the progress bar fill is HARD-CODED to width:'25%'. Every open tournament always shows a 25%-full bar regardless of reality. So a court-side player always sees "mostly empty, lots of room."

Product constraints from the owner (fixed decisions, do not relitigate):
- NO hard cap. Registration is NOT capped at player_count. Players may exceed it. player_count is a soft target, not a limit.
- Registration is an APPLICATION: a signup creates a `pending` row that an organizer later approves. Signing up does NOT grant a confirmed seat.
- Owner wants: show the REAL count as "actual signups / player_count", plus a gentle warning when signups exceed player_count. Do NOT block anyone.
- Getting the real signup count requires an extra COUNT query per table (currently not fetched). On 4G, an N+1 count per card in a list is a perf concern.

Questions:
1. Is a fill-toward-capacity progress bar even the right metaphor for an UNCAPPED, application-based (pending) flow? Does a % bar falsely promise a limited quota / a granted seat? Would a plain count be more honest?
2. Exact VI + EN copy for: (a) normal state e.g. 12 of 16; (b) over-target state e.g. 18 of 16 — worded so it does NOT alarm ("giải đã quá chỗ" reads scary in VI; suggest calmer). Remember VI runs longer than EN and can break a small card.
3. The label: EN currently "Slots filled" implies granted seats — wrong for pending applications. Better EN label? VI currently "Đã đăng ký" (= "registered/applied") — is that honest enough?
4. Severity: blocker / should-fix / nit? It is decorative and low real-estate, but permanently shows fake data.

## TOUCH POINT 2 — anonymous CTA on two other tournament types

Two other tournament formats have a broken anonymous entry:
- "DoublesElimination" tournament page: an anonymous (not-logged-in) visitor sees ONLY static text "Đăng nhập để đăng ký đội." ("Sign in to register a team.") — plain text, NO tappable button.
- "TeamMatch" tournament page: an anonymous visitor sees NOTHING where the register CTA would be — the CTA is gated behind `&& user`, so anon gets a dead-end with no path to participate.

A player arrives from a Facebook link to one of these pages, wants to join, is not logged in.

The parent task wants to add a real tappable "Sign in to register" CTA here (partly to measure a login-wall funnel). 

Questions:
1. Independent of any analytics goal — is the current state (static "please sign in" text with no button / no CTA at all) a genuinely bad UX dead-end worth fixing on its own merit? Or is adding a button just analytics theater?
2. If we add the CTA: exact VI + EN copy, placement, and accessibility (min 44px touch target — a recent change enforced 44px hit areas). Should the button route to /login and return the user to this page after login (redirect back)?
3. There is also a native mobile app (SwiftUI) that mirrors these screens. The analytics is web-only by design. Native users are usually already logged in. Should the native app get the same CTA in the same batch, or is that out of scope for a web-analytics-driven change?

Keep it tight. Exact strings, exact placement, severity per issue.
```

## REPLY

## 1. QuickTable registration count

### Recommendation: remove the progress bar

A fill-toward-capacity bar is the wrong metaphor because:

- `player_count` is a soft target, not a limit.
- Registration remains open above the target.
- A signup is an application, not a confirmed seat.
- A percentage bar implies both a finite quota and increasing scarcity.

Replace the entire **“Slots filled” progress-bar block** with a plain application count.

### Exact card copy

| State | VI | EN |
|---|---|---|
| Normal, 12 of target 16 | **12 lượt đăng ký / mục tiêu 16** | **12 applications / target 16** |
| Over target, count line | **18 lượt đăng ký / mục tiêu 16** | **18 applications / target 16** |
| Over-target helper, separate line | **Vẫn nhận đăng ký** | **Still accepting applications** |

Put the over-target helper on its own line or a neutral status chip below the count. Do not cram it into the count line on a 390px card. Use neutral brand/blue styling, not red or warning-triangle styling.

Avoid:

- **“Quá chỗ” / “Full” / “Over capacity”**
- **“Còn X chỗ” / “X spots left”**
- Any percentage

### Label fix

Replace:

- VI: **“Đã đăng ký”**
- EN: **“Slots filled”**

With:

- VI: **“Lượt đăng ký”**
- EN: **“Applications”**

“Đã đăng ký” is not strictly false, but **“Lượt đăng ký”** makes it clearer that this is a count of submitted registrations. “Slots filled” is incorrect because no seat has been granted.

Also relabel the existing capacity text so it cannot be read as a cap:

- VI: **“Mục tiêu: 16 người/cặp”**
- EN: **“Target: 16 players/pairs”**

If the card’s registration button currently says “Register Now,” align it with the application model:

- VI: **“Gửi đăng ký”**
- EN: **“Apply now”**

The registration flow should state:

- VI: **“Đăng ký cần được ban tổ chức phê duyệt.”**
- EN: **“Your application requires organizer approval.”**

### Data-loading fix

Do not add one COUNT request per card. Add `application_count` to the home/list response using one grouped query keyed by QuickTable ID, for example a server-side `GROUP BY quick_table_id`.

Define the count consistently—normally all active applications, excluding cancelled/withdrawn rows. While loading, show a short text skeleton. If the count fails, omit the count block; never fall back to `25%` or `0 / 16`.

### Severity: **Should-fix**

It is not a registration blocker, but it permanently presents fabricated availability and can directly affect whether someone applies. Remove the hard-coded bar even if the real count cannot ship immediately.

---

## 2. Anonymous registration CTA

### Current state

Yes, both are genuine UX dead ends, not analytics theater:

- **DoublesElimination:** tells the user to sign in but gives no way to do it.
- **TeamMatch:** gives an anonymous visitor no explanation and no next action.

### Exact CTA copy

**DoublesElimination**

- VI: **“Đăng nhập để đăng ký đội”**
- EN: **“Sign in to register a team”**

**TeamMatch**

- VI: **“Đăng nhập để đăng ký”**
- EN: **“Sign in to register”**

If TeamMatch also specifically registers a team rather than an individual, use the same team-specific copy as DoublesElimination.

### Placement

Render the anonymous CTA in the **exact same registration-action slot used for the authenticated Register button**:

- Immediately below the registration status/eligibility information
- Before the teams, bracket, or match content
- Full width on mobile
- Do not leave the DoublesElimination instruction as separate plain text; replace it with the button

### Navigation behavior

Use a real link styled as the primary button:

```text
/login?returnTo=<encoded-current-relative-URL>
```

After successful login, return the user to the same tournament page, preserving locale and relevant query parameters. Validate `returnTo` as a same-origin relative path to prevent open redirects.

### Accessibility

- Semantic `<a href>` because this action navigates
- Minimum **44px height** and full-width touch area
- Visible keyboard focus state
- Accessible name exactly matching the visible localized label
- Do not put a small text link inside a larger non-interactive container

### Severity

- **TeamMatch: Blocker** for the anonymous registration journey—the action is completely absent.
- **DoublesElimination: Should-fix, high priority**—the requirement is visible, but there is no actionable path.

### Native app scope

Do not block the web fix on SwiftUI work. The analytics-driven batch can remain web-only.

However, if an anonymous user can reach either native tournament screen, the same dead end is also a native UX defect. File a parity issue using the same localized copy and post-login return behavior. If native authentication prevents anonymous users from reaching these screens at all, no native CTA change is needed.