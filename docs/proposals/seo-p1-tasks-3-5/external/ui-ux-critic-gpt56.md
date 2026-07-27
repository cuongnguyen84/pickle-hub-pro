# external / ui-ux-critic — GPT-5.6 (vendor thứ hai)

**Gọi:** 2026-07-27 · model `gpt-5.6` (API trả `gpt-5.6-sol`) · 132 s · reply 21.081 ký tự
**Cách gọi:** `scripts/agents/ask-model.mjs` **KHÔNG TỒN TẠI** trong repo (giống ghi chú
memory "idea pipeline thiếu script"). Đã gọi thẳng OpenAI Responses API bằng script
one-off trong scratchpad, `OPENAI_API_KEY` + `OPENAI_MODEL=gpt-5.6` lấy từ env.
**System prompt:** "You are a senior product designer reviewing a mobile-first bilingual
(Vietnamese-primary) sports web app. Be specific and concrete. Name the exact element and
the exact fix. No generic design platitudes."

> ⚠️ GPT-5.6 KHÔNG thấy repo. Mọi mô tả code trong reply đều đến từ brief bên dưới.
> Phần "Điểm KHÔNG xác minh được" ở cuối file liệt kê chỗ nó suy diễn/bịa.

---

## 1. Prompt đã gửi (nguyên văn)

````markdown
# UX review brief — ThePickleHub, two content tasks (Task 4 + Task 5)

You cannot see the repo. Everything you need is below. Answer concretely: name the
element, name the fix. Rank findings Blocker / Should-fix / Nit.

## Product

ThePickleHub.net — bilingual pickleball platform for Vietnam. ~95% of traffic is
Vietnamese users. Mobile-dominant (mid-tier Android, 4G, 390px viewport) plus a
Capacitor native shell. Users almost always arrive from a Facebook share or a Google
result straight into ONE deep page; they do not browse the site IA. Perf targets
(Vietnam p75): LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.

Design system ("TheLine"): dark background #08090a, body text #c7c3bb at 17px /
line-height 1.7, article column max-width 720px, h2 in Instrument Serif italic
clamp(26px..38px), accent/link colour lime #b5e853 (very high contrast on the dark bg),
green underlined links, a serif drop-cap on the first paragraph. Buttons are 44px min
height. shadcn/ui + Tailwind.

## The two rendering paths (this is the crux — read carefully)

The site has TWO COMPLETELY DIFFERENT article pipelines:

**A. English posts** (`/blog/<slug>`) are TYPED DATA in TypeScript files. Each post is
an array of sections; a section is `{ heading: string, content: string (ONE paragraph),
listItems?: string[], orderedList?: string[], internalLinks?: {text, path}[], image? }`.
The React page renders `<h2>{heading}</h2>` then `<p>{content}</p>` — React escapes the
string, so ANY URL typed inside `content` appears as dead plain text. The server-side
render for crawlers does the same with an `escapeHtml()` call. There is no field for an
external link and no way to emit an `<a href>` inside prose. `internalLinks` only takes
a site-relative `path` (client uses a router `<Link to={path}>`, the crawler renderer
concatenates `siteUrl + path`), so putting an absolute external URL there produces a
broken href like `https://www.thepicklehub.net/https://ticketbox.vn/...`. Headings get
NO `id` attribute in either renderer, so `#anchor` links cannot work on EN posts today.

**B. Vietnamese posts** (`/vi/blog/<slug>`) are RAW HTML stored in a Supabase table
(`vi_blog_posts.content_html`), injected client-side through DOMPurify and rendered
server-side through a sanitizer that explicitly allows http(s) hrefs, `#fragment`
hrefs, and does not strip `id` attributes. So on the Vietnamese side, arbitrary HTML —
real clickable `<a href="https://ticketbox.vn/...">`, `<h2 id="kitchen">`, a table of
contents, a styled button — already works TODAY with zero code change.

Caveat found in the code: the VI article body is styled with generic Tailwind
Typography (`prose prose-lg`), NOT the TheLine `.tl-longform` typography the English
articles get (Instrument Serif h2, drop cap, lime links, 17px/1.7). So the 95%-of-users
language gets the plainer, less designed reading experience.

