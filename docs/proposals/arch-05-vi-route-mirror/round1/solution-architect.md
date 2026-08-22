## Tóm tắt kiến trúc

Vấn đề thật không phải "63 dòng JSX xấu" mà là **mỗi route mới phải sửa 2 chỗ, quên 1 = user VI 404**. React Router v6 (`react-router-dom ^6.30.1`, `BrowserRouter`, không phải data router) rank route theo specificity chứ không theo thứ tự khai báo — nên gom 63 cặp mirror vào một mảng rồi `.map()` hai lần **không đổi hành vi match** và mọi URL byte-identical, prerender (`functions/_middleware.ts` strip `/vi` bằng regex) không bị đụng. Giải pháp: một mảng config các route được-mirror + double-map, cộng một test parity làm hợp đồng chống-404; **không** đổi sang `createBrowserRouter` (đó là viết lại 192 route, rủi ro cao, không đáng cho một người).

## Option A — Config array mapped twice + parity guard

Effort: 3–4 half-days · Files: thêm `src/routes/vi-mirror.tsx` (mảng + type), sửa `src/App.tsx` (thay ~63 `<Route>` bằng 2 vòng `.map`), thêm `src/routes/vi-mirror.test.ts` · Data: none (không migration, không RLS, không RPC)

How it works:
- Một mảng khai báo **chỉ 63 route được mirror**:
  ```ts
  type MirrorRoute = {
    path: string;            // EN path không kèm "/", vd "tools/team-match/:id"
    element: ReactNode;      // element EN (giữ nguyên ConditionalAuth/RequireAuth lồng trong)
    viElement?: ReactNode;   // override VI: Blog→ViBlog, News language="vi"
    viSkipWrapper?: boolean; // 3 ngoại lệ: rankings, feed, social/:slug/live
  };
  ```
- Render trong `<Routes>`:
  ```tsx
  {MIRRORED.map(r => <Route key={r.path} path={`/${r.path}`} element={r.element} />)}
  {MIRRORED.map(r => {
    const el = r.viElement ?? r.element;
    return <Route key={`vi-${r.path}`} path={`/vi/${r.path}`}
      element={r.viSkipWrapper ? el : <ViLanguageWrapper>{el}</ViLanguageWrapper>} />;
  })}
  ```
