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
        try await removeMember(clubID: clubID, profileID: profileID)
    }

    // MARK: Member management (organizer)

    private struct MemberParams: Encodable { let p_club_id: String; let p_profile_id: String }

    func approveMember(clubID: UUID, profileID: UUID) async throws {
        _ = try await client.rpc("approve_club_member",
            params: MemberParams(p_club_id: clubID.uuidString.lowercased(),
                                 p_profile_id: profileID.uuidString.lowercased())).execute()
    }
    func removeMember(clubID: UUID, profileID: UUID) async throws {
        _ = try await client.rpc("remove_club_member",
            params: MemberParams(p_club_id: clubID.uuidString.lowercased(),
                                 p_profile_id: profileID.uuidString.lowercased())).execute()
    }

    // MARK: Create / edit (organizer)

    enum ClubWriteError: LocalizedError {
        case capExceeded, slugTaken, message(String)
        var errorDescription: String? {
            switch self {
            case .capExceeded: return "Bạn đã đạt giới hạn 3 CLB."
            case .slugTaken: return "Đường dẫn (slug) đã được dùng."
            case .message(let m): return m
            }
        }
    }

    /// True if a club already uses this slug (web debounced uniqueness check).
    func slugTaken(_ slug: String) async -> Bool {
        struct Row: Decodable { let id: UUID }
        let rows: [Row]? = try? await client.from("clubs")
            .select("id").eq("slug", value: slug).limit(1).execute().value
        return !(rows?.isEmpty ?? true)
    }

    private struct CreateClubParams: Encodable {
        let p_slug: String; let p_name: String; let p_description: String?
        let p_location_text: String; let p_logo_url: String?
    }
    /// Atomic cap-check + insert (web `create_club_with_cap_check`). Returns new id.
    func createClub(slug: String, name: String, description: String?, location: String, logoURL: String?) async throws -> UUID {
        do {
            let id: UUID = try await client.rpc("create_club_with_cap_check",
                params: CreateClubParams(p_slug: slug, p_name: name,
                                         p_description: description?.nonEmpty, p_location_text: location,
                                         p_logo_url: logoURL)).execute().value
            return id
        } catch {
            let msg = "\(error)".uppercased()
            if msg.contains("CLUB_CAP_EXCEEDED") { throw ClubWriteError.capExceeded }
            if msg.contains("CLUBS_SLUG") || msg.contains("DUPLICATE KEY") { throw ClubWriteError.slugTaken }
            throw error
        }
    }

    private struct ClubUpdate: Encodable { let name: String; let description: String?; let location_text: String; let logo_url: String? }
    func updateClub(id: UUID, name: String, description: String?, location: String, logoURL: String?) async throws {
        try await client.from("clubs")
            .update(ClubUpdate(name: name, description: description?.nonEmpty, location_text: location, logo_url: logoURL))
            .eq("id", value: id).execute()
    }

    private struct ArchiveUpdate: Encodable { let archived_at: String }
    func archiveClub(id: UUID) async throws {
        try await client.from("clubs")
            .update(ArchiveUpdate(archived_at: ISO8601DateFormatter().string(from: Date())))
            .eq("id", value: id).execute()
    }

    /// Upload a club logo to the `clubs-logos` bucket, return the public URL.
    func uploadLogo(data: Data) async -> String? {
        guard let uid = await currentUserID() else { return nil }
        let rand = UUID().uuidString.prefix(6)
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let path = "\(uid.uuidString.lowercased())/\(stamp)-\(rand).jpg"
        do {
            _ = try await client.storage.from("clubs-logos")
                .upload(path, data: data, options: FileOptions(cacheControl: "31536000", contentType: "image/jpeg", upsert: false))
            return try? client.storage.from("clubs-logos").getPublicURL(path: path).absoluteString
        } catch { return nil }
    }
}
