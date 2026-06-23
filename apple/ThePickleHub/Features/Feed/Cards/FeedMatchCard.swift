import SwiftUI

/// Match result card — the densest feed type. Serif player names (winner
/// highlighted), large lime/gray per-game score numerals, optional tournament
/// line, status badge, and read-only engagement. Mirrors the web FeedMatchCard.
struct FeedMatchCard: View {
    let match: FeedMatch
    let publishedAt: Date?

    private var teams: (teamA: [FeedParticipant], teamB: [FeedParticipant]) {
        FeedFormat.groupTeams(match.participants)
    }
    private var winnerIsA: Bool { match.winningTeam == "a" }

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

            footer
        }
        .feedCard()
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
        let handles = players.compactMap { p in p.username?.nonEmpty.map { "@\($0)" } }
        if !handles.isEmpty {
            Text(handles.joined(separator: "  ·  "))
                .font(TLFont.mono(10))
                .foregroundStyle(TLColor.fg4)
                .lineLimit(1)
        }
    }

    private func scoreboard(_ scores: [Int], isWinner: Bool) -> some View {
        HStack(spacing: 12) {
            ForEach(Array(scores.enumerated()), id: \.offset) { index, value in
                if index > 0 {
                    Rectangle().fill(TLColor.border).frame(width: 1, height: 26)
                }
                Text("\(value)")
                    .font(TLFont.mono(30, .semibold))
                    .foregroundStyle(isWinner ? TLColor.accentText : TLColor.fg3)
            }
        }
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