- 66 route KHÔNG có mirror (admin/*, creator/*, auth/*, match/*, `/tran-dau/*`, `/nguoi-choi/:username`, `/clb/*`, share/embed, catch-all) **ở nguyên** dưới dạng `<Route>` viết tay — mảng chỉ giữ đúng tập được-mirror, không đụng phần còn lại.
- 3 ca đặc biệt xử lý bằng field, không bằng ngoại lệ rải rác: `/blog/:slug`↔`/vi/blog/:slug` (`viElement: <ViBlogPost/>`), News (`viElement: <News language="vi"/>` và `<NewsArticle language="vi"/>`), 3 route bỏ wrapper (`viSkipWrapper: true`).
- **Hành vi giữ nguyên tuyệt đối:** mỗi route VI vẫn được bọc `ViLanguageWrapper` riêng như hôm nay — semantics mount/unmount + restore `lang="en"` y hệt. Không đổi mount tree.

Wins: đạt đúng tiêu chí "thêm route 1 chỗ"; 3 ca đặc biệt thành dữ liệu tường minh (dễ đọc hơn JSX rải rác); guard test biến "quên mirror" từ bug-prod thành fail-CI. · Loses: diff chạm file router load-bearing nhất (dù v6-ranking khiến reorder an toàn, vẫn cần review kỹ + smoke); mảng chứa JSX element nên hơi rối hơn mảng data thuần. · Forecloses: gần như không — vẫn có thể tiến lên nested-layout hay data-router sau này; chỉ khoá việc "để nguyên JSX thuần" (giá trị thấp).

## Option B — Parity guard test only (the cheap one)

Effort: 1 half-day · Files: thêm `src/routes/vi-mirror.test.ts` (hoặc `tests/vi-route-parity.spec.ts`) · Data: none

How it works: **không** restructure gì. Một test đọc `src/App.tsx` (regex `path="..."`), tính tập EN route thuộc "mirror-set" (loại trừ admin/creator/auth/match/... bằng allowlist prefix), rồi assert mỗi route đó có twin `/vi/...`. Fail CI khi thêm EN route mà quên `/vi`. Kèm assert ngược: mọi `/vi/...` phải có gốc EN (bắt route mồ côi).

Wins: diệt đúng failure-mode gây đau (quên mirror → 404 VI) với rủi ro gần-zero, không chạm 192 route; ship trong một buổi tối. · Loses: KHÔNG giảm double-edit — vẫn viết 2 route, guard chỉ la khi quên; không giảm dòng JSX. · Forecloses: không khoá gì; đây là bước 1 của Option A dùng độc lập được.

## Option C — Nested `/vi` layout route

Effort: 2 half-days · Files: sửa `src/App.tsx` + `ViLanguageWrapper.tsx` (render `<Outlet/>` thay children) · Data: none

How it works: một route cha `path="/vi"` element `<ViLanguageWrapper><Outlet/></ViLanguageWrapper>`, các route con dùng path tương đối (bỏ prefix `/vi` + bỏ 63 lần lặp wrapper). 3 ngoại lệ đặt thành route `/vi/...` phẳng ngoài cha.

Wins: xoá 63 lần lặp `ViLanguageWrapper`; wrapper mount một lần cho cả subtree (ít effect-thrash hơn). · Loses: **KHÔNG đạt tiêu chí "1 chỗ"** — vẫn phải viết cả EN lẫn VI con; và **đổi semantics mount**: hôm nay mỗi lần đổi route VI thì wrapper unmount/mount lại (restore `en` rồi set `vi`), layout dùng chung thì không — điều nãy đổi hành vi (nhiều khả năng tốt hơn, nhưng là thay đổi cần verify trình duyệt). · Forecloses: đẩy về hướng nested/data-router, khó quay lại map-twice sau.

## Khuyến nghị

**Option A, làm tăng dần, với test của Option B là increment 1 kiêm hợp đồng an toàn.** Chỉ A đạt tiêu chí thành công "thêm route một chỗ" *và* giữ hành vi byte-identical (mỗi VI route vẫn bọc `ViLanguageWrapper` riêng — không như C đổi mount semantics). Rủi ro regress trên 192 route thấp hơn tưởng vì **v6 rank route theo specificity, không theo thứ tự nguồn**, nên gom/reorder vào `.map` không đổi route nào thắng. C thua vì tốn công tương đương nhưng không giải quyết double-edit lại còn đổi hành vi mount cần test lại. `createBrowserRouter`/route-objects thua thẳng: viết lại toàn bộ router, chuyển `BrowserRouter`→`RouterProvider` kéo theo `DeepLinkInitializer`/`PageTracker`/`ScrollToTop`/`ChatFAB` (đang dùng hook trong cây Router) — không đáng cho một người, không mua thêm gì so với A. B đơn độc là lựa chọn "dừng sớm" hợp lệ nếu Cuong chỉ muốn chặn 404: nó không giảm số dòng nhưng diệt đúng con bug.

Bundle: **0 KB** — refactor thuần, element vẫn trỏ cùng các lazy component, không thêm dependency. SSR: URL byte-identical → không đụng `functions/_middleware.ts`, không đổi sitemap, không đổi cặp hreflang. Không phải RED-tier (không chạm auth/payments/`config.toml`).

## Increments

1. **Guard test** (`src/routes/vi-mirror.test.ts`) — verify: `npm run test` xanh trên cây hiện tại (chứng minh 63 cặp hiện đã đủ), fail thử bằng cách xoá tạm một `/vi` route.
2. **Nhóm "sạch"** — migrate block chuyên `/vi/*` dòng 743–787 (tools/*, forum/*, static pages, account) vào `MIRRORED` + double-map. Verify: guard xanh + `npm run lint` + smoke `/vi` + `curl -A Googlebot` mẫu 2 URL (200, title/hreflang đúng).
3. **Nhóm interleaved** — migrate social/venues/clubs/messages (dòng 567–644) vào mảng. Verify: như trên + click thử SPA nav vào vài route VI.
4. **Ca đặc biệt** — News (`viElement`), Blog↔ViBlog (`viElement`), 3 route `viSkipWrapper` (rankings/feed/social live). Verify: mở trình duyệt kiểm `document.documentElement.lang` trên 3 route bỏ-wrapper khi hard-load *và* khi SPA-nav vào. **Điểm dừng-nhìn** ở đây trước khi merge.

## Điều em không chắc

- **Hành vi lang trên SPA-nav vào 3 route bỏ-wrapper** (`/vi/rankings`, `/vi/feed`, `/vi/social/:slug/live`): recon §3 ghi rõ đây là code-path *chưa test trình duyệt*. Option A giữ nguyên `viSkipWrapper` nên không làm xấu đi, nhưng em chưa xác minh nó đang đúng hôm nay — nếu nó đang là bug tiềm ẩn thì refactor sẽ giữ nguyên bug đó, không sửa (ngoài scope).
- **Allowlist prefix cho guard test**: tập "route nào phải có mirror" là quy ước em suy từ recon (loại admin/creator/auth/match/share/embed/`tran-dau`/`clb`/`nguoi-choi`). Nếu Cuong muốn một route trong nhóm "loại trừ" sau này có bản VI, guard phải cập nhật allowlist — cần chốt danh sách này với Cuong ở round tới.
- **Giả định v6-ranking**: em tin reorder-an-toàn dựa trên tài liệu React Router v6, nhưng chưa dựng test đối chứng thứ-tự-match cho các path chồng lấn (vd `/tools/quick-tables/:shareId` vs `/tools/quick-tables/:shareId/setup`). Increment 2–3 nên có một smoke điều hướng thật để bắt hồi quy match-order nếu giả định sai.
