# Shop closed pilot — gói chuẩn bị, bàn giao

> **Câu trạng thái được phép dùng:**
>
> `Closed-pilot deployment package prepared and verified locally, pending
> Product Owner approval for remote actions.`
>
> **CẤM dùng:** *pilot deployed* · *production ready* · *remote verified* ·
> *preview live* · *seller onboarded*.

---

## 1. Nền tảng

| Thứ | Giá trị |
|---|---|
| Canonical P2b acceptance HEAD | **`f172a441fb182dc562af4c0d20d13a73fa0b0326`** |
| Nhánh mới | **`feat/shop-closed-pilot`** |
| Worktree | `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-closed-pilot` |
| Trạng thái push | **CHƯA push** — nhánh chỉ tồn tại cục bộ |
| Trước `main` | 82 commit (Shop) + 5 commit closed-pilot |
| Sau `main` | 12 commit (SEO/homepage/livestream, không chạm Shop) |

`f172a441` là commit cuối, **không** phải `7b52cc37` — ba supplemental commit
P2b.7b nằm sau nó và đều có trong nền tảng.

---

## 2. Đã tạo ra gì

| File | Nội dung |
|---|---|
| `release-inventory.md` | Kiểm kê: commit, 17 migration, function, cron, bucket, RLS, 95 RPC, route, env, cờ, giám sát, phụ thuộc rollback + vệ sinh Git |
| `environment-audit.md` | Audit chỉ đọc Supabase + Cloudflare, 4 blocker, ma trận môi trường |
| `pilot-contract.md` | Phạm vi, 4 ranh giới an toàn, 10 đầu vào cần Product Owner, tiêu chí dừng |
| `seller-rules-v1-outline.md` | Khung `DRAFT — NOT LEGAL APPROVAL` + thiết kế versioning/bằng chứng chấp thuận |
| `media-worker-deployment.md` | Gói worker + cron, bảo mật, log, cảnh báo, rollback, rotate |
| `migration-deployment.md` | 17 file, khoá/rủi ro, preflight, đối chiếu remote, phân loại rollback |
| `pilot-allowlist.md` | SQL vận hành có kiểm toán, kiểm khô, thiết kế RPC/UI cho sau này |
| `preview-deployment.md` | Ma trận môi trường, redirect/CORS, ma trận noindex, dọn dẹp |
| `operations.md` | 1 truy vấn bảng điều khiển, 14 cảnh báo, kill switch và giới hạn của nó |
| `notification-decision.md` | Đề xuất "không có thông báo tự động" + runbook liên lạc tay + ô ký |
| `acceptance.md` | 24 kiểm, 6 tự động / 18 thủ công |
| `gate-results.md` | Kết quả cổng cục bộ, và defect chúng bắt được |
| `approval-packets/` | README + Packet A/B/C/D |
| `scripts/shop-closed-pilot-smoke.mjs` | Bộ smoke cho môi trường đã deploy, có allowlist mục tiêu |

Một thay đổi mã nguồn duy nhất:
`scripts/shop-media-integration.test.mjs` — vá teardown rò rỉ (§5).

---

## 3. Phát hiện remote (chỉ đọc)

**Shop là tờ giấy trắng trên `ajvlcamxemgbxduhiqrl`.**

| Thứ | Remote |
|---|---|
| Bảng / bucket / cron job Shop | **0 / 0 / 0** |
| `shop-media-lifecycle` | **chưa deploy** (80 function ACTIVE) |
| Va chạm tên | **0** |
| `is_admin()` (có AAL2), `has_role()`, `audit_logs` | ✅ có |
| `log_audit_event()` | ✅ **đúng 1 overload**, khớp chữ ký Shop gọi |
| `pg_cron`, `pg_net`, `vault` + `cron_secret` | ✅ có |
| `CRON_SECRET` (edge secret) | ✅ **đã có** — không cần tạo |
| `unaccent` / `pg_trgm` | ❌ không cài — và **không cần** |
| Admin | 1 vai admin, 1 TOTP factor đã verify |

### Drift ledger — chính xác, không nói chung chung

Local 350 file · remote ledger 325 dòng · **29 file vắng mặt** (17 Shop + 12
không thuộc Shop) · **4 version remote không có file local**.

Probe object thật cho cả 12 file không thuộc Shop:

- **11/12 đã áp**, chỉ thiếu dòng ledger.
- 🔴 **1/12 THẬT SỰ CHƯA ÁP** — `20260805150000_news_source_ppa_tour_pause`.
  Nguồn tin `ppa-tour` vẫn `active=true` trên production dù feed đã 404 từ 05/08.

