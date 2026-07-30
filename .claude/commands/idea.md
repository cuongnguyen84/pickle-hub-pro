---
description: Ý tưởng → báo cáo toàn diện. Recon + panel 4 agent, 2 vòng (Claude + GPT-5.6) + audit trail → docs/proposals/<slug>/
argument-hint: <mô tả ý tưởng, tiếng Việt hoặc English>
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Agent, Skill, AskUserQuestion, WebSearch
---

# /idea — ý tưởng thành đề xuất có thể thi hành

Ý tưởng của Cuong: **$ARGUMENTS**

Bạn là orchestrator. Bạn **không** tự phân tích — bạn điều phối panel, ghi lại nguyên văn, rồi tổng hợp.

Hai cám dỗ sẽ giết giá trị của lệnh này. Biết trước để tránh:

1. **Tự viết phần phân tích thay vì gọi agent.** Nhanh hơn, và mất sạch thứ khiến pipeline này đáng tồn tại: ba góc nhìn độc lập.
2. **Tổng hợp cho êm.** Bạn vừa là người tổng hợp, vừa là người duy nhất Cuong có thể tin về việc bạn tổng hợp trung thực. Đó là lý do mọi output thô phải được ghi ra file — để Cuong kiểm tra được bạn.

## Bước 0 — Chuẩn bị

```sh
SLUG=<kebab-case-từ-ý-tưởng>
mkdir -p docs/proposals/$SLUG/{round1,round2,external}
```

Mọi output thô đi vào đây. Không có gì chỉ tồn tại trong đầu bạn.

## Bước 1 — Làm rõ

`AskUserQuestion`, **tối đa 3 câu**, chỉ những câu mà câu trả lời thay đổi thiết kế:

- Ai dùng? (người chơi VI / organizer / admin / khán giả EN)
- Đau ở đâu? Hôm nay họ xoay xở thế nào?
- Cái gì chứng minh nó thành công? (một con số, một hành vi)
- Ràng buộc? (deadline, phải chạy native, phải có SEO)

Đừng hỏi thứ mà đọc repo là biết. Ghi câu trả lời vào `docs/proposals/$SLUG/00-intake.md`.

## Bước 2 — Recon

Gọi `idea-recon`. Ghi output vào `round1/idea-recon.md`.

In ra chat: `🔍 recon xong — <1 dòng>`

**Nếu recon nói việc này đã tồn tại** — dừng ngay. Báo Cuong nó ở đâu, còn thiếu gì. Đó là kết quả tốt nhất lệnh này có thể trả về; đừng phân tích tiếp cho có báo cáo dày.

## Bước 3 — VÒNG 1: panel độc lập

**MỘT message, BỐN tool call `Agent`.** Chạy song song là bắt buộc, không phải tối ưu tốc độ: chạy tuần tự thì agent sau bị mồi bởi kết luận agent trước, và bạn nhận bốn bản sao của một ý kiến thay vì bốn ý kiến.

| Agent | Vai | Model ngoài |
|---|---|---|
| `solution-architect` | 2–3 phương án, trade-off, khuyến nghị | — |
| `ui-ux-critic` | giao diện, luồng, copy VI, a11y | GPT-5.6 |
| `risk-auditor` | rủi ro, SLO, perf, SEO, rollback, **tier** | GPT-5.6 |
| `pre-mortem` | 3 postmortem của sự cố chưa xảy ra | — (đọc repo) |

Mỗi agent nhận: ý tưởng + intake + output recon. **Không** nhận output của agent kia.

Hai trục phòng thủ, đừng nhầm chúng với nhau:

- **Độc lập** — GPT-5.6 không phải Claude. Nếu Claude coi nhẹ một loại rủi ro nào đó thì cả bốn agent cùng coi nhẹ y hệt, cùng lúc, cùng tự tin; role-prompt không sửa được điểm mù chung. Nhưng nó không thấy repo → bịa được.
- **Căn cứ** — `pre-mortem` đọc repo nên mọi mắt xích phải trỏ tới file thật. Nhưng nó vẫn là Claude → không độc lập.

Không cái nào thay được cái kia. Đó là lý do có cả hai.

Ghi nguyên văn vào `round1/<agent>.md`. Nhắc agent lưu prompt + reply model ngoài vào `external/` — Cuong phải đọc được cả cái đã gửi đi, không chỉ cái nhận về.

In ra chat khi từng agent xong:
```
✅ solution-architect — khuyến nghị Option B, 3 nửa ngày
✅ ui-ux-critic — 2 blocker, 1 nit
✅ risk-auditor — 🔴 RED (migration)
✅ pre-mortem — 3 sự cố, tệ nhất: sai hạng 6h không ai biết
```

## Bước 4 — Lập bảng bất đồng

Đọc cả bốn. Tìm chỗ chúng **thực sự** mâu thuẫn — không phải chỗ dùng từ khác nhau cho cùng một ý.

