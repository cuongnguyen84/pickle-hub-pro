# Rủi ro — ARCH-05: collapse `/vi/*` route mirror

## Verdict: 🟡 AMBER
Worst realistic outcome: một route bị chép sai/rơi khi gom 63 mirror → ~95% người dùng VN bấm link `/vi/...` đã-index nhận trang **NotFound hoặc nội dung tiếng Anh**, trong khi bot/GSC vẫn xanh (SSR prerender decoupled) nên lỗi im lặng cả tháng.

Classifier said: AMBER · Em giữ nguyên AMBER (không nâng, không hạ).
Không phải RED: refactor thuần client, `git revert` + redeploy khôi phục được, không migration, không app-store (native dùng remote URL). Không phải GREEN: mirror KHÔNG đồng nhất + 0 test routing + monitoring SSR không bắt được lỗi client → một lỗi chép tay là regression im lặng diện rộng.

## Rủi ro cụ thể
| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | Gom EN config rồi map lại với prefix `/vi` mà tái dùng cùng `element`, bỏ `ViLanguageWrapper`. `ViLanguageWrapper` (`src/components/layout/ViLanguageWrapper.tsx`) là cơ chế **duy nhất** lật ngôn ngữ khi SPA navigation không reload; `getInitialLanguage` (`src/i18n/index.tsx:41-64`) chỉ chạy lúc hard-load. | Điều hướng client từ trang EN sang `/vi/*` → URL là `/vi/...` nhưng UI vẫn **tiếng Anh**. Xảy ra cả trong app Capacitor (dùng remote URL). Bot vẫn nhận VI HTML → monitoring không thấy. | Snapshot test route-table (xem §"Phải verify"); giữ policy wrapper explicit cho từng route; smoke test có bước SPA-nav EN→`/vi/*`. |
| 2 | **Cao** | Flatten làm mất component/prop khác biệt: `/vi/blog/:slug` phải render `ViBlogPost` (`App.tsx:755`) chứ không phải `BlogPost` (`:664`); `/vi/news/:slug` phải là `<NewsArticle language="vi"/>` (`:753`) chứ không phải `language="en"`. Prop explicit thắng cả i18n context. | URL VI đã-index render **bài tiếng Anh** (blog) hoặc **NewsArticle sai ngôn ngữ** — dù hard-load đã set vi. Đây đúng là "EN content trên URL VI" mà SEO sợ nhất, nhưng chỉ user thấy (bot có middleware riêng). | Route-config phải model VI override rõ ràng: component, language prop; không map cùng EN element. |
| 3 | **TB** | 6 biến thể auth VI lồng `ConditionalAuth`/`RequireAuth` bên trong wrapper (`App.tsx:750,763,768,771,775,785`). Flatten đồng bộ làm mất tổ hợp này. | User chưa đăng nhập vào `/vi/tools/team-match/:id`… thấy trang lỗi API / mất redirect đăng nhập thay vì hành vi auth đúng. | Encode auth composition per-route trong config, có test cho cả 6. |
| 4 | **TB** | Phương án single wrapper-route (`<Route path="/vi/*">` + nested `<Routes>`): (a) `ViLanguageWrapper` hiện KHÔNG render `<Outlet/>` → phải sửa; (b) nested `<Routes>` không có inner `*` → `/vi/typo` khớp `/vi/*` ở ngoài, **bỏ qua** `path="*"` top-level (`App.tsx:789`). | (a) mọi route VI trắng trang; (b) `/vi/<gõ-sai>` hoặc route bị quên khi migrate → **trang trắng/"no routes matched"** thay vì NotFound. | Nếu chọn wrapper-route: bắt buộc có inner `*`→NotFound, `<Outlet/>`, và gỡ hết wrapper con để tránh cleanup lật lại "en". |
| 5 | **Thấp** | Bundle: config-array tham chiếu cùng biến `lazyRetry(...)` → cùng chunk, không gộp. `+0 KB` kỳ vọng. Rủi ro chỉ khi ai đó eager-import component vào mảng thay vì giữ lazy. | Không thấy gì nếu làm đúng; nếu eager-import → entry chunk phình, LCP VN chậm. | Kiểm tra `check-bundle-size` sau build; giữ mọi component ở `lazyRetry`. |

## SLO bị đe doạ
- SLO 1 (Availability `/` `/feed`): `/vi/feed` là 1 trong 3 route ngoại lệ không wrapper (`App.tsx:661`). Nếu wrapper-route/config làm sai → `/vi/feed` trắng trang = availability fail cho user VN. Smoke chỉ chạm `/vi` home, KHÔNG chạm `/vi/feed`.
- SLO 6 (Latency VN p75): chỉ đe doạ nếu rủi ro #5 xảy ra (eager import phình entry). Làm đúng thì trung tính.
- Các SLO khác (auth 2, registration 3, scoring 4, cron 5, push 7): không đụng — refactor không chạm edge function, DB, cron, push.

