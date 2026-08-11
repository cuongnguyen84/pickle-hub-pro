# Reply GPT-5.6 (codex exec, gpt-5.1-codex-max fallback) — 2026-08-09

> Nguyên văn output cuối của model. Prompt: `ui-ux-gpt-prompt.md`.
> Lưu ý: `scripts/agents/ask-model.mjs` KHÔNG tồn tại trong repo (gotcha đã biết);
> `--model gpt-5.6` bị ChatGPT account từ chối (400) nên chạy `codex exec` với model mặc định.

---

Kết luận chính: `fade/animate` không tự sửa CLS. Nếu phần tử vẫn tham gia layout, nó vẫn đẩy nội dung dù đang `opacity: 0`. Animation chỉ phù hợp sau khi đã giữ chỗ, hoặc với phần tử overlay thật sự.

Với `/live/<id>`, không nên biến video thành nơi chứa mọi trạng thái động. Footage là nội dung quan trọng nhất.

## 1. Viewer count — đặt trong thanh điều khiển dưới video

**Không đặt chip lên video. Không chèn nó vào metadata `flex-wrap`. Không render `0 đang xem`.**

Đặt viewer count ở bên phải của cùng thanh 48px đang chứa nút Chat:

```tsx
<div className="grid h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
  <button className="min-h-11 justify-self-start">
    Chat
    <ChevronDown aria-hidden />
  </button>

  <div className="w-[9.5rem] justify-self-end text-right">
    <span
      className={cn(
        "inline-flex h-8 items-center whitespace-nowrap rounded-full px-3",
        "text-sm tabular-nums transition-opacity duration-150",
        viewerCount == null ? "invisible" : "visible"
      )}
      aria-live="polite"
    >
      {formatViewerCount(viewerCount)} đang xem
    </span>
  </div>
</div>
```

Điểm quan trọng:

- Slot bên phải tồn tại ngay từ đầu, nhưng nằm trong thanh Chat vốn đã cần chiều cao 48px. Không tạo thêm một hàng trống.
- `visibility: hidden` giữ nguyên geometry nhưng không tạo “chip rỗng”.
- `tabular-nums` giảm thay đổi bề rộng giữa các chữ số.
- `whitespace-nowrap` ngăn “đang xem” xuống dòng.
- Width 9.5rem dành riêng cho đúng chuỗi tiếng Việt này; đây không phải fixed-width cho nội dung tùy ý.
- Dùng dạng rút gọn khi số lớn: `12,4 N đang xem`, không để chuỗi tăng vô hạn.

Khi Presence reconnect:

- Giữ số cuối cùng trên màn hình trong khoảng 15–30 giây.
- Giảm opacity hoặc thêm trạng thái kết nối, không xóa chip ngay.
- Nếu reconnect thất bại quá timeout, mới chuyển chip sang `invisible`.

Không đổi sang `Đang kết nối…` trong chính slot này: chuỗi dài hơn và người dùng có thể hiểu nhầm đó là trạng thái video. Nếu cần thông báo, dùng toast ngắn: `Đang kết nối lại…`.

**Trade-off:** dành 9.5rem khiến nút Chat không thể chiếm toàn hàng, nhưng đây là chi phí nhỏ và ổn định hơn nhiều so với che footage hoặc tạo một hàng metadata mới.

## 2. Total views và metadata row

Vấn đề không chỉ là `0 → 1.234`; gốc lỗi là đưa các phần tử async, độ dài không đoán trước vào một hàng `flex-wrap`.

Tách metadata thành các vùng có hình học xác định:

```tsx
<div className="space-y-3 text-sm">
  <OrganizerRow />

  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
    <div className="min-w-0">
      <span className="block min-h-5 whitespace-nowrap tabular-nums">
        {views == null ? (
          <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
        ) : (
          `${formatViews(views)} lượt xem`
        )}
      </span>
    </div>

    <time className="min-h-5 text-right">
      {formattedDate}
    </time>
  </div>
</div>
```

Viewer count đã được chuyển ra khỏi metadata. Organizer luôn là một hàng riêng. Views và thời gian dùng grid hai cột thay vì wrap theo nội dung.

Đối với số views:

