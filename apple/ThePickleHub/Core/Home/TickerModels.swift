import Foundation

/// One entry in the top results ticker. Built from recent feed matches so it
/// needs no extra query (the web ticker's "matches" mode shows the same data).
struct TickerItem: Identifiable, Equatable {
    enum Kind: Equatable { case live, result, upcoming }

    let id: UUID
    let kind: Kind
    let lead: String
    let body: String
    let trail: String?

    static func from(_ item: FeedItem) -> TickerItem? {
        guard case .match(let match) = item.kind else { return nil }
        if let mlp = match.mlpNotes {
            let winnerIsB = match.winningTeam == "b"
            let left = winnerIsB ? mlp.teamB : mlp.teamA
            let right = winnerIsB ? mlp.teamA : mlp.teamB
            return TickerItem(
                id: item.id,
                kind: .result,
                lead: [match.tournamentName, match.roundName].compactMap { $0?.nonEmpty }.joined(separator: " · "),
                body: "\(left.name) \(left.matchupWins):\(right.matchupWins) \(right.name)",
                trail: nil
            )
        }

        let teams = FeedFormat.groupTeams(match.participants)
        guard !teams.teamA.isEmpty, !teams.teamB.isEmpty else { return nil }

        let a = teams.teamA.map(\.resolvedName).joined(separator: " / ")
        let b = teams.teamB.map(\.resolvedName).joined(separator: " / ")
        let gameWins = zip(match.teamAScore, match.teamBScore).reduce(into: (a: 0, b: 0)) { wins, score in
            if score.0 > score.1 { wins.a += 1 }
            if score.1 > score.0 { wins.b += 1 }
        }
        let winnerIsB = match.winningTeam == "b"
        let left = winnerIsB ? b : a
        let right = winnerIsB ? a : b
        let leftWins = winnerIsB ? gameWins.b : gameWins.a
        let rightWins = winnerIsB ? gameWins.a : gameWins.b

        return TickerItem(
            id: item.id,
            kind: .result,
            lead: "KẾT QUẢ",
            body: "\(left) \(leftWins):\(rightWins) \(right)",
            trail: match.tournamentName?.nonEmpty
        )
    }

    static func from(_ stream: LivestreamSummary, kind: Kind) -> TickerItem {
        TickerItem(
            id: stream.id,
            kind: kind,
            lead: kind == .live ? "TRỰC TIẾP" : "SẮP TỚI",
            body: stream.displayTitle,
            trail: stream.orgName
        )
    }
}
