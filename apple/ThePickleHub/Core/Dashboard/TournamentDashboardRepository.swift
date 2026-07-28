import Foundation
import Supabase

/// Active-tournament picker and court snapshots used by the native TV dashboard.
struct TournamentDashboardRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private struct Row: Decodable {
        let id: UUID
        let name: String
        let shareID: String
        enum CodingKeys: String, CodingKey {
            case id, name
            case shareID = "share_id"
        }
    }

    func activeTournaments() async -> [ActiveDashboardTournament] {
        async let quick = active(
            table: "quick_tables",
            statuses: ["group_stage", "playoff"],
            type: .quickTable
        )
        async let team = active(
            table: "team_match_tournaments",
            statuses: ["ongoing"],
            type: .teamMatch
        )
        async let doubles = active(
            table: "doubles_elimination_tournaments",
            statuses: ["active", "ongoing"],
            type: .doublesElimination
        )
        return await (quick + team + doubles).sorted {
            if $0.type != $1.type { return $0.type.rawValue < $1.type.rawValue }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private func active(table: String, statuses: [String],
                        type: TournamentDashboardType) async -> [ActiveDashboardTournament] {
        do {
            let rows: [Row] = try await client.from(table)
                .select("id, name, share_id")
                .in("status", values: statuses)
                .execute().value
            return rows.map {
                ActiveDashboardTournament(id: $0.id, shareID: $0.shareID, name: $0.name, type: type)
            }
        } catch {
            return []
        }
    }

    func load(_ tournament: ActiveDashboardTournament) async throws -> TournamentDashboardSnapshot {
        switch tournament.type {
        case .quickTable:
            let detail = try await QuickTableRepository().load(shareID: tournament.shareID)
            let matches = detail.matches
                .filter { !$0.isCompleted }
                .sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) }
                .map {
                    TournamentDashboardMatch(
                        id: $0.id,
                        teamA: detail.name(for: $0.player1ID).dashboardName,
                        teamB: detail.name(for: $0.player2ID).dashboardName,
                        scoreA: $0.score1,
                        scoreB: $0.score2,
                        status: $0.status,
                        startTime: $0.startAt,
                        displayOrder: $0.displayOrder ?? 0,
                        courtNumber: $0.courtID ?? 0
                    )
                }
            return TournamentDashboardSnapshot(
                tournament: tournament,
                matches: matches,
                courtCount: detail.table.courts?.count ?? 0
            )

        case .doublesElimination:
            let detail = try await DoublesElimRepository().load(shareID: tournament.shareID)
            let matches = detail.matches
                .filter { !$0.isCompleted }
                .sorted { $0.displayOrder < $1.displayOrder }
                .map {
                    TournamentDashboardMatch(
                        id: $0.id,
                        teamA: detail.teamLabel($0.teamAID).dashboardName,
                        teamB: detail.teamLabel($0.teamBID).dashboardName,
                        scoreA: $0.scoreA,
                        scoreB: $0.scoreB,
                        status: $0.status,
                        startTime: $0.startTime,
                        displayOrder: $0.displayOrder,
                        courtNumber: $0.courtNumber ?? 0
                    )
                }
            return TournamentDashboardSnapshot(
                tournament: tournament,
                matches: matches,
                courtCount: detail.tournament.courtCount
            )

        case .teamMatch:
            let detail = try await TeamMatchRepository().load(shareID: tournament.shareID)
            let matches = detail.matches
                .filter { ["in_progress", "pending", "lineup"].contains($0.status ?? "") }
                .sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) }
                .map {
                    TournamentDashboardMatch(
                        id: $0.id,
                        teamA: detail.teamName($0.teamAID).dashboardName,
                        teamB: detail.teamName($0.teamBID).dashboardName,
                        scoreA: $0.gamesWonA,
                        scoreB: $0.gamesWonB,
                        status: $0.status == "in_progress" ? "live" : ($0.status ?? "pending"),
                        startTime: nil,
                        displayOrder: $0.displayOrder ?? 0,
                        courtNumber: 0
                    )
                }
            return TournamentDashboardSnapshot(tournament: tournament, matches: matches, courtCount: 0)
        }
    }
}

private extension String {
    var dashboardName: String {
        self == "—" || isEmpty ? "TBD" : self
    }
}