- Trạng thái đầu tiên là skeleton có cùng chiều cao, không phải `0 lượt xem`.
- Dùng `font-variant-numeric: tabular-nums`.
- Nếu cần ngăn tăng bề rộng, format rút gọn nhất quán: `1,2 N lượt xem`, `1,4 Tr lượt xem`.
- Không animate number bằng cách chạy qua hàng trăm giá trị. Chỉ crossfade hai text nằm chồng trong một slot cố định:

```css
.metric-value {
  display: inline-grid;
  min-inline-size: 8ch;
}

.metric-value > * {
  grid-area: 1 / 1;
}

.metric-value[data-align="end"] {
  text-align: end;
}
```

`9 → 10 → 100` lúc này không thay đổi grid track và không đẩy ngày sang dòng mới.

## 3. Loading toàn trang — progressive shell, không giữ cả trang sau skeleton

Không chọn một trong hai cực “spinner/skeleton toàn trang” hoặc “DOM mọc tự do”. Render ngay **page shell thật với geometry ổn định**, rồi hydrate từng vùng.

Thứ tự ưu tiên cho người deep-link từ Facebook:

1. Back/header shell: hiện ngay.
2. Player container full-bleed `aspect-ratio: 16 / 9`: hiện ngay.
3. Bắt đầu Mux/auth/playback song song với stream metadata.
4. Thanh Chat + viewer slot: hiện ngay.
5. Title/metadata skeleton bên dưới.
6. Description/comments/related streams hydrate sau.

Player loading và player thật phải dùng cùng markup ngoài:

```tsx
<div className="-mx-4 sticky top-14 aspect-video bg-black">
  {playbackReady ? <MuxPlayer ... /> : <PlayerLoadingState />}
  <PlaybackOverlays />
</div>
```

Không được có player skeleton rộng 358px rồi đổi thành 390px.

Với title, chọn một hình học có chủ đích:

```css
.stream-title-slot {
  min-block-size: calc(1.25em * 2);
}

.stream-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
```

Hiển thị tối đa hai dòng trên trang xem; thêm nút `Xem đầy đủ` nếu title bị cắt. Nút này cần target 44px. Đây tốt hơn việc giữ khoảng trống ba dòng cho mọi stream.

Comments:

- Initial comments skeleton nên có 2–3 hàng cùng chiều cao với comment thật.
- Comment mới phải append cuối danh sách, không prepend phía trên nội dung người dùng đang đọc.
- “Other live streams” ở cuối có thể hydrate tự nhiên; không ảnh hưởng nội dung phía trên miễn là không chèn ngược lên.

**Trade-off cần chấp nhận:** giữ cả trang skeleton cho tới khi mọi query hoàn tất có thể đạt CLS đẹp nhưng làm trải nghiệm 4G tệ hơn. Player phải được phép hoạt động ngay khi playback URL sẵn sàng; title, views và comments không được chặn video.

## 4. Home “Đang trực tiếp”

Không giữ một khoảng trống 350px phần lớn thời gian. Cũng không `return null` rồi chèn hero 350px ở đầu.

Giải pháp đúng: phần đầu home luôn có một **module media cố định, hữu ích ở cả hai trạng thái**:

```tsx
<section className="min-h-[11rem]" aria-labelledby="media-heading">
  {isLoading && <MediaModuleSkeleton />}
  {!isLoading && liveStreams.length > 0 && <CompactLiveModule />}
  {!isLoading && liveStreams.length === 0 && <LatestEditorialModule />}
</section>
```

- Có livestream: heading `Đang trực tiếp`, một card chính compact khoảng 176px.
- Không có livestream: dùng cùng slot cho `Mới nhất` hoặc `Sắp diễn ra`; không để khoảng trắng.
- Nếu product bắt buộc hero live cao khoảng 350px, đặt hero đó **sau module editorial đầu tiên** và reserve đúng chiều cao tại vị trí đó. Nhưng đây là lựa chọn kém hơn trên mobile.

CTA “log a match” sau auth cũng không được chèn ở đầu. Đặt một slot cố định trong module account/action:

- Chưa biết auth: skeleton action 44px.
- Đã đăng nhập: `Ghi lại trận đấu`.
- Chưa đăng nhập: `Đăng nhập để ghi trận`.

Hai trạng thái phải cùng chiều cao.

## 5. Font Vietnamese — giữ `swap`, preload và metric-match fallback

