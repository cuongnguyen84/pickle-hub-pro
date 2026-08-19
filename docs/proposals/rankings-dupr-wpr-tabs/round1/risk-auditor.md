# risk-auditor — rankings-dupr-wpr-tabs (2026-08-06)

External: GPT-5.6, prompt + reply tại `../external/risk-gpt56-prompt.md` / `risk-gpt56-reply.md`. Brief đã lọc sạch dữ liệu nội bộ (không SLO, không số user/doanh thu, không lịch sử sự cố).

## Verdict: 🔴 RED (chỉ increment search) · 🟢 GREEN (chỉ thanh tab)

Kết cục xấu nhất: bản sao đầy đủ 2.075 VĐV (file tĩnh hay proxy runtime) nằm đúng câu cấm nguyên văn ToS — takedown/IP block không có nút git revert.

**Classifier: AMBER** (8 file: 5 GREEN + 2 AMBER + 2 path lạ). **Nâng RED cho riêng increment search** — classifier đọc path không đọc ý định: `public/data/wpr-rankings.json` với nó là "unrecognised path", với ToS là "mirror". **Thanh tab giữ GREEN** — không chặn cả ý tưởng.

## Sự thật đã đo lại (đính chính recon)

| Dữ kiện | Recon | Đo hôm nay | Ý nghĩa |
|---|---|---|---|
| Payload full | 66,9 KB gz | 66,6 KB gz / 502.818 B ✓ | đúng |
| **Projection `[rank,name,points,country,div]`** | — | **26,9 KB gz** | giảm 2,5× — đổi kết luận perf |
| Index `[name,slug]` | — | **28,5 KB gz** | "tìm được" mà không tái xuất bản điểm |
| **API có search param?** | — | **KHÔNG** — `?search=`/`?q=`/`?limit=` trả y hệt 502.737 B | giết mọi thiết kế proxy "gọn nhẹ" |
| Ảnh + link | — | `headshot` + `profileUrl`; **1.901/2.075 trỏ pickleball.com**, chỉ 174 có trang ppatour | photography là tài sản ToS liệt đích danh |
| CORS | không ACAO | ✓ xác nhận | (c) chết thật |
| KV TTL | — | `DEFAULT_TTL_SECONDS=21600` (6h, `_middleware.ts:230,658-660`) | HTML cũ tự hết hạn 6h, không "vĩnh viễn" |

ToS fetch lại (Last updated May 22, 2026) — trích dẫn vòng trước đúng từng chữ. Chi tiết đáng biết: câu liệt kê tài sản gồm footage/**brackets data**/**photography**/branding — KHÔNG có "rankings"; nhưng câu acceptable-use nói "our content" chung. → Bỏ `headshot` thì rút khỏi vùng liệt đích danh; "mirror" thì không rút được bằng cách chọn cột.

## Verdict tier theo từng đường kiến trúc

| Đường | Tier | Cơ chế | Hệ quả |
|---|---|---|---|
| (a) JSON tĩnh full đủ field | 🔴 RED | Mirror đúng nghĩa + kèm headshot (tài sản liệt đích danh). Perf: 1900,6+66,6=**1967,2/1970, còn 2,4 KB** | Takedown không revert; bài blog kế tiếp đỏ CI backstop — Cuong bị chặn release vì PR không liên quan |
| (a′) JSON tĩnh projection 5 cột | 🔴 RED pháp lý / 🟢 perf | Vẫn bản sao toàn bảng = mirror; bỏ được photography | 1927,5/1970, còn 42,5 KB — rủi ro còn lại thuần pháp lý |
| (b) Proxy Pages Function không lưu | 🔴 RED | Nguồn không nhận query param → mỗi lần tìm kéo trọn 502 KB; không lưu = không last-good; JSON.parse 502 KB = function nặng CPU nhất repo | Nguồn chậm/đổi shape/chặn → search quay mãi, hỏng câm (ngoài monitor) |
| (c) Client fetch thẳng | ⛔ | Không CORS. (CSP connect-src không phải nút chặn — CORS mới là) | Console error, 0 kết quả, 100% user |
| (d) Search trong 50 dòng + link ra | 🟢 GREEN | 0 bề mặt, 0 KB, 0 phơi nhiễm | UX nói dối: 2.025/2.075 VĐV báo "không tìm thấy". Không đáp ứng yêu cầu Cuong |
| **(e) Index name→slug, KHÔNG đăng rank/points** | 🟡 **AMBER** | 28,5 KB. Chép dữ kiện định danh, không tái xuất bản giá trị xếp hạng, đẩy traffic VỀ nguồn | Đáp ứng "tìm được 2.075" theo nghĩa tìm-ra-người+link. **Bẫy mới: 1.901 link sang pickleball.com — ToS bên đó CHƯA AI ĐỌC** |

**Trả lời thẳng câu trung tâm:** KHÔNG có kiến trúc nào hiển thị rank+points cả 2.075 người mà không rơi vào mirror/rebroadcast trước khi có thư. Đường duy nhất né được là **(e)** — đổi bản chất từ tái xuất bản sang chỉ mục dẫn đường; giá: tìm ra người và được dẫn đi, không xem điểm tại chỗ.

Đã tìm cửa thứ ba và KHÔNG thấy: `pickleball.com/players-sitemap.xml` chỉ 484 byte 1 loc — stub, không dùng được.

## Rủi ro chính

