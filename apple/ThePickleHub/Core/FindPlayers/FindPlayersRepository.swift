import Foundation
import Supabase

/// Reads/writes the "tìm kèo" board and opens a DM with a request author.
/// Mirrors web `FindPlayers.tsx` (play_requests + get_or_create_dm RPC).
struct FindPlayersRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> String? {
        try? await client.auth.session.user.id.uuidString.lowercased()
    }

    private static let selectCols = """
    id, author_id, city, district, venue_id, skill_min, skill_max, play_at, note, status, created_at, \
    author:profiles!play_requests_author_id_fkey(username,display_name,avatar_url,profile_slug), \
    venue:venues!play_requests_venue_id_fkey(slug,name)
    """

    /// Open requests, newest first, optionally filtered by city (ILIKE, like web).
    func openRequests(city: String) async -> [PlayRequest] {
        let base = client.from("play_requests").select(Self.selectCols).eq("status", value: "open")
        let c = city.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "[,.()*\"%_]", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        let filtered = c.isEmpty ? base : base.ilike("city", pattern: "%\(c)%")
        return (try? await filtered.order("created_at", ascending: false).limit(50).execute().value) ?? []
    }

    private struct RequestInsert: Encodable {
        let author_id: String; let city: String?; let district: String?
        let skill_min: Double?; let skill_max: Double?; let play_at: String?
        let note: String; let status = "open"
    }

    func postRequest(city: String?, district: String?, band: SkillBand?, playAt: Date?, note: String) async throws {
        guard let uid = await currentUserID() else {
            throw NSError(domain: "findplayers", code: 401, userInfo: [NSLocalizedDescriptionKey: "Cần đăng nhập"])
        }
        let iso = playAt.map { ISO8601DateFormatter().string(from: $0) }
        try await client.from("play_requests").insert(RequestInsert(
            author_id: uid, city: city?.nonEmpty, district: district?.nonEmpty,
            skill_min: band?.min, skill_max: (band != nil && band!.max < 90) ? band!.max : nil,
            play_at: iso, note: note.trimmingCharacters(in: .whitespacesAndNewlines)
        )).execute()
    }

    /// Open (or reuse) a DM with the other user → conversation id (web get_or_create_dm).
    func getOrCreateDM(otherID: String) async -> String? {
        let id: String? = try? await client
            .rpc("get_or_create_dm", params: ["p_other": otherID]).execute().value
        return id
    }
}
