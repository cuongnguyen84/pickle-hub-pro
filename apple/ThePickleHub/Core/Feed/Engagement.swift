import Foundation
import Observation
import Supabase

/// Polymorphic engagement target (kudos + comments), mirroring the web
/// `EngagementTargetType` in `src/lib/social/engagement.ts`: every feed
/// card kind keys its engagement by (target_type, target_id) on the same
/// `kudos` / `social_comments` tables the match module already used.
struct EngagementTarget: Equatable, Hashable {
    let type: String
    let id: UUID
}

/// Deterministic engagement id for blog posts, a port of the web
/// `blogTargetId()`: blogs are file modules with no DB row, so the id is
/// derived from the CANONICAL slug (the same slug in EN and VI whenever
/// the pair shares one). Two FNV-1a 64-bit passes with different seeds
/// form the 128 bits; version/variant bits are set so the value is a
/// well-formed UUID. The hash runs over UTF-16 code units, matching the
/// JavaScript `charCodeAt` loop bit for bit.
enum BlogTargetId {
    /// The two legacy slug pairs whose VI slug differs from the EN
    /// canonical slug (repo convention: every newer post shares one
    /// slug). Mirrors the canonical stamping of web PR #1140.
    static func canonicalSlug(for slug: String) -> String {
        switch slug {
        case "tao-giai-pickleball-bang-ai":
            return "create-tournament-by-chat"
        case "luat-goi-bong-out-ly-hoang-nam-fair-play":
            return "line-call-rules-ly-hoang-nam-fair-play"
        default:
            return slug
        }
    }

    static func uuid(forSlug slug: String) -> UUID {
        func fnv1a(seed: UInt64) -> UInt64 {
            var hash: UInt64 = 0xcbf2_9ce4_8422_2325 ^ seed
            for unit in slug.utf16 {
                hash ^= UInt64(unit)
                hash = hash &* 0x100_0000_01b3
            }
            return hash
        }
        func hex(_ value: UInt64) -> [Character] {
            Array(String(format: "%016llx", value))
        }
        var raw = hex(fnv1a(seed: 0)) + hex(fnv1a(seed: 0x9e37_79b9_7f4a_7c15))
        // UUID layout 8-4-4-4-12, version 5, variant 10xx.
        raw[12] = "5"
        let variant = (Int(String(raw[16]), radix: 16) ?? 0) & 0x3 | 0x8
        raw[16] = Character(String(variant, radix: 16))
        let flat = String(raw)
        let part = { (range: Range<Int>) in
            String(flat.dropFirst(range.lowerBound).prefix(range.upperBound - range.lowerBound))
        }
        let string = "\(part(0..<8))-\(part(8..<12))-\(part(12..<16))-\(part(16..<20))-\(part(20..<32))"
        // The construction always yields a valid UUID string.
        return UUID(uuidString: string) ?? UUID()
    }
}

extension FeedItem {
    /// The engagement target for this card, following the id sources the
    /// `engagement_target_exists` SQL helper checks: news -> news_items.id,
    /// post -> social_posts.id, video -> videos.id, highlight ->
    /// feed_highlights.id, embed -> feed_embeds.id, livestream /
    /// tournament / event -> the happening's own row id, match -> the
    /// timeline item id, blog -> the deterministic canonical-slug UUID.
    var engagementTarget: EngagementTarget {
        switch kind {
        case .match:
            return EngagementTarget(type: "match", id: id)
        case .blog(let blog):
            // The stamped canonical slug (VI overlay) wins; otherwise
            // the slug map resolves the known split pairs.
            return EngagementTarget(
                type: "blog",
                id: BlogTargetId.uuid(forSlug: blog.canonicalSlug ?? BlogTargetId.canonicalSlug(for: blog.slug))
            )
        case .video(let video):
            return EngagementTarget(type: "video", id: video.videoID)
        case .news:
            return EngagementTarget(type: "news", id: id)
        case .embed:
            return EngagementTarget(type: "embed", id: id)
        case .highlight:
            return EngagementTarget(type: "highlight", id: id)
        case .socialPost:
            return EngagementTarget(type: "post", id: id)
        case .happening(let happening):
            switch happening.kind {
            case .live: return EngagementTarget(type: "livestream", id: id)
            case .tournament: return EngagementTarget(type: "tournament", id: id)
            case .event: return EngagementTarget(type: "event", id: id)
            }
        }
    }
}

