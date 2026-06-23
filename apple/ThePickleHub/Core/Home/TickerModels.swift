import Foundation

/// One entry in the top results ticker. Built from recent feed matches so it
/// needs no extra query (the web ticker's "matches" mode shows the same data).
struct TickerItem: Identifiable, Equatable {
    let id: UUID
    let lead: String       // "KẾT QUẢ"
    let body: String       // "Nam / Hùng 11–7 Vũ / Sơn"
    let trail: String?     // tournament name

    static func from(_ item: FeedItem) -> TickerItem? {
        guard case .match(let match) = item.kind else { return nil }
        let teams = FeedFormat.groupTeams(match.participants)
        guard !teams.teamA.isEmpty, !teams.teamB.isEmpty else { return nil }

        let a = teams.teamA.map(\.resolvedName).joined(separator: " / ")
        let b = teams.teamB.map(\.resolvedName).joined(separator: " / ")
        let scoreA = match.teamAScore.last ?? 0
        let scoreB = match.teamBScore.last ?? 0

        return TickerItem(
            id: item.id,
            lead: "KẾT QUẢ",
            body: "\(a) \(scoreA)–\(scoreB) \(b)",
            trail: match.tournamentName?.nonEmpty
        )
    }
}
