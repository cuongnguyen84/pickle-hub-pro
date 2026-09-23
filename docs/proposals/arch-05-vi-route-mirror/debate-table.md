## Bảng bất đồng — arch-05-vi-route-mirror

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Hình dạng route: config array map 2 lần (giữ per-route ViLanguageWrapper) hay route cha /vi (parent layout, wrapper render <Outlet/>)? | **solution-architect**: Option A — config array MIRRORED double-map, byte-identical; bác nested /vi layout (Option C) vì không đạt mục<br>**ui-ux-critic**: Route cha /vi giữ mount là NÂNG CẤP UX: sửa được nhóm bug ngôn-ngữ-sai + bug /vi/<sai> ra NotFound tiếng Anh;  | **solution-architect**: HOLD<br>**ui-ux-critic**: CONCEDE (`src/components/layout/ViLanguageWrapper.tsx:15,29 — effect d`) | ✅ RESOLVED_EVIDENCE | Config array double-map (Option A) thắng — giữ mount semantics, né bẫy trắng trang; các fix UX (wrapper cho route ngoại lệ, VI NotFound) thực hiện được ngay trong config array. |
| D2 | Scope hành vi: byte-identical hay vá luôn 3 route bỏ ViLanguageWrapper (SocialEventLive, Rankings, Feed) + VI NotFound trong cùng đợt? | **solution-architect**: Byte-identical — refactor không đổi hành vi; 3 ngoại lệ giữ nguyên, chuẩn hoá là việc khác.<br>**ui-ux-critic**: Vá 3 route ngoại lệ + 404-VI trong cùng PR gần như free, giá trị UX thật cho 95% user VI. | **solution-architect**: REFINE<br>**ui-ux-critic**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |

### 🔶 Cần anh quyết (1)

**D2 — Scope hành vi: byte-identical hay vá luôn 3 route bỏ ViLanguageWrapper (SocialEventLive, Rankings, Feed) + VI NotFound trong cùng đợt?**

- `solution-architect`: Byte-identical — refactor không đổi hành vi; 3 ngoại lệ giữ nguyên, chuẩn hoá là việc khác.
- `ui-ux-critic`: Vá 3 route ngoại lệ + 404-VI trong cùng PR gần như free, giá trị UX thật cho 95% user VI.


