# ui-ux-critic — telegram-fix-agent (nguyên văn, 2026-08-05)

> Panel chạy với cả 2 model (Codex CLI hết quota tới 08/08 → gọi thẳng OpenAI Responses API `gpt-5.6-sol`). Prompt + reply nguyên văn: `external/ui-ux-critic-gpt56.md`.

## Đánh giá tổng thể

Nút Fix hiện tại là một **RPC retry đội lốt một lời hứa** — `⛔ Không retry news-fetcher: retry_not_supported` là hệ thống trả enum nội bộ thay vì trả lời câu hỏi ("sửa được chưa?"). Nhưng thiếu mảnh lớn hơn cả format: **điểm vào thật của Cuong là notification cảnh báo, mà tin cảnh báo hiện KHÔNG có nút nào** (`sendTelegram(text)` trong errors-telegram-alert/index.ts:67 không nhận reply_markup). Mọi công sức agent 5-10 phút nằm sau một ngõ cụt phải tự gõ /jobs.

Thứ hai: `/fix` chạy **đồng bộ trong webhook** (320-322 → processTelegram → retryOutcome poll 5×2s). Agent 5-10 phút không sống trong đó được — tách hàng đợi là bắt buộc.

## Luồng đề xuất
alert (THÊM nút 🛠 Xử lý ngay tại tin cảnh báo) → callback toast <10s → webhook enqueue + return 200 → tin ACK cố định + sửa keyboard tin gốc Fix→⏳ → im lặng 5-10' → tin KẾT QUẢ MỚI (reply vào ACK) + nút 📄 Chi tiết [+ 👍 Duyệt] → xong. Điểm ra tối ưu: đọc dòng 1 trên banner màn hình khoá, không cần mở app.

## Vấn đề (4 Blocker, 5 Nên sửa, 2 Nit)

1. **[Blocker]** Tin cảnh báo/digest không có reply_markup → thêm tham số vào sendTelegram() + gắn nút `🛠 Xử lý / 🔎 Chi tiết` khi kind==="incident".
2. **[Blocker]** /fix đồng bộ trong webhook — webhook chỉ được: answerCallbackQuery → insert task → ACK → return 200. Agent chạy ngoài.
3. **[Blocker]** Rò enum nội bộ (retry_not_supported, cooldown, dispatch_failed, cron_job_unavailable) — map sang câu tiếng Việt; sau khi có agent, `🛠 Xử lý` không bao giờ được trả retry_not_supported nữa.
4. **[Blocker]** Không khoá theo incident: 2 lần bấm = 2 update_id = 2 task. Khoá 1 task active/incident; bấm lần 2 → chỉ toast.
5. **[Nên]** Nhãn `🛠 Fix` không mang job key; job key dài bị Telegram cắt trên 390px (`auto-cancel-unpa…`) → bấm nhầm hàng = khởi động agent sửa production. Đổi `🛠 Xử lý`, ACK in đủ job key, thêm `⏹ Huỷ` khi còn queued.
6. **[Nên]** `.slice(0,4000)` cắt đuôi = cắt đúng "việc còn lại cho anh". Dựng tin từ template giới hạn từng trường (nguyên nhân ≤200, đã làm ≤200, xác minh ≤150), phần thô sang 📄 Chi tiết.
7. **[Nên]** Agent báo "đã sửa" nhưng snapshot chưa refresh → digest sáng vẫn ❌ → "agent nói dối". Bắt buộc gọi ops_refresh_cron_health_snapshot + đọc lại state trước khi gửi, in `Trạng thái job bây giờ: healthy (snapshot 17:19)`.
8. **[Nên]** Hai kiểu render (MarkdownV2 vs plain) trong cùng hội thoại → chuẩn hoá **plain text không parse_mode** (JSON, `<`, `&`, gạch ngang sẽ 400 MarkdownV2).
9. **[Nên]** /diagnose nhãn tiếng Anh + ISO UTC → Việt hoá + giờ ICT `16:00 05/08`.
10. **[Nit]** "downstream chưa trả kết quả" → "Hệ thống đích chưa phản hồi… anh không cần bấm lại."
11. **[Nit]** Tin fallback hứa "agent sẽ xử lý ở lần chạy tới" cho MỌI text lạ — hứa agent chưa tồn tại; sau khi có agent thật thì nói đúng hoặc bỏ.

