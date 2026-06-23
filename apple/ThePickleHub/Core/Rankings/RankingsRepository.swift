import Foundation
import Supabase

/// Reads the live Vietnam DUPR leaderboard from the
/// `dupr_leaderboard_vietnam(p_format, p_limit)` RPC. (Global/continent scopes
/// are a static DUPR.com snapshot on the web — deferred for native.)
struct RankingsRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    enum Format: String, CaseIterable, Identifiable {
        case doubles, singles
        var id: String { rawValue }
        var label: String { self == .doubles ? "Đôi" : "Đơn" }
    }

    func vietnam(format: Format, limit: Int = 100) async throws -> [RankingRow] {
        struct Params: Encodable {
            let p_format: String
            let p_limit: Int
        }
        return try await client
            .rpc("dupr_leaderboard_vietnam", params: Params(p_format: format.rawValue, p_limit: limit))
            .execute()
            .value
    }
}