**Cảnh giác riêng với `risk-auditor` + `pre-mortem`.** Hai agent này cùng phe "đi tìm cái hỏng" nên chúng sẽ gật đầu với nhau rất nhiều, và bạn sẽ thấy điều đó như một sự xác nhận mạnh. Không phải. Hai Claude cùng nhiệm vụ đồng ý với nhau chỉ chứng minh chúng cùng là Claude. Sự đồng thuận **có nghĩa** duy nhất trong panel này là khi GPT-5.6 (vendor khác) và một agent Claude tới cùng kết luận một cách độc lập — nói rõ điều đó ra khi nó xảy ra, và đừng gán trọng lượng đó cho hai Claude gật gù.

Viết `docs/proposals/$SLUG/debate.json`:

```json
{
  "slug": "<slug>",
  "disagreements": [
    { "id": "D1", "topic": "<mâu thuẫn về cái gì>",
      "positions": { "solution-architect": "<lập trường>", "risk-auditor": "<lập trường>" } }
  ]
}
```

Không có bất đồng thật → bỏ qua bước 5, ghi rõ trong báo cáo. Nhưng nghi ngờ trước: ba agent với ba nhiệm vụ đối lập (ship nó / chê nó / chặn nó) mà đồng ý hoàn toàn thì thường là chúng đã bị mồi bởi nhau — kiểm tra lại bước 3 có thật sự chạy song song không.

In ra chat: `⚔️ <n> bất đồng: D1 <topic> · D2 <topic>`

## Bước 5 — VÒNG 2: đối chất (một vòng, không hơn)

Gọi lại **đúng những agent có mặt trong bất đồng**, song song, mỗi agent nhận: bất đồng liên quan + output vòng 1 của các agent kia + `docs/agent-round2-rules.md`.

Mỗi agent trả JSON `rebuttals` với `CONCEDE` / `HOLD` / `REFINE`. Ghi vào `round2/<agent>.json`.

Gộp vào `debate.json`, rồi **cưỡng chế luật**:

```sh
node scripts/agents/debate-ledger.mjs docs/proposals/$SLUG/debate.json --strict --markdown
```

- **Đỏ** → trả lại agent vi phạm sửa. `CONCEDE` không bằng chứng bị loại → agent về lập trường vòng 1, bất đồng thành `OPEN_FOR_CUONG`. Bạn **không** được tự sửa ledger cho nó xanh — làm vậy là chính bạn đang giả mạo cái audit trail mà Cuong dựng ra để giám sát bạn.
- **Xanh** → đi tiếp.

**Đúng một vòng.** Không vòng 3. Vòng 3 không tìm thêm sự thật, nó chỉ mài mòn agent nào lì nhất — và agent lì nhất không phải agent đúng nhất.

In ra chat:
```
⚔️ vòng 2: D1 architect CONCEDE (migration:L42) · D2 cả hai HOLD → cần anh quyết
```

## Bước 6 — Tổng hợp

Viết `docs/proposals/$SLUG/proposal.md` theo `docs/proposals/_TEMPLATE.md`.

Tổng hợp ≠ nối output lại:

- **Bất đồng `OPEN_FOR_CUONG` phải nổi lên đầu báo cáo**, không chôn ở mục 7. Đó là thứ duy nhất thật sự cần anh.
- **Chỗ các model độc lập đồng ý → bằng chứng thật.** Nói một lần.
- **Cắt phần thừa.** 12 trang không ai đọc tệ hơn 2 trang có người làm theo.
- **Verdict tier của `risk-auditor` là bắt buộc.** Bạn không hạ được. Thấy nó quá thận trọng → viết vào mục tranh luận, để Cuong quyết.

Nhúng bảng từ `debate-ledger.mjs --markdown` vào mục 7.

Chạy `node scripts/agents/risk-tier.mjs --files "<file dự kiến>" --json`, đối chiếu với verdict auditor (auditor được nâng, không được hạ).

## Bước 7 — Trình Cuong

Trong chat, **ngắn**:

```
📋 <slug> — 🔴 RED

Khuyến nghị: <1 câu>
Công sức: <n> nửa ngày
Rủi ro lớn nhất: <1 câu>

⚔️ Cần anh quyết (<n>):
  D2 — <topic>: ui-ux-critic muốn <X>, architect muốn <Y>

→ docs/proposals/<slug>/proposal.md
   raw: round1/ · round2/ · external/ · debate.json

Tiếp: /ship <slug>   (RED → cần anh duyệt trước)
```

Không tóm tắt lại báo cáo trong chat. File có sẵn, Cuong đọc được.

## Nguyên tắc

1. **Product luôn chạy trơn tru là ưu tiên #1.** Chọn giữa "ship được" và "chắc chắn không gãy" → luôn cái thứ hai.
2. **Đồng thuận không phải mục tiêu.** Bất đồng còn mở, được ghi rõ, là kết quả thành công.
3. **Không báo cáo thứ chưa verify.** Không đoán nội dung file — mở nó ra.
4. **Không kết luận là kết luận hợp lệ.** "Đừng làm cái này" là output tốt.
5. Tiếng Việt cho văn xuôi, tiếng Anh cho code/path/commit.
