import SwiftUI

/// Match result card — the densest feed type. Two team rows (winner
/// highlighted), per-game score cells, optional tournament line, and read-only
/// engagement counts. Kudos/comment interaction is deferred past Phase 2.
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
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(TLColor.fg2)
                    .lineLimit(2)
            }

            VStack(spacing: 8) {
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
        let tint: Color = badge.isVerified ? TLColor.green : (badge.isDisputed ? TLColor.gold : TLColor.fg3)
        return HStack(spacing: 5) {
            if badge.isVerified {
                Circle().fill(TLColor.green).frame(width: 6, height: 6)
            } else if badge.isDisputed {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 9))
            }
            Text(badge.label).font(.caption2.weight(.bold)).tracking(1)
        }
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
            VStack(alignment: .leading, spacing: 2) {
                if players.isEmpty {
                    Text("—").foregroundStyle(TLColor.fg3)
                }
                ForEach(players) { player in
                    HStack(spacing: 6) {
                        Text(player.resolvedName)
                            .font(.subheadline.weight(isWinner ? .bold : .medium))
                            .foregroundStyle(isWinner ? TLColor.fg : TLColor.fg2)
                            .lineLimit(1)
                        if let dupr = player.duprDoubles {
                            Text(String(format: "%.2f", dupr))
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(TLColor.fg4)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 6) {
                ForEach(Array(scores.enumerated()), id: \.offset) { _, value in
                    Text("\(value)")
                        .font(.system(.body, design: .monospaced).weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(isWinner ? TLColor.green : TLColor.fg3)
                        .frame(minWidth: 26)
                        .padding(.vertical, 4)
                        .background(
                            (isWinner ? TLColor.green.opacity(0.14) : TLColor.surface2),
                            in: RoundedRectangle(cornerRadius: 6, style: .continuous)
                        )
                }
            }
        }
    }

    // MARK: Footer

    private var footer: some View {
        HStack(spacing: 14) {
            if let venue = match.venueName?.nonEmpty {
                Label(venue, systemImage: "mappin.and.ellipse")
                    .font(.caption2)
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
            Text("\(count)").font(.caption2.weight(.semibold))
        }
        .foregroundStyle(TLColor.fg3)
        .opacity(count > 0 ? 1 : 0.5)
    }
}
