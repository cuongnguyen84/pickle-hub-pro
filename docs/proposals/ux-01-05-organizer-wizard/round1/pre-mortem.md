# pre-mortem — vòng 1 (2026-07-19)

> Nguyên văn output agent, không chỉnh sửa.

## Pre-mortem: ux-01-05-organizer-wizard

Ba câu chuyện, ba cơ chế khác nhau: **tiền chảy sai chỗ**, **RLS quá mở (draft lộ)**, **RLS quá chặt (autosave nói dối)**. Điểm chung của cả ba: cụm wizard đối xử với 5 flow như một, còn tầng RLS/telemetry bên dưới thì **không đồng nhất** — và đó là nơi checklist không có ô nào để tick.

---

### Sự cố 1 — "Ba tuần tiền sân của CLB Thủ Đức chảy vào tài khoản ông chủ nhiệm cũ đã nghỉ"
**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** ~3 tuần (tới kỳ đối soát cuối tháng)

**Timeline**
- T+0 (ngày 1): Manager mới của CLB dùng UX-02 "tạo từ mẫu" — chọn template sinh ra từ một buổi đánh tháng trước (buổi đó do chủ nhiệm cũ tạo, STK là của ông ấy). Template kéo nguyên cụm `bank_code / bank_account_number / bank_account_name` vào form. Manager điền lại tên, giờ, giá 120k, bấm Publish.
- T+0 → T+3 tuần: ~8 buổi/tuần × ~20 người × 120k. Mỗi người quét QR trong `/dang-ky`, app ngân hàng prefill đúng số tiền + đúng STK **của ông chủ nhiệm cũ**. Chuyển xong, chụp màn hình, manager bấm "đã nhận" trong luồng claim/confirm.
- T+21: chủ nhiệm cũ thấy tài khoản nhận lai rai vài chục triệu lạ, hoặc kế toán CLB đối soát cuối tháng thấy quỹ trống. Lúc đó ~9-12 triệu đã vào nhầm tài khoản của người ngoài CLB.

**Cơ chế**
`src/pages/EditSocialEvent.tsx:98,171-175` → luồng prefill bank từ `event_payment_config` đã tồn tại; UX-02 template gần như chắc chắn tái dùng đúng shape này để snapshot form → cụm bank trio được copy nguyên xi.
`src/components/social/create-event/Step2Payment.tsx:58-65` → preview QR chỉ validate **định dạng** (`/^[0-9]{6,20}$/` + tên ≥ 3 ký tự), không validate **quyền sở hữu**. Một STK cũ hợp lệ về hình thức → pass mọi guard.
`src/pages/PlayerRegistration.tsx:446-450` + `src/lib/payment/vietqr.ts:generateVietQRUrl` → QR người chơi quét được **dựng thuần client** từ `event_payment_config`. Không có server verify, không API ngân hàng, không đối soát. Số nào ghi trong config thì tiền chảy vào số đó.
`supabase/migrations/20260521130000_club_managers.sql` → multi-organizer ("2-3 người") là điều kiện đủ để người tạo template ≠ người publish → STK của A theo template sang tay B.

**Vì sao mọi gate vẫn xanh**
Panel duyệt wizard thấy QR preview render đẹp, form validate chặt. CI không thể có test "STK này có phải của organizer hiện tại không" — không có nguồn sự thật nào để so. Soak chạy bằng một tài khoản test có STK **tình cờ đúng**, tạo-publish trong cùng phiên. Bug cần **điều kiện thời gian + đa tác nhân** — không session test đơn lẻ nào tái hiện. Lỗi hợp thành thuần: mỗi mảnh (prefill, QR client, claim thủ công) đều "đúng".

**Ai báo, sau bao lâu**
Không phải người chơi (với họ mọi thứ bình thường). Người báo là chủ nhiệm cũ hoặc kế toán, sau ~3 tuần. Khả năng cao nổ trên group Facebook CLB trước khi Cuong biết.