1. **Cao** — full-roster (a/a′/b) = đúng 3 động từ + "commercially". Mitigation: chỉ (d)/(e) đến khi có thư; quyết định thuộc Cuong.
2. **Cao** — (a) headroom còn 2,4 KB → PR sau đỏ oan. Mitigation: projection.
3. **TB** — **Gate mù**: check-bundle-size chỉ walk `.js` — JSON public không được đếm nhưng user vẫn tải thật. Mitigation: ghi tay vào perf-budgets.md.
4. **TB** — **Offline asymmetry** (GPT nêu, đã verify vite.config.ts:183-186): JSON public không khớp rule runtime-cache nào → PWA offline mất index, bản nhúng JS thì còn.
5. **TB** — (b) mỗi keystroke kéo 502 KB; ToS còn câu "Don't bypass rate limits" — retry logic biến vi phạm nhẹ thành vi phạm được nêu tên.
6. **TB** — **Scope laundering qua PR #552** (MERGEABLE, 6/6 SUCCESS): commit search RED lên branch đã review mức AMBER → diff đổi ý nghĩa sau review. Mitigation: merge #552 trước, branch mới từ main.
7. **TB** — Working tree bẩn: 15 file M + **3 migration untracked** — `git add -A` kéo migration ride-along = không revert được. Cấm add -A.
8. **Thấp** — snapshot tĩnh trôi im lặng (lỗi solo-op khó phát hiện nhất — GPT gọi đúng). `PPA_WPR_FETCHED_AT` đã hiển thị trên UI — giữ + mốc milestones.

## SLO / Perf / SEO

- SLO: chỉ (b) chạm SLO 1 (blast radius giới hạn ở ô search). SLO 2/3/4/5/7 không chạm — điểm sáng thật, không thổi phồng.
- Perf: (a) ❌ 1967,2/1970; (a′) ✅ 1927,5; (e) ✅ 1929,1; route chunk PpaRankings phải đo <150 KB gz (chưa đo).
- SEO: **KHÔNG route SSR nào bị ảnh hưởng nếu tab+search là client-only.** Bump v34→v35 CHỈ KHI sửa 2 file render (đang phát anchor 2 chiều). TTL 6h — bump là để khỏi chờ 6h, không phải cứu kẹt vĩnh viễn (bác cách nói "indefinitely" của GPT). **Cấm tuyệt đối** đưa query string vào tầng render — `rawPath = pathname` (`_middleware.ts:715`) là guard đang giữ, không được phá.

## Rollback

- Tab / (d) / (e): git revert ~10' (bot ≤6h TTL hoặc bump+nocache). (e) không thu hồi được link đã gửi user sang pickleball.com.
- (a)/(a′)/(b): revert gỡ code ~10' — KHÔNG gỡ được: thư takedown, bản Google đã index, log truy cập phía Vercel/PPA, quan hệ với PPA. **Đây là thứ làm nó RED.**

## Checklist trước merge

- [ ] Merge #552 trước, branch mới từ main — không stack search lên #552
- [ ] `git status` sạch migrations trước mọi commit; không add -A
- [ ] build + check-bundle-size: Total <1970, chunk PpaRankings <150 KB gz
- [ ] `git diff --stat functions/_lib/render/` rỗng → không bump; có → v35
- [ ] `rawPath` vẫn `= pathname`, không kèm url.search
- [ ] Nếu (e): ĐỌC ToS pickleball.com, lưu external/ trước khi link 1.901 VĐV
- [ ] Nếu (b): đo CPU JSON.parse 502 KB trên preview trước khi tin
- [ ] seo.spec hreflang 2 route xanh

## Phản biện GPT-5.6

**Giữ (đã verify):** offline asymmetry public JSON; "không lưu" không cứu ToS mà còn tạo nhiều truy cập tự động hơn; lỗi khó thấy nhất với solo-op là trôi số liệu tĩnh (im lặng) chứ không phải proxy chết (ồn); cache poisoning ?q= — đúng cơ chế, hiện bị chặn bởi cấu tạo, giữ dạng "guard không được phá".
**Bác:** "KV giữ HTML cũ indefinitely" (sai — TTL 6h); "(a) fails CI blocks release" (nửa đúng — check-bundle-size chỉ cảnh báo trừ khi BUNDLE_STRICT=1, cơ chế thật ở workflow); "(d) an toàn và nhàm chán" (bỏ qua việc (d) chủ động nói dối user — lỗi sản phẩm, không trung tính).
**GPT không tìm ra (phải tự đo):** projection 26,9 KB (biến perf từ chặn thành không); 1.901/2.075 profileUrl trỏ pickleball.com (bề mặt pháp lý thứ hai).

## Kiến nghị (không phải quyết định — Cuong chịu trách nhiệm pháp lý)

Tách 2 increment, đừng gói chung:
- **Increment 1 — thanh tab: 🟢 GREEN, không chặn.** Client-only; không đụng render → không bump.
- **Increment 2 — search: 🔴 RED.** Muốn phủ 2.075 ngay: đường **(e)** là phơi nhiễm thấp nhất còn thoả yêu cầu (điều kiện: đọc ToS pickleball.com trước). Đường (a′) là "chấp nhận rủi ro có ý thức": perf sạch, pháp lý vẫn RED. Khoá mở duy nhất: email hồi âm từ legal@ppatour.com — có thư thì RED tắt, (a′) thành GREEN ngay.
