# round1 / ui-ux-critic — SEO P1 Task 4 + 5

**Agent:** `ui-ux-critic` (Claude + GPT-5.6) · **Chạy:** 2026-07-27 · **Output NGUYÊN VĂN.**
**External:** `external/ui-ux-critic-gpt56.md` (prompt + reply GPT-5.6)

---

## Đánh giá tổng thể

Task 4 và Task 5 đang được thiết kế như hai bài viết, nhưng người dùng thật của chúng đến với **ý định giao dịch** ("mua vé kiểu gì") và **ý định tra cứu** ("kitchen là gì"). Cả hai ý định đó đều bị chính kiến trúc render của repo chặn: bài EN là dữ liệu typed nên URL Ticketbox ra text chết, và không heading nào có `id` nên anchor `#kitchen` không tồn tại. **Nhưng recon bỏ sót một dữ kiện đảo ngược mức độ nghiêm trọng: bài VI KHÔNG đi qua đường đó.** `/vi/blog/*` đọc HTML thô từ Supabase (`ViBlogPost.tsx:120-123` → DOMPurify; SSR `blog.ts:222` → `sanitizeBlogHtml`, cho phép `https:` và `#fragment`, không đụng attribute `id`). Với 95% người dùng, nút vé bấm được và anchor `#kitchen` **đã khả thi hôm nay, không cần một dòng code nào**. Việc còn lại nhỏ hơn nhiều so với brief tưởng — và đúng một blocker code thật sự còn sót, không phải cái recon nêu.

## Luồng người dùng

**Task 4** — Facebook share → `/vi/blog/hcmc-open-2026` (SPA, nội dung tải sau first paint) → cuộn ~2.000 chữ → CTA duy nhất ở đáy trỏ `/live`. Người muốn *đi xem* không có lối ra nào. Ticketbox nằm ngoài `allowNavigation` trong `capacitor.config.ts` → trên app native link sẽ thoát ra trình duyệt hệ thống (đúng ý, **đừng** thêm ticketbox.vn vào allowlist).

