# Shop closed pilot — gói chuẩn bị, bàn giao

> **Câu trạng thái được phép dùng:**
>
> `Seller Rules v1, the Privacy disclosure, the B13 media fix and the B12
> owner-offboarding block are approved and applied locally; closed-pilot
> package pending approval to execute Packet S/B on staging.`
>
> **CẤM dùng:** *pilot deployed* · *production ready* · *remote verified* ·
> *preview live* · *seller onboarded*.

---

## 1. Nền tảng

| Thứ | Giá trị |
|---|---|
| Canonical P2b acceptance | `f172a441` |
| Nhánh | **`feat/shop-closed-pilot`** |
| Worktree | `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-closed-pilot` |
| Trạng thái push | **CHƯA push** — nhánh chỉ tồn tại cục bộ |
| Commit trên `f172a441` | **31** |

```
81604053 fix(account): block shop-owner self-service deletion safely
9ac773bf fix(shop-media): reconcile product and profile media safely
c673df59 docs(shop-pilot): CP16 record — gates, and a blocker that moved inward
f9639ae7 style(privacy): drop an unused import from the disclosure test
d7ab073e test(shop): what account deletion actually does, measured at the call site
b69b3cb7 feat(privacy): name the data Shop actually processes
75ead3a4 docs(shop-pilot): CP15 record, and the remote plan written down before anyone runs it
4a142ec3 docs(shop-pilot): the Privacy disclosure Shop owes, as a patch nobody applied
68b1bd2c feat(shop): the approved Seller Rules v1, published by migration
0f036e1e docs(shop-pilot): revise Seller Rules v1, and fill in the real staging ref
3abad4a5 docs(shop-pilot): CP13 record, gate delta, and the handoff
8fdf41f9 docs(shop-pilot): Packet S against the real staging project, and a 21-item dashboard checklist
d716ae19 docs(shop-pilot): carry the notification limitation into the contract and the readiness list
d98afb6e docs(shop-pilot): the full Seller Rules v1 draft, and a review artifact for it
a3cb5532 test(shop): fixtures now have to approve the document they publish
057facd9 feat(shop): show the moderator what the applicant actually agreed to
cf52120a feat(shop): a rules version is a draft until somebody approves it
c2917c35 docs(shop-pilot): CP12 record, gate delta, and the completion handoff
95f067a7 docs(shop-pilot): Packet S, a staging-first order, and a checklist for the dashboard
648c2cf4 docs(shop-pilot): record the notification decision as signed
cb8dd567 fix(shop): the append-only trigger made applications undeletable
49472978 test(shop): prove the rules gate over HTTP, and fix two things it exposed
0a773a3a feat(shop): show the seller the rules, then let them agree to them
dd43a579 feat(shop): the server, not a checkbox, decides that a seller agreed
544f5ddb docs(shop-pilot): completion and handoff
c3228f23 fix(shop): the media integration teardown walked two levels, not three
3a5da404 docs(shop-pilot): CP4-CP10 deployment packages, operations and smoke suite
30967af7 docs(shop-pilot): CP2 pilot contract + CP3 seller-rules outline and versioning
57d9566a docs(shop-pilot): CP0 release inventory + CP1 read-only environment audit
```

---

## 2. CP17 — B13 đã vá, B12 đóng bằng phương án C, B14 để riêng

### B13 — vòng quét dọn ảnh giờ hiểu cả hai miền media

Migration `20260814110000` = **Packet B #20**. Nó không thêm một điều kiện loại
trừ; nó viết ra thứ đang thiếu: `shop_media_referenced_objects()` — mọi cặp
`(bucket, path)` hệ thống mong đợi tồn tại, từ **cả** `product_media` **và**
`shop_profile_media`, qua **mọi cột chứa key**. Vòng quét là phần bù của tập đó,
nên miền media thứ ba trong tương lai chỉ cách một `UNION`.

Nhân tiện đóng một race mà ân hạn chỉ che *gần như*: key công khai của rendition
sản phẩm là **tất định**, nên tập tham chiếu chứa luôn key mà một ảnh đã verified
**sắp** được publish tới.

🔴 **#20 phải áp trước khi bất kỳ môi trường nào bật cron dọn ảnh.**

Đính chính CP16: đường nguy hiểm **có thật hôm nay** là **draft/24 giờ** (màn
cài đặt shop upload logo vào bucket đó), không phải public/1 giờ — bucket công
khai chưa có object profile nào vì `shop_profile_media_publish_commit()` chưa có
caller production.

### B12 — phương án C, và máy chủ là chỗ cưỡng chế

`delete-account` hỏi **một câu trước bước dọn đầu tiên**: tài khoản này có sở
hữu shop không. Có → **409 `shop_owner_offboarding_required`**, chưa đụng gì.

Thứ tự là toàn bộ vấn đề: bên dưới chỗ kiểm là vòng lặp 13 bảng rồi mới tới
`deleteUser`, **không transaction**. Một lời từ chối đến từ Postgres ở bước cuối
là lời từ chối đến **sau khi** tài khoản đã bị tháo rời. Hôm nay điều đó không
xảy ra — và chỉ vì may (B14). Khi B14 được sửa, chỗ kiểm này giữ cho nó an toàn.