`preload` Inter Vietnamese sẽ giảm số lần reflow nhưng không đảm bảo xóa CLS trên 4G. Fix đầy đủ gồm hai phần.

Preload đúng file đang dùng:

```html
<link
  rel="preload"
  href="/fonts/inter-vietnamese.woff2"
  as="font"
  type="font/woff2"
  crossorigin
  fetchpriority="high"
/>
```

Tạo fallback face có metric được điều chỉnh:

```css
@font-face {
  font-family: "Inter Metric Fallback";
  src: local("Roboto");
  size-adjust: var(--inter-fallback-size-adjust);
  ascent-override: var(--inter-fallback-ascent);
  descent-override: var(--inter-fallback-descent);
  line-gap-override: 0%;
}

html {
  font-family:
    "Inter",
    "Inter Metric Fallback",
    Roboto,
    Arial,
    sans-serif;
}
```

Không nên copy các phần trăm từ một blog. Hãy tính chúng từ **đúng file `inter-vietnamese.woff2` đang production** và Roboto Android:

- `size-adjust`: khớp average/x-height hoặc measured text width.
- `ascent-override`: khớp ascent sau khi áp dụng size adjustment.
- `descent-override`: khớp descent.
- `line-gap-override`: thường là `0%` với Inter, nhưng phải xác nhận từ font binary.

Test bằng chuỗi đại diện:

> `nghề nghiệp · Trực tiếp · 1.234 lượt xem · Nguyễn Thị Hồng`

So sánh width và line box ở 14, 16 và 24px tại 320/390/414px. Mục tiêu là cùng điểm xuống dòng trước và sau khi Inter load.

Quan trọng: metric fallback không thay thế Inter và không làm mất dấu. Roboto tạm thời render đầy đủ tiếng Việt; Inter thật vẫn được tải bằng `swap`. Vì vậy giữ đúng `nghề`, đồng thời loại phần lớn reflow.

Nếu Geist không phải body font, bỏ preload Geist hoặc hạ ưu tiên; hai preload không dùng ngay có thể tranh băng thông với Inter và Mux.

## 6. `/login` — render form shell ngay, tạm khóa submit

Full-page spinner không phù hợp cho auth restore 200–800ms. Nó vừa gây layout replacement, vừa khiến kết nối bình thường trông như bị treo.

Render header, wordmark và form ngay với geometry cuối cùng:

```tsx
<form aria-busy={authRestoring}>
  <EmailField disabled={authRestoring} />
  <PasswordField disabled={authRestoring} />

  <Button
    className="min-h-11 w-full"
    disabled={authRestoring}
  >
    {authRestoring ? "Đang kiểm tra phiên…" : "Đăng nhập"}
  </Button>
</form>
```

Tốt hơn nữa:

- Hiện form ngay nhưng disable trong lúc restore để tránh người đã đăng nhập bắt đầu nhập rồi bị redirect.
- Chỉ hiện copy `Đang kiểm tra phiên…` nếu restore kéo dài quá khoảng 300ms; trước đó giữ label `Đăng nhập` ở trạng thái disabled.
- Spinner nhỏ có thể nằm trong button, nhưng icon phải overlay hoặc chiếm slot cố định để label không dịch ngang.
- Header/form không được mount/unmount khi auth state đổi.
- Nếu session hợp lệ, redirect; nếu không, chỉ enable form.

Không dùng copy `Đang tải…`; `Đang kiểm tra phiên…` giải thích chính xác điều đang xảy ra.

## Quy tắc áp dụng chung

- **Reserve space:** title, metadata, player, login form, home module — những vùng thuộc cấu trúc trang.
- **Overlay:** chỉ player controls, login gate, geo-block, captions và feedback tạm thời. Không overlay business metadata lên footage.
- **Fade:** chỉ dùng `opacity` cho nội dung nằm trong một slot đã có kích thước; không animate `height`, `margin`, `top` hoặc `max-height`.
- Chat expand do thao tác người dùng có thể thay đổi flow; đừng làm overlay chat lên video chỉ để tối ưu CLS.
- Presence reconnect không nên làm UI biến mất ngay. Giữ last-known state ổn định tốt hơn cho cả CLS lẫn khả năng đọc tại sân.