/// Batched counts for one target (`get_engagement_counts`).
struct EngagementCounts: Equatable {
    var kudos: Int
    var comments: Int
    var viewerKudoed: Bool

    static let zero = EngagementCounts(kudos: 0, comments: 0, viewerKudoed: false)
}

struct EngagementCountsRow: Decodable {
    let targetID: UUID
    let kudosCount: Int
    let commentCount: Int
    let viewerKudoed: Bool

    enum CodingKeys: String, CodingKey {
        case targetID = "target_id"
        case kudosCount = "kudos_count"
        case commentCount = "comment_count"
        case viewerKudoed = "viewer_kudoed"
    }
}

struct ToggleKudosResult: Decodable, Equatable {
    let kudoed: Bool
    let count: Int
}

/// One row of `get_target_comments`. Deleted comments arrive as
/// tombstones: body "[deleted]", display name and avatar NULL.
struct TargetComment: Decodable, Equatable, Identifiable {
    let commentID: UUID
    let parentCommentID: UUID?
    let depth: Int
    let body: String
    let userID: UUID
    let username: String?
    let displayName: String?
    let avatarURL: String?
    let createdAt: String
    let isDeleted: Bool

    var id: UUID { commentID }

    var authorLabel: String {
        displayName?.nonEmpty ?? username?.nonEmpty ?? String(localized: "Thành viên")
    }

    enum CodingKeys: String, CodingKey {
        case commentID = "comment_id"
        case parentCommentID = "parent_comment_id"
        case depth, body, username
        case userID = "user_id"
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case createdAt = "created_at"
        case isDeleted = "is_deleted"
    }
}

/// Pure helpers for the comment thread, kept separate from the views so
/// they can be unit-tested without a network or a view hierarchy.
enum TargetCommentTree {
    /// Flattens the flat ASC rows into display order: roots in arrival
    /// order, each followed depth-first by its replies. Rows whose
    /// parent is missing (paged out) are treated as roots so nothing
    /// silently disappears.
    static func flattened(_ rows: [TargetComment]) -> [TargetComment] {
        let ids = Set(rows.map(\.commentID))
        var children: [UUID: [TargetComment]] = [:]
        var roots: [TargetComment] = []
        for row in rows {
            if let parent = row.parentCommentID, ids.contains(parent) {
                children[parent, default: []].append(row)
            } else {
                roots.append(row)
            }
        }
        var out: [TargetComment] = []
        func visit(_ comment: TargetComment) {
            out.append(comment)
            for child in children[comment.commentID] ?? [] { visit(child) }
        }
        for root in roots { visit(root) }
        return out
    }
}

enum CommentBody {
    enum Problem: Equatable, Error {
        case empty
        case tooLong
    }

    /// Mirrors the `add_target_comment` server rules: trimmed, 1...500
    /// characters. Returns the trimmed body, or the problem with it.
    static func validated(_ raw: String) -> Result<String, Problem> {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return .failure(.empty) }
        if trimmed.count > 500 { return .failure(.tooLong) }
        return .success(trimmed)
    }
}

