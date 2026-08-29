# Team Agent Kit — quy trình "ý tưởng → phân tích → phản biện → UI/UX → code → review"

Bộ này là các **subagent** + **1 slash command** dùng trong Claude Code CLI (chạy trên máy anh, trong repo dự án — ví dụ ThePickleHub). Nó dựng lại quy trình anh mô tả:

1. Anh đưa ý tưởng
2. `task-analyst` — phân tích công việc: scope, requirement, rủi ro, câu hỏi cần làm rõ
3. `critic-feasibility` + `critic-user` — 2 agent bàn luận/góp ý song song, mỗi agent một góc nhìn khác nhau
4. `ux-designer` — thiết kế UI/UX dựa trên bản đã chốt, dùng chung bộ skill `design:*` mà agent `ui-ux-critic` có sẵn trong repo đang dùng
5. `prompt-engineer` — **gọi Codex CLI qua Bash** (đăng nhập bằng email, không cần API key) để soạn prompt kỹ thuật; sau khi có code thì cũng gọi Codex để review độc lập
6. `coder` — **chạy bằng Claude**, nhận đúng prompt từ bước 5 và sửa code thật trên đĩa, báo cáo lại
7. Lặp lại 5↔6 (giới hạn 6 vòng) đến khi `prompt-engineer` xác nhận đạt acceptance criteria
8. Trả báo cáo tổng kết cho anh

Toàn bộ được điều phối bởi 1 slash command: `/build-feature`.

**Vì sao viết-prompt + review tách khỏi code:** `coder` chạy bằng Claude. Nếu Claude vừa ra đề vừa chấm bài cho chính Claude, những lỗi mà lối suy luận của Claude hay bỏ sót sẽ lọt qua ở cả hai đầu giống hệt nhau. Codex là model khác — cho nó giữ đúng hai vai "ra đề" và "chấm bài" thì mới thực sự là một cặp mắt độc lập, không phải Claude tự khen mình.

## Cài đặt

1. Copy 2 thư mục `commands/` và `agents/` vào `.claude/` ở gốc repo dự án (ví dụ `~/Projects/ThePickleHub/.claude/`). Nếu repo đã có `.claude/agents` hoặc `.claude/commands`, chỉ cần copy thêm các file `.md` bên trong, không đè các file khác.
2. Đảm bảo trên máy anh:
   - Claude Code CLI (`claude`) đã đăng nhập.
   - Codex CLI (`codex`) đã đăng nhập bằng tài khoản (không cần `OPENAI_API_KEY`). Kiểm tra lệnh chạy không tương tác bằng `codex --help` — nếu `codex exec "..."` không đúng cú pháp bản anh đang dùng, tìm cờ tương đương (ví dụ `codex --full-auto "..."`) rồi sửa lại trong `agents/prompt-engineer.md`.
3. Mở Claude Code trong thư mục dự án, gõ:
   ```
   /build-feature <ý tưởng của anh>
   ```

## Vì sao chia thành nhiều subagent thay vì 1 agent làm hết?

Mỗi subagent chạy trong context riêng, không bị nhiễu bởi các bước khác — agent phân tích không cần thấy code, `coder` không cần thấy toàn bộ cuộc bàn luận, v.v. Riêng cặp `prompt-engineer` (Codex) / `coder` (Claude) tách hẳn ra vì lý do khác: nếu cùng một model vừa ra đề vừa tự chấm bài cho chính nó, nó dễ bỏ sót đúng loại lỗi mà cách suy luận của nó hay bỏ sót — tách vendor mới có một cặp mắt độc lập thật sự.

Cách này còn giúp:

- Mỗi agent tập trung đúng vai trò, ít bị "lạc đề"
- Anh có thể dừng lại đọc/sửa kết quả từng bước trước khi đi tiếp (chỉnh `commands/build-feature.md` để dừng lại hỏi xác nhận sau mỗi bước nếu muốn kiểm soát chặt hơn)

## Tuỳ chỉnh nhanh

- **Đổi cú pháp gọi Codex**: sửa trong `agents/prompt-engineer.md` (2 chỗ gọi `codex exec`).
- **Thêm bước xác nhận thủ công**: sửa `commands/build-feature.md`, thêm chỗ dừng lại hỏi user giữa các bước (mặc định command tự chạy hết, chỉ dừng nếu 2 agent phản biện bất đồng lớn, hoặc chạm giới hạn 6 vòng code↔review).
- **Giới hạn vòng lặp code↔review**: mặc định 6 vòng, sửa trong `agents/prompt-engineer.md` và `commands/build-feature.md` nếu cần nhiều/ít hơn.
- **Model**: mỗi file agent có thể set `model:` riêng trong frontmatter nếu anh muốn agent phân tích/phản biện dùng model rẻ hơn `coder`.

## Giới hạn cần biết

- Codex chạy trên máy anh với quyền tài khoản đã đăng nhập — `prompt-engineer` chỉ gọi CLI qua `Bash`, không tự xác thực hộ.
- Nếu `codex exec` yêu cầu xác nhận từng bước (không phải chế độ tự động) — vòng lặp sẽ bị treo chờ input; `prompt-engineer` được dặn dừng ngay và báo cho anh thay vì đoán, nhưng tốt nhất nên tự kiểm tra `codex --help` trước khi chạy thử lần đầu.
- Đây là bản khởi điểm, tách riêng khỏi `/idea` + `/ship` đã có sẵn trong repo — nên chạy thử với 1 ý tưởng nhỏ trước để chỉnh giọng văn / mức chi tiết từng agent cho khớp gu của anh.

## Lưu ý phát hiện được khi rà repo (chưa xử lý, để anh quyết sau)

`/idea` + `/ship` đã có trong `.claude/commands/` là một hệ thống mạnh hơn nhiều bộ này — panel 4 agent (`solution-architect`, `ui-ux-critic`, `risk-auditor`, `pre-mortem`), 2 vòng đối chất có ledger cưỡng chế bằng máy, gọi GPT-5.6 thật qua `OPENAI_API_KEY`, rồi `qa-verifier` + `ui-ux-verifier` + `release-pilot` lo hết từ code đến deploy có auto-revert. Tài liệu ở `docs/agent-idea-pipeline.md`.

Nhưng 3 script cầu nối then chốt mà `/idea`, `ui-ux-critic`, `risk-auditor` đang gọi tới lại **không có trong repo, và cũng không có trong git history**: `scripts/agents/ask-model.mjs`, `scripts/agents/debate-ledger.mjs`, `scripts/agents/preview-shots.mjs` — dù tài liệu ghi rõ đã test bằng API thật ngày 16-17/7. Nhiều khả năng đây chính là lý do `/idea` không chạy được bước gọi GPT-5.6 tự động, và anh phải tự làm cầu nối bằng tay. Bộ `team-agent-kit` này KHÔNG đụng vào hệ thống đó — muốn dựng lại 3 script bị mất thì báo em, em viết lại đúng theo spec trong `docs/agent-idea-pipeline.md`.
