import SwiftUI

/// Match result card — the densest feed type. Serif player names (winner
/// highlighted), large lime/gray per-game score numerals, optional tournament
/// line, status badge, and read-only engagement. Mirrors the web FeedMatchCard.
struct FeedMatchCard: View {
    let match: FeedMatch
    let publishedAt: Date?

    @State private var expanded = false

    private var teams: (teamA: [FeedParticipant], teamB: [FeedParticipant]) {
        FeedFormat.groupTeams(match.participants)
    }
    private var winnerIsA: Bool { match.winningTeam == "a" }
    private var gameCount: Int { max(match.teamAScore.count, match.teamBScore.count) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            FeedEyebrow {
                EyebrowText.time(publishedAt)
                EyebrowText.dot
                EyebrowText.label(FeedFormat.format(match.format))
                EyebrowText.dot
                EyebrowText.label(FeedFormat.matchType(match.matchType))
            }

            statusBadge

            if match.isTournament, let tournamentLine {
                Text(tournamentLine)
                    .font(TLFont.sans(13, .medium))
                    .foregroundStyle(TLColor.fg2)
                    .lineLimit(2)
            }

            VStack(spacing: 10) {
                teamRow(players: teams.teamA, scores: match.teamAScore, isWinner: winnerIsA)
                Rectangle().fill(TLColor.border).frame(height: 1)
                teamRow(players: teams.teamB, scores: match.teamBScore, isWinner: !winnerIsA)
            }

            if let mlp = match.mlpNotes {
                detailToggle
                if expanded { mlpBreakdown(mlp) }
            } else if gameCount > 0 {
                detailToggle
                if expanded { gameBreakdown }
            }

            footer
        }
        .feedCard()
    }

    // MARK: Per-game detail (inline dropdown)

    private var detailToggle: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
        } label: {
            HStack(spacing: 4) {
                Text(expanded ? "Ẩn chi tiết" : "Chi tiết từng ván")
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 9, weight: .bold))
            }
            .font(TLFont.mono(10, .semibold)).tracking(0.6).textCase(.uppercase)
            .foregroundStyle(TLColor.accentText)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var gameBreakdown: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Text(teamNames(teams.teamA))
                    .foregroundStyle(winnerIsA ? TLColor.accentText : TLColor.fg2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(teamNames(teams.teamB))
                    .foregroundStyle(winnerIsA ? TLColor.fg2 : TLColor.accentText)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .multilineTextAlignment(.trailing)
            }
            .font(TLFont.mono(10, .semibold))
            .padding(.vertical, 9)
            Rectangle().fill(TLColor.border).frame(height: 1)

            ForEach(0..<gameCount, id: \.self) { index in
                let a = score(match.teamAScore, index)
                let b = score(match.teamBScore, index)
                HStack {
                    Text("Ván \(index + 1)")
                        .font(TLFont.mono(11, .medium))
                        .foregroundStyle(TLColor.fg3)
                    Spacer()
                    HStack(spacing: 10) {
                        Text("\(a)")
                            .foregroundStyle(a >= b ? TLColor.accentText : TLColor.fg3)
                        Text("–").foregroundStyle(TLColor.fg4)
                        Text("\(b)")
                            .foregroundStyle(b > a ? TLColor.accentText : TLColor.fg3)
                    }
                    .font(TLFont.mono(14, .semibold))
                    .monospacedDigit()
                }
                .padding(.vertical, 8)
                if index < gameCount - 1 {
                    Rectangle().fill(TLColor.border).frame(height: 1)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 2)
        .background(TLColor.bg, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
    }

    // MARK: MLP per-game breakdown (different lineup each game)

    /// Vietnamese long labels for MLP game slots, mirroring web GAME_LABEL_LONG.
    private static let mlpGameLabels: [String: String] = [
        "WD": "Đôi nữ",
        "MD": "Đôi nam",
        "MXD1": "Đôi nam nữ 1",
        "MXD2": "Đôi nam nữ 2",
        "DB": "Dreambreaker",
    ]

    private func mlpBreakdown(_ mlp: MlpMatchupNotes) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Text(mlp.teamA.name)
                    .foregroundStyle(winnerIsA ? TLColor.accentText : TLColor.fg2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(mlp.teamB.name)
                    .foregroundStyle(winnerIsA ? TLColor.fg2 : TLColor.accentText)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .multilineTextAlignment(.trailing)
            }
            .font(TLFont.mono(10, .semibold))
            .padding(.vertical, 9)
            Rectangle().fill(TLColor.border).frame(height: 1)

            ForEach(Array(mlp.games.enumerated()), id: \.offset) { index, game in
                mlpGameRow(game)
                if index < mlp.games.count - 1 {
                    Rectangle().fill(TLColor.border).frame(height: 1)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 2)
        .background(TLColor.bg, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
    }

    private func mlpGameRow(_ game: MlpMatchupNotes.Game) -> some View {
        let aWon = game.winner == "a"
        let bWon = game.winner == "b"
        let label = Self.mlpGameLabels[game.label] ?? game.label
        return VStack(alignment: .leading, spacing: 6) {
            Text("\(game.label) · \(label)")
                .font(TLFont.mono(9, .medium)).tracking(0.6).textCase(.uppercase)
                .foregroundStyle(TLColor.fg4)

            mlpSide(players: game.playersA, score: game.scoreA, isWinner: aWon)
            mlpSide(players: game.playersB, score: game.scoreB, isWinner: bWon)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 9)
    }

    private func mlpSide(players: [String], score: Int, isWinner: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(players.isEmpty ? "—" : players.joined(separator: " / "))
                .font(TLFont.serif(15))
                .foregroundStyle(isWinner ? TLColor.fg : TLColor.fg2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(2)
            Text("\(score)")
                .font(TLFont.mono(14, .semibold))
                .monospacedDigit()
                .foregroundStyle(isWinner ? TLColor.accentText : TLColor.fg3)
        }
    }

    private func score(_ scores: [Int], _ index: Int) -> Int {
        index < scores.count ? scores[index] : 0
    }

    private func teamNames(_ players: [FeedParticipant]) -> String {
        players.isEmpty ? "—" : players.map(\.resolvedName).joined(separator: " / ")
    }

    // MARK: Status

    private var statusBadge: some View {
        let badge = FeedFormat.status(match.verificationStatus)
        let tint: Color = badge.isVerified ? TLColor.accentText : (badge.isDisputed ? TLColor.gold : TLColor.fg3)
        return HStack(spacing: 5) {
            if badge.isVerified {
                Circle().fill(TLColor.accentText).frame(width: 6, height: 6)
            } else if badge.isDisputed {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 9))
            }
            Text(badge.label).font(TLFont.mono(10, .semibold)).tracking(0.8)
        }
        .textCase(.uppercase)
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(tint.opacity(0.12), in: Capsule())
    }

    private var tournamentLine: String? {
        let parts = [match.tournamentName, match.tournamentEvent, roundLabel].compactMap { $0?.nonEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var roundLabel: String? {
        guard let round = match.roundName?.nonEmpty else { return nil }
        if round == "F" || round.uppercased() == "FINAL" { return "Chung kết" }
        return round
    }

    // MARK: Team row

    private func teamRow(players: [FeedParticipant], scores: [Int], isWinner: Bool) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                names(players, isWinner: isWinner)
                handles(players)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            scoreboard(scores, isWinner: isWinner)
        }
    }

    @ViewBuilder
    private func names(_ players: [FeedParticipant], isWinner: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
            if players.isEmpty {
                Text("—").font(TLFont.serif(20)).foregroundStyle(TLColor.fg3)
            }
            ForEach(Array(players.enumerated()), id: \.offset) { index, player in
                if index > 0 {
                    Text("+").font(TLFont.serif(17)).foregroundStyle(TLColor.accentText)
                }
                Text(player.resolvedName)
                    .font(TLFont.serif(20))
                    .foregroundStyle(isWinner ? TLColor.fg : TLColor.fg2)
                    .lineLimit(1)
            }
        }
    }

    @ViewBuilder
    private func handles(_ players: [FeedParticipant]) -> some View {
        let withHandle = players.filter { $0.username?.nonEmpty != nil }
        if !withHandle.isEmpty {
            HStack(spacing: 0) {
                ForEach(Array(withHandle.enumerated()), id: \.element.id) { index, player in
                    if index > 0 {
                        Text("  ·  ").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                    }
                    handleView(player)
                }
            }
            .lineLimit(1)
        }
    }

    /// Real users get a tappable lime handle that pushes their native profile;
    /// ghost rows (imported pros, MLP team logos) stay dim and inert since they
    /// have no public profile to open.
    @ViewBuilder
    private func handleView(_ player: FeedParticipant) -> some View {
        let username = player.username ?? ""
        if player.isGhost == true {
            Text("@\(username)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
        } else {
            NavigationLink {
                PlayerProfileView(username: username)
            } label: {
                Text("@\(username)").font(TLFont.mono(10)).foregroundStyle(TLColor.accentText)
            }
            .buttonStyle(.plain)
        }
    }

    private func scoreboard(_ scores: [Int], isWinner: Bool) -> some View {
        ScoreCells(scores: scores, isWinner: isWinner, base: 30)
    }

    // MARK: Footer

    private var footer: some View {
        HStack(spacing: 14) {
            if let venue = match.venueName?.nonEmpty {
                Label(venue, systemImage: "mappin.and.ellipse")
                    .font(TLFont.mono(10))
                    .foregroundStyle(TLColor.fg3)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            engagement(icon: "heart", count: match.kudosCount)
            engagement(icon: "bubble.left", count: match.commentCount)
        }
    }

    private func engagement(icon: String, count: Int) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 11))
            Text("\(count)").font(TLFont.mono(10, .medium))
        }
        .foregroundStyle(TLColor.fg3)
        .opacity(count > 0 ? 1 : 0.5)
    }
}
