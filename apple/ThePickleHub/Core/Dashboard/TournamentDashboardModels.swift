import Foundation

enum TournamentDashboardType: String, Decodable, CaseIterable, Hashable {
    case quickTable
    case teamMatch
    case doublesElimination

    var label: String {
        switch self {
        case .quickTable: "Quick Table"
        case .teamMatch: String(localized: "Đấu đồng đội")
        case .doublesElimination: String(localized: "Loại kép")
        }
    }

    var icon: String {
        switch self {
        case .quickTable: "tablecells"
        case .teamMatch: "person.3.fill"
        case .doublesElimination: "arrow.triangle.branch"
        }
    }
}

struct ActiveDashboardTournament: Identifiable, Equatable, Hashable {
    let id: UUID
    let shareID: String
    let name: String
    let type: TournamentDashboardType
}

struct TournamentDashboardMatch: Identifiable, Equatable, Hashable {
    let id: UUID
    let teamA: String
    let teamB: String
    let scoreA: Int?
    let scoreB: Int?
    let status: String
    let startTime: String?
    let displayOrder: Int
    let courtNumber: Int

    var isLive: Bool {
        status == "live" || status == "playing" || status == "in_progress"
            || (status == "pending" && max(scoreA ?? 0, scoreB ?? 0) > 0)
    }
    var isPending: Bool { status == "pending" || status == "lineup" }
}

struct TournamentCourt: Identifiable, Equatable, Hashable {
    let courtNumber: Int
    let liveMatch: TournamentDashboardMatch?
    let nextMatch: TournamentDashboardMatch?
    var id: Int { courtNumber }
}

struct TournamentDashboardSnapshot: Equatable {
    let tournament: ActiveDashboardTournament
    let matches: [TournamentDashboardMatch]
    let courtCount: Int

    var liveTeamMatches: [TournamentDashboardMatch] {
        matches.filter(\.isLive)
    }
    var nextTeamMatches: [TournamentDashboardMatch] {
        Array(matches.filter(\.isPending).prefix(5))
    }

    /// Same grouping rule as the production web dashboard: first live and first
    /// pending match on every numbered court.
    var courts: [TournamentCourt] {
        guard tournament.type != .teamMatch else { return [] }
        let grouped = Dictionary(grouping: matches) { $0.courtNumber }
        let highest = grouped.keys.filter { $0 > 0 }.max() ?? 0
        let count = max(1, courtCount, highest)
        return (1...count).map { number in
            let ordered = (grouped[number] ?? []).sorted { $0.displayOrder < $1.displayOrder }
            let live = ordered.first(where: \.isLive)
            let next = ordered.first { $0.isPending && $0.id != live?.id }
            return TournamentCourt(courtNumber: number, liveMatch: live, nextMatch: next)
        }
    }
}
