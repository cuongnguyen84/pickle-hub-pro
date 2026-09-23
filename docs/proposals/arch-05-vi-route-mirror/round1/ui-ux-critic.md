# ARCH-05 — UI/UX critique: collapse `/vi/*` route mirror

_Round 1. Panel: Claude (Opus 4.8) + GPT-5.6. Cả hai chạy đủ, không one-model-down._

## Đánh giá tổng thể

Đây là refactor thuần kỹ thuật, nhưng nó chạm đúng cơ chế quyết định **ngôn ngữ
hiển thị cho 95% user VI** — nên nó KHÔNG vô hại về mặt UX. Tin tốt: nếu làm đúng
hình dạng (một route cha `/vi` giữ nguyên mount cho toàn subtree), refactor này là
một **nâng cấp UX**, không chỉ dọn nợ — nó vá 3 bug ngôn-ngữ-sai còn tồn (SPA-nav
vào `/vi/feed`, `/vi/rankings`, `/vi/social/:slug/live` hiện có thể ra tiếng Anh) và
bug 404-tiếng-Anh trên đường dẫn `/vi`. Tin xấu: nếu làm theo kiểu "map mọi route EN
rồi thêm prefix `/vi`", nó sẽ **làm hỏng trang blog/news VI** và có thể lộ 66 route
admin/creator dưới `/vi`. Ba blocker bên dưới đều là "đừng đánh mất trường hợp đặc
biệt", không phải "đừng làm".

## Luồng người dùng (thực tế deep-link)

Vào: user VI bấm link Facebook/Zalo → `/vi/giai-dau` (hard-load). `getInitialLanguage()`
đọc `window.location.pathname` **trước khi** render → language = "vi" ngay lập tức,
độc lập với việc route đó có `ViLanguageWrapper` hay không. Đây là lý do 3 route bỏ
wrapper vẫn "trông như đúng" khi hard-load — và cũng là lý do bug của chúng chỉ lộ
khi SPA-nav, nên test bằng deep-link thuần sẽ KHÔNG bắt được.

Chuyển ngôn ngữ: `LanguageSwitcher` (header) **không đọc bảng route** — nó biến đổi
chuỗi thuần: EN→VI `navigate("/vi"+pathname+search)`, VI→EN
`navigate(pathname.replace(/^\/vi/,"")||"/")`. Vì URL sau refactor phải byte-identical,
switcher không bị ảnh hưởng trực tiếp. Cả Claude và GPT đồng thuận điểm này.

