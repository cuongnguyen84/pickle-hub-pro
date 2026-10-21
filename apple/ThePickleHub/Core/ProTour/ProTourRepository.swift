import Foundation
import Supabase

protocol ProTourRepositoryProtocol: Sendable {
    func events(forceRefresh: Bool) async throws -> [ProTourEvent]
    func results(for event: ProTourEvent) async throws -> ProResults
}

actor ProTourRegistryCache {
    static let shared = ProTourRegistryCache()

    private var value: [ProTourEvent] = []
    private var fetchedAt: Date?

    func events(
        forceRefresh: Bool,
        loader: @Sendable () async throws -> [ProTourEvent]
    ) async throws -> [ProTourEvent] {
        if !forceRefresh,
           let fetchedAt,
           Date().timeIntervalSince(fetchedAt) < 300 {
            return value
        }
        let fresh = try await loader()
        value = fresh
        fetchedAt = Date()
        return fresh
    }
}

struct ProTourRepository: ProTourRepositoryProtocol {
    static let resultsSelect = "id,slug,tournament_name,tournament_event,round_name,team_a_score,team_b_score,winning_team,played_at,court_number,notes,match_participants(team,position,profile:profiles!match_participants_player_id_fkey(display_name,username))"

    private var client: SupabaseClient { SupabaseManager.shared.client }

    func events(forceRefresh: Bool = false) async throws -> [ProTourEvent] {
        try await ProTourRegistryCache.shared.events(forceRefresh: forceRefresh) {
            try await client.from("pro_tour_events")
                .select()
                .order("start_date", ascending: false)
                .limit(100)
                .execute().value
        }
    }

    func results(for event: ProTourEvent) async throws -> ProResults {
        let rows: [ProResultRow] = try await client.from("matches")
            .select(Self.resultsSelect)
            .eq("source_provider", value: "ppa_tour")
            .eq("is_public", value: true)
            .ilike("tournament_name", pattern: event.namePattern)
            .order("played_at", ascending: false)
            .limit(1_000)
            .execute().value
        return ProResultsLogic.group(rows)
    }
}
