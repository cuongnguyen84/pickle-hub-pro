

## Plan: Thêm hình ảnh cho bình luận forum

### 1. Database migration
- Thêm cột `image_urls text[] DEFAULT '{}'` vào bảng `forum_comments`

### 2. Cập nhật hook `useForumPost.ts`
- Thêm `image_urls` vào `ForumComment` interface
- Cập nhật `useCreateForumComment` mutation để nhận `image_urls`

### 3. Cập nhật `PostCommentSection.tsx`
- Import và tích hợp `ForumImageUpload` component (đã có sẵn) vào form bình luận
- Thêm state `commentImages` để quản lý ảnh đính kèm
- Hiển thị ảnh đính kèm trong mỗi comment (`CommentItem`)
- Reset `commentImages` sau khi submit
- Cho phép đính kèm tối đa 2 ảnh mỗi comment (nhỏ hơn post)

### Files

| Action | File |
|--------|------|
| Migration | Thêm `image_urls` vào `forum_comments` |
| Modify | `src/hooks/useForumPost.ts` — interface + mutation |
| Modify | `src/components/forum/PostCommentSection.tsx` — image upload UI + display |