Ra: `<ScrollToTop>` (mount ngoài `<Routes>`) reset `scrollTo(0,0)` + đẩy focus vào
`#main-content` trên mọi PUSH/REPLACE (keyed theo `pathname`), để POP cho browser.
Toggle EN↔VI đổi pathname → PUSH → cuộn lên đầu + focus vào nội dung. Hành vi này
nằm ngoài bảng route, không regress trừ khi refactor chèn thêm `<Navigate>` canonical.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | "Map EN + prefix /vi" sẽ **flatten các route đổi component**: `/vi/blog/:slug` phải là `ViBlogPost` (slug + content VI riêng, kho khác), `/vi/news/:slug` phải là `NewsArticle language="vi"`, `/vi/news` phải là `News language="vi"`. Nếu mất → user VI vào link blog/news từ FB thấy component EN / báo "không tìm thấy" cho slug VI hợp lệ. | Route-config phải cho **override `vi` element tường minh** cho từng bản ghi (mặc định `vi = en`). Test khẳng định **định danh component**, không chỉ URL match. |
| 2 | **Blocker** | Cấu trúc "prefix mọi route trong app" có thể vô tình đẻ ra `/vi/admin/*`, `/vi/creator/*`, `/vi/auth/*`, `/vi/clb/*` — 66 route hiện KHÔNG có mirror. Đổi đường truy cập + tạo trang trùng lặp index được. | Sinh subtree `/vi` **chỉ từ tập `localizedRoutes` (63)**, không từ toàn bộ mảng route. Giữ admin/creator/auth/clb + catch-all trong tập `nonLocalized` riêng. |
| 3 | **Blocker** | URL phải **byte-identical** với 63 đường dẫn hiện tại (SEO là mạch máu, đã index). Rủi ro: thiếu route, thừa `/`, đổi case, `/vi` home (không trailing slash) render sai, hoặc thêm `<Navigate>` canonical → gãy URL đã index + thêm navigation làm `ScrollToTop` cuộn bất ngờ. | Snapshot 63 path check-in, assert bằng chuỗi tuyệt đối (cả segment động). `/vi` home dùng `index` route tường minh. **Không** dùng `<Navigate>` để vào `/vi` hay chuẩn hoá path. |
| 4 | Nên sửa | 3 route bỏ wrapper (Feed/Rankings/SocialEventLive) hiện bị **sai ngôn ngữ khi SPA-nav**: rời một trang `/vi` có wrapper → cleanup reset language về "en" → 3 trang này không có wrapper set lại → user VI thấy tiếng Anh. Cả 3 đều đọc `useI18n().language`. | Dùng route cha `/vi` giữ mount qua điều hướng `/vi/a`→`/vi/b`, chỉ reset khi rời subtree `/vi`. Việc này vá luôn bug — bọc đồng nhất là **đúng về sản phẩm** (prefix URL là hợp đồng locale rõ nhất). |
| 5 | Nên sửa | `SocialEventLive` là trang chấm điểm **trực tiếp, court-side**. Bọc wrapper = đổi i18n context khi vào → có thể re-render toàn trang. | Trước khi ship, audit effect nào key theo `language`/`t`: **socket/SSE chỉ được key theo event/court id**, không theo locale. Xác minh: số kết nối không tăng, điểm hiện tại + optimistic update sống sót, không refetch điểm quyền uy, không blank-screen khi tải dictionary VI trên 4G. |
| 6 | Nên sửa | 404: `/vi/<không-tồn-tại>` — hard-load ra VI (getInitialLanguage) nhưng SPA-nav từ trang `/vi` có thể ra NotFound **tiếng Anh**. | Đặt `<Route path="*" element={<NotFound/>}>` làm **con cuối của route cha `/vi`** → 404 luôn trong ngữ cảnh VI, không tạo mirror cho trang EN-only. Fix trong cùng PR, chi phí ~0 khi đã có cha `/vi`. |
| 7 | Nit | `LanguageSwitcher` giữ `location.search` nhưng **bỏ `location.hash`**; và vẫn hiện toggle VI trên trang không có mirror (vd `/admin/foo` → đẩy tới `/vi/admin/foo` = 404). | Thêm `${location.hash}` vào cả 2 nhánh navigate. Cân nhắc ẩn/disable toggle khi `!hasLocalizedMirror(pathname)`. Scope creep nhẹ — để Cuong quyết. |
| 8 | Nit | Nếu chọn hình dạng route cha, `ViLanguageWrapper` hiện `return <>{children}</>` phải đổi sang render `<Outlet/>`. Mechanical, nhưng đừng để nó thêm `<main>` thứ hai (phá focus `#main-content`). | Đổi sang `<Outlet/>`, giữ đúng một `id="main-content"` do layout trang render. |

## Trạng thái màn hình

Refactor không thêm màn hình mới; các state đã tồn tại, cần **giữ nguyên**:

- **Loading (dictionary):** `I18nBootstrap` — spinner + `aria-live="polite"` label "Đang tải ngôn ngữ…" / "Loading language…". Giữ nguyên. Cảnh báo: nếu route cha `/vi` gate `<Outlet/>` sau khi dictionary tải xong, `ScrollToTop` có thể focus `#main-content` trước khi nó tồn tại → **đừng gate outlet theo trạng thái tải dictionary**.
- **404:** `NotFound` đọc `t.errors.notFound`. Sau fix #6, `/vi/*` sai → VI: "Không tìm thấy trang" + nút "Về trang chủ". Hiện EN khi SPA-nav (bug #6).
- **Offline (PWA/Capacitor):** navigation dùng NetworkFirst 3s timeout, `index.html` loại khỏi precache. Refactor không chạm SW. Trên native shell (`net.thepicklehub.app`) dùng URL remote — hành vi ngôn ngữ giống web, cùng cơ chế `getInitialLanguage`.
- **Empty:** không đổi (thuộc từng page).