Đây đúng là lý do lệnh **"cấm chèn ledger mù"** tồn tại. Ngoài phạm vi Shop,
ghi lại, **không sửa**.

---

## 4. Ba đính chính cho `deployment-readiness.md`

Cả ba tìm ra bằng cách đọc chính vật thể, không đọc ghi chú về nó.

| Mục | Ghi chú cũ nói | Thực tế |
|---|---|---|
| A1 | Migration `RAISE EXCEPTION` nếu vault trống ⇒ phải nạp secret **trước** | Exception nằm **trong thân cron job**, kích hoạt lúc **chạy**. Ràng buộc thứ tự đó là ảo. (Ràng buộc thật: deploy function **trước** migration tạo cron) |
| A2 | "Đặt secret `CRON_SECRET` cho function" | Secret là **cấp project** và **đã tồn tại**; 5 caller cron khác đang dùng. Chạy `secrets set` có nguy cơ rotate nhầm và làm **mọi** cron 401. **Packet C bỏ hẳn bước này** |
| A8 | Bucket public "chỉ webp", 1 MB | Bucket cho phép jpeg/png/webp, 8 MB. **Worker** mới là chỗ cưỡng chế webp + 1 MB + 2048px. Không ai giữ JWT ghi được vào bucket đó, nên kết quả giống nhau — nhưng tiêu chí nghiệm thu phải nhắm vào worker |

---

## 5. Defect mà cổng kiểm tra bắt được

**Teardown nói dối lần thứ năm, lần này ở tầng Storage.**

Bộ nghiệm thu P2b in `"objects": 0`. Đếm độc lập trên chính cơ sở dữ liệu vừa QA
tìm thấy **6 object trong bucket RIÊNG TƯ `shop-product-media-draft`**.

Thủ phạm: `scripts/shop-media-integration.test.mjs` rò rỉ **2 object mỗi lần
chạy**. `afterAll` đi xuống hai tầng thư mục, nhưng đường dẫn máy chủ chọn là
`<shop>/<product>/<media>/original` — **ba** tầng. `remove()` gọi lên tiền tố, và
xoá key không tồn tại là **thành công hợp lệ** trong Storage, nên không gì báo lỗi.

Vá: đi xuống tận đáy, phân biệt object với tiền tố bằng `entry.id`.
Đỏ-trước-xanh-sau: **+2/lần → +0/lần**, hai lần liên tiếp; `storage_objects`
giữ **0 → 0** qua một lượt `vitest run` đầy đủ.

Vì sao không phải tiếng ồn: bucket đó **riêng tư**; preview **dùng chung** cơ sở
dữ liệu với production nên file này nhắm vào môi trường nào cũng để lại object ở
đó; và đây là **lần thứ năm** một teardown ở repo này báo sạch trong khi không
sạch — bốn lần trước ở tầng cơ sở dữ liệu, lần này ở tầng Storage, chỗ bản sao
lưu cơ sở dữ liệu không với tới.

---

## 6. Cổng kiểm tra cục bộ — tất cả XANH

Cơ sở dữ liệu dựng lại từ số không trước khi đo.

| Cổng | Kết quả |
|---|---|
| `supabase db reset --local` | exit 0 |
| Ledger parity | **350 / 350** |
| pgTAP | **1 241 PASS** — chạy **hai lần**: một lần sạch, một lần sau QA |
| Unit | **2 014 PASS**, 10 skipped |
| Storage + vòng đời ảnh (stack thật) | **40 PASS**, không skip |
| noindex ở edge | **116 PASS** |
| `tsc -b` · `eslint` · `build` | exit 0 · 0 lỗi · exit 0 |
| Bundle `BUNDLE_STRICT=1` | exit 0 — **1 935,3 KB gz / 1 970 backstop** (không nâng), INITIAL **226,6 / 280** |
| `build:proto` | exit 0 |
| Q01–Q04 | **37 màn hình, 0 phát hiện** |
| Nghiệm thu P2b | **PASS** — 20 route × 6 chiều rộng, 6 hành trình |
| Dọn dữ liệu | **17/17 bộ đếm = 0**, đếm độc lập |
| Chỉ mục TẮT · sitemap không có Shop · không ghi remote | ✅ ✅ ✅ |

Dấu vết đầy đủ và hai lần đỏ vì môi trường: [`gate-results.md`](./gate-results.md).

---

## 7. Blocker chưa gỡ

