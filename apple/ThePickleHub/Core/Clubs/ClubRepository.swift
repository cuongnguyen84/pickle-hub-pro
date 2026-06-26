import Foundation
import Supabase

/// Reads clubs (`club_listing` view + `clubs`) and membership/matches/members
/// via the web RPCs. Mirrors useClub / useMyMembership / useClubMatches.
struct ClubRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let listColumns =
        "id, slug, name, description, logo_url, location_text, created_by, upcoming_events, creator_display_name, creator_username"

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    func list(search: String = "", limit: Int = 24) async throws -> [ClubListItem] {
        var query = client.from("club_listing").select(Self.listColumns)
        let safe = search.trimmingCharacters(in: .whitespacesAndNewlines)
        if !safe.isEmpty {
            let pat = "%\(safe)%"
            query = query.or("name.ilike.\(pat),location_text.ilike.\(pat)")
        }
        return try await query
            .order("upcoming_events", ascending: false)
            .order("created_at", ascending: false)
            .limit(limit).execute().value
    }

    func club(slug: String) async throws -> Club {
        try await client.from("clubs")
            .select("id, slug, name, description, logo_url, location_text, created_by")
            .eq("slug", value: slug).single().execute().value
    }

    /// Upcoming + past events for a club (non-draft), soonest first.
    func events(clubID: UUID) async -> [ClubEvent] {
        (try? await client.from("social_events")
            .select("id, slug, title_vi, title_en, start_at, end_at, location_text, max_players, price_vnd, status")
            .eq("club_id", value: clubID).neq("status", value: "draft")
            .order("start_at", ascending: true).limit(50).execute().value) ?? []
    }

    func matches(clubID: UUID, limit: Int = 20) async -> [ClubMatch] {
        struct Params: Encodable { let p_club_id: String; let p_limit: Int }
        return (try? await client.rpc("list_club_matches",
            params: Params(p_club_id: clubID.uuidString.lowercased(), p_limit: limit)).execute().value) ?? []
    }

    func members(clubID: UUID) async -> [ClubMember] {
        struct Params: Encodable { let p_club_id: String }
        return (try? await client.rpc("list_club_members",
            params: Params(p_club_id: clubID.uuidString.lowercased())).execute().value) ?? []
    }

    func membership(clubID: UUID) async -> ClubMembership {
        struct Params: Encodable { let p_club_id: String }
        let raw: String? = try? await client.rpc("my_club_membership_status",
            params: Params(p_club_id: clubID.uuidString.lowercased())).execute().value
        return raw.flatMap(ClubMembership.init) ?? .anonymous
    }

    /// Request to join → returns the new membership status string.
    @discardableResult
    func requestJoin(clubID: UUID) async throws -> ClubMembership {
        struct Params: Encodable { let p_club_id: String }
        let raw: String = try await client.rpc("request_to_join_club",
            params: Params(p_club_id: clubID.uuidString.lowercased())).execute().value
        return ClubMembership(rawValue: raw) ?? .pending
    }

    /// Leave the club (remove self).
    func leave(clubID: UUID, profileID: UUID) async throws {
        struct Params: Encodable { let p_club_id: String; let p_profile_id: String }
        _ = try await client.rpc("remove_club_member",
            params: Params(p_club_id: clubID.uuidString.lowercased(),
                           p_profile_id: profileID.uuidString.lowercased())).execute()
    }
}
