import Foundation
import Supabase

/// One community photo post in the admin moderation queue - the twin of
/// the web `ModerationPost` (usePostModeration). Reads and writes run
/// under the admin's own session: the social_posts RLS policies give
/// admins SELECT/UPDATE on every row and the status-guard trigger lets
/// only admins change a post's status, so approve / reject / hide are
/// plain client updates, exactly like the web queue (#1125).
struct ModerationPost: Equatable, Identifiable {
    let id: UUID
    let authorID: UUID
    let authorName: String
    let authorAvatarURL: URL?
    let authorVerified: Bool
    let body: String?
    let imageURL: URL
    let topic: String?
    let status: String
    let createdAt: Date?
    /// Open (pending) content_reports against this post.
    let reportCount: Int

    var topicLabel: String? { topic.flatMap(SocialPostTopic.init(rawValue:))?.label }

    /// Status badge label, mirroring the web queue.
    var statusLabel: String {
        switch status {
        case "approved": return "Đã duyệt"
        case "rejected": return "Đã từ chối"
        case "hidden": return "Đã ẩn"
        default: return "Chờ duyệt"
        }
    }
}

/// A moderation action offered on a post card (web renderPostActions).
enum ModerationAction: Equatable, CaseIterable {
    case approve
    case reject
    case hide

    /// The social_posts status the action writes.
    var targetStatus: String {
        switch self {
        case .approve: return "approved"
        case .reject: return "rejected"
        case .hide: return "hidden"
        }
    }

    var label: String {
        switch self {
        case .approve: return "Duyệt"
        case .reject: return "Từ chối"
        case .hide: return "Ẩn"
        }
    }
}

enum ModerationActions {
    /// Which actions a post offers, mirroring the web queue: approve
    /// unless already approved, reject only while pending, hide unless
    /// already hidden or rejected.
    static func actions(forStatus status: String) -> [ModerationAction] {
        var result: [ModerationAction] = []
        if status != "approved" { result.append(.approve) }
        if status == "pending" { result.append(.reject) }
        if status != "hidden" && status != "rejected" { result.append(.hide) }
        return result
    }
}

/// Raw social_posts row for the moderation lists.
struct ModerationPostRow: Decodable {
    let id: UUID
    let authorID: UUID
    let body: String?
    let imageURL: String
    let topic: String?
    let status: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, body, topic, status
        case authorID = "author_id"
        case imageURL = "image_url"
        case createdAt = "created_at"
    }
}

enum ModerationMapping {
    struct AuthorInfo: Equatable {
        let name: String
        let avatarURL: URL?
        let verified: Bool
    }

    /// Joins rows with the batched author profiles and report counts;
    /// a missing profile falls back to the house name, like the web.
    static func posts(
        rows: [ModerationPostRow],
        authors: [UUID: AuthorInfo],
        reportCounts: [UUID: Int]
    ) -> [ModerationPost] {
        rows.compactMap { row in
            guard let imageURL = URL(string: row.imageURL) else { return nil }
            let author = authors[row.authorID]
            return ModerationPost(
                id: row.id,
                authorID: row.authorID,
                authorName: author?.name ?? "ThePickleHub",
                authorAvatarURL: author?.avatarURL,
                authorVerified: author?.verified ?? false,
                body: row.body,
                imageURL: imageURL,
                topic: row.topic,
                status: row.status,
                createdAt: FeedDate.parse(row.createdAt),
                reportCount: reportCounts[row.id] ?? 0
            )
        }
    }
}

struct ModerationRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let postColumns = "id, author_id, body, image_url, topic, status, created_at"

    /// The pending queue, newest first (web useModerationPosts).
    func pendingPosts() async throws -> [ModerationPost] {
        let rows: [ModerationPostRow] = try await client
            .from("social_posts")
            .select(Self.postColumns)
            .eq("kind", value: "post")
            .eq("status", value: "pending")
            .order("created_at", ascending: false)
            .execute()
            .value
        return try await enrich(rows)
    }

    /// Recently decided posts (approved / rejected / hidden), newest
    /// first, capped at 50 like the web history list.
    func historyPosts() async throws -> [ModerationPost] {
        let rows: [ModerationPostRow] = try await client
            .from("social_posts")
            .select(Self.postColumns)
            .eq("kind", value: "post")
            .in("status", values: ["approved", "rejected", "hidden"])
            .order("created_at", ascending: false)
            .limit(50)
            .execute()
            .value
        return try await enrich(rows)
    }

    /// Number of posts waiting in the queue (drives the entry badge).
    func pendingCount() async -> Int {
        struct IDRow: Decodable { let id: UUID }
        let rows: [IDRow]? = try? await client
            .from("social_posts")
            .select("id")
            .eq("kind", value: "post")
            .eq("status", value: "pending")
            .execute()
            .value
        return rows?.count ?? 0
    }

    /// Writes a new status under the admin's session; the RLS policy
    /// and the status-guard trigger are the real boundary.
    func setStatus(id: UUID, status: String) async throws {
        struct StatusUpdate: Encodable { let status: String }
        try await client
            .from("social_posts")
            .update(StatusUpdate(status: status))
            .eq("id", value: id.uuidString)
            .execute()
    }

    private func enrich(_ rows: [ModerationPostRow]) async throws -> [ModerationPost] {
        guard !rows.isEmpty else { return [] }

        struct AuthorRow: Decodable {
            let id: UUID
            let displayName: String?
            let username: String?
            let avatarURL: String?
            let isVerified: Bool?
            enum CodingKeys: String, CodingKey {
                case id, username
                case displayName = "display_name"
                case avatarURL = "avatar_url"
                case isVerified = "is_verified"
            }
        }
        let authorIDs = Array(Set(rows.map(\.authorID))).map(\.uuidString)
        let profiles: [AuthorRow] = try await client
            .from("profiles")
            .select("id, display_name, username, avatar_url, is_verified")
            .in("id", values: authorIDs)
            .execute()
            .value
        var authors: [UUID: ModerationMapping.AuthorInfo] = [:]
        for profile in profiles {
            authors[profile.id] = ModerationMapping.AuthorInfo(
                name: profile.displayName?.nonEmpty ?? profile.username?.nonEmpty ?? "ThePickleHub",
                avatarURL: profile.avatarURL?.nonEmpty.flatMap(URL.init(string:)),
                verified: profile.isVerified ?? false
            )
        }

        // Open report counts are decoration on the card - if the read
        // is unavailable the queue still works with zero counts.
        var reportCounts: [UUID: Int] = [:]
        struct ReportRow: Decodable {
            let contentID: UUID
            enum CodingKeys: String, CodingKey { case contentID = "content_id" }
        }
        let postIDs = rows.map(\.id.uuidString)
        if let reports: [ReportRow] = try? await client
            .from("content_reports")
            .select("content_id")
            .eq("content_type", value: "post")
            .eq("status", value: "pending")
            .in("content_id", values: postIDs)
            .execute()
            .value {
            for report in reports { reportCounts[report.contentID, default: 0] += 1 }
        }

        return ModerationMapping.posts(rows: rows, authors: authors, reportCounts: reportCounts)
    }
}
