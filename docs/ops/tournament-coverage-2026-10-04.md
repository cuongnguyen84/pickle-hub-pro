# Lịch tác nghiệp giải đấu — kiểm chứng 04/10/2026

Yêu cầu của Cuong: research các giải tiếp theo và giao team agent tiếp tục chuẩn bị dữ liệu lịch thi đấu, cập nhật kết quả. Ưu tiên Hong Kong Slam; kế thừa nhóm bài lịch/kết quả Las Vegas đang mang traffic.

## Danh sách đã kiểm chứng

Ngày dưới đây là ngày địa phương. Nguồn phải đọc lại trước mỗi cập nhật; không coi lịch đăng bài là giờ thi đấu.

| Ưu tiên | Giải | Ngày 2026 | Địa điểm | Nguồn BTC |
|---|---|---|---|---|
| P0 | Veolia Chicago Cup | 5–11/10 | Life Time North Shore, Northbrook | https://www.ppatour.com/events/2026/veolia-chicago-cup/ |
| P1 | Virginia Beach Open | 12–18/10 | Pickleball Virginia Beach | https://www.ppatour.com/events/2026/virginia-beach-open/ |
| P0 | Hang Seng Bank Hong Kong Slam | 19–25/10 | Kai Tak Arena | https://www.ppatour-asia.com/tournament/2026/hong-kong-slam/ |
| P2 | Skechers Nanjing, Asia125 | 28–31/10 | Nanjing, sân chưa công bố | https://www.ppatour-asia.com/tournament/2026/ppa-asia-125-chn-nanjing-2026/ |
| P1 | Opendoor World Championships | 2–8/11 | Brookhaven, Farmers Branch TX | https://www.ppatour.com/events/2026/pickleball-world-championships/ |
| P1 | Proton Daytona Beach Open | 16–22/11 | Pictona, Holly Hill FL | https://www.ppatour.com/events/2026/proton-daytona-beach-open/ |
| P2 watchlist | PJ Tokyo Challenger | 7–9/12 | Ariake Tennis Park | https://www.ppatour-asia.com/tournament/2026/pj-tokyo-challenger-2026/ |
| P2 watchlist | MAS Johor, Asia125 | 17–20/12 | Johor, sân chưa công bố | https://www.ppatour-asia.com/tournament/2026/ppa-asia-125-mas-johor-2026/ |

WALKER Australia Cup 13–18/10 tại Brisbane có trong lịch PPA tổng; chưa đưa vào cadence riêng để ưu tiên Asia/VN và sáu giải gần nhất. Chưa xác minh được giải tại Việt Nam sau 4/10 đủ nguồn BTC trong lượt nghiên cứu này.

## Hong Kong — nhiệm vụ ưu tiên T86

Tiếp tục cùng mã T86, không tạo bản đếm ngược trùng lặp. Bản cũ bị chặn vì chỉ có Markdown và không truy cập được nguồn mới; lưu lại báo cáo cũ nhưng thay brief bằng dữ kiện vừa kiểm chứng.

Giữ bài `/blog/hong-kong-slam-2026-preview` và alternate VI đang có. Cập nhật trạng thái đăng ký: trang PPA Asia đã báo đóng, trong khi preview vẫn ghi đang mở. Chuẩn bị bài lịch riêng nếu mang intent rõ, bài kết quả giữ một URL và cập nhật xuyên giải. Không tạo bài mới mỗi ngày.

Lịch Pro theo PPA Asia, đổi GMT+8 sang giờ VN:

- 19/10: qualifying, 08:00–20:00.
- 20/10: R64; 21/10: R32; 22/10: R16; 23/10: tứ kết; 24/10: bán kết — 08:00–18:00.
- 25/10: chung kết, 12:00–17:00.

Đây là khung phiên, không phải lịch từng trận. Draw/results: https://pickleballtournaments.com/tournaments/C7E4FD72-D159-4211-82A2-21ADBB21DEFE và https://www.ppatour-asia.com/results/ . Chưa tự nhận có danh sách VĐV Việt Nam/hạt giống nếu chưa đối chiếu draw. Hong Kong là finale main PPA Asia; Asia125 vẫn có các chặng sau đó.

## Phân công và đầu ra

**Sports:** lập hồ sơ giải từ nguồn BTC, event ID/draw URL, múi giờ IANA, lịch phiên, nội dung/vòng đấu, người chơi/đội, điểm từng game, trạng thái final/live/scheduled/walkover/retired, URL và thời điểm kiểm chứng. Đối chiếu HCV với HCĐ; không tự kết luận vô địch từ trận cuối feed. Tách VĐV Việt Nam và VĐV gốc Việt; chỉ ghi quốc tịch khi có nguồn.

**Editorial:** chuẩn bị EN+VI theo dữ liệu xác minh: lịch, bản cập nhật sau mỗi ngày đấu, chung cuộc năm nội dung. Mở bài có ThePickleHub, ngày cập nhật, trả lời ngay câu hỏi. Giữ URL/ngày xuất bản gốc; cập nhật dateModified, liên kết qua lại lịch/kết quả/preview. Không hứa phát sóng trên ThePickleHub; chỉ dẫn kênh BTC đã xác minh.

