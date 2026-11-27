import Foundation
import Supabase

/// Reads profile rows from Supabase. Fetching the signed-in user's own profile
/// also serves as the end-to-end check that the user JWT + RLS work.
struct ProfileRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let columns = "id,username,display_name,avatar_url,dupr_singles,dupr_doubles"
    private static let publicColumns =
        "id,username,display_name,avatar_url,dupr_singles,dupr_doubles,bio,city,is_ghost,is_public_profile,is_pro,is_verified,cover_url,skill_level,created_at"

    /// The signed-in user's own profile.
    func currentUserProfile() async throws -> Profile {
        let userID = try await client.auth.session.user.id
        return try await client
            .from("profiles")
            .select(Self.columns)
            .eq("id", value: userID)
            .single()
            .execute()
            .value
    }

    /// Another player's public profile, resolved by username. Mirrors the web
    /// `usePlayerProfile` gate: ghost rows and non-public profiles are hidden
    /// from everyone except the owner, so this returns nil in those cases and
    /// the caller renders a "not public" state.
    func profile(username: String) async throws -> Profile? {
        let ownID = try? await client.auth.session.user.id
        let rows: [Profile] = try await client
            .from("profiles")
            .select(Self.publicColumns)
            .eq("username", value: username)
            .limit(1)
            .execute()
            .value
        guard let profile = rows.first, !(profile.isGhost ?? false) else { return nil }
        if !(profile.isPublicProfile ?? false) && profile.id != ownID {
            // 2026-11-24 rule (web #1130): an author with at least one
            // approved community post is publicly viewable even without
            // opting in. The existence check runs in a SECURITY DEFINER
            // RPC because social_posts has no anonymous count policy.
            struct Params: Encodable { let p_author_id: UUID }
            let hasPost: Bool? = try? await client
                .rpc("profile_has_approved_post", params: Params(p_author_id: profile.id))
                .execute()
                .value
            if hasPost != true { return nil }
        }
        return profile
    }

    // MARK: Onboarding / profile setup (web /onboarding ProfileSetup step)

    func usernameAvailable(_ candidate: String) async -> Bool {
        let ok: Bool? = try? await client
            .rpc("username_is_available", params: ["p_candidate": candidate]).execute().value
        return ok ?? false
    }

    private struct OnboardingUpdate: Encodable {
        let display_name: String; let username: String; let skill_level: String
        let onboarding_step: Int; let onboarding_completed_at: String
    }
    /// Save the profile-setup fields and mark onboarding complete in one update
    /// (native skips the optional DUPR / venue / follows steps).
    func completeOnboarding(displayName: String, username: String, skillLevel: String) async throws {
        let userID = try await client.auth.session.user.id
        try await client.from("profiles").update(OnboardingUpdate(
            display_name: displayName, username: username, skill_level: skillLevel,
            onboarding_step: 4, onboarding_completed_at: ISO8601DateFormatter().string(from: Date())))
            .eq("id", value: userID).execute()
    }

    // MARK: DUPR header chip

    /// The signed-in user's current DUPR rating (doubles preferred, like the
    /// rating card) plus the most recent change from `dupr_rating_history`.
    /// Returns nil when the user has no DUPR rating (→ "Kết nối" state).
    struct DuprChip: Equatable { let rating: Double; let delta: Double? }

    func duprChip() async -> DuprChip? {
        guard let userID = try? await client.auth.session.user.id else { return nil }
        struct P: Decodable { let dupr_doubles: Double?; let dupr_singles: Double? }
        guard let prof: P = try? await client.from("profiles")
            .select("dupr_doubles,dupr_singles").eq("id", value: userID).single().execute().value
        else { return nil }
        let preferDoubles = prof.dupr_doubles != nil
        guard let current = prof.dupr_doubles ?? prof.dupr_singles else { return nil }

        // Delta = change at the latest snapshot (last two history rows, same rating type).
        struct H: Decodable { let dupr_doubles: Double?; let dupr_singles: Double? }
        let rows: [H] = (try? await client.from("dupr_rating_history")
            .select("dupr_doubles,dupr_singles,recorded_at")
            .eq("profile_id", value: userID)
            .order("recorded_at", ascending: false)
            .limit(2).execute().value) ?? []
        var delta: Double?
        if rows.count >= 2 {
            let latest = preferDoubles ? rows[0].dupr_doubles : rows[0].dupr_singles
            let prev = preferDoubles ? rows[1].dupr_doubles : rows[1].dupr_singles
            if let l = latest, let p = prev, abs(l - p) > 0.0001 { delta = l - p }
        }
        return DuprChip(rating: current, delta: delta)
    }

    // MARK: Account editing (port of Account.tsx + useUserProfile)

    private struct DisplayNameUpdate: Encodable { let display_name: String }
    private struct AvatarUpdate: Encodable { let avatar_url: String }
    private struct PublicUpdate: Encodable { let is_public_profile: Bool }

    func updateDisplayName(_ name: String) async throws {
        let userID = try await client.auth.session.user.id
        try await client.from("profiles")
            .update(DisplayNameUpdate(display_name: name))
            .eq("id", value: userID).execute()
    }

    func setPublicProfile(_ isPublic: Bool) async throws {
        let userID = try await client.auth.session.user.id
        try await client.from("profiles")
            .update(PublicUpdate(is_public_profile: isPublic))
            .eq("id", value: userID).execute()
    }

    func fetchIsPublicProfile() async -> Bool {
        guard let userID = try? await client.auth.session.user.id else { return false }
        struct Row: Decodable { let is_public_profile: Bool? }
        let rows: [Row]? = try? await client.from("profiles")
            .select("is_public_profile").eq("id", value: userID).limit(1).execute().value
        return rows?.first?.is_public_profile ?? false
    }

    /// Upload avatar image data to the `avatars` bucket (path `{uid}/{ts}.{ext}`,
    /// upsert), set `profiles.avatar_url`, return the public URL — mirrors
    /// `useUserProfile.uploadAvatar`.
    func uploadAvatar(image: ProcessedImage) async throws -> String {
        let userID = try await client.auth.session.user.id
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let path = "\(userID.uuidString.lowercased())/\(stamp).\(image.fileExtension)"
        _ = try await client.storage.from("avatars")
            .upload(path, data: image.data, options: FileOptions(cacheControl: "3600", contentType: image.contentType, upsert: true))
        let url = try client.storage.from("avatars").getPublicURL(path: path).absoluteString
        try await client.from("profiles")
            .update(AvatarUpdate(avatar_url: url))
            .eq("id", value: userID).execute()
        return url
    }

    /// Invoke the `delete-account` edge function (auth via the session token that
    /// supabase-swift attaches automatically). Caller signs out on success.
    func deleteAccount() async throws {
        struct Result: Decodable { let success: Bool? }
        let _: Result = try await client.functions.invoke("delete-account")
    }

    /// Aggregate match stats for a player. Wraps the `get_player_stats` RPC;
    /// returns nil when the username doesn't map to a profile (the RPC still
    /// emits one row with a null profile_id in that case).
    func stats(username: String) async throws -> PlayerStats? {
        struct Params: Encodable { let p_username: String }
        let rows: [PlayerStats] = try await client
            .rpc("get_player_stats", params: Params(p_username: username))
            .execute()
            .value
        return rows.first { $0.profileID != nil }
    }

    // MARK: Social graph (follows, profile posts, match history)

    /// Whether the signed-in viewer follows `targetID`.
    func isFollowing(targetID: UUID) async -> Bool {
        guard let viewerID = try? await client.auth.session.user.id else { return false }
        struct Row: Decodable { let follower_id: UUID }
        let rows: [Row] = (try? await client
            .from("social_follows")
            .select("follower_id")
            .eq("follower_id", value: viewerID)
            .eq("followed_id", value: targetID)
            .limit(1)
            .execute()
            .value) ?? []
        return !rows.isEmpty
    }

    private struct FollowInsert: Encodable {
        let follower_id: UUID
        let followed_id: UUID
    }

    /// Follow or unfollow a player (the web `useFollow` writes the same
    /// `social_follows` row; RLS pins follower_id to the caller).
    func setFollowing(targetID: UUID, following: Bool) async throws {
        let viewerID = try await client.auth.session.user.id
        if following {
            try await client.from("social_follows")
                .insert(FollowInsert(follower_id: viewerID, followed_id: targetID))
                .execute()
        } else {
            try await client.from("social_follows")
                .delete()
                .eq("follower_id", value: viewerID)
                .eq("followed_id", value: targetID)
                .execute()
        }
    }

    enum FollowKind {
        case followers
        case following
    }

    /// One page of a follow list (web `useFollowList`): resolve the id
    /// column on the other side of the edge, then batch-load profiles.
    func followList(userID: UUID, kind: FollowKind) async throws -> [FollowPerson] {
        struct Edge: Decodable {
            let follower_id: UUID
            let followed_id: UUID
        }
        let selfColumn = kind == .followers ? "followed_id" : "follower_id"
        let edges: [Edge] = try await client
            .from("social_follows")
            .select("follower_id,followed_id")
            .eq(selfColumn, value: userID)
            .limit(100)
            .execute()
            .value
        let otherIDs = edges.map { kind == .followers ? $0.follower_id : $0.followed_id }
        guard !otherIDs.isEmpty else { return [] }
        let people: [FollowPerson] = try await client
            .from("profiles")
            .select("id,username,display_name,avatar_url,is_verified")
            .in("id", values: otherIDs)
            .execute()
            .value
        let byID = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0) })
        return otherIDs.compactMap { byID[$0] }.filter { $0.username != nil }
    }

    /// A player's approved community posts for the profile Posts tab
    /// (web `useProfilePosts`): newest first, 20 max, plus the exact
    /// approved total for the tab label.
    func profilePosts(userID: UUID) async throws -> (posts: [ProfilePostRow], total: Int) {
        let posts: [ProfilePostRow] = try await client
            .from("social_posts")
            .select("id,body,image_url,topic,created_at")
            .eq("author_id", value: userID)
            .eq("kind", value: "post")
            .eq("status", value: "approved")
            .order("created_at", ascending: false)
            .limit(20)
            .execute()
            .value
        let counted = try await client
            .from("social_posts")
            .select("id", head: true, count: .exact)
            .eq("author_id", value: userID)
            .eq("kind", value: "post")
            .eq("status", value: "approved")
            .execute()
        return (posts, counted.count ?? posts.count)
    }

    /// One page of a player's match history (web
    /// `usePlayerMatchHistory` over the `get_player_match_history` RPC).
    func matchHistory(playerID: UUID, limit: Int = 20, offset: Int = 0) async throws -> [PlayerMatchHistoryRow] {
        struct Params: Encodable {
            let p_player_id: UUID
            let p_limit: Int
            let p_offset: Int
        }
        return try await client
            .rpc("get_player_match_history", params: Params(p_player_id: playerID, p_limit: limit, p_offset: offset))
            .execute()
            .value
    }
}