Ưu tiên triển khai: sửa loading tree/player geometry trước, chuyển viewer count khỏi `flex-wrap`, thay home `return null`, sửa login shell, rồi metric-match font. Đây đều là nguyên nhân có thể xử lý ngay; không cần đợi 7 ngày attribution mới bắt đầu.
tokens used
29,181
Kết luận chính: `fade/animate` không tự sửa CLS. Nếu phần tử vẫn tham gia layout, nó vẫn đẩy nội dung dù đang `opacity: 0`. Animation chỉ phù hợp sau khi đã giữ chỗ, hoặc với phần tử overlay thật sự.

Với `/live/<id>`, không nên biến video thành nơi chứa mọi trạng thái động. Footage là nội dung quan trọng nhất.

## 1. Viewer count — đặt trong thanh điều khiển dưới video

**Không đặt chip lên video. Không chèn nó vào metadata `flex-wrap`. Không render `0 đang xem`.**

Đặt viewer count ở bên phải của cùng thanh 48px đang chứa nút Chat:

```tsx
<div className="grid h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
  <button className="min-h-11 justify-self-start">
    Chat
    <ChevronDown aria-hidden />
  </button>

  <div className="w-[9.5rem] justify-self-end text-right">
    <span
      className={cn(
        "inline-flex h-8 items-center whitespace-nowrap rounded-full px-3",
        "text-sm tabular-nums transition-opacity duration-150",
        viewerCount == null ? "invisible" : "visible"
      )}
      aria-live="polite"
    >
      {formatViewerCount(viewerCount)} đang xem
    </span>
  </div>
</div>
```

Điểm quan trọng:

- Slot bên phải tồn tại ngay từ đầu, nhưng nằm trong thanh Chat vốn đã cần chiều cao 48px. Không tạo thêm một hàng trống.
- `visibility: hidden` giữ nguyên geometry nhưng không tạo “chip rỗng”.
- `tabular-nums` giảm thay đổi bề rộng giữa các chữ số.
- `whitespace-nowrap` ngăn “đang xem” xuống dòng.
- Width 9.5rem dành riêng cho đúng chuỗi tiếng Việt này; đây không phải fixed-width cho nội dung tùy ý.
- Dùng dạng rút gọn khi số lớn: `12,4 N đang xem`, không để chuỗi tăng vô hạn.

Khi Presence reconnect:

- Giữ số cuối cùng trên màn hình trong khoảng 15–30 giây.
- Giảm opacity hoặc thêm trạng thái kết nối, không xóa chip ngay.
- Nếu reconnect thất bại quá timeout, mới chuyển chip sang `invisible`.

Không đổi sang `Đang kết nối…` trong chính slot này: chuỗi dài hơn và người dùng có thể hiểu nhầm đó là trạng thái video. Nếu cần thông báo, dùng toast ngắn: `Đang kết nối lại…`.

**Trade-off:** dành 9.5rem khiến nút Chat không thể chiếm toàn hàng, nhưng đây là chi phí nhỏ và ổn định hơn nhiều so với che footage hoặc tạo một hàng metadata mới.

## 2. Total views và metadata row

Vấn đề không chỉ là `0 → 1.234`; gốc lỗi là đưa các phần tử async, độ dài không đoán trước vào một hàng `flex-wrap`.

Tách metadata thành các vùng có hình học xác định:

```tsx
<div className="space-y-3 text-sm">
  <OrganizerRow />

  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
    <div className="min-w-0">
      <span className="block min-h-5 whitespace-nowrap tabular-nums">
        {views == null ? (
          <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
        ) : (
          `${formatViews(views)} lượt xem`
        )}
      </span>
    </div>

    <time className="min-h-5 text-right">
      {formattedDate}
    </time>
  </div>
</div>
```

Viewer count đã được chuyển ra khỏi metadata. Organizer luôn là một hàng riêng. Views và thời gian dùng grid hai cột thay vì wrap theo nội dung.

Đối với số views:

- Trạng thái đầu tiên là skeleton có cùng chiều cao, không phải `0 lượt xem`.
- Dùng `font-variant-numeric: tabular-nums`.
- Nếu cần ngăn tăng bề rộng, format rút gọn nhất quán: `1,2 N lượt xem`, `1,4 Tr lượt xem`.
- Không animate number bằng cách chạy qua hàng trăm giá trị. Chỉ crossfade hai text nằm chồng trong một slot cố định:

