import Foundation
import Supabase

/// Reads public social events. Mirrors web `useUpcomingSocialEvents` /
/// `useSocialEvent`.
struct SocialRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let columns =
        "id, slug, title_vi, title_en, description_vi, start_at, end_at, location_text, court_count, max_players, level_min, level_max, price_vnd, zalo_group_url, ball_type, free_perks, status"

    /// Published, public events that haven't ended yet, soonest first.
    func upcomingEvents(limit: Int = 30) async throws -> [SocialEvent] {
        let nowISO = ISO8601DateFormatter().string(from: Date())
        return try await client
            .from("social_events")
            .select(Self.columns)
            .eq("status", value: "published")
            .eq("visibility", value: "public")
            .gte("end_at", value: nowISO)
            .order("start_at", ascending: true)
            .limit(limit)
            .execute()
            .value
    }

    /// A single event by slug (used when drilling in from a club page).
    func event(slug: String) async throws -> SocialEvent {
        try await client.from("social_events").select(Self.columns)
            .eq("slug", value: slug).single().execute().value
    }

    /// Active (non-cancelled) registration count for an event.
    func registrationCount(eventID: UUID) async throws -> Int {
        let response = try await client
            .from("event_registrations")
            .select("id", head: true, count: .exact)
            .eq("event_id", value: eventID)
            .neq("status", value: "cancelled")
            .execute()
        return response.count ?? 0
    }

    /// Logged matches within a session (shares the ClubMatch shape — same RPC
    /// columns). Mirrors web `list_social_event_matches`.
    func matches(eventID: UUID, limit: Int = 50) async -> [ClubMatch] {
        struct Params: Encodable { let p_event_id: String; let p_limit: Int }
        return (try? await client.rpc("list_social_event_matches",
            params: Params(p_event_id: eventID.uuidString.lowercased(), p_limit: limit)).execute().value) ?? []
    }

    /// Public roster (active registrations), newest first.
    func roster(eventID: UUID, limit: Int = 50) async -> [SocialRosterEntry] {
        (try? await client.from("event_registrations")
            .select("id, display_name, self_rated_level")
            .eq("event_id", value: eventID).neq("status", value: "cancelled")
            .order("registered_at", ascending: true).limit(limit).execute().value) ?? []
    }

    /// Registration counts for several events at once (parallel head-counts).
    func registrationCounts(eventIDs: [UUID]) async -> [UUID: Int] {
        await withTaskGroup(of: (UUID, Int).self) { group in
            for id in eventIDs {
                group.addTask { (id, (try? await self.registrationCount(eventID: id)) ?? 0) }
            }
            var out: [UUID: Int] = [:]
            for await (id, count) in group { out[id] = count }
            return out
        }
    }
}