**Task 5** — Google "kitchen trong pickleball là gì" → `/vi/blog/thuat-ngu-pickleball#kitchen` → trình duyệt thử nhảy fragment **trước khi** react-query trả `content_html` → rơi ở đầu bài → người dùng phải tự cuộn tìm giữa 9 mục. Đây là chính xác đường vào mà cả Task 5 tồn tại để phục vụ.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | Deep link có hash không nhảy tới mục. Nội dung VI mount bất đồng bộ; không có chỗ nào trong repo re-scroll theo `location.hash` sau khi content về. Với điều hướng nội bộ còn tệ hơn: `ScrollToTop` (`src/App.tsx:463-476`) chạy `window.scrollTo(0,0)` khi `pathname` đổi + `navigationType !== "POP"`. | Thêm 6 dòng vào `ViBlogPost.tsx`, sau khi `post` về: `useEffect(() => { if (!post) return; const id = decodeURIComponent(window.location.hash.slice(1)); if (!id) return; const el = document.getElementById(id); if (!el) return; el.tabIndex = -1; el.scrollIntoView(); el.focus({ preventScroll: true }); }, [post])`. `focus()` là bắt buộc — scroll không thôi bỏ rơi người dùng bàn phím/screen reader. |
| 2 | **Blocker** | Không có `scroll-margin` nào trong toàn repo, trong khi `.tl-nav` là `position: sticky; top: 0` (`the-line.css:135-143`). Kể cả khi #1 được sửa, heading `#kitchen` nằm **dưới** thanh nav mờ. | 1 dòng CSS: `[data-theme="the-line"] .prose h2[id], [data-theme="the-line"] .tl-longform h2[id] { scroll-margin-top: calc(env(safe-area-inset-top) + 68px); }` GPT-5.6 đoán 80px — nó không thấy nav; con số đúng tính theo safe-area vì máy Android tai thỏ. |
| 3 | **Blocker** | Lỗi mạng bị hiển thị thành "bài đã bị xoá". `ViBlogPost.tsx:32-41` gộp `error \|\| !post` vào một nhánh và in *"Bài viết này không tồn tại hoặc đã bị xóa."* Người ở sân, 4G chập chờn, Supabase fetch fail → được thông báo bài viết đã bị xoá, không có nút thử lại. Đây là trang ta đang đẩy traffic vào trong 10 ngày. | Tách hai nhánh, dùng component có sẵn: `if (error) return <TheLineLayout title="Lỗi kết nối"><ErrorState onRetry={refetch} /></TheLineLayout>` (`src/components/states/PageStates.tsx:49`, chuỗi i18n đã có: `errors.networkError`, `errors.networkErrorDesc`). Giữ copy "không tồn tại" chỉ cho `!post`. |
| 4 | **Blocker** | Bài HCMC hiện **không hề nhắc tới vé khán giả**. Section "Xem HCMC Open ở đâu" (`hcmc-open-2026-preview.ts:243-245`) chỉ nói YouTube + `/live` + "có hơn 300 chỗ ngồi" — ngụ ý cứ tới là vào được. Đồng thời gạch đầu dòng *"Đăng ký nghiệp dư: đang mở tại pickleballbrackets.com"* rất dễ bị đọc nhầm là "đăng ký để vào xem". | Trong bản VI (sửa `content_html`, không đụng code): chèn block CTA **ngay sau section "HCMC Open 2026 trong một cái nhìn"**, không phải ở đáy. 1 dòng trạng thái + 1 `<a>` full-width ≥44px + 1 dòng nguồn. Đổi nhãn thành "Đăng ký **thi đấu** nghiệp dư". |
| 5 | **Nên sửa** | URL text trần trên bản EN. Xác nhận đúng như recon: `BlogPost.tsx:293` + `blog-body.ts:34`. **Nhưng recon kết luận thiếu:** `react-router-dom@6.30.4` (`dist/index.js:744-790`) đã tự phát hiện URL tuyệt đối khác origin → render `<a href>` thật, không intercept. Nghĩa là `ctaPath` hiện tại **đã** nhận được URL ngoài, và `internalLinks` chỉ hỏng ở **một dòng SSR**. | Sửa `blog-body.ts:51` thành `const href = /^https?:\/\//.test(l.path) ? l.path : siteUrl + l.path;`. **1 dòng**, không đổi type, không đổi renderer client, và bịt luôn cái bẫy hiện tại. Sau đó vé EN đi vào `internalLinks` như một text link. |
| 6 | **Nên sửa** | **Đừng tạo bài companion vé riêng.** Tách "vé" khỏi bài preview 10 ngày trước sự kiện = lặp lại đúng lỗi cannibalization Task 3 vừa dọn xong, và người rơi vào preview từ Facebook vẫn thiếu link vé. | Nhồi vé vào chính bài preview (1 URL, 1 CTA) + internal link từ `/vi/blog/ppa-tour-asia-2026-lich-thi-dau-tien-thuong`. Bỏ companion khỏi Task 4. |
| 7 | **Nên sửa** | Bản VI dùng typography kém hơn bản EN. `ViBlogPost.tsx:121` = `prose prose-lg` (Tailwind mặc định); bản EN được `.tl-longform` (17px/1.7, cột 720px, h2 Instrument Serif, drop cap, link lime gạch chân). 95% người dùng đang đọc bản xấu hơn. | Đổi class wrapper VI sang `tl-longform`. Không phải việc của sprint này nhưng glossary VI là bài "đọc lâu" đầu tiên nên chênh lệch sẽ lộ rõ. Cả tôi và GPT-5.6 độc lập chỉ ra cùng chỗ. |
| 8 | **Nên sửa** | Tiêu đề "A–Z" với 9 mục là lời hứa không giữ. | (a) mở rộng lên ~20 thuật ngữ trước khi publish — bản VI là HTML trong Supabase nên **chi phí là viết, không phải code**; hoặc (b) đổi tên thành "Thuật ngữ pickleball: 20 từ người mới hay gặp". Tôi chọn (a). Thiếu rõ nhất so với truy vấn thật của người Việt: **drive, reset, lob, smash, banger, lỗi chân (foot fault), rally scoring, DUPR, ăn non/đôi công**. |
| 9 | **Nên sửa** | Link chéo glossary → rules guide cũng rơi vào đầu bài. Bài `pickleball-rules-complete-guide` có heading "Kitchen (Non-Volley Zone)" nhưng cũng không có `id`. | Bản VI của rules guide nằm trong Supabase → thêm `id="kitchen"` là **một câu UPDATE SQL**. Làm cùng lúc với glossary. |
| 10 | **Nên sửa** | Cannibalization "kitchen": ai đọc cái nào. | Glossary **thắng** truy vấn định nghĩa ("… là gì"), giữ mục kitchen ~50 từ + 1 link. Rules guide thắng truy vấn luật đầy đủ. **Cấm copy nguyên đoạn sang cả hai.** Link hai chiều bằng anchor text mô tả, không "Xem thêm". Đồng thuận với GPT-5.6. |
| 11 | **Nit** | Anchor text "See also:" / "Xem thêm" lặp ở cuối mọi section (`BlogPost.tsx:308-318`). Với screen reader duyệt danh sách link, dòng nào cũng mở đầu như nhau. | Khi thêm link vé thì đặt anchor text nói rõ đích ("Mua vé HCMC Open 2026 trên Ticketbox"). |
| 12 | **Nit** | Đừng ép `target="_blank"` cho link Ticketbox. Trên web mobile nó cắt nút back; trong WKWebView của Capacitor, link `_blank` có thể **không làm gì cả** tuỳ handler. | Để anchor thường. Ticketbox không nằm trong `allowNavigation` nên native tự đẩy ra trình duyệt hệ thống. **Mục test tay bắt buộc trên máy thật.** |

