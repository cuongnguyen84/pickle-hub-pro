

# Tính năng @ Mention và Trả lời Chat trong Livestream

## Tổng quan

Thêm 2 tính năng vào khung chat livestream:
1. **@ Mention**: Gõ `@` để tag tên người dùng trong chat, hiển thị danh sách gợi ý
2. **Nút trả lời (Reply)**: Nút nhỏ bên cạnh mỗi dòng chat, khi nhấn sẽ tạo trạng thái "đang trả lời" phía trên ô nhập tin nhắn

## Chi tiết thiết kế

### 1. @ Mention

- Khi user gõ `@` trong ô chat, hiển thị popup danh sách người dùng đang chat (lấy từ danh sách `messages` hiện có, dedupe theo `user_id`)
- Popup hiện phía trên ô input, lọc theo ký tự sau `@`
- Chọn user sẽ chèn `@displayName ` vào ô chat
- Trong nội dung tin nhắn, phần `@tên` được highlight bằng màu primary, font bold
- Không cần thay đổi database -- mention chỉ là text thuần trong message

### 2. Nút trả lời (Reply)

- Thêm nút Reply icon nhỏ (icon `Reply`) bên cạnh nút `...` (MoreHorizontal) trên mỗi dòng chat, hiện khi hover
- Khi nhấn Reply:
  - Hiển thị thanh "Đang trả lời [tên]: [nội dung rút gọn]" phía trên ô input, có nút X để hủy
  - Tự động focus vào ô input
  - Khi gửi, tin nhắn sẽ có prefix `@displayName ` ở đầu (reply thuần text, không cần DB schema mới)
- Giữ nguyên layout chat hiện tại, nút reply nằm cùng hàng với dropdown `...`

## Kế hoạch kỹ thuật

### File cần tạo mới

**`src/components/chat/MentionSuggestions.tsx`**
- Component popup hiển thị danh sách user gợi ý khi gõ `@`
- Props: `query` (text sau @), `users` (danh sách unique users từ messages), `onSelect`, `onClose`
- Hiển thị avatar + tên, lọc theo query
- Hỗ trợ keyboard navigation (Up/Down/Enter/Escape)
- Positioned absolute phía trên input

### File cần chỉnh sửa

**`src/components/chat/ChatPanel.tsx`**

1. **ChatMessageItem component** (dòng 56-183):
   - Thêm prop `onReply: (message: ChatMessage) => void`
   - Thêm nút Reply (icon `Reply` từ lucide) bên cạnh DropdownMenu trigger, cùng nằm trong div `opacity-0 group-hover:opacity-100`
   - Nút chỉ hiện cho tin nhắn đã xác nhận (không pending/failed)

2. **ChatPanel component** (dòng 186+):
   - Thêm state `replyingTo: ChatMessage | null` để track tin nhắn đang reply
   - Thêm state và logic cho mention suggestions:
     - Detect `@` trong input, extract query text
     - Build unique users list từ messages
     - Hiển thị `MentionSuggestions` khi đang gõ mention
   - Khu vực input (dòng 771-808):
     - Thêm thanh "Replying to..." phía trên form khi `replyingTo !== null`
     - Khi submit reply: tự động prefix `@displayName ` vào tin nhắn
     - Render `MentionSuggestions` component phía trên input

3. **Render message content** (dòng 117):
   - Parse và highlight các `@mention` trong text tin nhắn
   - Tạo helper function `renderMessageWithMentions()` thay thế text thuần bằng JSX có highlight

**`src/components/chat/ChatMessageItem` interface** (dòng 43-54):
   - Thêm `onReply` prop

### Không thay đổi

- Database schema: mention và reply đều là text thuần, không cần bảng mới
- `useLiveChat.ts`: không cần thay đổi, `sendMessage` vẫn nhận string
- Broadcast/realtime logic: giữ nguyên

### Thứ tự triển khai

1. Tạo `MentionSuggestions.tsx`
2. Cập nhật `ChatMessageItem` -- thêm nút Reply + highlight @mention trong nội dung
3. Cập nhật `ChatPanel` -- thêm state reply, mention logic, UI thanh reply