**Quyền sở hữu, không phải tư cách thành viên**: manager/support không bị chặn.

Hộp thoại hỏi cùng câu đó qua `useMyShop` — hook vốn đã nghĩa là
`owner_user_id = tôi` — và với chủ shop thì **không có ô gõ `DELETE`**, chỉ có
lời giải thích và một nút **soạn** email. Câu giữ cho nó trung thực: *"nút bên
dưới chỉ mở ứng dụng email — nó KHÔNG tự gửi yêu cầu."*

Runbook offboarding 7 bước: [`account-deletion-b12.md` §7](./account-deletion-b12.md).

### B14 — cố ý không sửa, và có một cảnh báo đi kèm

Hồ sơ riêng: [`docs/defects/b14-delete-account-cleanup-noop.md`](../../defects/b14-delete-account-cleanup-noop.md),
đã trỏ từ **Known Bugs** trong `CLAUDE.md`.

🔴 **Không cấp các grant `service_role` còn thiếu như một bản vá lẻ.** Grant
không phải là lỗi; lỗi là một chuỗi xoá nhiều bước không bảo đảm thứ tự, với một
phản hồi thành công không phụ thuộc vào chính các bước của nó. Cấp grant lẻ biến
một no-op vô hại thành xoá thật chạy trước `deleteUser`.

Câu chữ đã sửa cùng lúc: hộp thoại từng hứa xoá "các giải đấu bạn đã tạo" trong
khi `quick_tables`/`team_match_tournaments` là `SET NULL` và giải đấu **sống
sót**.

### Hai phát hiện về chính bộ máy kiểm thử

- 🔴 **Edge runtime đang phục vụ `supabase/functions` của worktree KHÁC**
  (`shop-p2b`), vì `supabase start` từng chạy từ đó. `docker restart` không sửa
  được — mount nằm trong định nghĩa container. Đã `stop` + `start` lại từ
  worktree này. `diff -rq` cho thấy chỉ **một** file khác nhau, nên các cổng
  trước đó vẫn đứng vững.
- 🔴 **Teardown nói dối lần thứ sáu**: job do reconciler ghi mang `shop_id`
  **NULL**, nên `afterAll` xoá theo `shop_id` để sót 2 dòng. Đã vá bằng cách xoá
  thêm theo `object_path`.

---

## 3. CP16 — Chính sách bảo mật nói tên dữ liệu Shop, và ba phát hiện về xoá tài khoản

### Privacy — B11 đóng cục bộ

Product Owner duyệt toàn bộ bản sửa; đã áp vào `Privacy.tsx` + `vi.ts` + `en.ts`.
Bốn nhóm dữ liệu (công khai · hồ sơ nội bộ · bằng chứng chấp thuận · nhật ký
kiểm duyệt), mục đích, phạm vi người đọc, vòng đời **đúng tới đâu khoá ngoại
làm được tới đó**, và ngày hiệu lực `14/08/2026`.

🔴 **Chưa deploy.** `thepicklehub.net/privacy` vẫn phục vụ bản cũ cho tới khi
nhánh này được merge.

File `.patch` đã xoá sau khi áp — giữ hai bản sao của cùng nội dung là mời chúng
đi lệch nhau, và `git show` là bản ghi chính xác hơn. Tài liệu giải thích ở lại
vì nó mang **lý do** và bảng vòng đời, thứ diff không nói.

Khoá bằng **21 assertion**, hai tầng có chủ ý — [`privacy-shop-disclosure.md`
§6](./privacy-shop-disclosure.md). Tầng "qua trang" tồn tại vì **một mục chỉ
nằm trong từ điển là một mục không ai được xem**; tầng "qua từ điển, từng ngôn
ngữ" tồn tại vì "tiếng Việt nói địa chỉ lấy hàng là riêng tư, tiếng Anh quên
mất" thì test render một ngôn ngữ không thấy được.

### B12 — đo tại call site, và ba thứ đọc khoá ngoại không thấy

Chi tiết: [`account-deletion-b12.md`](./account-deletion-b12.md). Hai file
**chẩn đoán**, không đổi hành vi production.

| # | Phát hiện | Trạng thái |
|---|---|---|
| **B12** | Chủ shop **không xoá được tài khoản** (`RESTRICT`). Người dùng **không** bị báo thành công giả, nhưng lỗi họ nhận là `Failed to delete account` và GoTrue nuốt nguyên nhân thành `"Database error deleting user"` — không ai biết cái chặn là một shop | 3 phương án, khuyến nghị **C**, chờ quyết |
| **B13** | 🔴 `shop_media_reconcile()` xếp **logo đang sống** vào hàng đợi xoá — vòng quét orphan chỉ biết `product_media` | **chặn Packet C** |
| **B14** | ⚠️ `delete-account` trả **200 success** trong khi **cả 13 bước dọn dữ liệu thất bại**; hộp thoại hứa xoá "các giải đấu bạn đã tạo" nhưng chúng là `SET NULL` và **sống sót** | ngoài phạm vi Shop |