## Accessibility (WCAG 2.1 AA)

Không phát sinh mới, nhưng refactor phải **bảo toàn** 2 hành vi a11y đang có:
1. `ScrollToTop` đẩy focus vào `#main-content` (A11Y-01) — screen reader announce điều
   hướng, Tab bắt đầu trong nội dung. Mỗi route sinh ra phải render đúng **một**
   `#main-content`; `ViLanguageWrapper`/`Outlet` không được nhân đôi hay đổi tên nó.
2. `<html lang>` đổi theo URL (`getHtmlLangFromPath`) — bots + screen reader thấy
   `lang="vi"` trên `/vi/*`. Nếu chuyển sang synchronizer theo location, phải set
   `document.documentElement.lang` từ pathname, không mất bước này.

Kiểm bằng integration test (đọc `document.activeElement` sau nav), không chỉ visual.

## Copy đề xuất (VI / EN)

Không cần copy mới. Chuỗi hiện có giữ nguyên: `t.errors.notFound` ("Không tìm thấy
trang" / "Page not found"), `I18nBootstrap` ("Đang tải ngôn ngữ…" / "Loading
language…"). Toggle "EN | VI" giữ nguyên.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6:**
  - `LanguageSwitcher` decoupled khỏi bảng route (biến đổi chuỗi) → an toàn miễn URL
    byte-identical. (blocker #3 vẫn là điều kiện tiên quyết)
  - Blocker #1 (đừng flatten component blog/news) và #2 (đừng lộ 66 route EN dưới
    `/vi`) — cả hai model độc lập nêu y hệt. Tín hiệu mạnh.
  - Bọc đồng nhất 3 route qua **route cha `/vi` giữ mount** vừa gọn vừa **vá** bug
    ngôn-ngữ-sai khi SPA-nav (fix, không phải rủi ro) — với điều kiện audit
    `SocialEventLive` (#5).
  - Giữ ranh giới `React.lazy`; đừng eager-import 63 module vào mảng config (perf 4G).
  - Fix 404 VI trong cùng PR (#6) — gần như free với cha `/vi`.

- **Bất đồng:**
  - GPT cảnh báo regex `/^\/vi/` khớp nhầm `/vietnam`, `/videos` ở switcher và bộ
    dò prefix. **Claude phản biện:** code thật đã guard bằng
    `pathname === "/vi" || startsWith("/vi/")` (LanguageSwitcher:8, `isVietnamesePath`
    loader.ts:13) — lớp bug này KHÔNG tồn tại hôm nay. GPT review theo một implementation
    lỏng hơn code thật. **Chốt:** không tính là finding; nhưng nếu refactor viết lại
    hàm dò locale (vd `UrlLanguageSync` GPT đề xuất), phải **giữ đúng dạng có dấu `/`**,
    đừng thoái hoá thành `startsWith("/vi")`.
  - GPT đề xuất thay cơ chế cleanup-based của wrapper bằng `UrlLanguageSync` (đồng bộ
    language theo `useLocation`, không reset trong effect cleanup) để bỏ hẳn "en flash"
    lúc VI→VI. **Claude:** đúng về lý thuyết nhưng **vượt scope ARCH-05** (viết lại i18n
    core). Route cha `/vi` giữ mount đã xử lý ~hết vì cleanup chỉ chạy khi rời subtree.
    **Chốt:** để route cha là bắt buộc; `UrlLanguageSync` là nice-to-have ghi vào backlog,
    không phải điều kiện merge.

_Prompt + reply GPT-5.6 lưu tại `docs/proposals/arch-05-vi-route-mirror/external/`._