## Trạng thái màn hình

- **Loading:** skeleton, không spinner — `ViBlogPost.tsx:20-30` đã đúng. Với glossary, thêm 1 khối skeleton cho mục lục.
- **Error:** `<ErrorState onRetry={refetch} />` → "Lỗi kết nối / Không thể kết nối đến máy chủ." + nút "Thử lại". EN: "Network error / Unable to connect to the server." (`src/i18n/vi.ts:3662`, `en.ts:677`).
- **Empty (bài không tồn tại):** giữ copy hiện tại nhưng thêm lối ra — hiện là ngõ cụt. VI: "Không tìm thấy bài viết này. Có thể link đã cũ." + "Xem tất cả bài viết →" `/vi/blog`.
- **Offline:** `OfflineBanner` đã mount toàn cục. Thêm **một** thứ riêng cho trang vé: nếu bài được phục vụ từ cache PWA và người dùng offline, dòng trạng thái vé phải nói "Tình trạng vé có thể đã thay đổi — kiểm tra trên Ticketbox." (GPT-5.6 nêu, tôi đồng ý).

## Accessibility (WCAG 2.1 AA)

- **2.4.3 / 2.4.7 — Blocker:** anchor `#kitchen` phải `focus()` cùng lúc scroll (mục #1).
- **2.5.5:** link mục lục glossary ≥44px chiều cao mỗi dòng. **Không dùng hàng chip cuộn ngang.** Nút vé full-width, min-height 48px.
- **1.4.1 Use of color:** giữ gạch chân link. `.tl-longform a` đã gạch chân (`the-line.css:2673-2677`).
- **Contrast — sạch:** `#b5e853` trên `#08090a` ≈ 15:1; body `#c7c3bb` ≈ 12:1. Theme sáng dùng `--primary: 80 62% 28%` — nút vé phải qua token, `check-theline.mjs` bắt hex trần.
- **2.4.6 Headings:** glossary 1 `<h1>`, mỗi thuật ngữ 1 `<h2 id="…">`, chi tiết là `<h3>`. Mục lục bọc `<nav aria-labelledby="…">`.
- **Drop cap sạch:** `::first-letter` là CSS thuần, screen reader không đọc lặp.

## Copy đề xuất

**Block vé, chèn vào `content_html` bản VI ngay sau mục "HCMC Open 2026 trong một cái nhìn":**

```html
<p><strong>Vé xem HCMC Open 2026 đã mở bán trên Ticketbox.</strong>
Giá vé và loại vé từng ngày xem trực tiếp trên trang bán vé.</p>
<p><a href="https://ticketbox.vn/ppa-asia-500-mb-hcmc-open-2026-26355"
      class="tl-btn green">Mua vé HCMC Open 2026 →</a></p>
<p><small>Vé do Ticketbox bán. Đây là vé <em>xem</em> — nếu bạn muốn
<em>thi đấu</em> nhánh nghiệp dư thì đăng ký ở pickleballbrackets.com.</small></p>
```

**Phê bình 9 định nghĩa VI — thẳng.** Vấn đề chung: viết như ghi chú huấn luyện viên (dấu chấm phẩy nối, lược chủ ngữ), không phải câu tiếng Việt hoàn chỉnh. Và **"vô-lê" có gạch nối là lỗi rõ nhất**: không ai ở sân Việt Nam viết vậy. GPT-5.6 giữ nguyên "vô-lê" trong toàn bộ bản viết lại của nó; tôi không đồng ý. Giữ nguyên tiếng Anh: kitchen, NVZ, dink, counter, speed-up, third shot drop, erne, ATP, stacking, poach, let, volley — ép dịch là dấu hiệu bài viết máy dịch.

```
Kitchen (NVZ) — Vùng không volley, sâu 2,13 m tính từ lưới về mỗi bên. Bạn không
được volley (đánh bóng khi bóng chưa nảy) khi đang đứng trong kitchen hoặc chạm
vạch kitchen. Đà chân sau cú volley khiến bạn bước vào vùng này cũng tính là lỗi.

Counter — Cú phản công nhanh ngay sau khi đối thủ speed-up. Đánh gần vạch kitchen,
gần như phản xạ và chủ yếu bằng cổ tay, để chặn bóng hoặc lật ngược thế trận từ
thủ sang công.

Dink — Cú đánh nhẹ, có kiểm soát, thả bóng rơi vào kitchen đối phương để họ phải
đỡ bóng từ dưới lên và không tấn công được.

Third shot drop — Quả thứ ba của bên giao: thả nhẹ vào kitchen đối phương, đủ chậm
để cả đội kịp lên lưới (đứng sát vạch kitchen).

Erne — Cú volley sát lưới khi người chơi đứng hoặc bật ra ngoài vạch biên dọc, bên
cạnh kitchen. Hoàn toàn hợp lệ, miễn là không chạm vào kitchen trong lúc đánh.

ATP (Around The Post) — Cú đánh vòng ra ngoài cột lưới khi đối phương kéo bạn ra
sát biên. Bóng không cần bay qua trên lưới, chỉ cần rơi đúng sân đối phương là hợp lệ.

Stacking — Cách xếp vị trí trong đánh đôi: hai người tạm đứng cùng một bên sân trước
khi giao hoặc trả giao, xong mới di chuyển về vị trí muốn đánh. Thường dùng để giữ
tay thuận mạnh của một người ở giữa sân.

Poach — Băng sang phần sân của đồng đội để chặn hoặc kết thúc quả bóng mà lẽ ra
đồng đội sẽ đánh.

Let — Theo luật cũ: giao bóng chạm lưới nhưng vẫn rơi đúng ô thì được giao lại. Luật
hiện hành của USA Pickleball đã bỏ let — bóng chạm lưới vẫn tính, cứ đánh tiếp.
```

Sửa cụ thể so với bản seed: **"cú né luật kitchen" (Erne) là SAI bản chất** — Erne hợp lệ, không phải né luật; câu này dạy sai người mới. "bóng bạt rộng" (ATP) là tiếng Việt dịch, không ai nói. "thuận/nghịch tay" (Stacking) không giải thích được *tại sao* stack. "nay đa số giải bỏ luật let" để người mới treo lơ lửng.

## Panel đa model

**Đồng thuận Claude + GPT-5.6** (hai model độc lập — tín hiệu thật): URL Ticketbox text trần là **Blocker**, không phải "chấp nhận được cho 1 bài 10 ngày". CTA vé phải nằm **giữa bài, ngay sau mục "at a glance"**. Bài hiện thiếu toàn bộ thông tin mua vé và **không được bịa** — dẫn thẳng sang Ticketbox. Deep link `#kitchen` hỏng là Blocker và phải `focus()` chứ không chỉ scroll. Glossary thắng truy vấn định nghĩa, rules guide thắng truy vấn luật. Bản VI dùng `prose` thay `.tl-longform` là mất mát cho 95% người dùng. Mục lục là **điều hướng chức năng, không phải trang trí**, nhưng không phải blocker phát hành.

**Bất đồng 1 — cách cho EN link ngoài.** GPT-5.6: thêm field `externalCta?: {label, href}` + sửa cả 2 renderer. Tôi: nó chưa biết `react-router-dom@6.30.4` đã tự xử URL tuyệt đối, nên phương án nhỏ nhất là **sửa 1 dòng ở `blog-body.ts:51`**. **Chốt: làm 1 dòng đó trước.** Field `externalCta` chỉ đáng thêm nếu Cuong muốn *nút* giữa bài trên EN.

**Bất đồng 2 — "tiến lên lưới" (Third shot drop).** GPT-5.6 đòi "tiến lên vạch kitchen". Đúng kỹ thuật, sai ngôn ngữ: người Việt nói "lên lưới". **Chốt: giữ "lên lưới", mở ngoặc "(đứng sát vạch kitchen)".**

**Bất đồng 3 — companion vé.** GPT-5.6 để cửa cho bài companion. Tôi bỏ hẳn: hai URL cho cùng một sự kiện, 10 ngày trước giờ G, lặp lại đúng cannibalization Task 3 vừa đóng. **Chốt: 1 URL.**

**Bất đồng 4 — cơ chế hỏng của hash-scroll.** GPT-5.6 nói "route handler kéo lên đầu trang". Tôi kiểm được: `ScrollToTop` không chạy ở lần tải đầu (navigationType = POP), lỗi thật là race nội dung mount sau. Kết luận trùng nhau, **cơ chế của nó sai** — quan trọng vì bản vá theo mô tả của nó sẽ không sửa được đường vào từ Google.

**Ghi chú vận hành:** `scripts/agents/ask-model.mjs` **không tồn tại trong repo**. Tôi gọi thẳng OpenAI Responses API bằng script dùng một lần trong scratchpad; prompt + reply nguyên văn lưu tại `external/ui-ux-critic-gpt56.md`. Panel chạy đủ 2 vendor.