Điều đáng giữ lại nhất từ checkpoint này: hồ sơ của chủ shop **còn nguyên** sau
một lần xoá thất bại — nhưng **do may**, không do cẩn thận. Những lệnh xoá đáng
lẽ chạy trước `deleteUser` đều lỗi quyền. **Cấp quyền mà không sửa luồng** sẽ
biến vòng lặp vô hại đó thành một lần xoá thật, chạy trước, không transaction.
Đó chính là lý do phương án A nguy hiểm hơn vẻ ngoài.

---

## 4. CP15 — Quy chế v1 được duyệt, và được ban hành

Product Owner **APPROVE** toàn văn ngày 13/08. Bản ghi:

| Trường | Giá trị |
|---|---|
| `document_key` / `version` / `scope` | `seller-rules` / `v1` / `closed-pilot` |
| `approved_by` | `Cuong Nguyen — Product Owner, ThePickleHub` |
| `approved_at` | `2026-08-13T07:30:00+07:00` |
| `effective_at` | `2026-08-14T00:00:00+07:00` |
| `content_hash` | `fb62bd471d7b6b27c53d9eeded57dd636aa2f1f1f03db9a4a20abd49d7c70c98` |
| Kích thước văn bản | **33 568 byte** (26 147 ký tự) |
| Ban hành bởi | `20260814100000_shop_seller_rules_v1_publish.sql` — Packet B **#19** |

### Vì sao là migration chứ không phải script seed

Văn bản mà người bán ký phải tới staging và production bằng **cùng con đường đã
được rà soát** như schema. Một script seed chạy tay là con đường thứ hai để hai
môi trường cùng mang số hiệu `v1` mà nội dung khác nhau — và không ai phát hiện
ra, vì cả hai đều "đã seed".

### Ba thứ khiến bản ghi không thể lệch với văn bản đã duyệt

1. **Thân văn bản trong migration là file, đúng từng byte.**
   `shop-seller-rules-v1-parity.test.ts` so sánh nguyên văn, không chuẩn hoá,
   không `toContain`. Lệch một dấu cách là đỏ.
2. **`content_hash` không có trong câu `INSERT`.** Nó là cột `GENERATED`;
   Postgres tính, và khối `DO` cuối migration **đọc lại** rồi RAISE nếu nó khác
   `fb62bd47…`. Không môi trường nào phục vụ được văn bản khác hồ sơ phê duyệt:
   hoặc khớp, hoặc migration đỏ.
3. **Hằng số hash được test tính lại từ file**, không phải tin. Nếu ai sửa văn
   bản, hằng số thành mô tả một văn bản không còn tồn tại — và đó là điều test
   bắt.

Cả hai đường đều đã bị làm cho **ĐỎ trước khi tuyên xanh** —
[`gate-results.md` §6](./gate-results.md).

### Mã băm không nằm trong văn bản

Một văn bản không thể chứa mã băm của chính nó: viết mã băm vào là đổi nội
dung, và mã băm vừa viết lập tức sai. §20 của quy chế nói thẳng điều đó thay vì
để một ô trống trông như thiếu sót. Một assertion cấm văn bản chứa chuỗi hash
của chính nó.

### Cửa chưa mở ngay, và đó là đúng

`effective_at` là **nửa đêm 14/08**, nên tới lúc đó `legal_current_document()`
vẫn trả 0 dòng và `shop_application_submit()` vẫn từ chối bằng
`seller_rules_not_published`. Áp Packet B trước thời điểm đó **không** mở pilot
sớm.

### Ba bộ test phải sửa vì trước đây chúng khẳng định trạng thái toàn cục

| File | Trước | Sau |
|---|---|---|
| `shop_seller_rules_acceptance.test.sql` | dựng thế giới riêng nhưng dùng lại đúng khoá `seller-rules/v1` | xoá mọi `seller-rules` trong transaction rồi mới dựng — không đụng khoá, không phụ thuộc ngày |
| `shop_phase1_rls.test.sql` | khẳng định "chưa ban hành gì" trên cơ sở dữ liệu dùng chung | như trên |
| `shop-seller-rules-integration.test.mjs` | khẳng định lỗi **phải** là `seller_rules_not_published` | khẳng định **hồ sơ không nhúc nhích** — đúng ở mọi giờ, cả trước lẫn sau nửa đêm 14/08 |

Cả ba là **cùng một lỗi** và nó đã được ghi lại từ CP12: *trên một tài nguyên
dùng chung, chỉ khẳng định thứ mình sở hữu*. Lần này thứ dùng chung là **đồng
hồ**.

Bộ mới `shop_seller_rules_v1_published.test.sql` (19 assertion) làm việc ngược
lại: nó **không** dựng fixture nào, và đọc đúng dòng migration để lại.

---

