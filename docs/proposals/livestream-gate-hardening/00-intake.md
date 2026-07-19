# Intake — livestream-gate-hardening

Ngày: 2026-07-20
Nguồn ý tưởng: điều tra bug gate livestream (Claude session 2026-07-19 + Codex độc lập xác nhận, cả hai đồng thuận).

## Bối cảnh đã điều tra (facts, đã verify trên code + production)

1. **Tầng UI — gate thủng:**
   - `src/pages/WatchLive.tsx` render 2 `MuxPlayer` (mobile `:254`, desktop `:303`) dùng chung `ref={playerRef}` → ref trỏ player desktop (mount sau, ẩn trên mobile). `pause()` khi hết preview (`:75-80`) dừng nhầm player ẩn; player mobile phát tiếp sau overlay. Codex verify runtime trên prod viewport 390×844: gate hiện, mobile `paused: false`, currentTime vẫn chạy.
   - Effect gate chỉ pause **một lần** (deps `[isGated]`) — resume qua fullscreen native iOS / PiP / phím media → xem vô hạn. Áp dụng cả `HomeLivePlayer.tsx:55`.
   - `useLivestreamGate` chỉ ghi localStorage khi đếm hết giờ → reload ở giây 14 được 15s mới.
   - `/embed/live/:id` (`src/pages/embed/EmbedLive.tsx`) hoàn toàn không auth/gate.
2. **Tầng đo đạc:**
   - `useIntervalViewCounter` đếm view mỗi 30s chỉ cần trang mở, kể cả gated/paused → thổi phồng view.
   - Presence (`useLivePresence.ts:175`) track từ lúc mở trang → bảng admin "đang xem" gồm cả người kẹt ở màn hình gate.
3. **Tầng nền tảng:** Mux playback policy `public` (`mux-create-livestream`, `CreatorLivestreamForm.tsx:105`), `mux_playback_id` đọc được ẩn danh (migration `20260218031231`) → copy m3u8 xem không giới hạn, không hiện trong Presence.

Cấu hình prod đã đúng (`require_login_livestream=true`, `preview=15s`, `applies_to=all`) — lỗi ở code, không ở config.

## Trả lời của Cuong (AskUserQuestion 2026-07-20)

1. **Scope tầng 3 (signed playback):** Tầng 1+2 trước, tầng 3 làm proposal/PR riêng sau khi gate UI kín với người dùng thường.
2. **Embed route:** Gate như trang chính — embed cũng đếm 15s preview rồi hiện overlay yêu cầu đăng nhập (mở tab mới sang /login).
3. **Success metric:** **Tăng đăng ký tài khoản** — gate là phễu chuyển đổi; cần tracking nút login/signup trên overlay gate.

## Scope chốt cho proposal này

- Tầng 1 (gate UI kín với người dùng thường): fix ref, re-pause liên tục, chống reload-reset, gate embed.
- Tầng 2 (đo đạc thật): view counter chỉ đếm khi thực sự phát; presence phản ánh trạng thái gated.
- Thêm: tracking conversion từ overlay gate (metric thành công = signup).
- NGOÀI scope: Mux signed playback (tầng 3) — proposal riêng.