```css
.metric-value {
  display: inline-grid;
  min-inline-size: 8ch;
}

.metric-value > * {
  grid-area: 1 / 1;
}

.metric-value[data-align="end"] {
  text-align: end;
}
```

`9 → 10 → 100` lúc này không thay đổi grid track và không đẩy ngày sang dòng mới.

## 3. Loading toàn trang — progressive shell, không giữ cả trang sau skeleton

Không chọn một trong hai cực “spinner/skeleton toàn trang” hoặc “DOM mọc tự do”. Render ngay **page shell thật với geometry ổn định**, rồi hydrate từng vùng.

Thứ tự ưu tiên cho người deep-link từ Facebook:

1. Back/header shell: hiện ngay.
2. Player container full-bleed `aspect-ratio: 16 / 9`: hiện ngay.
3. Bắt đầu Mux/auth/playback song song với stream metadata.
4. Thanh Chat + viewer slot: hiện ngay.
5. Title/metadata skeleton bên dưới.
6. Description/comments/related streams hydrate sau.

Player loading và player thật phải dùng cùng markup ngoài:

```tsx
<div className="-mx-4 sticky top-14 aspect-video bg-black">
  {playbackReady ? <MuxPlayer ... /> : <PlayerLoadingState />}
  <PlaybackOverlays />
</div>
```

Không được có player skeleton rộng 358px rồi đổi thành 390px.

Với title, chọn một hình học có chủ đích:

```css
.stream-title-slot {
  min-block-size: calc(1.25em * 2);
}

.stream-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
```

Hiển thị tối đa hai dòng trên trang xem; thêm nút `Xem đầy đủ` nếu title bị cắt. Nút này cần target 44px. Đây tốt hơn việc giữ khoảng trống ba dòng cho mọi stream.

Comments:

- Initial comments skeleton nên có 2–3 hàng cùng chiều cao với comment thật.
- Comment mới phải append cuối danh sách, không prepend phía trên nội dung người dùng đang đọc.
- “Other live streams” ở cuối có thể hydrate tự nhiên; không ảnh hưởng nội dung phía trên miễn là không chèn ngược lên.

**Trade-off cần chấp nhận:** giữ cả trang skeleton cho tới khi mọi query hoàn tất có thể đạt CLS đẹp nhưng làm trải nghiệm 4G tệ hơn. Player phải được phép hoạt động ngay khi playback URL sẵn sàng; title, views và comments không được chặn video.

## 4. Home “Đang trực tiếp”

Không giữ một khoảng trống 350px phần lớn thời gian. Cũng không `return null` rồi chèn hero 350px ở đầu.

Giải pháp đúng: phần đầu home luôn có một **module media cố định, hữu ích ở cả hai trạng thái**:

```tsx
<section className="min-h-[11rem]" aria-labelledby="media-heading">
  {isLoading && <MediaModuleSkeleton />}
  {!isLoading && liveStreams.length > 0 && <CompactLiveModule />}
  {!isLoading && liveStreams.length === 0 && <LatestEditorialModule />}
</section>
```

- Có livestream: heading `Đang trực tiếp`, một card chính compact khoảng 176px.
- Không có livestream: dùng cùng slot cho `Mới nhất` hoặc `Sắp diễn ra`; không để khoảng trắng.
- Nếu product bắt buộc hero live cao khoảng 350px, đặt hero đó **sau module editorial đầu tiên** và reserve đúng chiều cao tại vị trí đó. Nhưng đây là lựa chọn kém hơn trên mobile.

CTA “log a match” sau auth cũng không được chèn ở đầu. Đặt một slot cố định trong module account/action:

- Chưa biết auth: skeleton action 44px.
- Đã đăng nhập: `Ghi lại trận đấu`.
- Chưa đăng nhập: `Đăng nhập để ghi trận`.

Hai trạng thái phải cùng chiều cao.

## 5. Font Vietnamese — giữ `swap`, preload và metric-match fallback

`preload` Inter Vietnamese sẽ giảm số lần reflow nhưng không đảm bảo xóa CLS trên 4G. Fix đầy đủ gồm hai phần.

Preload đúng file đang dùng:

