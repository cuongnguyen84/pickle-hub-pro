# ThePickleHub Shop Closed Pilot — Next Session Roadmap

> Handoff cho Claude Code. Bắt đầu từ checkpoint staging hiện tại; không làm
> lại P2a, P2b, coverage, B-1, C-1 hoặc rollback drill đã đạt.

## 1. Trạng thái nguồn

- Repository: `cuongnguyen84/pickle-hub-pro`
- Branch: `feat/shop-closed-pilot`
- PR: [#578](https://github.com/cuongnguyen84/pickle-hub-pro/pull/578)
- Checkpoint được báo cáo gần nhất: HEAD `ea1ba75c` hoặc hậu duệ hợp lệ trên
  `origin/feat/shop-closed-pilot`.
- CI tại checkpoint gần nhất: 8/8 xanh.

Trước khi làm:

1. Fetch remote.
2. Checkout đúng branch trong worktree sạch.
3. Xác minh HEAD là `ea1ba75c` hoặc hậu duệ hợp lệ.
4. Đọc mọi commit mới hơn `ea1ba75c` nếu có.
5. Đọc `CLAUDE.md`, `architecture-boundaries.md`, implementation map và toàn
   bộ `docs/proposals/shop-closed-pilot/`.
6. Đọc `.claude/memory/MEMORY.md`, mục Shop closed pilot ngày 14/08/2026.
7. Không nuốt file bẩn của phiên khác.

## 2. Phần đã hoàn thành

### Product

- Prototype 37 màn: hoàn thành.
- P2a seller/catalog: hoàn thành và Product Owner acceptance PASS.
- P2b admin/buyer/public Shop: hoàn thành và Product Owner acceptance PASS.
- Seller application/profile, moderation, catalog, variants, SKU, inventory,
  media, public projection, discovery, search, PDP và public shop đều đã có.
- Giỏ hàng, đơn hàng và thanh toán chưa thuộc phase này.

### Seller Rules và Privacy

- `approved_by`: Cuong Nguyen — Product Owner, ThePickleHub.
- `effective_at`: `2026-08-14T00:00:00+07:00`.
- Body: 33,568 bytes.
- SHA-256:
  `fb62bd471d7b6b27c53d9eeded57dd636aa2f1f1f03db9a4a20abd49d7c70c98`.
- Privacy Shop VI/EN đã được duyệt và áp.

### Quality

- Statements: 84.31% — 4726/5605.
- Branches: 71.77%.
- Functions: 79.84%.
- Lines: 86.18%.
- Không hạ threshold, thêm exclusion/ignore hoặc thay coverage provider/config.

### Staging

Supabase staging:

- Project: ThePickleHub Staging.
- Ref: `utokwfcljxjkpkaqgheo`.
- URL: `https://utokwfcljxjkpkaqgheo.supabase.co`.
- Region: `ap-northeast-1`.

Cloudflare Pages staging riêng:

- Project: `thepicklehub-shop-staging`.
- URL: `https://thepicklehub-shop-staging.pages.dev`.
- Production branch của Pages project: `feat/shop-closed-pilot`.
- Không thay đổi Pages project `pickle-hub-pro`.

Staging đã có:

- Migration ledger 359 tại báo cáo gần nhất; phải tính lại theo HEAD hiện tại.
- `pg_cron` và `pg_net`.
- Edge Function `shop-media-lifecycle`.
- `CRON_SECRET` riêng của staging.
- Schema/RPC/RLS Shop, Seller Rules v1, CP18 và B13.
- Cleanup và reconcile cron đã chạy HTTP 200.

Hai cron Shop đang active:

- `shop-media-cleanup-every-5m`.
- `shop-media-reconcile-hourly`.

16 cron ngoài Shop đang tạm inactive trên staging để acceptance có tín hiệu
sạch. Không tự bật lại trong checkpoint acceptance.

### B13 và rollback

Đã chứng minh trên staging:

- Live logo/cover không bị enqueue hoặc xóa.
- Orphan thật được enqueue và xóa.
- Reconcile idempotent.
- Health `stuck=0`, `failed=0`.
- Không cron active nào trỏ production.
- Rollback drill function/cron PASS và hệ thống đã được khôi phục.

## 3. Defect và debt đã biết

### B14

Delete-account cleanup nền tảng có thể lỗi nhưng endpoint cũ vẫn trả success.
Không sửa bằng service-role grant lẻ. Closed pilot an toàn vì shop owner bị
chặn 409 `shop_owner_offboarding_required` trước cleanup. Không mở lại
self-service deletion cho shop owner.

### `shops.owner_user_id`

REST `select=*` dành cho anon có thể trả UUID owner, nhưng hiện không nối được
sang profile/PII. Đây là privacy-hardening debt hậu pilot:

- Không sửa column grant trong CP27.
- Buyer production call site không được gọi `select=*`.
- Buyer DOM/network không được lộ `owner_user_id`.
- Phải xử lý trước public indexing hoặc API expansion.

### Ops cron

`secret-sync-heal-30min` đã được loại bằng forward migration idempotent. Không
khôi phục job này. Không đụng production `social-poster-catchup-15min` ngoài
kế hoạch riêng.

## 4. Mục tiêu phiên tiếp theo

Hoàn thành CP27:

1. Tạo fixture staging tổng hợp.
2. Chạy 18 acceptance cases có đăng nhập còn lại.
3. Đạt tổng staging acceptance 24/24.
4. Chạy responsive/axe trên dữ liệu thật.
5. Chạy leakage scan và teardown.
6. Xác minh cron/health sau acceptance.
7. Sửa bug và đợi CI 8/8 nếu có thay đổi.
8. Merge PR #578 khi đủ merge gate.
9. Production pre-flight, deploy và Wave 0 nội bộ.
10. Giữ indexing OFF; không mở Wave 1.

Không dừng xin phép giữa các checkpoint đã được phê duyệt nếu gate xanh.

## 5. CP27 pre-flight

Trước mọi mutation:

1. In branch, HEAD và trạng thái tree.
2. In staging ref `utokwfcljxjkpkaqgheo` và chứng minh production không phải
   target.
3. Xác minh staging `ACTIVE_HEALTHY`.
4. Đọc database time thật.
5. Xác minh Seller Rules v1 approved, effective, đúng 33,568 bytes và hash.
6. Tính lại expected ledger theo checkout hiện tại rồi so remote; không mặc
   định 359 nếu có migration mới.
7. Xác minh Edge Function staging hiện diện.
8. Xác minh đúng hai cron Shop active và 16 cron ngoài Shop inactive.
9. Xác minh health `stuck=0`, `failed=0`.
10. Xác minh Pages artifact có staging ref, không có production ref và `/shop`
    trả `noindex, nofollow, noarchive`.
11. Không in secret, token, password, TOTP hoặc signed URL.

Dừng nếu target, ledger, Rules hash, function hoặc cron state không khớp.

## 6. Fixture staging

Tạo dữ liệu tổng hợp, không dùng PII thật:

- `cp27-admin-<run-id>`.
- `cp27-seller-<run-id>`.
- `cp27-buyer-<run-id>` nếu cần.

Nếu `.invalid` không được Supabase Auth nhận, dùng alias QA thuộc domain dự án
kiểm soát; không dùng email cá nhân.

Yêu cầu:

- Password sinh ngẫu nhiên; không log/commit/chat.
- Tạo qua Admin API staging.
- Admin role đúng convention.
- Admin trước TOTP là `aal1`; enroll và verify TOTP thật; sau verify là
  `aal2`.
- Không bypass/mock/tắt `AdminMFAGate`.
- Seller chỉ nhận pilot membership tối thiểu.
- Buyer không có quyền nâng cao.
- Tách browser context/cookie/storage cho từng actor.
- Registry ghi đủ ID để teardown.
- Không dùng service-role token trong browser acceptance.

## 7. Acceptance có đăng nhập

### A. Admin MFA

- AAL1 bị chặn khỏi moderation.
- Queue không render trước AAL2.
- TOTP enroll/verify thật.
- JWT xác nhận AAL2 rồi queue/review mới render.

### B. Seller Rules

- Seller chưa ký không submit được.
- Mở đúng toàn văn v1.
- Ký đúng bản đang effective.
- Receipt đúng version, hash, accepted time, user và application.
- Admin không ký thay seller được.

### C. Seller application

- Submit thành công sau acceptance.
- Request changes bắt buộc public note và structured target.
- Internal note không lộ seller.
- Status liệt kê đúng field cần sửa.
- Deep-link mở đúng step/field và focus thật.
- Draft cũ còn nguyên; resubmit thành công.
- Approve replay không tạo shop thứ hai.

### D. Shop profile và contact

- Cập nhật tên, slug, region, shipping note và return note.
- Đổi tên không tự đổi slug; đổi slug qua RPC riêng.
- Contact normalize đúng và chỉ công khai sau moderation.
- Raw contact/private note không rò.

### E. Product, variants và inventory

- Tạo single rồi chuyển multi.
- `option_key` không phụ thuộc thứ tự nhóm.
- SKU, giá và tồn đúng.
- Invalid duplicate group không xóa variant.
- Variant mới không thừa kế stock của variant khác.
- Inventory movement không invent stock.
- Bulk/undo đúng; duplicate SKU bị chặn.

### F. Media

- Upload JPEG có EXIF/GPS thật.
- Draft private, rendition WebP sạch, original không public.
- Product/logo/cover sống qua reconcile.
- Reorder và variant-media mapping đúng.
- Một file lỗi không kéo file khác; retry giữ token.
- Finalize lỗi không báo success.

### G. Preview và submit

- Preflight trả lỗi có cấu trúc.
- Deep-link lỗi đúng control/variant/media.
- Upload xong checklist refetch.
- Submit chỉ khi preflight OK.
- Pending review khóa sửa và nút lưu.

### H. Moderation và publish

- Request changes, sửa, resubmit.
- Approve không tự publish.
- Worker publish mới đưa sản phẩm ra public.
- Replay không nhân event/job.

### I. Buyer surfaces

- Discovery, search có/không dấu, category, PDP và public shop.
- Variant đổi ảnh.
- Out-of-stock, nonexistent và unknown là ba trạng thái khác nhau.
- Contact CTA được sanitize.
- Không cart/save/payment CTA.

### J. Suspend và reopen

- Suspend gỡ public projection ngay và enqueue cleanup.
- Reopen về `needs_changes`, không về approved.
- Không tự publish lại.
- Seller resubmit và admin approve/publish lại theo đúng vòng.

### K. Account deletion

- Shop owner nhận 409 trước cleanup.
- UI không hiện ô DELETE hoặc success.
- Không partial cleanup.
- Non-owner deletion không regression.
- Manager/support không bị nhận nhầm là owner.

### L. Slug, privacy và noindex

- Redirect slug đúng.
- Suspended và never-existed không tạo private oracle.
- Buyer DOM/network không rò dữ liệu riêng tư.
- Shop routes vẫn noindex.
- Không Shop URL trong sitemap/IndexNow.

Map các case trên với Product Owner test pack hiện có; không bỏ case vì mã TC
khác nhau.

## 8. Responsive và accessibility trên dữ liệu thật

Không nghiệm thu bằng catalogue rỗng. Kiểm tra:

- `/shop`.
- `/shop/search`.
- Category.
- PDP multi-variant.
- Public shop.
- Seller settings/product edit/variant matrix/media editor.
- Admin product queue/review/contact moderation.

Viewport: `320`, `375`, `390`, `414`, `768`, `1440`.

Assert:

- `window.innerWidth` đúng.
- Có ProductCard và fixture data thật.
- Axe serious/critical = 0.
- Không overflow/clipping.
- Touch target, keyboard, focus và dialog đúng.
- Sticky CTA không bị che.
- Seller/Admin không có buyer BottomNav.
- ChatFAB không đè action.
- Content marker chứng minh đã tới phần thân, không phải error/empty shell.

## 9. Leakage scan

Anonymous buyer DOM và network không được chứa:

- Account email/phone.
- Pickup address.
- `owner_user_id` trong buyer call site/DOM.
- `internal_note`.
- `client_token`.
- `stock_on_hand`.
- `draft_path`.
- `rendition_source_path`.
- `/original`.
- Signed token.
- Cleanup job.
- TOTP/secret.

Ghi debt endpoint REST `shops?select=*`, nhưng không dùng nó để miễn buyer UI.

## 10. Cron và health

Giữ active đúng hai cron Shop và giữ 16 cron ngoài Shop inactive.

Chứng minh:

- Cleanup có ít nhất hai HTTP 200.
- Reconcile có ít nhất một HTTP 200.
- Không request sang production.
- Live product/logo/cover không bị xóa.
- Orphan thật bị xóa.
- Reconcile idempotent.
- `stuck=0`, `failed=0`.
- 404 noise ngoài Shop không tăng.

Không bật lại cron ngoài Shop cuối acceptance.

## 11. Teardown

Xóa toàn bộ fixture CP27:

- Auth users và roles.
- Pilot memberships.
- Applications/events và legal acceptances của fixture.
- Shops/members.
- Contacts/events.
- Products/variants/inventory/events.
- Product/profile media.
- Cleanup jobs và Storage objects.

Không xóa Seller Rules v1, migration ledger, cron definitions, Vault secrets,
system/pro-tour user hoặc dữ liệu ngoài registry CP27.

Sau teardown:

- Mọi counter fixture = 0.
- Storage fixture objects = 0.
- Cleanup health sạch.
- Hai cron Shop vẫn active; 16 cron ngoài Shop vẫn inactive.
- Query error phải fail; không dùng `?? 0` che lỗi.

## 12. Xử lý bug

Nếu tìm thấy bug:

1. Giữ fixture tái hiện.
2. Chứng minh đỏ tại production call site.
3. Sửa nguyên nhân và thêm regression.
4. Commit riêng, chạy gate, push và chờ CI 8/8.

Không nới gate, bypass MFA/RLS, vá quyền rộng hoặc xử lý B14 bằng grant lẻ.

## 13. Merge gate

Chỉ merge PR #578 khi:

- Acceptance tổng 24/24 PASS.
- Responsive/axe trên dữ liệu thật PASS.
- Leakage scan PASS.
- Teardown sạch.
- Rollback drill PASS.
- Cleanup/reconcile khỏe.
- Seller Rules đúng hash và effective.
- CI 8/8 trên HEAD cuối.
- Working tree sạch.

Merge theo branch protection, không bypass. Ghi merge SHA, final HEAD,
migration target, function hash, staging health và known debts.

## 14. Production pre-flight

Chỉ bắt đầu sau merge. Production ref: `ajvlcamxemgbxduhiqrl`.

Trước mutation:

1. In project ref/name/org/region và chứng minh đúng production target.
2. Đọc ledger, schema, function, cron và Vault state thật; không suy từ staging.
3. Không sửa drift PPA.
4. Không rotate production `CRON_SECRET` nếu đang hoạt động.
5. Xác minh `project_url` production đúng CP18.
6. Xác minh indexing OFF/vắng.
7. Chuẩn bị rollback.
8. Dừng nếu drift làm kế hoạch staging không còn áp dụng được.

## 15. Production deploy

Thứ tự bắt buộc:

1. Dependency/schema an toàn.
2. Deploy Edge Function trước cron.
3. B13 trước cleanup/reconcile cron.
4. Không tạo cron rồi unschedule sau.
5. Không chèn ledger mù.
6. Áp migration loại `secret-sync-heal` resurrection.
7. Không tắt social-poster production ngoài quyết định riêng.
8. Không đổi production secret nếu không cần.
9. Xác minh Seller Rules body/hash và Privacy build.
10. Xác minh function version/hash, cron và health.
11. Deploy web production với indexing vẫn OFF.

Không copy secret staging sang production.

## 16. Wave 0 nội bộ

Chỉ dùng tài khoản nội bộ Product Owner kiểm soát. Chạy auth/MFA, Rules,
application, moderation, shop profile, product/variant/inventory, media,
buyer surfaces, suspend/reopen, B12, cron health, noindex và leakage.

Không mời seller ngoài. Nếu Wave 0 đỏ, dừng, disable cron khi liên quan và
rollback; không mở Wave 1.

## 17. Điều vẫn bị cấm

- Không bật `SHOP_PUBLIC_INDEXING`.
- Không IndexNow hoặc thêm Shop vào sitemap.
- Không mở Wave 1 hoặc mời seller thật.
- Không mở self-delete cho shop owner.
- Không sửa B14 bằng grant lẻ.
- Không sửa drift PPA.
- Không dùng secret staging cho production.
- Không đưa credential/TOTP/signed URL vào báo cáo.
- Không xóa dữ liệu production ngoài fixture của phiên.

## 18. Báo cáo

Báo theo checkpoint:

1. Branch/HEAD/tree.
2. DB time và Seller Rules state.
3. Fixture actors đã che và AAL evidence.
4. Verdict từng acceptance case và tổng 24/24.
5. Responsive/axe và leakage.
6. Cron/health.
7. Bug/regression.
8. Teardown.
9. PR CI và merge SHA.
10. Production pre-flight/deploy.
11. Wave 0.
12. B14 và `owner_user_id` debt.
13. Xác nhận indexing OFF và Wave 1 chưa mở.

Kết luận staging:

> Closed-pilot staging acceptance PASS 24/24 with rollback drill complete;
> PR #578 ready to merge.

Kết luận production:

> Closed pilot deployed to production with indexing OFF; Wave 1 external
> seller onboarding awaits Product Owner approval.

Nếu phải dừng:

> Deployment stopped safely at checkpoint …

Nêu chính xác mutation đã thực hiện và rollback state.

## 19. Quy tắc tiếp tục

Không dừng chỉ để hỏi “có tiếp tục không” khi bước sau đã nằm trong phạm vi ủy
quyền và gate xanh.

Nếu context gần hết: hoàn thành checkpoint hiện tại, commit, push nếu phù hợp,
để tree sạch, cập nhật completion/memory và để phiên sau tiếp tục.

Chỉ dừng khi thiếu credential/quyền, target không xác minh được, migration
drift, security/data-loss bug chưa sửa an toàn, teardown không sạch, rollback
không khả thi hoặc production action vượt phạm vi đã duyệt.
