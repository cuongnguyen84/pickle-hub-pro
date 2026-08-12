# Shop closed pilot — gói chuẩn bị, bàn giao

> **Câu trạng thái được phép dùng:**
>
> `Closed-pilot package locally ready, pending Product Owner approval of Seller
> Rules v1 and approval to execute Packet S/B on staging.`
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
| Commit trên `f172a441` | **18** |

```
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

## 2. CP13 — bản dự thảo quy chế, và mô hình bản-nháp

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

## 3. CP12 — blocker B5 đã đóng

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

## 4. Ba defect các cổng bắt được trong CP12

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

## 5. Cổng kiểm tra — tất cả XANH

Cơ sở dữ liệu dựng lại từ số không. Delta đầy đủ:
[`gate-results.md`](./gate-results.md).

| Cổng | Kết quả |
|---|---|
| `supabase db reset --local` | exit 0 |
| Ledger parity | **351 / 351** |
| pgTAP | **1 312 PASS** · 34 file · exit 0 |
| Unit (gồm storage + vòng đời ảnh trên stack thật) | **2 051 PASS** · 10 skipped · 158 file |
| noindex ở edge | **116 PASS** |
| `tsc -b` · `eslint` · `build` | exit 0 · **0 lỗi** · exit 0 |
| `BUNDLE_STRICT=1` | exit 0 |
| `build:proto` | exit 0 |
| Q01–Q04 prototype | 37 màn hình, 0 phát hiện |
| Nghiệm thu P2b (20 route × 6 chiều rộng, 6 hành trình) | **PASS** |
| Dọn dữ liệu, đếm độc lập | **19/19 bộ đếm = 0** |

### Bundle delta

```
              trước CP12    sau CP12    sau CP13    tổng
INITIAL gz     226,6 KB     226,6 KB    226,6 KB    0,0 KB   / 280 KB
Tổng gz JS    1935,3 KB    1936,8 KB   1937,8 KB   +2,5 KB   / backstop 1970 KB
```

**Backstop KHÔNG nâng.** Còn 32,2 KB. Không thêm dependency nào. `INITIAL` không
đổi một byte qua cả hai đợt — cả hai màn hình nằm trong chunk route của chúng,
không trên đường tới paint đầu tiên.

---

## 6. Quyết định Product Owner đã áp dụng

| # | Quyết định | Đã làm gì |
|---|---|---|
| 1 | Preview dùng **Supabase staging riêng** | **Packet S** mới; A/B/C đổi mục tiêu; B và C chạy **hai lần** với secret khác nhau |
| 2 | Pilot chấp nhận **chưa có thông báo tự động** | [`notification-decision.md`](./notification-decision.md) ghi **ĐÃ KÝ**, kèm 6 điều kiện; **không** xây hạ tầng thông báo |
| 3 | Indexing **TẮT/unset ở mọi môi trường** | Packet A §4, Packet D §3, checklist mục 4 |
| 4 | Drift `20260805150000_news_source_ppa_tour_pause` **ngoài phạm vi** | Packet B §4 — không sửa, không chèn ledger |
| 5 | **Submit phải được máy chủ xác minh chấp thuận** | ✅ CP12 |

---

## 7. Thứ tự thi hành mới

```
 1. Cưỡng chế seller-rules ở cục bộ                     ✅ XONG
 2. Product Owner DUYỆT TOÀN VĂN v1                     ⬜ APPROVE/REVISE/REJECT
 3. Chốt effective_at + approved_by                     ⬜
 4. Tính và đóng băng content hash trên bản ĐÃ DUYỆT    ⬜
 5. Packet S — cấu hình staging (project đã tạo)
 6. Packet B-1 — 18 migration lên STAGING
 7. Packet C-1 — function + cron trên STAGING
 8. Packet A — preview Cloudflare trỏ STAGING
 9. Smoke đầy đủ trên staging
 8. Product Owner nghiệm thu preview
 9. Packet B-2 + C-2 lên PRODUCTION