/// RPC client for the generic engagement functions added by web
/// PR #1136 (`toggle_target_kudos`, `add_target_comment`,
/// `get_target_comments`, `delete_target_comment`,
/// `get_engagement_counts`). Reads are open to guests; writes require a
/// signed-in user and the RPCs enforce that server-side.
struct EngagementRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private struct CountsParams: Encodable {
        let p_target_type: String
        let p_target_ids: [String]
    }

    private struct TargetParams: Encodable {
        let p_target_type: String
        let p_target_id: String
    }

    private struct CommentsParams: Encodable {
        let p_target_type: String
        let p_target_id: String
        let p_limit: Int
        let p_cursor_created_at: String?
        let p_cursor_comment_id: String?
    }

    private struct AddParams: Encodable {
        let p_target_type: String
        let p_target_id: String
        let p_body: String
        let p_parent_comment_id: String?
    }

    private struct DeleteParams: Encodable {
        let p_comment_id: String
    }

    private struct AddResult: Decodable {
        let commentID: UUID
        let depth: Int
        enum CodingKeys: String, CodingKey {
            case commentID = "comment_id"
            case depth
        }
    }

    func counts(type: String, ids: [UUID]) async throws -> [EngagementCountsRow] {
        guard !ids.isEmpty else { return [] }
        let params = CountsParams(p_target_type: type, p_target_ids: ids.map(\.uuidString))
        return try await client.rpc("get_engagement_counts", params: params).execute().value
    }

    func toggleKudos(target: EngagementTarget) async throws -> ToggleKudosResult {
        let params = TargetParams(p_target_type: target.type, p_target_id: target.id.uuidString)
        return try await client.rpc("toggle_target_kudos", params: params).execute().value
    }

    func comments(target: EngagementTarget, after last: TargetComment?) async throws -> [TargetComment] {
        let params = CommentsParams(
            p_target_type: target.type,
            p_target_id: target.id.uuidString,
            p_limit: 50,
            p_cursor_created_at: last?.createdAt,
            p_cursor_comment_id: last?.commentID.uuidString
        )
        return try await client.rpc("get_target_comments", params: params).execute().value
    }

    @discardableResult
    func addComment(target: EngagementTarget, body: String, parentID: UUID?) async throws -> UUID {
        let params = AddParams(
            p_target_type: target.type,
            p_target_id: target.id.uuidString,
            p_body: body,
            p_parent_comment_id: parentID?.uuidString
        )
        let result: AddResult = try await client.rpc("add_target_comment", params: params).execute().value
        return result.commentID
    }

    func deleteComment(id: UUID) async throws {
        let params = DeleteParams(p_comment_id: id.uuidString)
        _ = try await client.rpc("delete_target_comment", params: params).execute()
    }
}

/// Shared engagement state for the feed: batched counts per target and
/// optimistic kudos toggles. One instance lives in `FeedView` and is
/// handed to every card's engagement bar.
@Observable
@MainActor
final class EngagementStore {
    private(set) var counts: [EngagementTarget: EngagementCounts] = [:]

    private let repo = EngagementRepository()
    private var requested = Set<EngagementTarget>()
    private var toggling = Set<EngagementTarget>()

    func counts(for target: EngagementTarget) -> EngagementCounts {
        counts[target] ?? .zero
    }

    /// Groups targets by type - the counts RPC takes ONE type per call.
    static func groupedByType(_ targets: [EngagementTarget]) -> [String: [UUID]] {
        var grouped: [String: [UUID]] = [:]
        for target in targets { grouped[target.type, default: []].append(target.id) }
        return grouped
    }

    /// Loads counts for any targets not already requested. Failures are
    /// swallowed per type: a card without counts just shows zeroes
    /// until the next feed refresh requests again.
    func ensureCounts(for targets: [EngagementTarget]) async {
        let fresh = targets.filter { !requested.contains($0) }
        guard !fresh.isEmpty else { return }
        for target in fresh { requested.insert(target) }
        for (type, ids) in Self.groupedByType(fresh) {
            guard let rows = try? await repo.counts(type: type, ids: ids) else { continue }
            let byID = Dictionary(uniqueKeysWithValues: rows.map { ($0.targetID, $0) })
            for id in ids {
                let target = EngagementTarget(type: type, id: id)
                if let row = byID[id] {
                    counts[target] = EngagementCounts(
                        kudos: row.kudosCount,
                        comments: row.commentCount,
                        viewerKudoed: row.viewerKudoed
                    )
                } else {
                    counts[target] = .zero
                }
            }
        }
    }

    /// Optimistic toggle: flips immediately, then reconciles with the
    /// server's authoritative result; a failed call rolls back.
    func toggleKudos(target: EngagementTarget) async {
        guard !toggling.contains(target) else { return }
        toggling.insert(target)
        defer { toggling.remove(target) }
        let before = counts(for: target)
        var optimistic = before
        optimistic.viewerKudoed.toggle()
        optimistic.kudos = max(0, optimistic.kudos + (optimistic.viewerKudoed ? 1 : -1))
        counts[target] = optimistic
        do {
            let result = try await repo.toggleKudos(target: target)
            counts[target] = EngagementCounts(
                kudos: result.count,
                comments: before.comments,
                viewerKudoed: result.kudoed
            )
        } catch {
            counts[target] = before
        }
    }

    /// Keeps a card's comment count in step with thread add/delete
    /// without refetching every count on the feed.
    func adjustComments(target: EngagementTarget, delta: Int) {
        var current = counts(for: target)
        current.comments = max(0, current.comments + delta)
        counts[target] = current
    }

    func reset() {
        counts = [:]
        requested = []
    }
}