## Ngân sách hiệu năng
- Bundle: **+0 KB** kỳ vọng → giữ 1903.8 / 1970 KB. Config-array không merge chunk vì tái dùng biến `lazyRetry`. Verdict: an toàn NẾU không eager-import.
- Vietnam p75 impact: trung tính. Không thêm render work trên `/feed`, không waterfall mới. (Cảnh báo: đừng phá code-split PERF-02 đã đưa TeamMatchView 241→136 KB — giữ nguyên các `lazyRetry`.)

## SEO
- Routes SSR bị ảnh hưởng: **none**. `functions/_middleware.ts:184` strip `/vi` bằng regex đọc URL string, KHÔNG import React Router. Hreflang/canonical client-side (`src/components/seo/HreflangTags.tsx`, `DynamicMeta.tsx`, `LanguageSwitcher.tsx`) chạy theo `location.pathname`, không theo route config. → An toàn CHỪNG NÀO URL byte-identical.
- Cần bump `pr:v29`? **Không** — SSR output không đổi (middleware không chạm, URL giữ nguyên). Chỉ bump nếu vô tình đổi 1 URL nào đó.
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/vi/tournaments` (+ vài path VI đại diện) → expect 200 + title VI + og:image + hreflang en/vi/x-default. So khớp trước/sau refactor.

## Kế hoạch rollback
- Cơ chế: `git revert` + redeploy Cloudflare Pages. Thuần client code, không migration, không native build (native Capacitor load remote URL → deploy web tới native tức thì NHƯNG revert cũng tức thì).
- Thời gian khôi phục: ~5-10 phút (build + deploy Pages).
- Không revert được: **không có** — đây là lý do chính giữ verdict ở AMBER chứ không RED.

## Phải verify trước khi merge
- [ ] **Route-table characterization test (gate cứng, phải land TRƯỚC refactor):** snapshot chính xác tập path string + (component, props, wrapper policy, auth wrapper) của cả 192 route hiện tại; assert byte-identical sau refactor. Không có test này thì refactor không kiểm chứng được → em đẩy về gần RED.
- [ ] Smoke SPA-navigation: click từ trang EN sang `/vi/tournaments`, `/vi/feed`, `/vi/rankings`, `/vi/social/:slug/live`, `/vi/blog/:slug`, `/vi/news/:slug` → xác nhận UI đúng tiếng Việt + đúng component (không reload).
- [ ] 6 biến thể auth VI: test logged-out redirect đúng.
- [ ] `/vi/<gõ-sai>` → NotFound (không trắng trang) — bắt bug nested-`*` của phương án wrapper-route.
- [ ] `curl -A Googlebot` diff 3-5 URL VI trước/sau: status + title + hreflang không đổi.
- [ ] `BUNDLE_STRICT=1 npm run build` (hoặc CI bundle gate) → entry chunk ≤170 KB, tổng ≤1970.

## Phản biện độc lập (GPT-5.6)
Panel chạy đủ 2 model (OPENAI_API_KEY present, exit 0). Full output: `docs/proposals/arch-05-vi-route-mirror/external/risk-openai.md`, brief: `.../external/risk-brief.md`.
- **Đã xác minh trong repo (survived):**
  - "Bỏ wrapper → VI render EN sau SPA nav" — đúng, khớp `ViLanguageWrapper` là cơ chế lật ngôn ngữ duy nhất khi không reload (rủi ro #1).
  - "`/vi/blog/:slug`→BlogPost, `/vi/news/:slug`→language=en nếu map từ EN config" — đúng, khớp `App.tsx:664/755` và `:656/753` (rủi ro #2).
  - "6 auth variant mất ConditionalAuth/RequireAuth" — đúng, grep xác nhận 6 (rủi ro #3).
  - "wrapper-route: thiếu `<Outlet/>` / thiếu inner `*` → trắng trang thay vì NotFound" — đúng cơ chế React Router v6 nested (rủi ro #4). `ViLanguageWrapper` hiện chỉ render `{children}`, chưa có Outlet — xác nhận.
  - "v6 ranked matching → thứ tự khai báo không phải vấn đề; prefix path không đổi public URL; prerender không vỡ vì đổi router" — đúng, khớp `react-router-dom ^6.30.1`.
- **Bác bỏ:** không có claim nào bị bác. GPT-5.6 tự kiềm chế đúng chỗ: nó TỪ CHỐI bịa ra failure cho việc wrap 3 route ngoại lệ, nói "verify whether omission is still required" — calibration tốt, không phải hallucination.