## 5. CP13 — bản dự thảo quy chế, và mô hình bản-nháp

> Ghi lại nguyên trạng lúc CP13. Văn bản này **đã được duyệt** ở CP15 (§2);
> phần dưới mô tả nó khi còn là bản nháp.

**Quy chế người bán v1** giờ có một **bản dự thảo đầy đủ 20 mục**:
[`seller-rules-v1.md`](./seller-rules-v1.md), trạng thái
`DRAFT — PENDING PRODUCT OWNER APPROVAL`. Metadata mà chỉ Product Owner chốt
được (`approved_by`, `approved_at`, `effective_at`, content hash) để **trống
nhìn thấy được**, không điền giá trị nghe hợp lý.

Rà soát theo từng mục, kèm nhãn CODE/QUYẾT ĐỊNH/PHÁP LÝ/CHẶN, ba khoảng cách
giữa văn bản và hệ thống, bảy câu hỏi cần quyết và năm câu đề nghị không làm
mềm: [`seller-rules-v1-review.md`](./seller-rules-v1-review.md).

**Schema có thêm ba trạng thái thay vì hai.** `approved_by`/`approved_at` cả hai
`NULL` = **bản nháp**: `legal_current_document()` không trả về, policy đọc không
cho đọc, không ai ký được — nhưng **nội dung vẫn sửa được**. Duyệt là cửa một
chiều, và đúng lúc đó nội dung đóng băng.

Hai CHECK mới thay hai cách nguỵ tạo bằng chứng: `effective_at` không được sớm
hơn `approved_at` (không ghi lùi ngày), và phê duyệt là **tên VÀ thời điểm hoặc
không có gì** — một nửa không phải bằng chứng.

`scope` (`closed-pilot` | `public`) tồn tại vì quy chế pilot không phải quy chế
public launch, và không có cột đó thì việc tái sử dụng vào ngày mở công khai sẽ
**im lặng**.

**Người kiểm duyệt** giờ thấy biên lai ngay trên màn xét hồ sơ: phiên bản, thời
điểm, hash rút gọn — và khi người nộp ký một bản **cũ**, panel nói rõ họ ký bản
nào, lúc nào, và bản nào đang hiệu lực.

### Một cái bẫy thiết kế bị test bắt

Đóng băng nội dung **lúc ghi** nghe chặt hơn và thực ra là bẫy: một bản nháp đặt
với `effective_at` trong quá khứ sẽ **không bao giờ duyệt được**, vì duyệt khi
đó vi phạm quy tắc không-ghi-lùi-ngày và không có cách nào dời ngày. Chính test
cố duyệt một bản nháp bắt được. Đóng băng chuyển sang **lúc phê duyệt**.

---

## 6. CP12 — blocker B5 đã đóng

Chi tiết đầy đủ: [`seller-rules-enforcement.md`](./seller-rules-enforcement.md).

### Schema

| Bảng | Vai trò |
|---|---|
| `legal_documents` | `(document_key, version)`, `title`, `body`, **`content_hash` GENERATED**, `effective_at`, `retired_at`. Bất biến bằng trigger; chỉ `retired_at` đi được từ `NULL` sang một giá trị, một lần |
| `legal_acceptances` | `(user_id, document_key, version)` UNIQUE, `content_hash` **sao chép từ máy chủ**, `application_id` (bằng chứng, `ON DELETE SET NULL`), `accepted_at`, `client_token`. **Không** IP, **không** device fingerprint |

### RPC

| Hàm | Ghi chú |
|---|---|
| `legal_current_document(key)` | bản đang hiệu lực: đã tới hạn, chưa thu hồi, mới nhất |
| `legal_accept(key, version, hash, token)` | idempotent; nhận version+hash **chỉ để từ chối lệch**; lưu bản sao của máy chủ |
| `shop_application_submit(_expected_rules_version)` | **chữ ký MỚI** — hàm 0 tham số đã bị DROP |
| `shop_application_rules_receipt(app_id)` | "có chấp thuận bản đang hiệu lực không", không phải "ký gì gần nhất" |

### Bằng chứng cưỡng chế

Cổng nằm **trong** `shop_application_submit()`. Bốn cách từ chối:
`seller_rules_not_published` · `seller_rules_version_changed` ·
`seller_rules_not_accepted` · lệch hash.

**Red-before-green ở đúng call site production:** xoá đoạn kiểm khỏi
`shop_application_submit()` trên cơ sở dữ liệu đang chạy → **6 assertion đỏ**,
gồm cả cái về gọi thẳng RPC không qua UI.

| Tầng | Số |
|---|---|
| pgTAP `shop_seller_rules_acceptance.test.sql` | **68** |
| pgTAP `shop_phase1_rls.test.sql` | +3 |
| HTTP integration (JWT thật, qua PostgREST) | **11** |
| Component (bốn trạng thái, đua phiên bản, refresh) | **10** |
| Parity (cổng đúng chỗ, không seed văn bản, không thu IP) | +11 |

### Hành vi UI