10. Web production, indexing vẫn TẮT
11. Packet D — Wave 0, tài khoản test
12. Wave 1 — một người bán thật
```

Bước 2 chặn bước 12, **không** chặn bước 3: hạ tầng dựng được trong lúc chờ văn
bản; chỉ việc mời người bán thật là không.

---

## 8. Blocker còn lại

| # | Blocker | Ai gỡ | Chặn |
|---|---|---|---|
| **B4′** | 🔴 **Quy chế v1 — bản dự thảo đã có, chờ DUYỆT.** Cần: `APPROVE`/`REVISE`/`REJECT` toàn văn, `effective_at`, `approved_by`, và bốn câu hỏi chặn ở [`seller-rules-v1-review.md`](./seller-rules-v1-review.md). Máy chủ vẫn từ chối mọi lần gửi hồ sơ với `seller_rules_not_published` — kể cả của Cuong | Cuong / pháp lý | Bước 13-14 |
| **B3″** | 🔴 **Project ref staging.** Project **đã tạo** (ThePickleHub Staging · org ThePickleHub · Pro · ap-northeast-1 · sạch) nhưng **ref chưa được cung cấp** — chuỗi nhận được là placeholder `<STAGING_PROJECT_REF>`. Agent không đoán 20 ký tự base-36 | Product Owner, **một dòng** | **Packet B và C** |
| **B1′** | URL preview trong **Redirect URLs của STAGING** | Cuong, dashboard | Packet A |
| **B2** | `SHOP_PUBLIC_INDEXING` **không tồn tại** ở cả Production lẫn Preview | Cuong, dashboard | Packet A, D |
| **B9** | `pg_cron`/`pg_net` **đã bật** trên staging chưa (Pro cho phép; cho phép ≠ đã bật) | Cuong, dashboard S-9 | Packet C |
| **B6′** | Tên người **kiểm hàng đợi hằng ngày** (điều kiện #4 của quyết định thông báo) | Product Owner | Packet D |
| **B7** | 9 đầu vào của Packet D | Product Owner | Packet D |

**B5 đã đóng** và không còn trong danh sách.

### Đầu vào B4′ chính xác cần gì

1. **Đọc** [`seller-rules-v1.md`](./seller-rules-v1.md) và trả lời
   **APPROVE / REVISE / REJECT**.
2. **`effective_at`** — thời điểm hiệu lực. Tương lai là hợp lệ và không ai ký
   được trước thời điểm đó; **không được sớm hơn `approved_at`** (ràng buộc CHECK).
3. **`approved_by`** — chuỗi hiển thị trong bản ghi. Dự kiến
   `Cuong Nguyen — Product Owner`; cần xác nhận đúng chữ.
4. **Kênh hỗ trợ (mục 19)** — dùng chung ba kênh hiện có
   (`tapickleballvn@gmail.com`, Zalo, Messenger) hay lập kênh riêng cho pilot.

Ba câu hỏi 🟠 nữa (mục 13, danh sách ngành hàng mục 3, đối chiếu mục 14 với
`Privacy.tsx`) nên trả lời nhưng không chặn.

**Chuỗi ban hành, đúng thứ tự:** duyệt → chốt `effective_at`/`approved_by` →
**rồi mới** tính hash trên nội dung đã duyệt → `INSERT`. `content_hash` **không**
nằm trong câu `INSERT` — nó là cột GENERATED, không ai viết được, kể cả người gõ
câu đó. Ba dòng SQL ở
[`approval-packets/packet-d-pilot-activation.md` §4](./approval-packets/packet-d-pilot-activation.md).

---

## 9. Năm packet — không cái nào được duyệt

| Packet | Nội dung | Mục tiêu | Tier |
|---|---|---|---|
| [S](./approval-packets/packet-s-staging.md) | Tạo/xác nhận project staging | mới | 🟡 |
| [B](./approval-packets/packet-b-migrations.md) | 18 migration | staging **rồi** production | 🔴 |
| [C](./approval-packets/packet-c-worker-cron.md) | Worker + cron | staging **rồi** production | 🟡 |
| [A](./approval-packets/packet-a-preview.md) | Đẩy nhánh → preview trỏ staging | Cloudflare | 🟡 |
| [D](./approval-packets/packet-d-pilot-activation.md) | Allowlist, mở pilot | production | 🔴 |

Checklist dashboard 7 mục cho Product Owner:
[`dashboard-checklist.md`](./dashboard-checklist.md).

---

## 10. Khuyến nghị: duyệt cái gì trước

Hai việc **song song**, không phụ thuộc nhau:

**1. Đọc và trả lời Quy chế v1** ([`seller-rules-v1.md`](./seller-rules-v1.md) +
[bản rà soát](./seller-rules-v1-review.md)). Không cần chờ hạ tầng, và nó là thứ
duy nhất chặn việc mời người bán thật.

**2. Cung cấp project ref staging** — một dòng, ô **S-0** trong
[`dashboard-checklist.md`](./dashboard-checklist.md). Không có nó, Packet B và C
không có mục tiêu để chạy.

Trong lúc điền checklist, mục **S-9** (`pg_cron`/`pg_net` đã bật chưa) đáng kiểm
sớm: nếu chưa, Packet C mất phần quan trọng nhất — chứng minh worker chạy theo
**lịch thật** — và preview chỉ còn drain tay, tức là đúng thứ máy cục bộ đã làm
được.

---

## 11. Không thao tác remote nào đã thực hiện

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
| Ban hành Quy chế v1 vào `legal_documents` | ❌ không — chờ APPROVE |
| Deploy Cloudflare | ❌ không |
| Merge / push | ❌ không — nhánh chỉ ở cục bộ |
| Gửi email/push thật | ❌ không |
| Bật lập chỉ mục · IndexNow · sitemap Shop | ❌ không |
| Sửa drift `news_source_ppa_tour_pause` | ❌ không — ngoài phạm vi theo quyết định #4 |
| Tạo dữ liệu người bán thật | ❌ không |

Mọi truy vấn Postgres remote trong đợt audit đi qua một script từ chối bất cứ
câu lệnh nào không bắt đầu bằng `SELECT`/`WITH`. Không giá trị secret nào được
đọc hay in — chỉ tên.
