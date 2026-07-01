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
    func uploadAvatar(data: Data, fileExtension: String) async throws -> String {
        let userID = try await client.auth.session.user.id
        let ext = fileExtension.isEmpty ? "jpg" : fileExtension.lowercased()
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let path = "\(userID.uuidString.lowercased())/\(stamp).\(ext)"
        let contentType = ext == "png" ? "image/png" : "image/jpeg"
        _ = try await client.storage.from("avatars")
            .upload(path, data: data, options: FileOptions(cacheControl: "3600", contentType: contentType, upsert: true))
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