Bốn trạng thái nói bằng lời: **Đang tải** (chưa có checkbox nào tồn tại) ·
**Đã ghi nhận** (đọc từ máy chủ, nên refresh cho ra sự thật) · **Chưa ghi nhận
được** (bỏ tích + mời thử lại, không bao giờ nói "đã ký") · **Chưa ban hành**
(phân biệt với "không tải được").

Toàn văn hiển thị tại chỗ. Đua phiên bản rút lại chấp thuận **trước** khi người
ta bấm nút. Nút gửi khoá cho tới khi máy chủ xác nhận — khoá, không giấu, và
không tin.

---

## 7. Ba defect các cổng bắt được trong CP12

1. **Thiếu grant `service_role` trên `legal_documents`.** Bộ HTTP integration
   trả `42501` ngay lần chạy đầu. `service_role` đi vòng qua RLS nhưng **không**
   qua tầng grant — lớp lỗi repo này đã quét hai lần, và pgTAP lẫn typechecker
   đều mù với nó.
2. **Trigger append-only làm không xoá được hồ sơ.** `ON DELETE SET NULL` là một
   UPDATE, và trigger từ chối nó — mọi `DELETE FROM shop_applications` sẽ hỏng.
   Chỉ lượt chạy trình duyệt gặp được: **pgTAP khẳng định trong một transaction
   nó rollback**, nên không bao giờ xoá một hồ sơ nào.
3. **Một assertion về trạng thái toàn cục trên cơ sở dữ liệu dùng chung.**
   `shop-p2b-media-lifecycle.test.mjs` khẳng định hàng đợi rỗng **toàn cục**;
   các bộ integration chạy song song và tự xếp job vào đó. Nó đang khẳng định
   một sự thật về test của người khác.

> Quy tắc rút ra từ #3: **trên một tài nguyên dùng chung, chỉ khẳng định thứ
> mình sở hữu.** "Hàng đợi rỗng" và "hàng đợi không còn gì của tôi" nghe giống
> nhau và chỉ một câu là kiểm được.

---

## 8. Cổng kiểm tra — tất cả XANH

Cơ sở dữ liệu dựng lại từ số không. Delta đầy đủ:
[`gate-results.md`](./gate-results.md).

| Cổng | Kết quả sau CP17 |
|---|---|
| `supabase db reset --local` | exit 0 |
| Ledger parity | **353 / 353** |
| pgTAP | **1 348 PASS** · 36 file · exit 0 |
| Unit (gồm storage + vòng đời ảnh trên stack thật) | **2 096 PASS** · 10 skipped · 162 file |
| HTTP integration quy chế, stack thật | **11 PASS · 0 skip** |
| Hợp đồng xoá tài khoản, gọi thật hàm edge | **7 PASS** |
| Vòng đời ảnh byte thật (gồm case B13) | **8 PASS** |
| noindex ở edge | **116 PASS** |
| `tsc -b` · `eslint` · `build` | exit 0 · **0 lỗi** · exit 0 |
| `BUNDLE_STRICT=1` | exit 0 |
| Dọn dữ liệu, đếm độc lập | **10/10 bộ đếm = 0**, gồm cả hai bucket |

`build:proto`, Q01–Q04 và nghiệm thu P2b **không chạy lại** ở CP15 — không có
mã client nào đổi. Kết quả CP13 của chúng vẫn là kết quả mới nhất, và chép nó
sang một cột "sau CP15" sẽ làm nó trông như vừa được đo.

### Bundle delta

```
              trước CP12    sau CP13    sau CP15    sau CP16    sau CP17    tổng
INITIAL gz     226,6 KB     226,6 KB    226,6 KB    226,6 KB    226,7 KB   +0,1 KB   / 280 KB
Tổng gz JS    1935,3 KB    1937,8 KB   1938,2 KB   1939,2 KB   1940,8 KB   +5,5 KB   / backstop 1970 KB
```

**Backstop KHÔNG nâng.** Còn 30,8 KB. Không thêm dependency nào. CP15 không đổi
mã client (+0,4 KB là nhiễu build ±0,6 KB đã biết); CP16 là **+1,0 KB thật** —
một mục mới trong Chính sách bảo mật ×2 ngôn ngữ, nằm trong `locale-*`, không
nằm trong `INITIAL`.

---

## 9. Quyết định Product Owner đã áp dụng

| # | Quyết định | Đã làm gì |
|---|---|---|
| 1 | Preview dùng **Supabase staging riêng** | **Packet S** mới; A/B/C đổi mục tiêu; B và C chạy **hai lần** với secret khác nhau |
| 2 | Pilot chấp nhận **chưa có thông báo tự động** | [`notification-decision.md`](./notification-decision.md) ghi **ĐÃ KÝ**, kèm 6 điều kiện; **không** xây hạ tầng thông báo |
| 3 | Indexing **TẮT/unset ở mọi môi trường** | Packet A §4, Packet D §3, checklist mục 4 |
| 4 | Drift `20260805150000_news_source_ppa_tour_pause` **ngoài phạm vi** | Packet B §4 — không sửa, không chèn ledger |
| 5 | **Submit phải được máy chủ xác minh chấp thuận** | ✅ CP12 |