**Vì sao khó sửa**
`git revert` được code, nhưng **tiền đã đi**. VietQR không có đối soát ngược; phải xin sao kê, đối chiếu thủ công, đòi/hoàn từng người. Không bản ghi nào nói "giao dịch này lẽ ra vào STK X nhưng đã vào Y" — hệ thống chưa từng biết STK nào là "đúng".

**Dấu hiệu sớm lẽ ra phải có**
Cảnh báo khi STK buổi mới **khác** STK buổi gần nhất cùng CLB (một query). BASE-02 funnel chỉ đo **chuyển đổi**, không đo **tính đúng của tiền** — số liệu xanh mướt suốt 3 tuần.

---

### Sự cố 2 — "Giải nháp 'aaa test' của bầu Long hiện trong tìm kiếm + có người đăng ký thật vào bracket chưa dựng xong"
**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** vài ngày

**Timeline**
- T+0: UX-01 thêm trạng thái `draft`; UX-04 autosave ghi **row draft xuống DB ngay từ bước 1** (để resume xuyên thiết bị). Organizer mở wizard DoublesElim, gõ tên nháp, cấu hình dở, đóng tab.
- T+2h: người chơi search "giải" trên `/tim-kiem` hoặc lướt homepage → thấy giải draft (tên nháp, ngày sai, phí trống). Bấm vào, thấy nút đăng ký → đăng ký thật.
- T+2 ngày: vài người đã ghi danh vào giải chưa tồn tại về mặt tổ chức.

**Cơ chế**
`supabase/migrations/20251221153808_...sql:276` → `tournaments FOR SELECT USING (true)`. `supabase/migrations/20260122020801_...sql:83` → `doubles_elimination_tournaments FOR SELECT USING (true)`. RLS **không có** status trong điều kiện.
`src/hooks/useTournamentData.ts:26` → `useTournaments()` `select("*")` không `.eq("status",…)`. `src/hooks/usePaginatedSearch.ts:88` → search tournaments không lọc status.
`src/pages/Tournaments.tsx:386` → status lạ render **nguyên văn**, fallback sort đẩy cuối nhưng **vẫn hiện**.

**Vì sao mọi gate vẫn xanh**
**RLS của 5 flow không đối xứng**: `social_events` lọc `status='published'` ở query (`useFeedHappenings.ts:70`), `quick_tables`/`flex_tournaments` gated `is_public` (`20251223034604:134`, `20260123142717:178`) — 3 flow an toàn. Chỉ `tournaments` + `doubles_elimination_tournaments` là `USING(true)`. Reviewer test bằng flow social/flex (draft ẩn đúng) rồi kết luận "cụm draft OK". Soak tạo draft rồi publish cùng phiên. Sitemap sạch (`sitemap-tournaments.xml.ts:53` whitelist) càng làm pipeline tin draft bị chặn mọi cửa. Cửa sót: listing homepage + search.

**Ai báo, sau bao lâu**
Người chơi đăng ký nhầm nhắn hỏi (1-3 ngày), hoặc organizer thấy người lạ trong giải nháp. Không alert nào nổ.

**Vì sao khó sửa**
Đã có **đăng ký thật + tiền cọc** dính vào giải chưa hoàn thiện. Xoá draft = mất data người chơi vô tội; giữ = ép organizer hoàn thành giải họ định vứt. Rối người, không rối code.

**Dấu hiệu sớm lẽ ra phải có**
Test parity RLS "tạo draft cả 5 flow → query anon thấy không". BASE-02 funnel chỉ đo social → bất thường tournament vô hình.

---

### Sự cố 3 — "Bầu Sơn dựng bảng loại kép 32 đội trong 40 phút, đóng máy, mở lại thấy trắng — 'đã lưu 14:32' là dối"
**Xác suất:** trung bình-cao · **Thời gian tới lúc phát hiện:** vài giờ (organizer nổi đoá ngay)

**Timeline**
- T+0: Manager (thêm qua `club_managers`, **không phải** creator) mở wizard DoublesElim/TeamMatch qua cụm UX mới.
- T+0 → T+40ph: điền cả trăm field (32 đội, seeding, sân, phí). Autosave chạy mỗi ~10s, chip "Đã lưu 14:32" nhấp nháy xanh.
- T+41ph: reload → wizard load draft từ DB → **trắng trơn** hoặc kẹt bản 40 phút trước.

