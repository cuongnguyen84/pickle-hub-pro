

# Fix: Video bị đẩy lên khi mở keyboard trên mobile

## Vấn đề
Khi user focus vào ô chat trên mobile, virtual keyboard đẩy nội dung lên. Video player dùng `sticky top-14` nhưng do `#root` dùng `height: 100dvh` (dynamic viewport height), khi keyboard mở thì `dvh` co lại → video bị đẩy ra khỏi viewport.

## Giải pháp

### 1. Thêm `interactive-widget=overlays-content` vào viewport meta (index.html)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=overlays-content" />
```
Thuộc tính này báo trình duyệt: keyboard overlay lên content thay vì resize layout viewport. Layout viewport giữ nguyên → video không bị đẩy.

### 2. Xử lý chat input bị keyboard che (WatchLive.tsx + ChatPanel.tsx)
Vì keyboard giờ overlay lên content, cần đảm bảo chat input area không bị che:

- Trong `ChatPanel.tsx`: Khi input focused trên mobile, thêm padding-bottom bằng chiều cao keyboard (dùng `visualViewport` API)
- Tạo hook `useKeyboardHeight()` để detect keyboard height qua `window.visualViewport.resize` event
- Apply padding-bottom động cho chat container khi keyboard mở

### 3. Tạo hook `useKeyboardHeight.ts`
```typescript
// Lắng nghe visualViewport resize để tính keyboard height
// keyboardHeight = window.innerHeight - visualViewport.height
// Return keyboardHeight (0 khi keyboard đóng)
```

### 4. Áp dụng trong ChatPanel
- Khi `keyboardHeight > 0` và input focused → thêm `paddingBottom: keyboardHeight` cho chat container
- Đảm bảo scroll chat messages vẫn hiển thị đúng

### Files thay đổi
1. `index.html` — thêm `interactive-widget=overlays-content` vào viewport meta
2. `src/hooks/useKeyboardHeight.ts` — hook mới detect keyboard height
3. `src/components/chat/ChatPanel.tsx` — apply dynamic padding khi keyboard mở
4. `src/pages/WatchLive.tsx` — có thể cần adjust mobile chat section

### Rủi ro & Mitigation
- `interactive-widget=overlays-content` có thể ảnh hưởng các form khác → kiểm tra Login, Forum, Account pages
- Fallback: nếu `visualViewport` không available, dùng estimated keyboard height (~300px)
- Chỉ apply keyboard padding trên mobile (`lg:` breakpoint trở lên không cần)

