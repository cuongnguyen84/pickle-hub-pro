import Foundation
import Supabase

/// Reads recent public Bracket Lab tables for the Tools hub. Brackets are
/// created and scored on the web, so this is read-only.
struct ToolsRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    /// Recent public quick tables, newest first (any status).
    func recentTables(limit: Int = 12) async throws -> [QuickTableSummary] {
        try await client
            .from("quick_tables")
            .select("id, share_id, name, is_doubles, player_count, status")
            .eq("is_public", value: true)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }
}