**Cơ chế**
`supabase/migrations/20260521130000_club_managers.sql:200-230` → chỉ mở INSERT/UPDATE RLS cho `clubs` + `social_events`. **Không đụng** tournaments/doubles/flex/quick_tables/team_match.
`20260122020801_...sql:107` (`creator_user_id = auth.uid()`) + `20260122125549_...sql:26` (`created_by = auth.uid()`) → UPDATE tournament vẫn **chỉ creator**. Manager không khớp → RLS lọc sạch row.
Chí mạng: supabase-js `.update()` khớp **0 row** dưới RLS trả `{ data: [], error: null }` — **không throw**. Autosave bắt `error`, thấy null → chip "Đã lưu" xanh (lạc quan dối).

**Vì sao mọi gate vẫn xanh**
Panel/CI/soak **đều chạy bằng creator** → autosave hoàn hảo. Đường manager cần tài khoản thứ hai qua `club_managers` — không nằm trong ma trận test. Lỗi là **sự vắng mặt của một ghi**, không phải ghi sai. Đối xứng với Sự cố 2: RLS tournament quá mở (đọc) nhưng quá chặt (ghi manager) — cùng gốc: cụm UX coi 5 flow như nhau, `club_managers` chỉ vá 2 bảng.

**Ai báo, sau bao lâu**
Chính manager, vài giờ, rất giận. Phát hiện nhanh nhưng **ăn mòn niềm tin trực tiếp** — organizer copy ra Google Docs, đúng cái wizard định xoá bỏ.

**Dấu hiệu sớm lẽ ra phải có**
Autosave kiểm `data.length === 0` → coi là thất bại, không cho chip xanh. Biến thể cùng cơ chế: 2 tab cùng autosave last-write-wins đè nhau — cũng lọt vì soak không mở 2 tab.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | Tiền vào STK cũ (template bank prefill) | TB | **Rất cao** (~3 tuần, tiền thật, im lặng) | **P0** |
| 2 | Draft tournament lộ ra listing/search + đăng ký nhầm | TB | Trung bình (vài ngày) | P1 |
| 3 | Autosave "đã lưu" nói dối với co-manager | TB-cao | Thấp (vài giờ) | P2 |

## Rẻ nhất để chặn từ bây giờ

1. **Sự cố 1** — Khi publish mà bank trio đến từ template/prefill: ép checkbox xác nhận **hiển thị `bank_account_name`**: "Tiền sẽ vào [TÊN] – [STK], đúng tài khoản của bạn?". Rẻ hơn nữa: query cảnh báo khi STK buổi mới ≠ STK buổi gần nhất cùng `club_id`.
2. **Sự cố 2** — Sửa **gốc, một chỗ**: siết RLS SELECT trên `tournaments` + `doubles_elimination_tournaments` thành `status <> 'draft' OR creator_user_id = auth.uid()`. Vá RLS phủ mọi caller hiện tại + tương lai.
3. **Sự cố 3** — Helper autosave chung: kiểm cả `error` **và** `data.length`; 0 row = thất bại. Song song: mở `club_managers` RLS sang bảng tournament, hoặc chặn manager vào wizard tournament ở cửa.

## Khoảng hở của pipeline mà bài này lộ ra

- **Không có test parity 5-flow.** Panel/CI/soak luôn: một tài khoản creator, một phiên, tạo-và-publish liền. Ba sự cố sống trong khe: (a) đa tác nhân, (b) đa phiên, (c) đa flow (2/5 bảng `USING(true)`), (d) draft nằm lại rồi xem bằng anon.
- **BASE-02 journey funnel chỉ đo social.** 4 flow tournament không có mắt funnel nào — metric "cụm chạy tốt" mù với chính nơi 2/3 sự cố xảy ra.

**Feedback cho /idea:** thêm hai gate cứng trước merge UX-04/05: (1) ma trận parity 5-flow chạy **write-as-manager** + **SELECT-as-anon-on-draft** cho cả năm bảng; (2) mở journey funnel sang 4 flow tournament **trước**, không sau.
