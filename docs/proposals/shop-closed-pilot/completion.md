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

---

## 16. CP18 — một cơ sở dữ liệu chỉ được gọi đúng project của nó

Phát hiện ở pre-flight Packet S, **trước** khi chạm remote lần nào.

### Vấn đề

**36 call site** trong **20 migration** ghi cứng host production:

```sql
url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/…'
```

Đúng khi repo có **một** môi trường. Sai ngay khi có hai: staging áp đúng những
migration đó sẽ tạo cron **trên staging** gọi Edge Function **của production**,
mang theo secret **của staging**, mỗi 5 phút.

### Vì sao nó chưa từng nổ — và lý do không phải cái ai cũng đoán

Trên máy cục bộ ngay lúc này: **20 cron job đang active**, tất cả trỏ
production. `net._http_response` = **0**, `cron.job_run_details` = **25 lần
failed**. Mọi job dừng đúng một dòng trước khi gửi request, tại
`cron_secret is not configured`.

> **Một secret bị thiếu là thứ duy nhất đang ngăn repo này gọi xuyên môi
> trường.** Và staging là môi trường đầu tiên ta **cố ý tạo** secret đó.

Nói cách khác: lớp bảo vệ đang giữ trận địa chính là lớp Packet S sắp gỡ bỏ.

### Hợp đồng mới

`public.ops_project_url()` — đọc vault key **`project_url`**, kiểm hình dạng,
**RAISE** khi thiếu hoặc sai định dạng.

| Nguyên tắc | Vì sao |
|---|---|
| **Không fallback** | Một default trỏ production chính là cách staging cấu hình sai lặng lẽ trở thành client thứ hai của production. Exception = job chết ồn ào và **không xoá gì** |
| **Host và secret là hai key riêng** | Chúng trả lời hai câu hỏi khác nhau — *ở đâu* và *có được phép không*. Deploy đúng một nửa phải **fail**, không được chạy nửa vời |
| **Giải ở RUN time** | Đổi hướng một môi trường là một lệnh ghi vault, không phải re-schedule → không tồn tại cửa sổ có job mang host sai |
| **Không tự nhận dạng được** | `cluster_name` = `"main"` trên **mọi** project Supabase (đã kiểm trên staging thật, không đoán). Nên chặng cuối là **assertion lúc triển khai**, do packet chịu trách nhiệm |

### Lịch sử migration — vì sao sửa tại chỗ là an toàn

19/20 file đã áp trên production và **sẽ không chạy lại**. Ledger
`supabase_migrations.schema_migrations` có đúng ba cột — `version`,
`statements`, `name` — **không có checksum**, và được chọn theo `version`. Nên
một file đã sửa không thể gây re-apply hay mismatch. Production giữ nguyên job
và host hiện có, chỉ đổi khi có ai đó **chủ ý** áp migration lên nó.

`db reset` sạch tái lập toàn bộ; helper được đặt tên
`20260519010050_…` để sort **ngay trước** caller đầu tiên
(`20260519010100`).

### Phạm vi còn lại, có kiểm chứng

Hai job vẫn ghi host: `secret-sync-heal-30min` và `social-poster-catchup-15min`,
trỏ **Cloudflare Worker** chứ không phải project Supabase. Cả hai đọc vault
secret **trước** khi gửi request và RAISE khi thiếu — nên staging không được cấp
hai secret đó thì không thể chạm tới chúng. Ghi ra kèm cơ chế ngăn, không để
thành bất ngờ.

**Ngoài migration** (không chạy trên staging, chỉ liệt kê): 4 `wrangler.toml`
của worker production · `supabase/functions/ops-job-control/index.ts` ·
`src/lib/errorReporter.ts` fallback · docs/scripts (tên container docker cục bộ
có chứa ref).

### Đỏ trước, xanh sau

| Phá gì | Kết quả |
|---|---|
| Trả literal production về **một** call site | **2 đỏ** |
| Cho helper một fallback production | **1 đỏ** — chính file helper vi phạm luật nó tạo ra |
| Hoàn nguyên | **359 xanh** (một assertion cho **mỗi** file migration) |

Cổng: `src/lib/__tests__/migration-project-url.test.ts` +
`supabase/tests/ops_project_url.test.sql` (9 assertion trên DB thật: fail-closed
khi thiếu, từ chối `http://`, cắt dấu `/` cuối, `search_path` cố định, và
`authenticated` **không** có EXECUTE).

Sau CP18, cục bộ: **0** job mang host literal · **14/20** job dùng helper · 6
job còn lại không gọi Edge Function (2 trong đó gọi Worker, xem trên) ·
`net._http_response` vẫn **0**.

### 🔴 Ràng buộc thứ tự vẫn nguyên giá trị

