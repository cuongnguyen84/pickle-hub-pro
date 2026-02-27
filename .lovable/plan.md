

## Forum Feature Plan

### Database Schema

**New tables:**

1. **`forum_categories`** — Admin-managed categories (Kỹ thuật, Tìm bạn chơi, Mua bán gear, Q&A, etc.)
   - `id`, `name`, `slug`, `description`, `display_order`, `created_at`
   - RLS: public SELECT, admin-only INSERT/UPDATE/DELETE

2. **`forum_posts`** — User posts
   - `id`, `user_id`, `category_id` (FK → forum_categories), `title`, `content` (text), `image_urls` (text[]), `tags` (text[]), `is_pinned` (boolean, default false), `is_qa` (boolean, default false — marks Q&A posts), `like_count` (integer, default 0), `comment_count` (integer, default 0), `created_at`, `updated_at`
   - RLS: public SELECT, authenticated INSERT (user_id = auth.uid()), owner UPDATE/DELETE, admin can UPDATE (for pinning) and DELETE

3. **`forum_comments`** — Replies to posts
   - `id`, `post_id` (FK → forum_posts), `user_id`, `content`, `is_best_answer` (boolean, default false — for Q&A), `like_count` (integer, default 0), `created_at`
   - RLS: public SELECT, authenticated INSERT, owner UPDATE/DELETE, post owner can UPDATE `is_best_answer`

4. **`forum_likes`** — Likes on posts and comments
   - `id`, `user_id`, `target_type` (enum: 'post', 'comment'), `target_id`, `created_at`
   - UNIQUE(user_id, target_type, target_id)
   - RLS: public SELECT, authenticated INSERT/DELETE own
   - Trigger to increment/decrement `like_count` on forum_posts/forum_comments

**Storage:**
- Create `forum-images` bucket (public) for post image uploads

**Realtime:**
- Enable realtime on `forum_posts` and `forum_comments` for live updates

### Pages & Routes

1. **`/forum`** — Forum home: category list + latest/trending posts feed
2. **`/forum/:categorySlug`** — Posts filtered by category
3. **`/forum/post/:postId`** — Post detail with comments
4. **`/forum/new`** — Create new post (requires auth)

### Components

- `src/pages/Forum.tsx` — Main forum page with category tabs + post list
- `src/pages/ForumCategory.tsx` — Posts by category
- `src/pages/ForumPostDetail.tsx` — Single post + comments
- `src/pages/ForumPostCreate.tsx` — Create/edit post form
- `src/components/forum/PostCard.tsx` — Post preview card (title, excerpt, author, likes, comments count, tags, pinned badge)
- `src/components/forum/PostCommentSection.tsx` — Comments list + reply form, with "best answer" marking for Q&A
- `src/components/forum/ForumCategoryNav.tsx` — Category navigation (horizontal tabs or sidebar)
- `src/components/forum/TagFilter.tsx` — Tag chips for filtering
- `src/components/forum/ForumImageUpload.tsx` — Image upload component using forum-images bucket

### Hooks

- `src/hooks/useForumPosts.ts` — React Query for fetching/paginating posts, with category/tag filters
- `src/hooks/useForumPost.ts` — Single post detail + comments
- `src/hooks/useForumCategories.ts` — Fetch categories
- `src/hooks/useForumLike.ts` — Like/unlike with optimistic updates

### Key Features

- **Pinned posts**: Admin/Creator can pin posts to top of category or global feed
- **Tags**: Free-form tags on posts, clickable to filter
- **Images**: Up to 4 images per post, uploaded to storage bucket
- **Q&A mode**: Post creator can toggle Q&A, then mark one comment as "best answer" (highlighted with green check)
- **Like + Comment counts**: Denormalized counters updated via database triggers for performance
- **Pagination**: Cursor-based infinite scroll on post lists
- **i18n**: Add `forum` namespace to both `en.ts` and `vi.ts`

### Navigation

- Add "Forum" / "Diễn đàn" link to bottom nav and app header
- Icon: `MessageSquare` from lucide-react

### Files to create/modify

| Action | File |
|--------|------|
| Migration | New migration: tables, enums, triggers, storage bucket, RLS policies |
| Create | `src/pages/Forum.tsx` |
| Create | `src/pages/ForumCategory.tsx` |
| Create | `src/pages/ForumPostDetail.tsx` |
| Create | `src/pages/ForumPostCreate.tsx` |
| Create | `src/components/forum/PostCard.tsx` |
| Create | `src/components/forum/PostCommentSection.tsx` |
| Create | `src/components/forum/ForumCategoryNav.tsx` |
| Create | `src/components/forum/TagFilter.tsx` |
| Create | `src/components/forum/ForumImageUpload.tsx` |
| Create | `src/components/forum/index.ts` |
| Create | `src/hooks/useForumPosts.ts` |
| Create | `src/hooks/useForumPost.ts` |
| Create | `src/hooks/useForumCategories.ts` |
| Create | `src/hooks/useForumLike.ts` |
| Modify | `src/App.tsx` — Add 4 forum routes |
| Modify | `src/components/layout/BottomNav.tsx` — Add forum tab |
| Modify | `src/components/layout/AppHeader.tsx` — Add forum link |
| Modify | `src/i18n/en.ts` + `src/i18n/vi.ts` — Add forum translations |