```html
<link
  rel="preload"
  href="/fonts/inter-vietnamese.woff2"
  as="font"
  type="font/woff2"
  crossorigin
  fetchpriority="high"
/>
```

Tạo fallback face có metric được điều chỉnh:

```css
@font-face {
  font-family: "Inter Metric Fallback";
  src: local("Roboto");
  size-adjust: var(--inter-fallback-size-adjust);
  ascent-override: var(--inter-fallback-ascent);
  descent-override: var(--inter-fallback-descent);
  line-gap-override: 0%;
}

html {
  font-family:
    "Inter",
    "Inter Metric Fallback",
    Roboto,
    Arial,
    sans-serif;
}
```

Không nên copy các phần trăm từ một blog. Hãy tính chúng từ **đúng file `inter-vietnamese.woff2` đang production** và Roboto Android:

- `size-adjust`: khớp average/x-height hoặc measured text width.
- `ascent-override`: khớp ascent sau khi áp dụng size adjustment.
- `descent-override`: khớp descent.
- `line-gap-override`: thường là `0%` với Inter, nhưng phải xác nhận từ font binary.

Test bằng chuỗi đại diện:

> `nghề nghiệp · Trực tiếp · 1.234 lượt xem · Nguyễn Thị Hồng`

So sánh width và line box ở 14, 16 và 24px tại 320/390/414px. Mục tiêu là cùng điểm xuống dòng trước và sau khi Inter load.

Quan trọng: metric fallback không thay thế Inter và không làm mất dấu. Roboto tạm thời render đầy đủ tiếng Việt; Inter thật vẫn được tải bằng `swap`. Vì vậy giữ đúng `nghề`, đồng thời loại phần lớn reflow.

Nếu Geist không phải body font, bỏ preload Geist hoặc hạ ưu tiên; hai preload không dùng ngay có thể tranh băng thông với Inter và Mux.

## 6. `/login` — render form shell ngay, tạm khóa submit

Full-page spinner không phù hợp cho auth restore 200–800ms. Nó vừa gây layout replacement, vừa khiến kết nối bình thường trông như bị treo.

Render header, wordmark và form ngay với geometry cuối cùng:

```tsx
<form aria-busy={authRestoring}>
  <EmailField disabled={authRestoring} />
  <PasswordField disabled={authRestoring} />

  <Button
    className="min-h-11 w-full"
    disabled={authRestoring}
  >
    {authRestoring ? "Đang kiểm tra phiên…" : "Đăng nhập"}
  </Button>
</form>
```

Tốt hơn nữa:

- Hiện form ngay nhưng disable trong lúc restore để tránh người đã đăng nhập bắt đầu nhập rồi bị redirect.
- Chỉ hiện copy `Đang kiểm tra phiên…` nếu restore kéo dài quá khoảng 300ms; trước đó giữ label `Đăng nhập` ở trạng thái disabled.
- Spinner nhỏ có thể nằm trong button, nhưng icon phải overlay hoặc chiếm slot cố định để label không dịch ngang.
- Header/form không được mount/unmount khi auth state đổi.
- Nếu session hợp lệ, redirect; nếu không, chỉ enable form.

Không dùng copy `Đang tải…`; `Đang kiểm tra phiên…` giải thích chính xác điều đang xảy ra.

## Quy tắc áp dụng chung

- **Reserve space:** title, metadata, player, login form, home module — những vùng thuộc cấu trúc trang.
- **Overlay:** chỉ player controls, login gate, geo-block, captions và feedback tạm thời. Không overlay business metadata lên footage.
- **Fade:** chỉ dùng `opacity` cho nội dung nằm trong một slot đã có kích thước; không animate `height`, `margin`, `top` hoặc `max-height`.
- Chat expand do thao tác người dùng có thể thay đổi flow; đừng làm overlay chat lên video chỉ để tối ưu CLS.
- Presence reconnect không nên làm UI biến mất ngay. Giữ last-known state ổn định tốt hơn cho cả CLS lẫn khả năng đọc tại sân.

Ưu tiên triển khai: sửa loading tree/player geometry trước, chuyển viewer count khỏi `flex-wrap`, thay home `return null`, sửa login shell, rồi metric-match font. Đây đều là nguyên nhân có thể xử lý ngay; không cần đợi 7 ngày attribution mới bắt đầu.
