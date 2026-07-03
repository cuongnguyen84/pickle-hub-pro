import Foundation

// ============================================================================
// SocialStandings — BXH cho màn Live sự kiện giao lưu.
// Port `src/lib/social-events/standings.ts` (computeStandings +
// seedStandingsWithRoster). Chỉ trận `completed` có đủ 2 tỉ số mới tính;
// hoà → không cộng thắng/thua nhưng point diff vẫn đúng.
// ============================================================================

struct StandingRow: Identifiable, Equatable {
    let playerID: String
    var wins = 0
    var losses = 0
    var matchesPlayed = 0
    var pointsFor = 0
    var pointsAgainst = 0
    var pointDiff: Int { pointsFor - pointsAgainst }
    var id: String { playerID }
}

enum SocialStandings {

    static func compute(_ matches: [SocialLiveMatch]) -> [StandingRow] {
        var map: [String: StandingRow] = [:]
        func row(_ id: String) -> StandingRow { map[id] ?? StandingRow(playerID: id) }

        for m in matches {
            guard m.status == "completed", let scoreA = m.teamAScore, let scoreB = m.teamBScore else { continue }
            let teamA = [m.teamAPlayer1ID, m.teamAPlayer2ID].compactMap { $0?.uuidString.lowercased() }
            let teamB = [m.teamBPlayer1ID, m.teamBPlayer2ID].compactMap { $0?.uuidString.lowercased() }
            guard !teamA.isEmpty, !teamB.isEmpty else { continue }
            let aWin = m.winningTeam == "a", bWin = m.winningTeam == "b"

            for id in teamA {
                var r = row(id)
                r.matchesPlayed += 1; r.pointsFor += scoreA; r.pointsAgainst += scoreB
                if aWin { r.wins += 1 } else if bWin { r.losses += 1 }
                map[id] = r
            }
            for id in teamB {
                var r = row(id)
                r.matchesPlayed += 1; r.pointsFor += scoreB; r.pointsAgainst += scoreA
                if bWin { r.wins += 1 } else if aWin { r.losses += 1 }
                map[id] = r
            }
        }

        return map.values.sorted {
            if $0.wins != $1.wins { return $0.wins > $1.wins }
            if $0.pointDiff != $1.pointDiff { return $0.pointDiff > $1.pointDiff }
            if $0.matchesPlayed != $1.matchesPlayed { return $0.matchesPlayed > $1.matchesPlayed }
            return $0.playerID < $1.playerID
        }
    }

    /// Trộn BXH với roster để người chưa đấu vẫn hiện 0-0; tie-break cuối theo
    /// level giảm dần (hiển thị ban đầu = "mạnh nhất trước").
    static func seedWithRoster(_ base: [StandingRow], roster: [(profileID: String, level: Double?)]) -> [StandingRow] {
        let baseIDs = Set(base.map(\.playerID))
        var seeded = base
        for r in roster where !baseIDs.contains(r.profileID) {
            seeded.append(StandingRow(playerID: r.profileID))
        }
        let levelByID = Dictionary(roster.map { ($0.profileID, $0.level) }, uniquingKeysWith: { a, _ in a })
        return seeded.sorted {
            if $0.wins != $1.wins { return $0.wins > $1.wins }
            if $0.pointDiff != $1.pointDiff { return $0.pointDiff > $1.pointDiff }
            if $0.matchesPlayed != $1.matchesPlayed { return $0.matchesPlayed > $1.matchesPlayed }
            let la = levelByID[$0.playerID].flatMap { $0 } ?? -.infinity
            let lb = levelByID[$1.playerID].flatMap { $0 } ?? -.infinity
            if la != lb { return la > lb }
            return $0.playerID < $1.playerID
        }
    }
}