---

## 10. Thứ tự thi hành mới

```
 1. Cưỡng chế seller-rules ở cục bộ                     ✅ XONG
 2. Product Owner DUYỆT TOÀN VĂN v1                     ✅ APPROVE 13/08
 3. Chốt effective_at + approved_by                     ✅ 14/08 00:00+07 · Cuong Nguyen
 4. Đóng băng content hash trên bản ĐÃ DUYỆT            ✅ fb62bd47…c70c98, migration #19
 5. Product Owner duyệt bản sửa Privacy                 ✅ 13/08 — đã áp, CHƯA deploy
 5b. Chọn phương án B12 + vá B13                        ✅ 13/08 — C + migration #20
 6. Packet S — cấu hình staging (project đã tạo)        ⬜
 7. Packet B-1 — 19 migration lên STAGING               ⬜
 8. Packet C-1 — function + cron trên STAGING           ⬜
 9. Packet A — preview Cloudflare trỏ STAGING           ⬜
10. Smoke đầy đủ trên staging                           ⬜
11. Product Owner nghiệm thu preview                    ⬜
12. Packet B-2 + C-2 lên PRODUCTION                     ⬜
13. Web production, indexing vẫn TẮT                    ⬜
14. Packet D — Wave 0, tài khoản test                   ⬜
15. Wave 1 — một người bán thật                         ⬜
```

Không còn blocker sản phẩm nào chặn bước 15 — mọi thứ còn lại là **quyền chạy
remote** và bốn ô cấu hình trên dashboard.

🔴 **Ràng buộc thứ tự còn lại, và nó tuyệt đối**: Packet B **#20** phải chạy
**trước** khi bật cron dọn ảnh ở bất kỳ môi trường nào. Bật cron trước #20 là
mất ảnh của người bán, không phải một cảnh báo.

---

## 11. Blocker còn lại

