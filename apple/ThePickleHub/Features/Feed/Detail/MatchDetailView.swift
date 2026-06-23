import SwiftUI

/// Native match detail. All data already arrives on the feed card, so this
/// screen needs no extra fetch — it just presents the match richly. A secondary
/// link opens the web page (kudos/comments live there until those go native).
struct MatchDetailView: View {
    let match: FeedMatch
    let publishedAt: Date?

    @State private var showWeb = false

    private var teams: (teamA: [FeedParticipant], teamB: [FeedParticipant]) {
        FeedFormat.groupTeams(match.participants)
    }
    private var winnerIsA: Bool { match.winningTeam == "a" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                scoreboard
                meta
                if match.slug != nil {
                    webButton
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Trận đấu")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showWeb) {
            if let slug = match.slug {
                SafariView(url: WebRoutes.match(slug: slug)).ignoresSafeArea()
            }
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            FeedEyebrow {
                EyebrowText.time(publishedAt)
                EyebrowText.dot
                EyebrowText.label(FeedFormat.format(match.format))
                EyebrowText.dot
                EyebrowText.label(FeedFormat.matchType(match.matchType))
            }
            statusBadge
            if match.isTournament, let line = tournamentLine {
                Text(line)
                    .font(TLFont.serif(22))
                    .foregroundStyle(TLColor.fg)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var statusBadge: some View {
        let badge = FeedFormat.status(match.verificationStatus)
        let tint: Color = badge.isVerified ? TLColor.accentText : (badge.isDisputed ? TLColor.gold : TLColor.fg3)
        return HStack(spacing: 5) {
            if badge.isVerified { Circle().fill(TLColor.accentText).frame(width: 6, height: 6) }
            Text(badge.label).font(TLFont.mono(10, .semibold)).tracking(0.8)
        }
        .textCase(.uppercase)
        .foregroundStyle(tint)
        .padding(.horizontal, 8).padding(.vertical, 4)
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

    // MARK: Scoreboard

    private var scoreboard: some View {
        VStack(spacing: 14) {
            teamRow(players: teams.teamA, scores: match.teamAScore, isWinner: winnerIsA)
            Rectangle().fill(TLColor.border).frame(height: 1)
            teamRow(players: teams.teamB, scores: match.teamBScore, isWinner: !winnerIsA)
        }
        .feedCard()
    }

    private func teamRow(players: [FeedParticipant], scores: [Int], isWinner: Bool) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    if players.isEmpty { Text("—").font(TLFont.serif(22)).foregroundStyle(TLColor.fg3) }
                    ForEach(Array(players.enumerated()), id: \.offset) { index, player in
                        if index > 0 { Text("+").font(TLFont.serif(18)).foregroundStyle(TLColor.accentText) }
                        Text(player.resolvedName)
                            .font(TLFont.serif(22))
                            .foregroundStyle(isWinner ? TLColor.fg : TLColor.fg2)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
                ForEach(players) { player in
                    HStack(spacing: 6) {
                        if let handle = player.username?.nonEmpty {
                            Text("@\(handle)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                        }
                        if let dupr = player.duprDoubles {
                            Text("DUPR \(String(format: "%.2f", dupr))")
                                .font(TLFont.mono(10, .medium)).foregroundStyle(TLColor.accentText)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            ScoreCells(scores: scores, isWinner: isWinner, base: 34)
        }
    }

    // MARK: Meta + web

    private var meta: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let venue = match.venueName?.nonEmpty {
                Label(venue, systemImage: "mappin.and.ellipse")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
            }
            HStack(spacing: 16) {
                Label("\(match.kudosCount)", systemImage: "heart")
                Label("\(match.commentCount)", systemImage: "bubble.left")
            }
            .font(TLFont.mono(12, .medium))
            .foregroundStyle(TLColor.fg3)
        }
    }

    private var webButton: some View {
        Button { showWeb = true } label: {
            HStack(spacing: 6) {
                Text("Xem trên web")
                Image(systemName: "arrow.up.right")
            }
            .font(TLFont.sans(14, .semibold))
            .foregroundStyle(TLColor.fg2)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .overlay(
                RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                    .strokeBorder(TLColor.border2, lineWidth: 1)
            )
        }
    }
}
