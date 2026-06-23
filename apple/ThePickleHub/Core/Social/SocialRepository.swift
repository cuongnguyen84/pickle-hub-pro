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
}
