import Foundation
import Supabase

/// Reads profile rows from Supabase. Fetching the signed-in user's own profile
/// also serves as the end-to-end check that the user JWT + RLS work.
struct ProfileRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let columns = "id,username,display_name,avatar_url,dupr_singles,dupr_doubles"
    private static let publicColumns =
        "id,username,display_name,avatar_url,dupr_singles,dupr_doubles,bio,city,is_ghost,is_public_profile,is_pro,is_verified"

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
        if !(profile.isPublicProfile ?? false) && profile.id != ownID { return nil }
        return profile
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