**Engineering/QA:** dùng `scripts/blog/ppa_results_recap.py` làm tham khảo nhưng không chạy bản hardcode Las Vegas cho giải khác. Trước khi tích hợp xuất bản, xác minh feed riêng từng giải, mapping vòng và trận HCV/HCĐ, đồng bộ EN/VI + metadata + barrel + cache, kiểm tra HTML Googlebot/hreflang/canonical. Không biến bản nháp thành bằng chứng đã deploy.

## Cadence đã cấu hình cho team

Manifest: `scripts/ops/team_tournament_coverage.json`. Queue: `scripts/ops/team_tournament_coverage.py`, gọi từ tick team mỗi phút.

- Chuẩn bị ngay Hong Kong/Chicago/Virginia.
- Trước giải: T−14, T−7, T−2.
- Trong giải: mỗi ngày lấy nguồn mới và giao bản cập nhật; lượt chạy 07:30 giờ VN, quy đổi ngày giải bằng IANA timezone.
- Sau ngày cuối: giao tổng kết, chỉ công bố danh hiệu khi nguồn final xác nhận.
- Khi máy bỏ lỡ nhiều mốc, chỉ giao mốc mới nhất, không dồn toàn bộ backlog cũ.
- Tối đa hai nhiệm vụ mới mỗi tick; dedupe theo giải/mốc; tôn trọng trạng thái pause.
- Fetch lỗi/nguồn động không có score: ghi thiếu nguồn, không suy diễn kết quả. Thời điểm snapshot không chứng minh nội dung nguồn đã mới.

**Publish policy (owner order 04/10):** Chicago và Virginia Beach có `auto_publish: true`, nhưng chỉ từ ngày địa phương giải bắt đầu. Mốc T−14/T−7/T−2 chỉ chuẩn bị nguồn, không đăng bài kết quả sớm. Khi feed điểm số chính thức đổi trong hoặc sau giải, gate deterministic kiểm event ID, schema, trạng thái và đúng một cờ winner; sau đó tạo/cập nhật EN + VI, ghi `vi_blog_posts`, regenerate barrel, typecheck/build, commit và push `main`. Snapshot không đổi là no-op. Checkout bẩn, feed thiếu/mâu thuẫn hoặc build lỗi sẽ chặn và để bằng chứng cho team; không đăng một phần. Các giải chưa có score feed (Hong Kong/Nanjing/Worlds/Daytona/Tokyo/Johor) vẫn chỉ chuẩn bị dữ liệu cho tới khi có feed được cấu hình. Runtime chạy trên máy Mac; máy ngủ/offline thì lần tick kế tiếp tiếp tục.

## Các điểm cần kiểm chứng gần ngày đấu

- Chicago/Virginia: bảng daily schedule và broadcast có khác biệt; phân biệt giờ phát sóng và giờ thi đấu, không chốt giờ trận từ TV window.
- World Championships: ngày/vòng đã có; giờ pro TBD. Không nhầm giải này với World Cup Đà Nẵng đã kết thúc.
- Chicago tháng10 local+12h=VN; Virginia +11h. Sau DST tháng11: Texas+13h, Florida+12h. Dùng IANA timezone, không hardcode offset cả mùa.
- Nanjing/Johor chưa có venue/draw chi tiết; Tokyo draw liên kết fetch timeout. Bài kết quả chỉ chuẩn bị cấu trúc khi chưa có dữ liệu.

## Đo hiệu quả

Growth đọc GSC theo cohort URL lịch/kết quả từng giải vào D+3 và D+7 khi dữ liệu đủ hoàn tất: impression/click/CTR/position, EN/VI, VN/ngoài VN. So với baseline trước giải; tách hết nhu cầu sau giải khỏi lỗi SEO. Không quy toàn bộ tăng trưởng website cho bài mới.

## Giao việc và kích hoạt thực tế lúc 20:30 ngày04/10

- T86: Hong Kong, đã tiếp tục cùng mã và đang chạy; lưu nguyên bằng chứng bản cũ.
- T135: Sports chuẩn bị hồ sơ nguồn sáu giải Oct–Nov, queued.
- T136: Engineering chuẩn bị handoff kiểm tra tích hợp; publish gate tự động đã bật riêng cho Chicago/Virginia, không dùng UUID Las Vegas cho giải khác.
- T137: Chicago, queued và được ưu tiên; snapshot event guide + score feed đều lấy thành công.
- T138: Virginia Beach, queued; snapshot event guide + score feed đều lấy thành công.

Đã kích hoạt module/manifest trong bản runtime mà LaunchAgent team-v2 thực sự chạy, không chỉ sửa bản repo. Có backup và SHA256 trong `tournament-coverage-activation-2026-10-04.json`. Kiểm thử: 10 coverage +42 team pass; git diff --check pass. Scheduler tạo đúng T137/T138 từ nguồn thật; T86 đang chạy được giữ nguyên. Chicago feed có71 trận scheduled tại lần kiểm tra này, không phải71 kết quả. Các trạng thái trên là tại thời điểm giao việc, không phải xác nhận bài đã xuất bản.