| # | Blocker | Ai gỡ | Chặn |
|---|---|---|---|
| ~~B4″~~ | ✅ **ĐÃ GỠ 13/08 (CP15).** Quy chế v1 được duyệt toàn văn, `approved_at` `2026-08-13T07:30:00+07:00`, `effective_at` `2026-08-14T00:00:00+07:00`, hash `fb62bd47…c70c98`, ban hành bằng migration Packet B **#19**. Cửa vẫn đóng trên mọi môi trường **chưa chạy #19** — đúng thiết kế | — | — |
| ~~B11~~ | ✅ **ĐÓNG CỤC BỘ 13/08.** Chính sách bảo mật nay nêu tên bốn nhóm dữ liệu Shop, mục đích, phạm vi người đọc và vòng đời; ngày hiệu lực `14/08/2026`. Khoá bằng 21 assertion. 🔴 **CHƯA DEPLOY** — bản đang phục vụ ở `thepicklehub.net/privacy` vẫn là bản cũ cho tới khi nhánh được merge (bước 13) | — | — |
| ~~B12~~ | ✅ **ĐÓNG CỤC BỘ 13/08 bằng phương án C.** Máy chủ từ chối chủ shop bằng `409 shop_owner_offboarding_required` **trước** bước dọn đầu tiên; giao diện giải thích và mở email; runbook 7 bước trong [`account-deletion-b12.md`](./account-deletion-b12.md). 🔴 **Chưa deploy** | — | — |
| ~~B13~~ | ✅ **ĐÃ VÁ** — migration `20260814110000` (Packet B **#20**) thay điều kiện loại trừ bằng một định nghĩa: `shop_media_referenced_objects()`. 🔴 **#20 phải áp TRƯỚC khi bật cron ở bất kỳ môi trường nào** | — | — |
| **B14** | ⚠️ `delete-account` **báo thành công trong khi cả 13 bước dọn dữ liệu thất bại**. Hồ sơ riêng: [`docs/defects/b14-delete-account-cleanup-noop.md`](../../defects/b14-delete-account-cleanup-noop.md); đã vào **Known Bugs** của `CLAUDE.md`. 🔴 **Cấm cấp grant lẻ**. Câu chữ sai về giải đấu **đã sửa**. Điều kiện tiên quyết trước khi mở tự-xoá diện rộng | nền tảng | — |
| ~~B3″~~ | ✅ **ĐÃ GỠ.** Ref staging = **`utokwfcljxjkpkaqgheo`**, đã điền vào toàn bộ tài liệu. Probe chỉ đọc xác nhận project trắng: 0 `auth.users`, 0 bảng `public`, 0 bucket, 0 Edge Function, 0 secret, **0 va chạm tên object Shop** | — | — |
| **B9** | 🔴 **`pg_cron` / `pg_net` chưa cài trên staging** — khả dụng nhưng chưa bật. Bật là thao tác **ghi**, ngoài phạm vi kiểm chỉ đọc | Cuong, dashboard | **Packet C** |
| **B10** | ⚠️ Gói **Pro** chưa xác minh được bằng API (`plan: null`) — chỉ dashboard đọc được | Cuong, S-1b | — |
| **B1′** | URL preview trong **Redirect URLs của STAGING** | Cuong, dashboard | Packet A |
| **B2** | `SHOP_PUBLIC_INDEXING` **không tồn tại** ở cả Production lẫn Preview | Cuong, dashboard | Packet A, D |
| **B9** | `pg_cron`/`pg_net` **đã bật** trên staging chưa (Pro cho phép; cho phép ≠ đã bật) | Cuong, dashboard S-9 | Packet C |
| ~~B6′~~ | ✅ **ĐÃ GỠ** — Cuong Nguyen, tối thiểu **2 lần/ngày** | — | — |
| **B7** | 9 đầu vào của Packet D | Product Owner | Packet D |

**B5 đã đóng** và không còn trong danh sách.

### Đầu vào B11 chính xác cần gì

1. **Đọc** [`privacy-shop-disclosure.md`](./privacy-shop-disclosure.md) — bốn
   nhóm dữ liệu, mục đích, ai đọc được, và vòng đời **ở mức khoá ngoại thật sự
   hỗ trợ**, không hứa quá.
2. **Duyệt hoặc sửa nội dung mục Shop** (VI là bản gốc, EN là bản dịch).
3. **Quyết định ngày hiệu lực hiển thị**: giữ `28/12/2024` hay đổi sang
   `14/08/2026` như patch đề xuất.
4. **Quyết định riêng cho B12** (`ON DELETE RESTRICT`) trước khi mời người bán
   thật.

Patch được sinh bằng cách **áp thật rồi hoàn nguyên**, đã kiểm `git apply
--check`, `tsc -b` và `vitest run src/i18n`. Áp khi duyệt:
`git apply docs/proposals/shop-closed-pilot/privacy-shop-disclosure.patch`.

---

## 12. Năm packet — không cái nào được duyệt

| Packet | Nội dung | Mục tiêu | Tier |
|---|---|---|---|
| [S](./approval-packets/packet-s-staging.md) | Tạo/xác nhận project staging | mới | 🟡 |
| [B](./approval-packets/packet-b-migrations.md) | 19 migration (**#19 = Quy chế v1**) | staging **rồi** production | 🔴 |
| [C](./approval-packets/packet-c-worker-cron.md) | Worker + cron | staging **rồi** production | 🟡 |
| [A](./approval-packets/packet-a-preview.md) | Đẩy nhánh → preview trỏ staging | Cloudflare | 🟡 |
| [D](./approval-packets/packet-d-pilot-activation.md) | Allowlist, mở pilot | production | 🔴 |

Checklist dashboard 7 mục cho Product Owner:
[`dashboard-checklist.md`](./dashboard-checklist.md).

---

## 13. Khuyến nghị: duyệt cái gì trước

Hai việc **song song**, không phụ thuộc nhau:

**1. Cấp quyền chạy Packet S/B trên staging.** Ref đã có
(`utokwfcljxjkpkaqgheo`); còn thiếu chữ ký để bắt đầu ghi. Đây giờ là thứ
**duy nhất** chặn tiến độ.

**2. Bốn ô dashboard**: xác nhận gói Pro (S-1b) · Redirect URL của staging ·
bật `pg_cron`/`pg_net` (S-9) · `SHOP_PUBLIC_INDEXING` ở Preview và Production.

**3. Một câu hỏi còn mở, không gấp**: §3.4 của
[`account-deletion-b12.md`](./account-deletion-b12.md) — bằng chứng chấp thuận
CASCADE mất theo tài khoản. Giữ nguyên cho pilot, hay giữ một bản ẩn danh? Chỉ
cần trả lời trước khi có thanh toán.

Trong lúc điền checklist, mục **S-9** (`pg_cron`/`pg_net` đã bật chưa) đáng kiểm
sớm: nếu chưa, Packet C mất phần quan trọng nhất — chứng minh worker chạy theo
**lịch thật** — và preview chỉ còn drain tay, tức là đúng thứ máy cục bộ đã làm
được.

---

## 14. Không thao tác remote nào đã thực hiện

| Cấm | Trạng thái |
|---|---|
| `supabase link` | ❌ không chạy |
| Áp migration remote | ❌ không |
| Deploy Edge Function | ❌ không |
| Tạo/đổi secret remote | ❌ không |
| Tạo cron remote | ❌ không |
| Seed allowlist remote | ❌ không |
| Tạo/cấu hình project staging | ❌ không — Product Owner đã tự tạo; agent không link, không ghi, không đọc |
| `supabase link` tới staging | ❌ không |
| Đọc remote staging | ❌ **không một lần nào** — project ref chưa có, và không có ref thì không có gì để đọc |
| Ban hành Quy chế v1 vào `legal_documents` **trên remote** | ❌ không — migration đã viết và chạy **chỉ trên cơ sở dữ liệu cục bộ**; nó là Packet B #19 và chờ duyệt như 18 file kia |
| Áp bản sửa `Privacy.tsx` | ✅ **đã áp** trên nhánh cục bộ (được duyệt 13/08) — nhưng **chưa push, chưa deploy**; trang production vẫn là bản cũ |
| Sửa `delete-account`, `shops`, hay vòng quét dọn ảnh (B12/B13/B14) | ❌ không — chỉ thêm **test chẩn đoán** |
| Deploy Cloudflare | ❌ không |
| Merge / push | ❌ không — nhánh chỉ ở cục bộ |
| Gửi email/push thật | ❌ không |
| Bật lập chỉ mục · IndexNow · sitemap Shop | ❌ không |
| Sửa drift `news_source_ppa_tour_pause` | ❌ không — ngoài phạm vi theo quyết định #4 |
| Tạo dữ liệu người bán thật | ❌ không |

Mọi truy vấn Postgres remote trong đợt audit đi qua một script từ chối bất cứ
câu lệnh nào không bắt đầu bằng `SELECT`/`WITH`. Không giá trị secret nào được
đọc hay in — chỉ tên.

---

## 15. Thao tác remote **dự kiến**, đúng thứ tự — chưa cái nào chạy

Danh sách này tồn tại để một thao tác remote không bao giờ được quyết định
ngẫu hứng giữa chừng. Mỗi dòng là một lần ghi vào một hệ thống thật.

**Trước dòng 1: chưa có gì được duyệt.** Packet S, B, C, A, D đều còn trống ô ký.

### Giai đoạn 1 — staging (`utokwfcljxjkpkaqgheo`)

| # | Thao tác | Packet | Ghi |
|---|---|---|---|
| 1 | Chứng minh mục tiêu: `GET /v1/projects/<ref>` → tên **không phải** `thepicklehub-prod` | S §8 | chỉ đọc |
| 2 | Bật **`pg_cron`** và **`pg_net`** (dashboard) | S / B9 | ghi |
| 3 | Bật **MFA/TOTP**, tạo **1 tài khoản admin staging** (UUID khác production), enrol TOTP | S §4 | ghi |
| 4 | Đặt **Site URL** + **Redirect URLs** của staging = URL preview Cloudflare | S §4 | ghi |
| 5 | Sinh **`CRON_SECRET` MỚI** cho staging + ghi cùng giá trị vào vault `cron_secret` | S §5 · C-1 | ghi · **không sao chép của production** |
| 6 | Áp migration **#1 → #3** | B-1 | ghi |
| 7 | Deploy Edge Function dọn ảnh lên staging | C-1 | ghi · 🔴 **cron chỉ được bật SAU bước 8** (migration #20) |
| 8 | Áp migration **#4 → #20** (#19 = Quy chế v1, **#20 = bản vá B13**) | B-1 | ghi |
| 9 | Ghi ledger cho **20** file Shop đã áp — và **chỉ** những file đó | B-1 §4 | ghi |
| 10 | Kiểm sau #19: đúng 1 dòng `seller-rules/v1`, hash `fb62bd47…c70c98` | B-1 §5 | chỉ đọc |
| 11 | Đặt biến Cloudflare Preview `VITE_SUPABASE_*` → staging | A | ghi |
| 12 | **Push nhánh** `feat/shop-closed-pilot` → build preview | A | ghi · **lần đầu tiên nhánh rời máy** |
| 13 | Smoke đầy đủ trên preview + staging | A | đọc |
| 14 | Chèn **tài khoản test** vào `shop_pilot_members` staging | D-a | ghi |

### Giai đoạn 2 — production (`ajvlcamxemgbxduhiqrl`), chỉ sau khi nghiệm thu preview

| # | Thao tác | Packet | Ghi |
|---|---|---|---|
| 15 | Chứng minh mục tiêu **lại từ đầu** | B §1 | chỉ đọc |
| 16 | Áp migration **#1 → #3** lên production | B-2 | ghi |
| 17 | Deploy Edge Function dọn ảnh lên production — **KHÔNG đụng `CRON_SECRET`**, 5 cron đang dùng chung nó | C-2 | ghi · 🔴 cron chỉ bật SAU bước 18 |
| 18 | Áp migration **#4 → #20** lên production | B-2 | ghi |
| 19 | Ghi ledger 20 file — **không** chèn cho 12 file ngoài Shop | B-2 | ghi |
| 20 | Merge nhánh → web production, **`SHOP_PUBLIC_INDEXING` vẫn TẮT** | A | ghi |
| 21 | Packet D — Wave 0, tài khoản test | D | ghi |
| 22 | Wave 1 — người bán thật đầu tiên | D | ghi · **chặn bởi B11 (Chính sách bảo mật)** |

**Không có trong danh sách này, và cố ý:** bật `SHOP_PUBLIC_INDEXING`, gửi
IndexNow, thêm Shop vào sitemap, sửa drift `news_source_ppa_tour_pause`, xoay
`CRON_SECRET` của production.