| # | Blocker | Ai gỡ | Chặn |
|---|---|---|---|
| **B1** | URL preview có trong Supabase Auth → Redirect URLs? Không đọc được ở chế độ chỉ đọc (endpoint trả secret cùng payload) | Cuong, dashboard | Packet A |
| **B2** | `SHOP_PUBLIC_INDEXING` không tồn tại ở **cả** Production lẫn Preview? Không có lệnh CLI đọc được | Cuong, dashboard | Packet A, D |
| **B3** | Preview trỏ vào Supabase nào — **không có project staging** | Product Owner | **Packet A và B** |
| **B4** | "Quy chế người bán v1" chưa tồn tại | Cuong / pháp lý | Người bán thật |
| **B5** | 🔴 **Việc gửi hồ sơ KHÔNG cưỡng chế chấp thuận quy chế.** Ô đồng ý bị khoá, `shop_application_submit()` xác thực 5 trường và không kiểm chấp thuận, `shop_applications` không có cột bằng chứng | Product Owner | Người bán thật |
| **B6** | Quyết định thông báo chưa ký | Product Owner | Packet D |
| **B7** | 9 đầu vào của Packet D chưa điền (UUID, thời gian, người trực, ngưỡng dừng) | Product Owner | Packet D |

**B5 đáng đọc lại.** Câu "submit bị khoá cho tới khi có quy chế" là **sai**. Một
người bán được duyệt hôm nay sẽ không để lại bằng chứng chấp thuận nào. Không ai
từng viết rằng nó chặn — **niềm tin rằng nó chặn mới là thứ nguy hiểm**.

---

## 8. Bốn packet — không cái nào được duyệt

| Packet | Nội dung | Tier |
|---|---|---|
| [A](./approval-packets/packet-a-preview.md) | Đẩy nhánh; Cloudflare tự dựng preview | 🟡 AMBER |
| [B](./approval-packets/packet-b-migrations.md) | 17 migration lên `ajvlcamxemgbxduhiqrl` | 🔴 **RED** |
| [C](./approval-packets/packet-c-worker-cron.md) | Deploy `shop-media-lifecycle`, xác nhận cron | 🟡 AMBER |
| [D](./approval-packets/packet-d-pilot-activation.md) | Chèn UUID người bán, mở pilot | 🔴 **RED** |

**Thứ tự đọc A → B → C → D. Thứ tự thi hành B → C → A → D**, vì preview web trỏ
vào Supabase production và một preview có route Shop trên cơ sở dữ liệu không có
bảng Shop là một preview lỗi ở mọi màn hình. Web **sau** backend, luôn luôn.

Trong B, function phải deploy trước migration #4 — nên C chèn vào giữa B.

---

## 9. Khuyến nghị: duyệt cái gì trước

**Packet B**, nhưng câu hỏi thật sự đứng trước nó là **B3**: *preview trỏ vào
Supabase nào?*

Không có project staging. Ba lựa chọn ở [`environment-audit.md` §5](./environment-audit.md);
khuyến nghị là **preview web + Supabase production**, vì đó là cách duy nhất
kiểm được cron và worker thật, và ba lớp bảo vệ đã có sẵn chứ không phải thêm
vào:

1. `shop_pilot_members` rỗng ⇒ không ai tạo được gì;
2. `SHOP_PUBLIC_INDEXING` không đặt ⇒ mọi route Shop noindex ở edge;
3. `main` không có route Shop ⇒ web production không đổi một pixel.

Đổi lại, phải chấp nhận rằng schema Shop sống trên cơ sở dữ liệu production
trước khi ai duyệt pilot. Nó là thêm mới thuần, thao tác đắt nhất dưới một giây
— nhưng đó là điều Product Owner **nói "được"**, không phải điều suy ra từ việc
nó an toàn.

Trả lời B3 xong thì B → C → A → D chạy theo thứ tự.

---

## 10. Không thao tác remote nào đã thực hiện

Đối chiếu với danh sách cấm:

| Cấm | Trạng thái |
|---|---|
| `supabase link` | ❌ không chạy |
| Áp migration remote | ❌ không |
| Deploy Edge Function | ❌ không |
| Tạo/đổi secret remote | ❌ không |
| Tạo cron remote | ❌ không |
| Seed allowlist remote | ❌ không — bảng vẫn chưa tồn tại |
| Sửa vai trò/admin remote | ❌ không |
| Deploy Cloudflare (preview/production) | ❌ không |
| Merge / push | ❌ không — nhánh chỉ ở cục bộ |
| Gửi email/push thật | ❌ không |
| Bật lập chỉ mục · IndexNow · sitemap Shop | ❌ không |
| Tạo dữ liệu người bán thật | ❌ không |
| Bắt đầu Phase 3 | ❌ không |

Mọi truy vấn Postgres đi qua một script từ chối bất cứ câu lệnh nào không bắt
đầu bằng `SELECT`/`WITH`. Không giá trị secret nào được đọc hay in — chỉ tên.
