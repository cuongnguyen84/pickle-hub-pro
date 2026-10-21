# pre-mortem — rankings-dupr-wpr-tabs (2026-08-06)

> Ba sự cố dưới đây **đã xảy ra**. Feature ship 2026-08-06. Mắt xích trỏ file thật trên branch `feat/ppa-rankings-tab` (HEAD `4f02fa1c`).

## Sự cố 1 — "Không tìm thấy VĐV" cho Hien Truong — VĐV Việt Nam DUY NHẤT trên bảng WPR — suốt 5 tuần

**Xác suất:** cao · **Phát hiện:** 3-6 tuần (chỉ khi có người chửi công khai)

**Timeline:** T+0 ship, Cuong test "Ben Johns" → ra, xanh. T+5 ngày: user từ Google với "hien truong pickleball ranking" mở trang (board Nam mặc định), gõ "hien truong" → **"Không tìm thấy VĐV"** — trong khi dòng đó hiển thị cách 300px bên dưới (khối Việt Nam & gốc Việt). T+11: group Facebook chụp màn hình "trang này bảo VN không có ai trên bảng thế giới", 40 comment, không ai tag Cuong. T+34: Cuong gõ "Alix Trương" (Telex có dấu) → 0 kết quả → mới lần ra.

**Cơ chế — 3 thứ vô hại gặp nhau:**
1. `PpaRankings.tsx:40` — search chỉ soi 25 dòng của board đang chọn (mặc định men).
2. `ppa-rankings.ts:105-109` — 3/4 VĐV highlight nằm NGOÀI mọi mảng board (Hien Truong #38 — người duy nhất hộ chiếu VN — chỉ tồn tại trong highlights; board dừng ở #25).
3. `useSearch.ts:31` — `.toLowerCase().includes()`, KHÔNG fold dấu. Repo có 12 chỗ normalize("NFD") (venues.ts:204, slug.ts:19) nhưng không chỗ nào trong đường search. Gõ Telex "Trương" vs data "Truong" → 0 match.

**Vì sao mọi gate xanh:** seo.spec đi nhánh bot → renderPpaRankings không có ô search, in đủ 2 board + khối Việt (đúng về cấu tạo — không thể bắt lỗi nhánh người; nguyên văn bài học "gate chỉ đo nhánh BOT"). human-path.spec chỉ crawl từ trang chủ — /rankings/ppa-tour không có inlink từ home → chưa bao giờ được mở. Coverage 83% toàn cục mù với file 0-test. Filter trả [] là giá trị hợp lệ — 0 client_errors, soak sạch, Telegram im. Visual: route mới không có baseline, workflow continue-on-error. Panel: recon ĐÃ nêu đúng cơ chế ở idea-recon.md:53 dưới nhãn "unknown worth asking" — nhãn không ai sở hữu.

**Không revert được:** ảnh chụp màn hình lưu hành trong group Facebook — "ThePickleHub bảo VN không có ai trên bảng WPR". Thiệt hại niềm tin với đúng nhóm user duy nhất của sản phẩm.

**Dấu hiệu sớm lẽ ra có:** event `wpr_search_no_result` — 1 dòng, báo trong 48h.

## Sự cố 2 — Proxy full-2.075 chết câm 26 ngày; triệu chứng TRÙNG KHÍT hành vi đúng

**Xác suất:** TB-cao (nếu chọn proxy) · **Phát hiện:** 3-4 tuần

**Cơ chế:** nguồn trả **200 + HTML challenge** (không phải 500) hoặc đổi shape → `res.json()` throw → `catch {} → Response.json([])`, hoặc field mới → mọi tên thành "" → không bao giờ khớp. Nếu có "last-good in KV": mảng rỗng CHÍNH NÓ ghi đè last-good. UI empty state dùng **cùng chuỗi** với Sự cố 1 → user không phân biệt "nguồn chết" với "ngoài trích đoạn", Cuong cũng không, log cũng không. Disclaimer "trích top 25" của chính trang **bảo kê** cho lỗi.

**Vì sao gate xanh:** KHÔNG gate nào chạm Pages Function /api/* — seo đi nhánh bot thuần tĩnh; uptime-ping chỉ probe / + /feed; `ops_job_registry` chỉ có schema cho cron Supabase — endpoint on-demand **không có ô để đăng ký** (lỗ loại mới, không phải "quên khai báo"); 0 exception → 0 client_errors.

**Khó sửa:** không biết chết từ lúc nào; nếu WAF/IP block thì mọi thử nghiệm thêm request vào đúng cái đang đếm; nếu ToS-driven block thì đó là câu trả lời của PPA cho lá thư chưa hồi âm — bằng kỹ thuật thay vì email.

**Dấu hiệu sớm:** assert `rows.length > 1000`, NÉM khi ít hơn (để client_errors + Telegram thấy) — pattern guard 0-dòng proposal cũ đã viết cho Option A rồi không áp cho proxy vì proxy "không phải pipeline". Nó là pipeline chạy theo request.

## Sự cố 3 — Gate `quality` đỏ vĩnh viễn từ ngày 24, không PR nào bị chặn là thủ phạm

**Xác suất:** cao (nếu nhúng full 2.075 tĩnh) · **Phát hiện:** ngay, **quy trách nhiệm sai nhiều tuần**

**Cơ chế:** nhúng 66,9 KB → Total 1967,5/1970 — **xanh với 2,5 KB dư**, merge không ai nhìn. 6 ngày sau bài blog mới (+7,5-15 KB) → Total ~1975-1982 → `quality` ĐỎ trên MỌI PR sau, thông điệp nêu tổng không nêu ai ăn headroom. `check-bundle-size.mjs:43` — chunk data WPR không khớp CONTENT_RE → tính vào CODE; mỗi lần refresh snapshot tay lại đẩy lên. Luật ratchet-down (perf-budgets.md:56) chặn nâng số bằng thủ tục. Repo ĐÃ có 2 gate đỏ kinh niên (deploy-guard drift, coverage 75%<83%) — thêm cái thứ ba biến "quality đỏ" thành trạng thái nền, và regression thật (lazy→eager, lớp lỗi recharts) sẽ đi qua khi mọi người đã quen phớt lờ màu đỏ.

**Dấu hiệu sớm:** cảnh báo headroom <5% trong check-bundle-size — 3 dòng.

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | Search nói dối về Hien Truong (board-scope × excerpt × dấu VN) | Cao — ngay lần ship đầu với dữ liệu đang có | Rất cao — 0 exception, gate bot mù cấu tạo, empty state trông như đúng | 🔴 P0 |
| 2 | Proxy chết câm nguỵ trang thành empty hợp lệ | TB-cao (nếu proxy) | Rất cao — không gate nào chạm /api/*; disclaimer bảo kê | 🔴 P0 nếu proxy |
| 3 | Bundle ratchet khoá CI mọi PR sau | Cao (nếu nhúng tĩnh) | Thấp triệu chứng, cao quy-trách-nhiệm | 🟠 P1 |

**Hợp thành 1+2:** hai sự cố dùng CHUNG một chuỗi UI. Ship cả hai đường (excerpt + proxy) thì Sự cố 2 vĩnh viễn không phân biệt được với Sự cố 1. Thiết kế BẮT BUỘC có **hai empty state khác nhau**.

## Rẻ nhất để chặn từ bây giờ

1. **Search soi UNION** `[...MEN, ...WOMEN, ...VIET_HIGHLIGHTS]` thay vì `rows` + fold dấu NFD (pattern venues.ts:204). Kèm **1 test: `search("Trương")` phải trả Hien Truong** — test này fail hôm nay ⇒ nó sống.
2. **Hai empty state khác chữ** ("không có trong trích đoạn → link nguồn" ≠ "không tải được → thử lại"). Nếu proxy: assert rows>1000 và NÉM.
3. **Cảnh báo headroom <5%** trong check-bundle-size (3 dòng).

## Khoảng hở pipeline

- human-path.spec chỉ crawl từ trang chủ — mọi route mới (chính cái /idea sinh ra) nằm ngoài lưới.
- KHÔNG có bề mặt giám sát nào có ô cho Pages Function /api/* — không phải quên đăng ký, không có chỗ đăng ký.
- Ngân sách bundle không có khái niệm biên — cho PR tiêu 96% headroom rồi bắt PR sau trả giá; gate quy trách nhiệm sai dạy người ta ngừng tin gate.
- Mọi "unknown worth asking" trong recon không được đóng bằng test/guard là **một sự cố đã được lên lịch** (Sự cố 1 được viết sẵn ở idea-recon.md:53).