/// A person row in a followers / following list.
struct FollowPerson: Decodable, Identifiable, Equatable {
    let id: UUID
    let username: String?
    let displayName: String?
    let avatarURL: String?
    let isVerified: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case isVerified = "is_verified"
    }

    var label: String {
        displayName?.nonEmpty ?? username ?? ""
    }
}

/// One approved community post on a profile (web `ProfilePost`).
struct ProfilePostRow: Decodable, Identifiable, Equatable {
    let id: UUID
    let body: String?
    let imageURL: String
    let topic: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case body
        case imageURL = "image_url"
        case topic
        case createdAt = "created_at"
    }
}

/// One row of the `get_player_match_history` RPC (verified live
/// 2026-11-25): participants reuse the feed participant shape.
struct PlayerMatchHistoryRow: Decodable, Identifiable, Equatable {
    let matchID: UUID
    let slug: String?
    let playedAt: String
    let format: String?
    let matchType: String?
    let venueName: String?
    let teamAScore: [Int]
    let teamBScore: [Int]
    let winningTeam: String?
    let playerTeam: String?
    let playerWon: Bool
    let participants: [FeedParticipant]

    var id: UUID { matchID }

    enum CodingKeys: String, CodingKey {
        case matchID = "match_id"
        case slug
        case playedAt = "played_at"
        case format
        case matchType = "match_type"
        case venueName = "venue_name"
        case teamAScore = "team_a_score"
        case teamBScore = "team_b_score"
        case winningTeam = "winning_team"
        case playerTeam = "player_team"
        case playerWon = "player_won"
        case participants
    }
}

/// One row of the `get_player_stats` RPC.
struct PlayerStats: Decodable, Equatable {
    let profileID: UUID?
    let totalMatches: Int
    let wins: Int
    let losses: Int
    let winRate: Double
    let last5Form: String?
    let currentStreak: Int
    let followersCount: Int
    let followingCount: Int

    enum CodingKeys: String, CodingKey {
        case profileID = "profile_id"
        case totalMatches = "total_matches"
        case wins
        case losses
        case winRate = "win_rate"
        case last5Form = "last_5_form"
        case currentStreak = "current_streak"
        case followersCount = "followers_count"
        case followingCount = "following_count"
    }
}
