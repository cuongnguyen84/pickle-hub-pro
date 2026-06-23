import Foundation
import Supabase

/// Reads pro tournaments from the `tournaments` table (all public). Community
/// brackets (quick tables / elimination / flex / team) span several sources and
/// are deferred for native.
struct TournamentsRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func list() async throws -> [Tournament] {
        try await client
            .from("tournaments")
            .select("id, name, slug, start_date, end_date, status, description, organization:organizations(name, slug, logo_url)")
            .order("start_date", ascending: false)
            .execute()
            .value
    }
}