Migration **#4** (`20260811150000`) tạo `shop-media-reconcile-hourly`
(`17 * * * *`) — **16 file trước** bản vá B13 (#20). CP18 không đụng tới điều
đó. Thứ tự an toàn: `#1–3 → deploy function → #5–20 → canary B13 → #4 cuối
cùng`. Không file nào trong #5–20 phụ thuộc cron, nên dời #4 xuống cuối là đủ
và không cần sửa thêm code.

---

## 17. CP19 — nhánh đã push, PR đã mở, và điểm dừng an toàn trước staging

### Đã làm

| Việc | Kết quả |
|---|---|
| Push `feat/shop-closed-pilot` | ✅ `origin/feat/shop-closed-pilot` @ `eb5b1612` |
| Pull Request | ✅ **[#578](https://github.com/cuongnguyen84/pickle-hub-pro/pull/578)** → base `main` · 114 commit · 320 file · +76 061 |
| CI | ✅ **Cloudflare Pages: pass**. Không có GitHub Actions run nào (ngân sách Actions đã cạn từ 27/07). Branch protection: API trả 403 *"Upgrade to GitHub Pro"* → **repo private không bật được branch protection**, nên tập "required checks" thực tế = build Cloudflare Pages |
| Preview | ✅ `https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev` — HTTP 200 |
| `/shop` trên preview | ✅ `x-robots-tag: noindex, nofollow, noarchive` |

### 🔴 Preview đang trỏ PRODUCTION — đúng như dự đoán, và là điều kiện dừng

Bundle preview chứa `https://ajvlcamxemgbxduhiqrl.supabase.co`. Biến môi trường
**Preview** của Cloudflare Pages chưa được đặt, nên build lấy giá trị production.

Đây là điều kiện dừng đã ghi trong Packet S ("Preview trỏ production"), và việc
sửa nó có một hệ quả cần biết trước khi bấm:

> Cloudflare Pages **không** hỗ trợ biến theo từng nhánh (Packet S §6, phương
> án S-a vs S-b). Đổi biến Preview sẽ trỏ **mọi preview của mọi nhánh** sang
> staging — và staging hiện có **0 bảng**. Bốn PR đang mở khác (#575, #569,
> #568, #524…) sẽ có preview hỏng cho tới khi migration chạy xong.

Vì vậy việc này phải làm **ngay sát** lượt nghiệm thu staging, không làm sớm.

### Vì sao dừng ở đây, chứ không phải vì hết ngữ cảnh

Bước kế tiếp là áp **354 migration** lên staging theo cơ chế một-file-một-lần
qua Management API. Bắt đầu một chuỗi như vậy mà không chắc chạy hết trong cùng
một lượt là tự tạo ra **partial migration** — và nếu dừng nhầm chỗ, `#4` (tạo
cron) có thể đã áp trong khi `#20` (bản vá B13) thì chưa. Đó đúng là hai điều
kiện dừng đã ghi: *migration partial* và *nguy cơ cron chạy trước B13*.

Đơn vị công việc an toàn nhỏ nhất ở đây là **toàn bộ chuỗi + canary + xác minh**,
không phải từng file.

### Trạng thái credential — đủ cả ba, đã kiểm

| Hệ | Trạng thái |
|---|---|
| Supabase Management API | ✅ liệt kê được 4 project; staging `utokwfcljxjkpkaqgheo` = **ThePickleHub Staging**, org `hldorwnfmobdxhkkbrap`, ap-northeast-1, **ACTIVE_HEALTHY**, PG 17.6.1.155 |
| GitHub | ✅ `gh` đăng nhập `cuongnguyen84`, scope `repo` + `workflow` |
| Cloudflare | ✅ wrangler OAuth, account `7888e97…c281` (khớp account trong link CI) |

### Staging — ảnh chụp chỉ-đọc trước khi ghi

```
auth.users            0
public tables         0
migration ledger      chưa tồn tại
extensions            pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp
pg_cron / pg_net      CHƯA CÀI          ← B9, và là bước S2
cluster_name          "main"            ← không dùng để tự nhận dạng project được
gói Pro               API không trả trường plan  ← B10; xác minh bằng khả năng
                                            bật pg_cron/pg_net trên thực tế
```

### Phiên kế tiếp bắt đầu từ đâu

1. `project_url` vào vault staging (CP18) — **trước** mọi migration.
2. Bật `pg_cron` + `pg_net` (đồng thời là phép thử Pro thực tế).
3. Bật TOTP MFA staging · Site URL + Redirect URLs = preview URL ở trên.
4. `CRON_SECRET` mới **chỉ cho staging** → Edge Function secret + vault.
5. Áp `#1–3` → deploy `shop-media-lifecycle` → `#5–20` → **canary B13** → `#4`.
6. Đổi biến Preview của Cloudflare sang staging (sau khi migration xong, để
   preview của các nhánh khác chỉ hỏng trong thời gian ngắn nhất).
7. Fixture + 24 case nghiệm thu + responsive/axe 6 chiều rộng.
8. Rollback drill → merge #578 → production → Wave 0.

---

## 18. CP20 — PR #578 mở, CI 7/8, và một cổng cần quyết định

### CI sau khi merge `main` và sửa

| Check | Trạng thái |
|---|---|
| Cloudflare Pages | ✅ pass |
| pgtap | ✅ pass |
| smoke | ✅ pass |
| visual | ✅ pass |
| npm-audit | ✅ pass |
| codeql | ✅ pass (đã sửa, không baseline) |
| typecheck | ✅ pass (đã sửa) |
| **quality** | 🔴 **fail** — **coverage**, không phải test |

### Hai cái đã sửa

**typecheck** — `workers/edge-blob-watchdog/` chỉ có `tsconfig.json`, không có
`src/`. File nguồn **không được track** trong repo; nó chỉ tồn tại như bản
untracked trong working tree của một phiên trước, nên `tsc -b` cục bộ xanh còn
CI sạch thì TS18003. Đã xoá config mồ côi.

**codeql** — 3 finding ở `shop-closed-pilot-smoke.mjs`, đều từ việc dùng regex
bóc `<script>`/`<style>` để đếm từ. CodeQL đúng về cơ chế (`</script >` lọt
qua), dù đoạn này không bảo vệ gì cả — nó chỉ phân biệt trang đã render với vỏ
SPA rỗng. **Sửa thật, không baseline**: giờ nó duyệt tag một lượt và bỏ nội
dung script/style. Parser thay cho filter — finding biến mất vì pattern không
còn, chứ không vì một file JSON bảo bỏ qua.

### 🔴 Cổng còn đỏ: coverage, và nó cần một quyết định

```
160 test file pass · 5 skipped (integration cần stack sống)
Statements 78,54%  /  ngưỡng 83%
```

Không phải prototype: loại `src/proto/**` chỉ nâng lên **79,82%** — vẫn thiếu
**3,2 điểm**.

Nguyên nhân thật: phần lớn mã Shop được kiểm bằng **pgTAP, HTTP integration và
lượt nghiệm thu trình duyệt 20 route** — không có cái nào được bộ đếm câu lệnh
nhìn thấy. Ngưỡng 83% được hiệu chỉnh cho `src/` ở thời điểm chưa có một feature
lớn kiểm theo kiểu đó.

Ba lựa chọn, và **không lựa chọn nào agent được tự quyết**:

| | Việc | Đánh giá |
|---|---|---|
| **A** | Viết unit test cho UI Shop tới khi đạt 83% | Đúng đắn nhất, nhưng là khối lượng lớn và mở |
| **B** | Loại `src/proto/**` khỏi coverage | Có tiền lệ (`functions/**`, `workers/**`, `scripts/**` đã loại với cùng lý do) nhưng **chỉ được 1,3 điểm** — không đủ |
| **C** | Điều chỉnh phạm vi/ngưỡng cho `src/pages/shop/**` + `src/components/shop/**` như đã làm với `functions/**` | Cần Product Owner ký, vì ranh giới giữa "khoanh đúng phạm vi" và "làm yếu cổng" là một quyết định, không phải một commit |

> Chỉ thị hiện tại nói rõ: **"Không bỏ qua hoặc làm yếu security/QA gate."** Nên
> agent dừng ở đây thay vì tự hạ ngưỡng hay tự mở rộng danh sách loại trừ.

### Hệ quả

Phase 4 (merge) yêu cầu CI xanh → **chưa merge**. Do đó Phase 5 (production) và
Phase 6 (Wave 0) **chưa bắt đầu**. Staging cũng chưa được cấu hình: xem CP19 về
lý do không khởi động chuỗi 354 migration khi chưa chắc chạy hết trong một lượt.

### Merge `main` đã lấy về những gì

Ba xung đột, giải theo ý nghĩa từng bên: `eslint.config.js` giữ **cả hai** ignore
· `home.ts` giữ H1 của nhánh này **và** câu Google Sign-In của main (nó tồn tại
cho khâu xác minh OAuth) · `Privacy.tsx` giữ **14/08/2026**.

Cổng CP18 tự chứng minh giá trị ngay lần chạy đầu sau merge: main mang về
`20260805110000_ops_record_dispatches…` với **2 host production ghi cứng** nữa.
Đúng trường hợp nó được viết ra để bắt.

Merge cũng làm lộ một **race trong bộ test** đã tiềm ẩn: hai suite cùng chạy
worker trên một cơ sở dữ liệu, và `shop_media_cleanup_claim` là **toàn cục** —
đúng như thiết kế, nó *là* worker. Case B13 thêm ở CP17 drain toàn cục, cướp job
của `shop-media-integration` và xoá object mà suite kia còn đang khẳng định. Chỉ
đỏ khi chạy full, không bao giờ đỏ khi chạy riêng. Đã vá bằng cách chỉ drain job
thuộc shop của chính mình — **cùng bài học với CP12**. Hai lượt full liên tiếp
xanh.

---

## 19. CP21–CP22 — đóng khoảng trống coverage bằng test thật

Product Owner chọn **phương án A**: viết test có ý nghĩa, không đổi mẫu số.
Không hạ ngưỡng, không thêm exclusion, không đụng cấu hình coverage.

### Tiến độ đo được

| Mốc | Statements | Δ |
|---|---|---|
| Bắt đầu CP21 | 78,54% (4293/5466) | — |
| + imagePipeline, draft recovery | 78,92% | +0,38 |
| + upload state machine | 79,73% | +0,81 |
| + date helpers | **80,45%** (4646/5775) | +0,72 |
| **Còn thiếu tới 83,5%** | | **171 statement** |

Bốn metric hiện tại: statements **80,45%** · branches **66,91%** · functions
**72,01%** · lines **82,04%**.

### Đã khoá được những bất biến nào

**`imagePipeline`** (31 test) — đây là **ranh giới riêng tư**, không phải bộ
resize: quyết định file *là gì* theo byte chứ không theo tên, re-encode qua
canvas (chính là thứ xoá EXIF, và cùng với đó là **toạ độ GPS nhà người bán**),
và từ chối bằng tiếng Việt thay vì để máy chủ từ chối sau khi người bán đã chờ.
Phủ 4 brand HEIC · mp4 cũng `ftyp` nhưng không phải ảnh · header cụt · **chặn
dung lượng trước khi decode** · thang chất lượng · trình duyệt trả PNG khi xin
WebP · giải phóng bitmap trên nhánh throw · abort.

**Draft recovery** (7 test, component + localStorage thật) — bản nháp cục bộ
**không bao giờ được âm thầm thắng** bản máy chủ; entry hỏng hoặc private mode
không được làm chết trình sửa.

**Upload state machine** (16 test, hook thật) — các assertion **phủ định** mới
là thứ quan trọng: original lên được nhưng rendition hỏng → **không** complete ·
finalize reject → **không** complete · lỗi một file không kéo file khác · token
giữ nguyên qua retry (server dedupe) · huỷ → `cancelled`, không finalize ·
`clearComplete` **giữ lại** file lỗi · nhãn pha **không có phần trăm** (số do
timer đẻ ra là lời nói dối lần đầu nó đứng ở 90%).

**Date helpers** (17 test) — placeholder thay cho `Invalid Date`; **không bao
giờ** mô tả tương lai bằng thì quá khứ; biên phút/giờ/ngày rơi đúng một bên.

### 🔴 Một bug thật, do test tìm ra — `46e1fe0d`

`useMediaUpload`: huỷ **giữa hai pha** để lại dòng đứng nguyên. `processImage`
nhận signal nên huỷ *trong* lúc xử lý sẽ ném AbortError và vào catch; nhưng huỷ
rơi vào khoảng sau khi một pha xong và trước khi pha sau bắt đầu chỉ chạm phải
`if (aborted()) return` — bốn chỗ — và thoát mà **không đổi phase**.

Người bán gặp: bấm Huỷ đúng nửa giây xấu → dòng đứng mãi ở "Đang xử lý ảnh",
`busy` vẫn true nên **thanh Lưu bị khoá**, retry lẫn "dọn xong" đều không với
tới được vì nó không ở trạng thái nào cả. Chỉ còn cách tải lại trang.

Đã sửa trong commit riêng; test tìm ra nó mock một `processImage` **bỏ qua
signal** — đúng hình dạng của khoảng trống giữa hai pha khi nhìn từ ngoài.

### Red-proof — phá sản phẩm, không phá test

| Phá gì | Kết quả |
|---|---|
| Gỡ dòng từ chối HEIC | 1 đỏ |
| Gỡ chặn dung lượng đầu vào | 1 đỏ |
| Cho bản nháp cục bộ thắng mà không so với máy chủ | 1 đỏ |
| Huỷ giữa hai pha (bug thật) | 1 đỏ, rồi xanh sau khi sửa |

### Còn lại — 171 statement, theo đúng thứ tự giá trị

| File | Thiếu | Nhóm bất biến |
|---|---|---|
| `SellerProductForm.tsx` | 117 | slug · archive · submit preflight · deep-link `requested_fields` · khoá input khi pending_review |
| `VariantEditor.tsx` | 77 | ma trận · `option_key` không phụ thuộc thứ tự cột · cảnh báo đích danh tổ hợp sẽ mất · bulk + undo · **payload multi-variant không mang giá/tồn form chính** |
| `MediaEditor.tsx` | 68 | wiring của component quanh hook đã phủ |
| `useSellerProducts.ts` | 36 | cache key đủ filter/sort/cursor · phản hồi cũ không đè mới |
| `CatalogResults.tsx` | 17 | 4 trạng thái · **DTO người mua không chứa draft_path/stock_on_hand/internal_note** |

Ba nhóm đầu là dư đủ cho 171. Không nhóm nào là "gọi hàm cho chạy dòng" — mỗi
nhóm khoá một bất biến nghiệp vụ hoặc một ranh giới riêng tư.

---

## 20. CP23 — mẫu số coverage, và vì sao nó tăng

### 🔴 Câu trả lời cho +309: **coverage chỉ đếm file mà test có nạp**

Cấu hình dùng provider **v8**, và chú thích trong `vite.config.ts` nói đúng
điều đó: *"Coverage of test-imported files"*. Hệ quả không hiển nhiên:

> **Viết test cho một file chưa từng được test sẽ CỘNG file đó vào mẫu số.**

Đo trực tiếp thay vì suy đoán — chạy hai lượt trên **cùng một cây**, khác nhau
đúng bốn file test của CP21/CP22:

```
có 4 file test mới :  4508 / 5603  = 80,45%
bỏ 4 file test mới :  4263 / 5395  = 79,01%
                     ─────────────
mẫu số tăng thêm   :        +208
```

Ba file production **chỉ xuất hiện trong báo cáo khi test mới chạy**:

| File | Statement cộng vào mẫu số |
|---|---|
| `src/hooks/shop/useMediaUpload.ts` | +96 |
| `src/lib/shop/imagePipeline.ts` | +71 |
| `src/hooks/shop/useProductMedia.ts` | +41 |

Phần còn lại của +309 đến từ **merge `main`** (mã production mới của #576/#577)
và từ test draft-recovery nạp lazily `MediaEditor`/`VariantEditor`.

**Không có test helper hay file generated nào lọt vào scope.** Không phải lỗi
cấu hình, nên **không sửa cấu hình** — đây là mã production hợp lệ, và trước
đây nó vô hình chứ không phải đã được phủ.

### Hệ quả cho chiến lược, và nó đảo ngược trực giác

Phủ một file **đang vô hình** ở mức thấp hơn trung bình hiện tại (80–81%) sẽ
**kéo tỷ lệ xuống**, dù viết test tốt. Muốn nâng tỷ lệ thì phải phủ file **đã
nằm trong mẫu số**.

Bằng chứng ngay trong lượt này: nhóm A nhắm `SellerProductForm` — file đã có
trong báo cáo — và kết quả là **mẫu số đứng yên ở 5603**, tử số +42.

| Mốc | covered / total | % | Mẫu số |
|---|---|---|---|
| Đầu CP23 | 4508 / 5603 | 80,45% | — |
| + nhóm A (`SellerProductForm.lifecycle`) | **4550 / 5603** | **81,20%** | **không đổi** |

Bốn metric: statements **81,20%** · branches **67,63%** · functions **73,28%** ·
lines **82,92%**. **Còn 129 statement** tới 83,5%.

> Đính chính CP22: con số tuyệt đối "4646/5775" ghi ở mục 19 là lấy nhầm từ một
> lượt đo khác; tỷ lệ 80,45% thì đúng. Số đúng của thời điểm đó là **4508/5603**.

### Nhóm A đã khoá gì

`SellerProductForm.lifecycle` — 16 test qua component thật:
**đường dẫn** (đổi tên không đổi URL · RPC riêng · cảnh báo khác nhau tuỳ đã
bán hay chưa · lỗi không làm mất draft · **sản phẩm đã duyệt không sửa được URL
ở màn hình này**) · **ngừng bán** (hỏi trước · huỷ không gọi gì · archive đúng
sản phẩm · **lỗi không giả vờ thành công** · mở lại chỉ hiện ở trạng thái hợp
lệ) · **cổng gửi duyệt** (checklist là câu trả lời của **máy chủ**, render theo
`code` chứ không theo `message` tự chế · mỗi dòng có lối đi tới chỗ cần sửa ·
không gửi khi còn vướng · **submit lỗi không đổi badge sang chờ duyệt**) ·
**khoá khi chờ duyệt**.

Một test viết ra với kỳ vọng sai và được sửa theo sự thật: bản đã duyệt **không
sửa được đường dẫn**, nên đoạn cảnh báo mạnh hơn là nhánh **không ai tới được**
— pin sự thật thay vì pin một nhánh chết.

Red-proof, hai đột biến độc lập: bỏ xác nhận ngừng bán → **4 đỏ**; bỏ khoá kiểm
duyệt → **1 đỏ**. Hoàn nguyên → 16 xanh.

### Còn lại 129 statement

`VariantEditor` (77) · `MediaEditor` (68) · `useSellerProducts` (36) ·
`CatalogResults` (17) — tất cả **đã nằm trong mẫu số**, nên mỗi statement phủ
được là một statement nâng tỷ lệ. Riêng `VariantEditor` + `MediaEditor` đã dư.

---

## 21. CP24 — đóng coverage, và hai lỗi thật rơi ra trên đường

### Kết quả: ngưỡng CI đạt, hai lượt đo giống hệt nhau

| Mốc | covered / total | statements | Mẫu số |
|---|---|---|---|
| Đầu CP24 | 4550 / 5603 | 81,20% | — |
| + nhóm B `VariantEditor` | 4629 / 5605 | 82,58% | **+2** |
| + nhóm D `MediaEditor` | 4711 / 5605 | 84,04% | không đổi |
| + nhóm E `CatalogResults` | **4726 / 5605** | **84,31%** | không đổi |

Bốn metric cuối: statements **84,31%** · branches **71,77%** · functions
**79,84%** · lines **86,18%**. Ngưỡng CI cưỡng chế duy nhất là statements 83%
→ **biên 1,31 điểm**. `npm run test -- --coverage` chạy hai lượt liên tiếp cho
ra **con số giống hệt**: 4726/5605.

### Mẫu số: +2, và cả hai là của chính bản vá

CP23 kết luận phải phủ file **đã nằm trong mẫu số**. Làm đúng thế và mẫu số
đứng yên: 5603 → 5605, đúng **hai statement** mà bản vá `VariantEditor` thêm
vào. **Không file production nào mới lọt vào scope** — số file trong báo cáo
giữ nguyên 179 suốt ba nhóm.

| File | Trước | Sau |
|---|---|---|
| `VariantEditor.tsx` | 31/108 | **109/110** |
| `MediaEditor.tsx` | 31/99 | **89/99** |
| `useProductMedia.ts` | 13/41 | **35/41** |
| `CatalogResults.tsx` | 20/37 | **30/37** |
| `ProductCard.tsx` | 2/7 | **7/7** |

`useProductMedia` và `ProductCard` lên theo, không phải vô tình: test
`MediaEditor` đi **xuyên qua hook thật** tới một `shopRpc` giả, nên khẳng định
được **tên RPC và tham số thật** chứ không chỉ "hook được gọi"; test
`CatalogResults` render **thẻ thật** chứ không giả lập nó, vì ranh giới riêng
tư nằm ở chỗ thẻ đọc DTO.

`useSellerProducts` (35 statement còn thiếu) **cố ý không đụng tới**: mục tiêu
đã đạt với biên an toàn, và mục I cấm tối ưu tiếp lên 85–90% trong checkpoint
này.

### 🔴 Hai lỗi thật, cùng một gốc — `9b7445dd`

`applyGroups` dựng lại ma trận sau **mọi** thay đổi nhóm, kể cả những thay đổi
**chưa hợp lệ**. `reconcileRows` chỉ giữ dòng nào còn combination trong tích
Descartes, nên một cấu trúc nó không đặt được dòng vào sẽ **xoá dòng đó** — mà
`proposeGroups` lại bỏ qua cảnh báo đúng lúc nhóm không hợp lệ:

```js
const losing = validateGroups(next) ? [] : removedRows(next, rows);
```

**Lỗi 1 — gõ nhầm một nhịp là mất hàng.** Người bán sửa "Trắng, Đen" mà lỡ để
"Trắng, Trắng" một lần blur: hai dòng Đen biến mất **không một lời cảnh báo**.
Sửa lại chính tả **không lấy lại được** — reconcile lúc này chạy trên tập dòng
đã không còn dữ liệu đó, nên Đen · 39 và Đen · 40 quay lại **rỗng**, mất SKU
B39/B40 và tồn kho 5/6.

Cùng cơ chế ở chiều **vào** ma trận: đặt tên nhóm trước khi gõ giá trị là một
trạng thái không thể tránh, và nó **làm rỗng tập dòng** — nên giá của sản phẩm
đơn thực tế **chưa bao giờ** được mang sang, dù `seed` vẫn được truyền.

**Lỗi 2 — tồn kho bịa ra.** Một combination mới được mồi bằng tồn kho của dòng
đầu: thêm size 41 thì nó tự điền số hàng của size 39. Con số đó được lưu thành
movement `correction` trong sổ kho — tức là **đặt trước mặt người mua món hàng
không tồn tại**.

Bản vá: chỉ dựng lại khi `validateGroups(next)` sạch, và mồi **giá** chứ không
mồi **tồn kho**. Cấu trúc sai vẫn hiện lỗi của nó, bảng đứng yên, nút Lưu vốn
đã bị khoá.

### Red-proof — 9 đột biến production, không đột biến test nào

| Nhóm | Phá gì | Đỏ |
|---|---|---|
| B | dựng lại theo **chỉ số mảng** thay vì `option_key` | 4 |
| B | bỏ hộp xác nhận trước thay đổi phá huỷ | 6 |
| B | cho dòng không hợp lệ đi qua nút Lưu | 5 |
| D | xoá **ảnh đầu** thay vì ảnh được bấm | 1 |
| D | retry sinh **client token mới** | 1 |
| D | reorder chỉ gửi **cặp vừa đổi chỗ**; cover upload với `purpose: "logo"` | 4 |
| E | chuyển `internal_note` vào thẻ người mua | 1 |
| E | nhánh lỗi rơi xuống trạng thái rỗng | 2 |
| E | fallback sang `draft_path` khi thiếu `public_path`; unknown coi là hết hàng | 2 |

Một đột biến **không đỏ ở lượt đầu** — fallback `draft_path` — vì fixture để
đường dẫn riêng tư ở gốc `card` chứ không trong `cover`. Test đã được sửa cho
đúng hình dạng dữ liệu thật rồi mới tính là khoá được ranh giới.

### Bất biến được khoá, theo nhóm

**B — `VariantEditor`, 34 test.** Dòng là **combination** chứ không phải vị
trí: đổi thứ tự giá trị làm dòng di chuyển, còn SKU/giá/tồn kho đi theo đúng
combination của nó. Không gì biến mất mà không được **gọi tên trước** — kèm SKU
và tồn kho — và "Giữ như cũ" để lại bảng **giống hệt từng byte**. Trùng SKU chỉ
đánh dấu **dòng sau** và chỉ tên dòng nó đụng. Bulk báo đúng số dòng thật sự
đổi và hoàn tác được. Bàn desktop và thẻ điện thoại là **một state**. "Đã lưu"
chỉ hiện sau khi máy chủ trả lời. Không ghi đè lên mảng được truyền vào (fixture
`Object.freeze`).

**D — `MediaEditor`, 26 test.** Đổi thứ tự gửi **cả danh sách** theo thứ tự mới
kèm version, sắp theo `position` chứ không theo thứ tự dòng về. Xoá gửi id của
**đúng ảnh được bấm**. Gán ảnh cho phiên bản nêu cả hai phía và xoá gán bằng
`null` chứ không phải `""`. Logo và bìa là **một component hai purpose**, mà
`purpose` chỉ tồn tại **bên trong upload target** — nên test bắt target rồi gọi
`init()`, cách duy nhất nhìn thấy nó. File hỏng giữ Thử lại trỏ vào **token của
chính nó** (token *là* khoá dedupe của máy chủ), và một file chưa xong **không
bao giờ** render thành ảnh của sản phẩm. Preview ký 300 giây và **không URL đã
ký nào lọt vào tham số RPC**.

**E — `CatalogResults`, 12 test.** Bốn trạng thái là **bốn câu trả lời khác
nhau**; lỗi tải nói rõ là lỗi tải và giữ chữ "chưa có sản phẩm nào" ra khỏi màn
hình. Ranh giới người mua: đưa cho lưới một dòng **có sẵn** `draft_path`,
`rendition_source_path`, `stock_on_hand`, `internal_note`, `client_token` và
một URL đã ký, rồi khẳng định **không cái nào** chạm tới `outerHTML` — chữ,
thuộc tính và URL cùng lúc. Ảnh chỉ có draft path phải hiện **thành không có
ảnh**. `unknown` **không** là hết hàng.

### Cổng đã chạy

lint repo-wide (0 error) · TheLine (4 file thay đổi) · migration duplicates
(357) · edge auth registry strict (81/81/81, 0 finding) · `tsc -b --noEmit` ·
`npm run test -- --coverage` **hai lượt giống hệt** · build · bundle
`BUNDLE_STRICT=1` **1949,6 / 1970 KB**.

⚠️ Bundle còn **20,4 KB headroom** — cảnh báo có sẵn của nhánh, không phải do
lượt này (bản vá là ~10 dòng, phần lớn là chú thích). PR sau phải trả.

Không chạy lại `db reset`/pgTAP cục bộ: lượt này **không đụng SQL và không đụng
edge function nào**, và job `pgtap` trên CI đã xanh ở `c7c321fa`. Nó chạy lại
trên CI cùng lượt push này.

### Không đổi policy coverage

Không sửa provider, threshold, exclusion hay reporter. Mẫu số tăng đúng 2 và cả
hai là statement của bản vá — mọi statement còn lại đến từ việc phủ file **đã
có trong mẫu số**, đúng như CP23 đã đo.

---

## 22. B-1 + C-1 trên STAGING — đã chạy, và hai thứ bắt được trước khi ghi

**Đích:** `utokwfcljxjkpkaqgheo` — `ThePickleHub Staging`, ap-northeast-1,
ACTIVE_HEALTHY. In ra và đọc **trước mọi mutation**. Production
`ajvlcamxemgbxduhiqrl` **không bị chạm**.

### 🔴 Preflight bắt được lỗi thật — artifact staging gọi về production

Trước khi ghi một dòng nào, kiểm tra #1 ("artifact và network chứa staging ref,
không chứa production ref") **ĐỎ**. Bundle JS thì sạch — nó đọc
`VITE_SUPABASE_URL` — nhưng **bốn thứ nằm ngoài đồ thị JS** ghi cứng ref
production, và không đường env nào trong `src/` với tới:

| Chỗ | Hậu quả trên staging |
|---|---|
| `index.html` `preconnect` + `dns-prefetch` | mỗi lượt tải trang mở **DNS + TLS tới production** |
| `public/_headers` CSP `report-uri` | báo cáo vi phạm CSP **POST sang production**, ghi dòng gốc-staging vào dữ liệu production |
| `vite.config.ts` — 2 `urlPattern` của service worker | ghim theo host production nên trên môi trường khác **khớp KHÔNG GÌ CẢ** |

Cái thứ ba đáng nói nhất: một trong hai luật đó là **luật an toàn** — Supabase
`/rest/` không bao giờ được cache, vì phản hồi là theo-người-dùng và cache khoá
theo URL có thể trả dữ liệu của tài khoản A cho tài khoản B trên máy dùng
chung. Trên staging luật đó **im lặng không áp dụng**. REST vẫn không bị cache,
nhưng chỉ vì **không luật nào khác khớp** — được bảo vệ do tình cờ, không do
thiết kế.

Vá ở `e08f39d6`: cả bốn suy ra từ `SUPABASE_ORIGIN`, fallback là host production
**có chủ đích** để một bản build thiếu env cho ra artifact **y hệt trước đây**
chứ không phải nửa vời. Chứng minh production không đổi bằng build trước/sau với
env production: `_headers` giống hệt, `registerRoute` của SW giống hệt,
`index.html` chỉ khác build token. Guard 5 assertion + red-proof 3 đột biến.

Kèm theo, sửa `src/lib/pwa/__tests__/cache.test.ts`: nó định vị luật bằng chuỗi
literal, nên khi pattern đổi, **một test đỏ (đúng) và một test thành RỖNG NGHĨA**
— mọi assertion của nó là `not.toContain`, nên một lát cắt không khớp gì sẽ
**qua hết**. Giờ cả hai khẳng định tìm thấy vị trí trước đã.

### B-1 — 357 file, một file một lần

`project_url` vào vault **trước file đầu tiên** (CP18) → `ops_project_url()` trả
staging. Runner từ chối chạy nếu `auth.users > 50` hoặc ref trả về khác ref yêu
cầu; ledger **chỉ ghi cho file thật sự áp**; dừng ở lỗi đầu tiên.

356 file áp trong một lượt, **0 lỗi**, giữ lại `20260811150000_shop_media_cleanup_cron.sql`.

| Kiểm | Kết quả |
|---|---|
| `shop_pilot_members` · `products` · `shop_media_cleanup_jobs` · `shop_slug_history` · `legal_documents` · `legal_acceptances` | đều tồn tại |
| `shop_application_submit` overload | **đúng 1** (bẫy 42725 tránh được) |
| Quy chế v1 | `content_hash` khớp `fb62bd47…c70c98`, `octet_length(body)` = **33 568**, hash tự nhất quán |
| Đang phục vụ? | **0 dòng** — `effective_at` là 14/08 00:00+07, đúng như thiết kế |
| apps · categories · public_products · pilot | 0 · **6** · 0 · 0 |
| bucket | `shop-product-media` public, `shop-product-media-draft` **private** |
| Ledger | **357** |

> ⚠️ Ledger đích là **357**, không phải 353 như packet viết. Đã sửa packet ở
> `38e87c90` — đó là **tiêu chí nghiệm thu**, ngưỡng sai làm một lượt áp đúng
> trông như thiếu file.

### 🔴 Thứ hai bắt được: 2 cron gọi Worker dùng chung của production

Sau khi áp, staging có 18 cron job. **0 job trỏ production Supabase** — CP18
hoạt động đúng như thiết kế. Nhưng hai job gọi **Cloudflare Worker dùng chung**,
không phải hạ tầng theo môi trường:

| Job | Đích | Nhịp |
|---|---|---|
| `secret-sync-heal-30min` | `secret-sync.thecuong.workers.dev/heal` | mỗi 30 phút |
| `social-poster-catchup-15min` | `social-poster.thecuong.workers.dev/run` | mỗi 15 phút |

Cả hai đang **vô hại vì thiếu secret trong vault** → RAISE trước khi gửi. Nhưng
đó đúng là cảnh báo của CP18: *một secret thiếu là lớp bảo vệ duy nhất* — và
C-1 sắp cố ý tạo secret trên chính project này. Đã **tắt cả hai** trên staging
(`active := false`, không unschedule, để dòng còn nhìn thấy và bật lại được).

🔴 **Phát hiện nền, đáng báo cho production:** `secret-sync-heal-30min` là job đã
được **gỡ khỏi production ngày 03/08** sau sự cố ghi đè `SCRAPER_AUTH_SECRET`.
Việc gỡ làm bằng SQL tay, **không bằng migration** — nên bất kỳ môi trường nào
dựng lại từ migration đều **hồi sinh nó**. Staging vừa chứng minh điều đó.

### C-1 — function + secret + cron, đúng thứ tự

1. `CRON_SECRET` **giá trị MỚI** (`openssl rand -hex 32`), đặt cho Edge Functions
   **và** nạp cùng giá trị vào vault `cron_secret`. Không sao chép từ production;
   giá trị không bao giờ được in ra. Production **không chạy `secrets set`** —
   ở đó 5 cron caller dùng chung secret đó.
2. Deploy `shop-media-lifecycle` → phản hồi trả `project_ref: utokwfcljxjkpkaqgheo`.
3. Smoke cổng: `reconcile`/`cleanup` **không secret → 401**, secret sai → **401**.
4. **Canary B13** — điều kiện của mục #8, chạy TRƯỚC khi tạo cron.

**Canary B13 — PASSED.** Trồng một logo **đang sống** và một orphan **thật**,
làm cũ cả hai quá 24h, chạy `shop_media_reconcile()` thật:

```
live logo   queued = 0   ✅
real orphan queued = 1   ✅
```

Khẳng định **cả hai chiều** là chỗ quan trọng: chỉ khẳng định "logo sống sót" sẽ
xanh y hệt nếu vòng quét **không làm gì cả**. Teardown bằng **rollback có chủ
đích** (`storage.objects` từ chối DELETE trực tiếp, và teardown viết tay ở dự án
này đã nói dối 6 lần) — rồi kiểm độc lập: 0 shop, 0 profile media, 0 job, 0
storage object.

5. Chỉ sau đó mới áp `20260811150000_shop_media_cleanup_cron.sql` — **file cuối
   cùng**, đúng mục #7.

### Trạng thái staging sau B-1 + C-1

| | |
|---|---|
| Ledger | **357 / 357** |
| Cron | 20 tổng, **18 active** (2 job Worker dùng chung đã tắt) |
| Cron trỏ production | **0** |
| `shop-media-cleanup-every-5m` · `shop-media-reconcile-hourly` | active, dùng `ops_project_url()` + tự ký bằng `cron_secret` |
| Vault | `project_url`, `cron_secret` — đúng hai cái |
| Edge Functions | `shop-media-lifecycle`, cổng cron 401 |

---

## 23. CP25 — cron reconcile chạy thật, staging im tiếng, và job hồi sinh bị đóng bằng migration

### CP1 — `shop-media-reconcile-hourly`, lần chạy thật đầu tiên

B-1/C-1 dừng lại với đúng một mắt xích chưa có bằng chứng: đường
`action:"reconcile"` chưa từng đi hết chuỗi vault → `ops_project_url()` →
Edge Function → xác thực **bằng lịch cron thật**. Ba bằng chứng gián tiếp đã có
(canary chạy đúng hàm và xanh hai chiều · endpoint trả 401 khi thiếu secret ·
cron cleanup đã đi trọn chuỗi) — nhưng gián tiếp không phải là đã chạy.

Trước lần chạy 18:17, trồng một fixture **có commit** (canary B13 rollback nên nó
chứng minh *hàm*, không chứng minh *lịch*): shop `cp1-cron-canary`, hai object
**đang sống** (`logo` + `cover`, có dòng `shop_profile_media` trỏ tới) và một
orphan **thật**, cả ba làm cũ 30 ngày để không cái nào được bảo vệ chỉ nhờ mới.

```
cron.job_run_details  shop-media-reconcile-hourly  succeeded  18:17:00 (VN)
net._http_response    200  {"ok":true,"unstuck":0,"orphans_queued":1}
                      logo   queued = 0   cover queued = 0   orphan queued = 1
```

Lần chạy thứ hai của cùng hàm đó: **vẫn 1 dòng job, vẫn `pending`** — chỉ mục
duy nhất `uniq_shop_media_cleanup_open` làm việc, xếp lại không nhân đôi.

Rồi cron cleanup lúc 18:20 đóng nốt vòng, và đây là phần không định trước nhưng
đáng giá nhất: `shop-media-cleanup-every-5m` trả `200`, job chuyển `done`, và
`storage.objects` của shop này **3 → 2**. Orphan bị xoá thật khỏi storage; logo
và cover **còn nguyên**. Toàn bộ vòng đời chạy trên **lịch**, không có bàn tay
nào chạm vào giữa chừng.

| Điều kiện CP1 | Bằng chứng |
|---|---|
| Request tới Edge Function staging | `net._http_response` id 40, `application/json` |
| HTTP 200 | ✅ |
| Action đúng là `reconcile` | thân phản hồi có `unstuck`/`orphans_queued` — cleanup trả `claimed/deleted/failed` |
| Xác thực bằng secret staging | vault `cron_secret` (giá trị mới ở C-1); thiếu/sai → 401 đã đo ở C-1 |
| Không request nào sang production | `ops_project_url()` = `https://utokwfcljxjkpkaqgheo.supabase.co`; 0 job active nào mang URL literal (4 job không khớp regex là 4 job **SQL thuần**, không gọi HTTP) |
| Live media còn tồn tại | logo + cover `queued=0`, object vẫn còn sau khi cleanup chạy |
| Orphan thật được xử lý | `orphans_queued=1` → `done` → object biến mất |
| Chạy lại idempotent | lần 2 → vẫn 1 dòng `pending` |
| Health view sạch | `pending 1 · due_now 1 · stuck 0 · failed 0 · worst_attempts 0` |
| Log không chứa secret/đường dẫn riêng tư/PII | thân phản hồi là `{"ok":true,…}`; `return_message` của cron là `DO` |

11 lần chạy cron **thất bại** trên staging đều là job ngoài Shop và đều dừng ở
`cron_secret`/`internal_anon_key is not configured` — tức là dừng **trước** khi
gửi request. Không job Shop nào nằm trong đó.

### CP2 — tắt cron ngoài Shop trên staging

**Đây là trạng thái vận hành của staging, KHÔNG phải migration.** Không có gì
trong `supabase/migrations` mang thay đổi này sang production, và production
**không** tắt `social-poster-catchup-15min`.

Inventory được in và phân loại **trước** khi đổi bất cứ thứ gì — 20 job, không
job nào lạ: 14 job gọi Edge Function qua `ops_project_url()`, 4 job SQL thuần
(`prune_client_errors`, hai DELETE retention, `surface-quick-table-results`), 2
job gọi Cloudflare Worker dùng chung (cả hai đã inactive từ B-1).

```sql
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname NOT LIKE 'shop-media%'
  AND active;
```

| Sau khi chạy | |
|---|---|
| Tổng số job | **20 → 20** (không xoá gì) |
| Active | 18 → **2**, cả hai là `shop-media%` |
| Schedule / command bị sửa | **0** — `alter_job` chỉ nhận `active` |
| Job ngoài Shop chuyển inactive | **16** |
| 404 mới sau khi tắt | **0** — bộ đếm đứng ở 36, dòng cuối 18:19:00, trong khi `ops-job-telegram-commands` chạy **mỗi phút** |
| Shop cleanup/reconcile | vẫn chạy: 200 lúc 18:20 |

Rollback **không dùng lệnh bật-tất-cả**: jobid 6 và 3 vốn đã inactive trước
checkpoint, một lệnh `active := true` diện rộng sẽ bật lại đúng hai job gọi
Worker dùng chung. Câu lệnh khôi phục liệt kê **16 cặp `(jobid, jobname)`** và
JOIN theo cả hai, để một jobid đã bị đánh số lại không kéo nhầm job khác —
`operations.md` §10.

### CP3 — `secret-sync-heal-30min` bị loại vĩnh viễn, bằng migration

Job này bị **gỡ khỏi production 03/08 bằng SQL tay**. Không có dòng nào trong
repo ghi lại việc đó, nên `20260622000000` vẫn tạo nó và `20260715190000` vẫn
`active := true` cho nó — mọi môi trường dựng từ migration đều có lại. Staging
chứng minh điều đó bằng một database mới tinh chạy một job đã chết 10 ngày.

`20260814120000_ops_remove_secret_sync_heal_cron.sql` — một câu:

```sql
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'secret-sync-heal-30min';
```

**Idempotent do cấu trúc, không do cờ**: đó là một SELECT trên `cron.job`, nên
môi trường không có job (production, sau lần xoá tay) chạy **0 lần gọi** và
thành công. Khớp `=` chứ không `LIKE`: bán kính của một pattern là mọi job mà
sau này ai đó đặt tên bất cẩn. Khối `DO` cuối file RAISE nếu job vẫn còn — một
lần unschedule im lặng không thành công thì migration **không được ghi vào
ledger**.

Không đọc/ghi secret nào (`SCRAPER_AUTH_SECRET` và `secret_sync_heal_secret` giữ
nguyên — chúng là bằng chứng), không gọi Worker, không sinh traffic.

**Test `supabase/tests/ops_secret_sync_heal_removed.test.sql` (14 assertion), hai
tầng.** Tầng một khẳng định *trạng thái của chính database này* sau khi mọi
migration chạy — đó là call site thật. Tầng hai chạy lại phần thân dưới các
fixture (job active · job inactive · job vắng mặt · ba tên gần giống ·
social-poster · 2 cron Shop · chạy hai lần nữa) — và **không chép câu lệnh vào
test**: nó đọc `statements` **ra từ ledger**, nên test xanh là test đã chạy đúng
văn bản được ship.

🔴 Cái bẫy phải chặn trước: version không có trong ledger → 0 statement → replay
0 lệnh → **mọi assertion phía dưới xanh mà không chạy gì**. Assertion #2 khẳng
định ledger có version đó với `array_length(statements,1) >= 1` **trước** khi
dùng nó.

**Red-proof — 3 đột biến trên migration, không đột biến nào trên test:**

| Đột biến | Đỏ |
|---|---|
| Xoá hẳn phần loại bỏ (chỉ còn `SELECT 1;`) | **4** — test 1 (resurrection), 7, 10, 12 |
| `= 'secret-sync-heal-30min'` → `LIKE 'secret-sync-heal%'` | **1** — test 12: `secret-sync-heal-30min-v2` và `'secret-sync-heal-30min '` bị nuốt |
| Lối tắt hợp lý nhất: `WHERE command LIKE '%thecuong.workers.dev%'` ("xoá mọi job gọi Worker dùng chung") | **7** — trong đó test 12 vì **`social-poster-catchup-15min` bị xoá** |

Đột biến thứ ba mới là cái đáng sợ: nó đọc như một bản dọn dẹp hợp lý, và nó lấy
mất đúng job mà Product Owner đã quyết định giữ.

### Áp lên staging — và **không** lên production ở checkpoint này

| Sau khi áp | |
|---|---|
| Ledger staging | **358** (357 → 358; đích cũ 357 nay đã cũ) |
| `secret-sync-heal-30min` | **không tồn tại** (cron.job 20 → 19) |
| `social-poster-catchup-15min` | vẫn tồn tại, **inactive** (do CP2, không do migration) |
| Cron Shop | cả hai vẫn active |
| Outbound mới từ job đã loại | **0** — 404 vẫn 36, HTTP cuối là 200 của cleanup lúc 18:20 |

Migration này vào **Packet B-2**; production nhận nó sau khi #578 merge. Ở đó nó
là **no-op an toàn** vì job đã bị xoá tay — và đó chính là điểm: lần dựng lại
tiếp theo sẽ không mang nó về nữa.

⚠️ Ledger staging không có cột `statements` (runner B-1 chỉ ghi `version`+`name`),
nên tầng hai của test chỉ chạy được ở local/CI, nơi `db reset` điền đầy đủ. Đó là
lý do tầng một tồn tại riêng.

### Cổng đã chạy cho CP25

pgTAP **38 file / 1371 test** PASS (37/1357 → +1 file, +14) ·
`migration-project-url.test.ts` **363** PASS (nó khẳng định từng file migration,
kể cả file mới) · `db reset` áp trọn 358 file, `cron.job` 20 → 19.