Second caveat: for human visitors both languages are a client-side SPA — the article
body arrives from the network AFTER first paint (prerendered HTML is served only to
crawler user-agents). There is a global "scroll to top on route change" behaviour, and
no code anywhere that re-scrolls to `location.hash` after async content mounts.

## Task 4 — HCMC Open ticket push (event is Aug 6-9, today is Jul 27, 10 days out)

An existing preview article exists in both languages: EN `/blog/hcmc-open-2026-preview`,
VI `/vi/blog/hcmc-open-2026`. It has 8 sections: tour context, "at a glance" bullet list
(dates, venue, tier, US$70,000 prize money, sponsors, events, "amateur registration:
open now via pickleballbrackets.com"), venue description, prize-money table as bullets,
line-up watch, how to enter the amateur draws, "How to watch" (says PPA Tour Asia streams
on its YouTube channel, and our own /live hub aggregates streams/scores), and a closing
"Vietnam's big August" section. Every section ends with a "See also:" line of internal
links. At the very bottom of the article there is ONE call-to-action block: a lime button
labelled "Watch live tournaments on ThePickleHub" pointing to /live.

**Nothing in the article mentions spectator tickets at all.** Tickets are now on sale at
`https://ticketbox.vn/ppa-asia-500-mb-hcmc-open-2026-26355`. The proposal is to add a
"how to watch / how to buy tickets" companion (EN + VI) and internal links pointing at
the preview from stronger pages.

The project owner already decided "just put the URL in the prose" — before learning that
prose URLs render as dead plain text (path A). On the VI side a real link is free
(path B). Question for you: for a Vietnamese user on a phone who reached this page to
find out how to get in, how bad is a dead plain-text `ticketbox.vn/ppa-asia-500-mb-hcmc-
open-2026-26355` in the middle of a paragraph? Blocker or acceptable for a 10-day
one-off? What is the minimum change that makes this convert? Where exactly on the page
should the ticket CTA sit given the article is ~2,000 words and the only existing CTA is
at the very bottom?

## Task 5 — Vietnamese A-Z glossary pillar

New pillar page: VI `/vi/blog/thuat-ngu-pickleball` (primary) + optional EN
`/blog/pickleball-glossary` (for hreflang). One entry per term with an anchor
(`#kitchen`, `#dink`, ...), targeting Vietnamese queries like "kitchen trong pickleball
là gì" (currently position 23) and "counter trong pickleball là gì" (position 10.5). The
whole Vietnamese informational cluster gets 424 impressions and ZERO clicks in 90 days.

There is NO table-of-contents component anywhere in the codebase today.

An existing article `pickleball-rules-complete-guide` (published in both languages)
already has a section headed "The Kitchen (Non-Volley Zone)" explaining the same rule.

### The 9 seed definitions (written in Vietnamese by the project owner). Critique the
### Vietnamese specifically: is it natural VI or translated-English VI? Do beginners in
### Vietnam actually use these words? Is anything wrong, stiff, or redundant?

1. **Kitchen (NVZ):** "vùng 2,13 m mỗi bên lưới; không được vô-lê trong vùng này; chạm vạch cũng lỗi."
2. **Counter:** "cú đáp trả nhanh một quả speed-up của đối thủ, thường bằng cổ tay ở thế thủ tại NVZ."
3. **Dink:** "cú đánh nhẹ, có kiểm soát, rơi vào kitchen đối phương để ép họ đánh bóng lên."
4. **Third shot drop:** "cú thứ ba của bên giao, thả nhẹ vào kitchen để có thời gian tiến lên lưới."
5. **Erne:** "cú né luật kitchen — di chuyển/nhảy ra ngoài vạch biên cạnh lưới để vô-lê hợp lệ."
6. **ATP (Around The Post):** "đánh bóng vòng NGOÀI cột lưới khi bóng bạt rộng — hợp lệ."
7. **Stacking:** "giữ cả 2 người cùng một bên (thuận/nghịch tay), đổi vị trí sau giao/trả."
8. **Poach:** "băng sang phần sân đồng đội để chặn/kết thúc điểm."
9. **Let:** "(luật cũ) giao chạm lưới vào ô hợp lệ — nay đa số giải bỏ luật let."

## What I want from you

1. Task 4: verdict on the dead-plain-text ticket URL (Blocker or not) and the exact
   minimal fix, given the VI page can already carry real HTML links and the EN page
   cannot without a code change. Where does the ticket CTA go on a 390px screen?
   What ticket-buying information is missing from the article entirely (a user asks
   "how much, which day, how do I get in")?
2. Task 5: with no TOC component and no heading anchors, what is the mobile reading
   experience of a 9-term glossary? Is a TOC required or is it decoration? How should
   a user who lands from Google on `#kitchen` be handled given the async-content /
   hash-scroll race described above? Is the glossary/rules-guide overlap on "kitchen" a
   real user problem, and which page should win?
3. Line-by-line critique of the 9 Vietnamese definitions, with rewritten Vietnamese
   strings you would actually ship. Say which terms Vietnamese players say in English
   and should NOT be translated.
4. Named empty / loading / error / offline states for both pages, with the exact
   Vietnamese and English copy.
5. WCAG 2.1 AA issues specific to what is described (anchors, headings, touch targets,
   focus, link text, contrast).
````

---

## 2. Reply GPT-5.6 (nguyên văn, không sửa)

````markdown
## Priority summary

### Blockers

1. **Ticketbox URL rendered as plain text**
   - A dead `ticketbox.vn/...` string is a conversion blocker, not an acceptable 10-day workaround.
   - On a 390px phone the slug wraps across several lines, is difficult to select reliably, and may be impossible to open conveniently inside the Capacitor shell.
   - It is especially unacceptable on the Vietnamese page because that pipeline already supports a real external `<a>` with no code change.

2. **Async article rendering breaks `#kitchen` and other deep links**
   - The browser attempts fragment scrolling before the article HTML exists, then the global route handler scrolls to the top.
   - A Google or internal link to `/vi/blog/thuat-ngu-pickleball#kitchen` will therefore land at the article top instead of “Kitchen.”

### Should-fix

- Place the ticket CTA near the top of the existing preview, not only at the bottom.
- Add actual ticket price/session/entry instructions; the current article answers none of the primary purchase questions.
- Give the glossary a compact jump list even though nine entries are still readable without one.
- Apply TheLine’s `.tl-longform` typography to the Vietnamese article container instead of generic `prose prose-lg`.
- Add loading/error/offline UI that does not temporarily look like an empty or missing article.
- Make the glossary genuinely alphabetical, or remove “A–Z” from its title until it is comprehensive.

---

# Task 4 — HCMC Open tickets

## Verdict: dead plain-text URL

**Blocker.**

Do not publish this:

> Mua vé tại ticketbox.vn/ppa-asia-500-mb-hcmc-open-2026-26355

The problem is not merely visual polish. The user has arrived with a transactional goal—“how do I get in?”—and the page gives them no operable control.

### Exact minimum fix for Vietnamese

Edit `vi_blog_posts.content_html` and add a normal external anchor. No component or schema work is needed.

```html
<div class="ticket-cta">
  <p><strong>Vé khán giả HCMC Open 2026 đang được bán trên Ticketbox.</strong></p>
  <a href="https://ticketbox.vn/ppa-asia-500-mb-hcmc-open-2026-26355">
    Mua vé HCMC Open 2026 trên Ticketbox
  </a>
</div>
```

The anchor should:

- Be full-width at 390px.
- Have at least a 44px height.
- Use the lime CTA treatment.
- Keep a visible focus outline.
- Open normally in the same browsing context. Do not force a new tab on mobile unless the Capacitor shell specifically requires external-browser handling.
- Use descriptive text, not “Bấm vào đây” and not the raw URL.

### Exact minimum fix for English

Do not put the Ticketbox URL in `content`, and do not abuse `internalLinks`.

Add one typed field to the section model:

```ts
externalCta?: {
  label: string;
  href: string;
};
```

Render it in both paths:

- Client: `<a href={href}>`
- Crawler SSR: escaped label plus a validated, escaped absolute `http:` or `https:` URL

Example data:

```ts
externalCta: {
  label: "Buy HCMC Open 2026 tickets on Ticketbox",
  href: "https://ticketbox.vn/ppa-asia-500-mb-hcmc-open-2026-26355",
}
```

Reject protocols other than `https:` and `http:`. Do not concatenate `siteUrl` for this field.

This is smaller and safer than turning the English `content` field into arbitrary HTML.

## Exact CTA placement

Put the primary ticket block **immediately after the “At a glance” section and before the venue description**.

That placement works because the user has just confirmed:

- Dates
- Venue
- Event tier
- Prize money

Their next likely question is whether they can attend.

On a 390px viewport, use this sequence:

1. One short status line:
   - **VI:** “Vé khán giả đang mở bán.”
   - **EN:** “Spectator tickets are now on sale.”
2. Full-width 44–48px button:
   - **VI:** “Mua vé HCMC Open 2026”
   - **EN:** “Buy HCMC Open 2026 tickets”
3. Small source line:
   - **VI:** “Bán qua Ticketbox”
   - **EN:** “Ticketing by Ticketbox”

Also add a contextual text link inside the later “How to watch / Cách xem” section, but do not make users read roughly 2,000 words to reach their first purchase control.

Keep the existing bottom `/live` button. It serves a different action: watching remotely rather than attending.

### Do not rely only on a separate companion article

A companion page may target ticket-specific search queries, but the existing preview must still contain the direct CTA. Sending a user from the preview to another article and then to Ticketbox adds an unnecessary step during a time-sensitive sale.

If the companion is created, use descriptive internal link text:

- **VI:** “Giá vé và cách mua vé HCMC Open 2026”
- **EN:** “HCMC Open 2026 ticket prices and entry guide”

Not “Xem thêm” or “See also.”

## Missing ticket-buying information

The article currently does not answer “how much, which day, how do I get in.”

Verify on Ticketbox or with the organiser and add:

1. **Ticket price**
   - Price for each ticket type.
   - Booking/service fees.
   - Whether prices are per day, per session, or for a multi-day pass.

2. **Day and session coverage**
   - Which tickets cover Aug 6, 7, 8, or 9.
   - Whether qualifiers, amateur matches, semifinals, and finals require different tickets.
   - Session start and end times, if sold by session.

3. **Admission procedure**
   - Whether the buyer receives a QR code or e-ticket.
   - Whether the QR code can be shown on a phone.
   - Whether identification matching the purchaser is required.
   - Whether tickets are exchanged for a wristband.

4. **Venue arrival**
   - Full venue address.
   - Spectator entrance or check-in point.
   - Door/opening time.
   - Re-entry policy, if relevant.

5. **Availability and restrictions**
   - Sold-out or low-availability sessions.
   - Child ticket policy.
   - Seating: reserved or general admission.
   - Refund/transfer policy.
   - Accessibility information.

6. **Clear distinction from amateur registration**
   - “Amateur registration” and “spectator tickets” must be separate labels and separate links. The current registration bullet can otherwise mislead a spectator.

Do not invent these details. If they are not confirmed, say so directly:

> **VI:** “Giá và quyền lợi từng loại vé được hiển thị trên trang Ticketbox chính thức.”  
> **EN:** “Current prices and ticket inclusions are listed on the official Ticketbox page.”

---

# Task 5 — Vietnamese glossary

## Is a table of contents required?

For only nine terms, the page remains usable without a TOC. Its absence is **not a launch blocker**.

However, for a glossary, a jump list is functional navigation rather than decoration. Users will commonly scan for one known term instead of reading all nine definitions.

### Exact fix without building a component

Because the Vietnamese pipeline accepts raw HTML, add a native `<nav>` near the top:

```html
<nav aria-labelledby="glossary-nav-title">
  <h2 id="glossary-nav-title">Chuyển nhanh đến thuật ngữ</h2>
  <ul>
    <li><a href="#atp">ATP</a></li>
    <li><a href="#counter">Counter</a></li>
    <li><a href="#dink">Dink</a></li>
    <li><a href="#erne">Erne</a></li>
    <li><a href="#kitchen">Kitchen</a></li>
    <li><a href="#let">Let</a></li>
    <li><a href="#poach">Poach</a></li>
    <li><a href="#stacking">Stacking</a></li>
    <li><a href="#third-shot-drop">Third shot drop</a></li>
  </ul>
</nav>
```

On 390px:

- Use a two-column list or full-width rows.
- Give each link at least 44px of vertical touch area under TheLine’s product rule.
- Do not use a horizontally scrolling chip row; it hides terms and creates an additional gesture.
- Keep visible underlines so the terms are clearly links.

The current nine terms are not in alphabetical order. If the page is called “A–Z,” sort them as shown above. More importantly, nine terms do not constitute an A–Z glossary. Either:

- Rename it to **“9 thuật ngữ pickleball người mới cần biết”**, or
- Expand it into a genuinely comprehensive glossary before using “A–Z.”

## Exact heading structure

Use one page `<h1>`, then one `<h2>` per term:

```html
<h2 id="kitchen">Kitchen (NVZ) là gì?</h2>
```

This gives both a useful search heading and a stable fragment.

Add:

```css
.tl-longform h2[id] {
  scroll-margin-top: 80px;
}
```

Adjust `80px` to the actual sticky-header height plus spacing.

## Fixing the async hash-scroll race

The browser’s initial fragment behavior is insufficient because the content mounts later.

### Exact route behavior

1. Change the global route scroll handler:
   - If `location.hash` is empty, scroll to top.
   - If `location.hash` exists, do not perform the unconditional top scroll.

2. After the article HTML has been fetched, sanitized, and committed to the DOM:
   - Decode `location.hash`.
   - Find the element by ID.
   - Set `tabindex="-1"` programmatically if it is not normally focusable.
   - Call `element.scrollIntoView({ block: "start" })`.
   - Call `element.focus({ preventScroll: true })`.

3. Repeat this behavior when the hash changes on the same route, such as when someone taps the glossary jump list.

Conceptually:

```ts
useEffect(() => {
  if (!articleLoaded || !location.hash) return;

  const id = decodeURIComponent(location.hash.slice(1));
  const target = document.getElementById(id);

  if (!target) return;

  target.tabIndex = -1;
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
}, [articleLoaded, location.hash]);
```

Focusing the heading is important for keyboard and screen-reader users; scrolling alone only changes the visual viewport.

If images can appear above the target without reserved dimensions, give them explicit width/height or aspect ratio so late image layout does not move the target after scrolling.

## Kitchen overlap with the rules guide

This is **not inherently a user problem**. The two pages have different jobs:

- **Glossary:** owns “kitchen trong pickleball là gì” and provides the concise definition.
- **Rules guide:** owns broader rule intent such as complete kitchen/NVZ rules, faults, momentum, and examples.

The glossary should win the short definition query. Its Kitchen entry should link to the detailed rules section:

> **Xem chi tiết:** [Luật kitchen và vùng không vô-lê trong pickleball]

The rules guide should link back with:

> [Tra nhanh các thuật ngữ pickleball]

Do not duplicate the exact same paragraph on both pages, and do not canonicalize one page to the other. Keep separate self-canonicals and reciprocal VI/EN hreflang where equivalent pages exist.

---

# Vietnamese definition review

## Overall language verdict

The source text is understandable, but it is compressed and occasionally reads like translated English or coaching shorthand. Specific issues include:

- “cú né luật kitchen” sounds like exploiting a loophole and is misleading.
- “bóng bạt rộng” is stiff and unclear.
- “thuận/nghịch tay” does not explain the actual purpose of stacking.
- “nay đa số giải bỏ luật let” is ambiguous about what happens after a net-touching serve.
- Several semicolon-heavy definitions read like notes rather than finished Vietnamese prose.

Vietnamese pickleball players generally retain the English terms. Do **not** force Vietnamese replacements for:

- Kitchen
- NVZ
- Counter
- Speed-up
- Dink
- Third shot drop
- Erne
- ATP
- Stacking
- Poach
- Let
- Volley

Give a Vietnamese explanation after the English term.

## 1. Kitchen (NVZ)

**Issue:** Mostly natural, but too compressed. “Chạm vạch cũng lỗi” needs to specify that the line belongs to the NVZ and that the fault concerns volleying. It should also mention momentum.

**Ship:**

> **Kitchen (NVZ):** Khu vực không vô-lê sâu 2,13 m tính từ lưới ở mỗi bên sân. Người chơi không được đánh vô-lê khi đang chạm vào kitchen hoặc vạch NVZ; nếu đà sau cú vô-lê khiến bạn bước vào vùng này, đó cũng là lỗi.

## 2. Counter

**Issue:** “Bằng cổ tay” is too prescriptive; a counter is not defined by wrist use. “Ở thế thủ tại NVZ” is understandable but stiff.

**Ship:**

> **Counter:** Cú phản công nhanh ngay sau khi đối thủ speed-up, thường được thực hiện gần vạch kitchen để chặn bóng hoặc đổi thế phòng thủ thành tấn công.

Keep both **counter** and **speed-up** in English.

## 3. Dink

**Issue:** Already natural and substantially correct. “Ép họ đánh bóng lên” can be expressed more naturally as forcing an upward contact or weak return.

**Ship:**

> **Dink:** Cú đánh nhẹ và có kiểm soát, đưa bóng rơi vào kitchen của đối phương để họ phải đánh bóng từ thấp lên và khó tấn công.

Keep **dink** in English.

## 4. Third shot drop

**Issue:** “Cú thứ ba của bên giao” is understandable but slightly imprecise as phrasing. “Tiến lên lưới” should be “tiến lên vạch kitchen,” because players should not literally approach the net.

**Ship:**

> **Third shot drop:** Cú đánh thứ ba của pha bóng, thường do đội giao thực hiện, đưa bóng rơi nhẹ vào kitchen đối phương để có thời gian tiến lên vạch kitchen.

Keep **third shot drop** in English.

## 5. Erne

**Issue:** “Cú né luật kitchen” is the most problematic phrase in the set. An Erne is legal positioning, not evasion of the rule.

**Ship:**

> **Erne:** Cú vô-lê được thực hiện gần lưới khi người chơi đứng hoặc bật nhảy ra ngoài đường biên dọc, bên cạnh kitchen. Cú đánh hợp lệ nếu người chơi không chạm vào NVZ trong quá trình vô-lê.

Keep **Erne** in English and capitalized because it is named after a person.

## 6. ATP (Around the Post)

**Issue:** “Bóng bạt rộng” sounds translated and is difficult for beginners. Writing “NGOÀI” in capitals is unnecessary.

**Ship:**

> **ATP (Around the Post):** Cú đánh đưa bóng vòng ngoài cột lưới khi đối phương kéo bạn ra sát biên. Bóng không cần bay qua phía trên lưới và vẫn hợp lệ nếu rơi đúng phần sân đối phương.

Keep **ATP** and **Around the Post** in English.

## 7. Stacking

**Issue:** The original does not clearly explain when both players stand on the same side or why they do it. “Thuận/nghịch tay” is too vague.

**Ship:**

> **Stacking:** Cách sắp xếp vị trí trong đánh đôi khi hai người tạm đứng cùng một bên sân trước lúc giao hoặc trả giao, rồi di chuyển về vị trí mong muốn. Chiến thuật này thường được dùng để giữ cú thuận tay mạnh của một người ở giữa sân.

Keep **stacking** in English.

## 8. Poach

**Issue:** This is natural but should clarify that the player intercepts a ball that would normally be handled by the partner.

**Ship:**

> **Poach:** Tình huống một người băng sang phần sân của đồng đội để chặn hoặc kết thúc quả bóng mà đồng đội thường sẽ đánh.

Keep **poach** in English.

## 9. Let

**Issue:** “Đa số giải bỏ luật let” leaves beginners unsure whether the serve is replayed, faulted, or kept live. The current result needs to be explicit.

**Ship:**

> **Let:** Thuật ngữ theo luật cũ dành cho cú giao chạm lưới nhưng vẫn rơi đúng ô giao, khi đó điểm được giao lại. Theo luật hiện hành của USA Pickleball, cú giao như vậy vẫn tiếp tục được chơi và không tự động giao lại.

Keep **let** in English, but visibly label it as an older usage. If the target competition follows a different federation’s rules, add that rule set rather than saying “đa số giải.”

---

# Loading, empty, error, and offline states

Do not render an empty article shell while the request is pending. Loading, empty, error, and offline must be distinct states.

## HCMC Open article

| State | Vietnamese | English |
|---|---|---|
| Loading | **Đang tải thông tin HCMC Open 2026…** | **Loading HCMC Open 2026 information…** |
| Empty content | **Bài viết này hiện chưa có nội dung.** | **This article does not have any content yet.** |
| Request error | **Không tải được bài viết. Vui lòng thử lại.** Button: **Thử lại** | **We couldn’t load this article. Please try again.** Button: **Try again** |
| Offline, uncached | **Bạn đang ngoại tuyến. Hãy kết nối mạng để tải thông tin vé và lịch thi đấu.** Button: **Thử lại** | **You’re offline. Connect to the internet to load ticket and schedule information.** Button: **Try again** |
| Offline, cached | **Bạn đang xem bản đã lưu. Giá vé và tình trạng còn vé có thể đã thay đổi.** | **You’re viewing a saved copy. Prices and ticket availability may have changed.** |

The offline-cached warning is particularly important for ticket availability. Do not present stale “on sale” information without a warning.

## Glossary

| State | Vietnamese | English |
|---|---|---|
| Loading | **Đang tải thuật ngữ pickleball…** | **Loading pickleball terms…** |
| Empty content | **Chưa có thuật ngữ nào trong danh sách này.** | **There are no terms in this glossary yet.** |
| Request error | **Không tải được bảng thuật ngữ. Vui lòng thử lại.** Button: **Thử lại** | **We couldn’t load the glossary. Please try again.** Button: **Try again** |
| Offline, uncached | **Bạn đang ngoại tuyến. Hãy kết nối mạng để tải bảng thuật ngữ.** Button: **Thử lại** | **You’re offline. Connect to the internet to load the glossary.** Button: **Try again** |
| Offline, cached | **Bạn đang xem bản thuật ngữ đã lưu trên thiết bị.** | **You’re viewing a glossary saved on this device.** |

### Loading implementation

Use a reserved article skeleton approximating the final title and paragraphs to reduce CLS. Give the loading message `role="status"` or `aria-live="polite"`. Do not announce every skeleton row.

All “Thử lại / Try again” controls must meet the 44px design-system minimum.

---

# WCAG 2.1 AA and interaction findings

## Blocker

### Fragment target is not reached or focused

**Element:** Glossary term headings such as `<h2 id="kitchen">`.

**Fix:** Re-run fragment navigation after async content mounts, add `scroll-margin-top`, and programmatically focus the heading with `tabindex="-1"`.

Without this, the URL promises a specific destination but users—including keyboard and screen-reader users—remain at the page top.

## Should-fix

### External ticket control must be a real link

**Element:** Ticketbox purchase CTA.

**Fix:** Render an `<a href="https://ticketbox.vn/...">`, not plain text and not a click handler on a `<div>`. Use descriptive accessible text:

> “Mua vé HCMC Open 2026 trên Ticketbox”

This satisfies link purpose better than “Mua vé” when links are listed out of context.

### Preserve visible focus

**Element:** Ticket CTA, glossary jump links, “See also” links, and retry buttons.

**Fix:** Add a clearly visible focus style, for example a 2–3px lime or light outline with offset. Do not remove `outline` unless it is replaced.

### Use real headings in a logical hierarchy

**Element:** Glossary title, navigation label, and term titles.

**Fix:**

- One `<h1>` for the page.
- `<h2>` for each term.
- If definitions have examples or related-rule subsections, use `<h3>`.
- Do not style paragraphs to look like headings.

### Label the glossary navigation

**Element:** Jump-list container.

**Fix:** Use `<nav aria-labelledby="glossary-nav-title">`. Do not expose an unlabeled cluster of nine fragment links.

### Meet touch-target requirements

**Element:** Ticket CTA, TOC links, retry controls, and compact “See also” links.

**Fix:** TheLine requires 44px minimum height. Add sufficient vertical padding and spacing so adjacent links cannot be tapped accidentally. WCAG 2.1 AA itself does not universally require 44px targets, but the stated product system does.

### Do not use color alone to identify links

**Element:** Lime article links.

**Fix:** Retain the underline in normal, hover, visited, and focus states. The described lime-on-dark contrast is strong, but contrast alone does not communicate link affordance.

### Make external navigation understandable

**Element:** Ticketbox link.

**Fix:** Include “Ticketbox” in visible link text. If it opens an external browser from the Capacitor shell, expose that behavior in accessible text, for example:

> “Mua vé trên Ticketbox — mở trình duyệt”

Do not add only an unlabeled external-link icon.

### Vietnamese article typography parity

**Element:** The VI sanitized article-body wrapper currently using `prose prose-lg`.

**Fix:** Apply `.tl-longform` to the Vietnamese body, or port its exact rules for:

- 17px body text
- `line-height: 1.7`
- 720px maximum column width
- Instrument Serif italic `<h2>`
- Lime underlined links
- First-paragraph drop cap

Verify that the drop cap is CSS decoration and does not cause the first letter to be announced twice.

## Nit

### External link new-tab behavior

Do not force `target="_blank"` on mobile merely because Ticketbox is external. If product requirements do force a new tab/window, disclose it and include:

```html
rel="noopener noreferrer"
```

### Link wording in repeated “See also” sections

Repeated generic labels create noise. Keep “See also / Xem thêm” as a lead-in if desired, but each actual anchor must name its destination. Avoid several links all named “Xem thêm.”

### Contrast

The stated body color `#c7c3bb` and lime `#b5e853` on `#08090a` should comfortably exceed AA contrast thresholds. Still test:

- Muted metadata
- Visited links
- Disabled controls
- Placeholder text
- Focus outlines

Those unspecified variants are more likely to fail than the primary palette.````

---

## 3. Điểm GPT-5.6 nói mà KHÔNG xác minh được trong repo (nó không thấy code)

| Claim của GPT-5.6 | Trạng thái |
|---|---|
| "the global route handler scrolls to the top" khi mở link có `#kitchen` | **SAI một phần.** `ScrollToTop` (`src/App.tsx:463-476`) chỉ chạy khi `pathname` đổi VÀ `navigationType !== "POP"`. Lần tải đầu từ Google = POP → KHÔNG scroll top. Lỗi thật là race: nội dung mount sau khi trình duyệt đã thử nhảy fragment. Với điều hướng nội bộ (react-router `<Link>` có hash) thì GPT đúng: PUSH → `window.scrollTo(0,0)`. Kết luận cuối (deep link hỏng) đúng, cơ chế mô tả sai. |
| `scroll-margin-top: 80px` | Con số bịa (không thấy nav). Repo: `.tl-nav` = `position: sticky; top: 0` với `padding: calc(env(safe-area-inset-top) + 12px) … 12px` (`src/styles/the-line.css:135-143`), và **toàn repo hiện KHÔNG có dòng `scroll-margin` nào**. Giá trị đúng phải tính theo safe-area, xem báo cáo chính. |
| Đề xuất thêm field `externalCta?: {label, href}` vào `BlogSection` là "smaller and safer" | Có phương án nhỏ hơn GPT không biết: `react-router-dom@6.30.4` (`node_modules/react-router-dom/dist/index.js:744-790`) đã tự nhận URL tuyệt đối khác origin → render `<a href>` thật, không intercept click. Nghĩa là `ctaPath` HIỆN TẠI đã nhận URL ngoài, và `internalLinks` chỉ hỏng ở SSR (1 dòng nối chuỗi). Xem báo cáo chính. |
| Bảng copy Loading/Error/Offline (chuỗi VI/EN mới) | Không sai, nhưng repo ĐÃ có surface chuẩn `PageStates.tsx` (`LoadingState`/`ErrorState`/`OfflineBanner`, DS-04) + chuỗi i18n `errors.networkError` = "Lỗi kết nối" / `errors.offline` = "Mất kết nối mạng — sẽ tự tải lại khi có mạng." GPT viết bộ chuỗi thứ hai vì không thấy bộ có sẵn. |
| "Verify that the drop cap is CSS decoration" | Xác minh được: đúng là CSS thuần (`.tl-longform p:first-of-type::first-letter`, `the-line.css:2667`) → không ảnh hưởng screen reader. Nhưng lưu ý drop cap chỉ áp cho `.tl-longform` (bài EN); bài VI dùng `prose prose-lg` nên KHÔNG có drop cap — GPT đoán đúng vấn đề parity từ brief. |
| "may be impossible to open conveniently inside the Capacitor shell" (URL text trần) | Không xác minh bằng chạy thật được. Repo: `capacitor.config.ts` `server.allowNavigation` KHÔNG có `ticketbox.vn` → link ngoài thoát ra trình duyệt hệ thống (hành vi mong muốn). Hành vi của `target="_blank"` trong WKWebView phải test tay trên máy thật. |
| Toàn bộ phần phê bình 9 định nghĩa tiếng Việt | Không phải claim về repo — là ý kiến ngôn ngữ, đánh giá riêng trong báo cáo chính. |