## Trạng thái
- ACK = tin cố định (toast biến mất sau 3s = bỏ rơi người dùng với tác vụ 5-10').
- Giữa chừng: IM LẶNG; một tin duy nhất khi vượt 10' (kèm nhịp tim gần nhất).
- Job đã khoẻ khi bấm nút cũ → chỉ toast.
- ❌ CHƯA SỬA ĐƯỢC (thử rồi vẫn hỏng) ≠ ⚠️ XỬ LÝ ĐỨT GIỮA CHỪNG (có thể đã ghi một phần — cấm tự chạy lại) ≠ ⚠️ CHƯA BẮT ĐẦU ĐƯỢC (Mac ngủ, 3' không ai claim; hết hạn 30').

## A11y
Emoji không bao giờ là vật mang nghĩa duy nhất (từ phán quyết viết hoa ngay sau); tối đa 2 nút/hàng (44px+); nút 👍 Duyệt một mình một hàng; callback trả <10s; 2 dòng đầu đủ nghĩa trên banner.

## Bộ copy tiếng Việt (trích — bản đầy đủ trong external + report gốc)
- ACK: `⏳ ĐÃ NHẬN · news-fetcher / Agent đang điều tra, dự kiến 5-10 phút. Anh không cần bấm lại. / Mã: FX-48212 · 17:12 [⏹ Huỷ]`
- Thành công: `✅ ĐÃ SỬA · news-fetcher / Trạng thái job bây giờ: healthy (snapshot 17:19). / Nguyên nhân… / Đã làm… / Xác minh… / Cần anh làm: không có. [📄 Chi tiết]`
- Cần duyệt (KHÔNG dùng ❌): `🛠 CHƯA SỬA · CẦN ANH DUYỆT · <job> … [👍 Duyệt: <gọi tên đích danh thao tác>] [📄 Chi tiết]`
- Cần sửa code: `🛠 CHƯA SỬA · CẦN SỬA CODE · <job> … [👍 Duyệt: mở PR (không merge)]`
- Từ vựng phán quyết cố định: ✅ ĐÃ SỬA (đã xác minh nghiệp vụ — HTTP 200 một mình KHÔNG đủ) · ⚠️ ĐÃ ĐỘNG VÀO NHƯNG CHƯA XÁC MINH · 🛠 CHƯA SỬA·CẦN DUYỆT/CẦN SỬA CODE · ❌ CHƯA SỬA ĐƯỢC · ❌ KHÔNG XỬ LÝ ĐƯỢC · ⏳ đang chờ.
- Map enum: retry_not_supported → "Job này không có cơ chế retry. Bấm 🛠 Xử lý để agent điều tra và xử lý đúng cách." · cooldown → "Lần chạy lại gần nhất lúc 17:12. Thử lại sau 17:22."

## Panel đa model
**Đồng thuận Claude + GPT-5.6 (12 điểm — tín hiệu thật):** ACK cố định; kết quả = tin MỚI không edit; dòng 1 = phán quyết + job key; thứ tự phán quyết→việc cần làm→nguyên nhân→đã làm→metadata; "cần sửa code" là kết quả hợp lệ (🛠 không ❌); plain text; bỏ nút 🔁 Chạy lại (sống vĩnh viễn trên tin cũ); giữ 📄 Chi tiết; bỏ ✅ Đóng; nhãn duyệt gọi tên thao tác; không rò enum; 1 task đổi-production một thời điểm.
**Bất đồng 1 (tiến độ giữa chừng):** GPT muốn edit ACK theo checkpoint; Claude chốt im lặng + lưu message_id ngay v1 để đổi nút Fix→⏳ chống bấm kép.
**Bất đồng 2 (duyệt 2 bước):** GPT muốn 2 chạm; Claude chốt 1 chạm + nhãn đích danh + callback kiểm task mới nhất/chưa hết hạn 2h/state chưa đổi — chặn đúng mode hỏng thật (bấm nút cũ) thay vì thêm ma sát.
**GPT bỏ sót:** tin cảnh báo không có nút (không thấy code); rủi ro cắt nhãn job key 390px.

## Runbook phải sửa cùng PR
`docs/job-operations-telegram.md:73-75` (Giới hạn cố ý) + dòng 36 (trạng thái ✅/⚠️/❌/⏳ cũ) sẽ sai sau thay đổi này.
