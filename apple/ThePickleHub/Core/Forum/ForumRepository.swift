import Foundation
import Supabase

/// Community forum — faithful port of the web `useForum*` hooks. All plain
/// PostgREST CRUD; author names/avatars come from the `get_public_profiles`
/// RPC (id, display_name, avatar_url). Admin actions (pin/hide) are excluded.
struct ForumRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> String? {
        try? await client.auth.session.user.id.uuidString.lowercased()
    }

    private struct PublicProfile: Decodable { let id: String; let display_name: String?; let avatar_url: String? }

    private func profileMap(_ userIDs: [String]) async -> [String: PublicProfile] {
        let ids = Array(Set(userIDs))
        guard !ids.isEmpty else { return [:] }
        let rows: [PublicProfile] = (try? await client
            .rpc("get_public_profiles", params: ["profile_ids": ids]).execute().value) ?? []
        return Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }

    // MARK: Categories

    func categories() async -> [ForumCategory] {
        (try? await client.from("forum_categories").select("*")
            .order("display_order", ascending: true).execute().value) ?? []
    }

    private func categoryID(slug: String) async -> String? {
        struct Row: Decodable { let id: String }
        let rows: [Row]? = try? await client.from("forum_categories")
            .select("id").eq("slug", value: slug).limit(1).execute().value
        return rows?.first?.id
    }

    // MARK: Posts

    func posts(categorySlug: String?, tag: String?, limit: Int = 60) async -> [ForumPost] {
        var query = client.from("forum_posts").select("*")
        if let slug = categorySlug, let cid = await categoryID(slug: slug) {
            query = query.eq("category_id", value: cid)
        }
        if let tag { query = query.contains("tags", value: [tag]) }
        guard var posts: [ForumPost] = try? await query
            .order("is_pinned", ascending: false)
            .order("created_at", ascending: false)
            .limit(limit).execute().value else { return [] }

        let profiles = await profileMap(posts.map(\.userID))
        let cats = await categories()
        let catByID = Dictionary(cats.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for i in posts.indices {
            let p = profiles[posts[i].userID]
            posts[i].authorName = p?.display_name ?? "Người dùng"
            posts[i].authorAvatar = p?.avatar_url
            if let cid = posts[i].categoryID, let c = catByID[cid] {
                posts[i].categoryName = c.name; posts[i].categorySlug = c.slug
            }
        }
        return posts
    }

    func post(id: String) async -> ForumPost? {
        guard var post: ForumPost = try? await client.from("forum_posts")
            .select("*").eq("id", value: id).single().execute().value else { return nil }
        let profiles = await profileMap([post.userID])
        post.authorName = profiles[post.userID]?.display_name ?? "Người dùng"
        post.authorAvatar = profiles[post.userID]?.avatar_url
        if let cid = post.categoryID {
            struct Cat: Decodable { let name: String; let slug: String }
            if let c: Cat = try? await client.from("forum_categories")
                .select("name, slug").eq("id", value: cid).single().execute().value {
                post.categoryName = c.name; post.categorySlug = c.slug
            }
        }
        return post
    }

    private struct PostInsert: Encodable {
        let user_id: String; let title: String; let content: String
        let category_id: String?; let tags: [String]?; let image_urls: [String]?; let is_qa: Bool
    }
    /// Insert a post and return its new id (web returns the row).
    func createPost(title: String, content: String, categoryID: String?,
                    tags: [String]?, imageURLs: [String]?, isQA: Bool) async throws -> String {
        guard let uid = await currentUserID() else { throw ForumError.notAuthed }
        struct Row: Decodable { let id: String }
        let row: Row = try await client.from("forum_posts")
            .insert(PostInsert(user_id: uid, title: title, content: content,
                               category_id: categoryID, tags: tags, image_urls: imageURLs, is_qa: isQA))
            .select("id").single().execute().value
        return row.id
    }

    func deletePost(id: String) async throws {
        try await client.from("forum_posts").delete().eq("id", value: id).execute()
    }

    // MARK: Comments

    func comments(postID: String) async -> [ForumComment] {
        guard var comments: [ForumComment] = try? await client.from("forum_comments")
            .select("*").eq("post_id", value: postID)
            .order("is_best_answer", ascending: false)
            .order("created_at", ascending: true).execute().value else { return [] }
        let profiles = await profileMap(comments.map(\.userID))
        let byID = Dictionary(comments.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for i in comments.indices {
            let p = profiles[comments[i].userID]
            comments[i].authorName = p?.display_name ?? "Người dùng"
            comments[i].authorAvatar = p?.avatar_url
            if let pid = comments[i].parentID, let parent = byID[pid] {
                comments[i].parentAuthorName = profiles[parent.userID]?.display_name ?? "Người dùng"
                comments[i].parentContent = parent.content
            }
        }
        return comments
    }

    private struct CommentInsert: Encodable {
        let post_id: String; let user_id: String; let content: String
        let parent_id: String?; let image_urls: [String]?
    }
    func createComment(postID: String, content: String, parentID: String?, imageURLs: [String]?) async throws {
        guard let uid = await currentUserID() else { throw ForumError.notAuthed }
        try await client.from("forum_comments")
            .insert(CommentInsert(post_id: postID, user_id: uid, content: content,
                                  parent_id: parentID, image_urls: imageURLs)).execute()
    }

    func deleteComment(id: String) async throws {
        try await client.from("forum_comments").delete().eq("id", value: id).execute()
    }

    private struct BestAnswerUpdate: Encodable { let is_best_answer: Bool }
    /// Mark/unmark best answer (Q&A). Marking clears others on the post first.
    func toggleBestAnswer(commentID: String, postID: String, isBestAnswer: Bool) async throws {
        if !isBestAnswer {
            try await client.from("forum_comments")
                .update(BestAnswerUpdate(is_best_answer: false)).eq("post_id", value: postID).execute()
        }
        try await client.from("forum_comments")
            .update(BestAnswerUpdate(is_best_answer: !isBestAnswer)).eq("id", value: commentID).execute()
    }

    // MARK: Likes (forum_likes; like_count denormalized by DB trigger)

    func likedTargetIDs(_ targetIDs: [String], type: String) async -> Set<String> {
        guard let uid = await currentUserID(), !targetIDs.isEmpty else { return [] }
        struct Row: Decodable { let target_id: String }
        let rows: [Row] = (try? await client.from("forum_likes")
            .select("target_id").eq("user_id", value: uid).eq("target_type", value: type)
            .in("target_id", values: targetIDs).execute().value) ?? []
        return Set(rows.map(\.target_id))
    }

    private struct LikeInsert: Encodable { let user_id: String; let target_type: String; let target_id: String }
    func toggleLike(targetID: String, targetType: String, isLiked: Bool) async throws {
        guard let uid = await currentUserID() else { throw ForumError.notAuthed }
        if isLiked {
            try await client.from("forum_likes").delete()
                .eq("user_id", value: uid).eq("target_type", value: targetType)
                .eq("target_id", value: targetID).execute()
        } else {
            try await client.from("forum_likes")
                .insert(LikeInsert(user_id: uid, target_type: targetType, target_id: targetID)).execute()
        }
    }

    // MARK: Image upload (bucket forum-images, path {uid}/{ts}-{rand}.jpg)

    func uploadImages(_ datas: [Data]) async -> [String] {
        guard let uid = await currentUserID() else { return [] }
        var urls: [String] = []
        for data in datas {
            let rand = UUID().uuidString.prefix(6)
            let stamp = Int(Date().timeIntervalSince1970 * 1000)
            let path = "\(uid)/\(stamp)-\(rand).jpg"
            do {
                _ = try await client.storage.from("forum-images")
                    .upload(path, data: data, options: FileOptions(contentType: "image/jpeg", upsert: false))
                if let url = try? client.storage.from("forum-images").getPublicURL(path: path).absoluteString {
                    urls.append(url)
                }
            } catch { continue }
        }
        return urls
    }

    enum ForumError: LocalizedError {
        case notAuthed
        var errorDescription: String? { "Cần đăng nhập" }
    }
}
