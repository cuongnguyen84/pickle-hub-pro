import SwiftUI

@Observable
final class ClubDetailViewModel {
    enum Phase: Equatable { case loading, loaded(Club), failed(String) }
    var phase: Phase = .loading
    var membership: ClubMembership = .anonymous
    var events: [ClubEvent] = []
    var matches: [ClubMatch] = []
    var members: [ClubMember] = []
    var uid: UUID?
    var busy = false

    private let repo = ClubRepository()

    var upcoming: [ClubEvent] {
        let now = Date()
        return events.filter { ($0.startDate ?? .distantPast) >= now && $0.status != "cancelled" }
    }

    @MainActor
    func load(slug: String) async {
        do {
            let club = try await repo.club(slug: slug)
            uid = await repo.currentUserID()
            phase = .loaded(club)
            async let m = repo.membership(clubID: club.id)
            async let ev = repo.events(clubID: club.id)
            async let ma = repo.matches(clubID: club.id)
            async let mem = repo.members(clubID: club.id)
            membership = await m
            events = await ev
            matches = await ma
            members = await mem
        } catch { phase = .failed(error.localizedDescription) }
    }

    @MainActor
    func join() async {
        guard case .loaded(let club) = phase else { return }
        busy = true
        membership = ((try? await repo.requestJoin(clubID: club.id)) ?? membership)
        Haptics.success(); busy = false
    }

    @MainActor
    func leave() async {
        guard case .loaded(let club) = phase, let uid else { return }
        busy = true
        try? await repo.leave(clubID: club.id, profileID: uid)
        membership = .none
        members = await repo.members(clubID: club.id)
        busy = false
    }
}

/// Club detail (`/clb/:slug`) — identity, DUPR-link badge, stats, membership
/// action, upcoming events, recent matches, members. Port of web ClubLanding.
struct ClubDetailView: View {
    let slug: String
    let fallbackName: String

    @State private var model = ClubDetailViewModel()
    @State private var openWeb: IdentifiedURL?

    var body: some View {
        ScrollView {
            content.padding(.horizontal, 18).padding(.top, 6).padding(.bottom, 32)
        }
        .background(TLColor.bg)
        .navigationTitle(fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .task { if case .loading = model.phase { await model.load(slug: slug) } }
        .sheet(item: $openWeb) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 80)
        case .failed(let message):
            errorState(message)
        case .loaded(let club):
            VStack(alignment: .leading, spacing: 22) {
                identity(club)
                duprBadge
                statsRow
                membershipRow(club)
                if !model.upcoming.isEmpty { eventsBlock }
                if !model.matches.isEmpty { matchesBlock }
                if !model.members.isEmpty { membersBlock }
            }
        }
    }

    private func identity(_ club: Club) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ClubLogo(url: club.logoURLResolved, initials: club.initials, size: 64)
            VStack(alignment: .leading, spacing: 6) {
                Text(club.name).font(TLFont.serif(28)).foregroundStyle(TLColor.fg)
                    .fixedSize(horizontal: false, vertical: true)
                if let loc = club.locationText?.nonEmpty {
                    Label(loc, systemImage: "mappin.and.ellipse").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var duprBadge: some View {
        HStack(spacing: 6) {
            Circle().fill(TLColor.accent).frame(width: 5, height: 5)
            Text("LIÊN KẾT DUPR · TRẬN TÍNH HỆ SỐ CAO")
                .font(TLFont.mono(9.5, .bold)).tracking(0.5).foregroundStyle(TLColor.accentText)
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(TLColor.accent.opacity(0.1), in: Capsule())
        .overlay(Capsule().strokeBorder(TLColor.accent.opacity(0.28), lineWidth: 1))
    }

    private var statsRow: some View {
        HStack(spacing: 0) {
            stat("\(model.members.count)", "THÀNH VIÊN")
            divider
            stat("\(model.upcoming.count)", "SỰ KIỆN")
            divider
            stat("\(model.matches.count)", "TRẬN ĐÃ GHI")
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(TLFont.mono(20, .bold)).foregroundStyle(TLColor.fg)
            Text(label).font(TLFont.mono(9)).tracking(0.6).foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 13)
    }
    private var divider: some View { Rectangle().fill(TLColor.border).frame(width: 1, height: 44) }

    @ViewBuilder
    private func membershipRow(_ club: Club) -> some View {
        HStack(spacing: 9) {
            Button { Haptics.light(); openWeb = IdentifiedURL(url: WebRoutes.base.appending(path: "clb/\(club.slug)")) } label: {
                Label("Mở buổi chơi", systemImage: "plus")
                    .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
            }.buttonStyle(.plain)
            membershipButton(club)
        }
    }

    @ViewBuilder
    private func membershipButton(_ club: Club) -> some View {
        switch model.membership {
        case .manager, .creator:
            NavigationLink { ClubManageView(club: club) } label: {
                Text("Quản trị")
                    .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentText)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(TLColor.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
            }.buttonStyle(.plain)
        case .active:
            Button { Haptics.light(); Task { await model.leave() } } label: {
                Text("Đã tham gia ✓")
                    .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg2)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border2, lineWidth: 1))
            }
            .buttonStyle(.plain).disabled(model.busy)
        case .pending:
            Text("Đang chờ duyệt").font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.gold)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(TLColor.gold.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.gold.opacity(0.3), lineWidth: 1))
        case .none, .anonymous:
            Button { Haptics.light(); Task { await joinOrLogin(club) } } label: {
                Text("Tham gia").font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentText)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(TLColor.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
            }.buttonStyle(.plain).disabled(model.busy)
        }
    }

    private func joinOrLogin(_ club: Club) async {
        if model.uid == nil {
            openWeb = IdentifiedURL(url: WebRoutes.base.appending(path: "login"))
        } else {
            await model.join()
        }
    }

    // MARK: Events

    private var eventsBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("SỰ KIỆN SẮP TỚI", trailing: nil)
            VStack(spacing: 11) { ForEach(model.upcoming) { ClubEventRow(event: $0) } }
        }
    }

    // MARK: Matches

    private var matchesBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("TRẬN ĐẤU GẦN ĐÂY", trailing: nil)
            VStack(spacing: 11) { ForEach(model.matches.prefix(8)) { ClubMatchCard(match: $0) } }
        }
    }

    // MARK: Members

    private var membersBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("THÀNH VIÊN · \(model.members.count)", trailing: nil)
            HStack(spacing: -10) {
                ForEach(model.members.prefix(6)) { member in
                    Circle().fill(LinearGradient(colors: [TLColor.surface2, TLColor.surface], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 38, height: 38)
                        .overlay(Text(member.initials).font(TLFont.sans(11, .semibold)).foregroundStyle(TLColor.fg2))
                        .overlay(Circle().strokeBorder(TLColor.bg, lineWidth: 2))
                }
                if model.members.count > 6 {
                    Circle().fill(TLColor.surface2).frame(width: 38, height: 38)
                        .overlay(Text("+\(model.members.count - 6)").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText))
                        .overlay(Circle().strokeBorder(TLColor.bg, lineWidth: 2))
                }
            }
        }
    }

    private func sectionHeader(_ title: String, trailing: String?) -> some View {
        HStack(spacing: 10) {
            Text(title).font(TLFont.mono(11, .semibold)).tracking(1.5).foregroundStyle(TLColor.fg2)
            Rectangle().fill(LinearGradient(colors: [TLColor.border, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1)
            if let trailing { Text(trailing).font(TLFont.mono(10, .bold)).foregroundStyle(TLColor.accentText) }
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "person.3.sequence").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được CLB").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(slug: slug) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

// MARK: - Club event row (drills into the event)

private struct ClubEventRow: View {
    let event: ClubEvent

    var body: some View {
        NavigationLink { EventBySlugView(slug: event.slug, fallbackTitle: event.title) } label: {
            HStack(spacing: 13) {
                dateTile
                Rectangle().fill(TLColor.border).frame(width: 1, height: 40)
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(2)
                    Text(metaLine).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3).lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(TLColor.fg4)
            }
            .padding(13)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var dateTile: some View {
        let comps: (String, String, String) = {
            guard let d = event.startDate else { return ("", "—", "") }
            let cal = Calendar.current
            let wd = DateFormatter(); wd.locale = Locale(identifier: "vi_VN"); wd.dateFormat = "EEE"
            let day = String(cal.component(.day, from: d))
            let mon = String(format: "%02d", cal.component(.month, from: d))
            return (wd.string(from: d).uppercased(), day, mon)
        }()
        return VStack(spacing: 1) {
            Text(comps.0).font(TLFont.mono(9)).foregroundStyle(TLColor.fg3)
            Text(comps.1).font(TLFont.sans(22, .bold)).foregroundStyle(TLColor.fg)
            Text(comps.2).font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
        }
        .frame(width: 46)
    }

    private var metaLine: String {
        var parts: [String] = []
        if let d = event.startDate {
            let f = DateFormatter(); f.locale = Locale(identifier: "vi_VN"); f.dateFormat = "HH:mm"
            parts.append(f.string(from: d))
        }
        if let max = event.maxPlayers { parts.append("\(max) chỗ") }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Club match card (scores prominent, DUPR badge secondary)

struct ClubMatchCard: View {
    let match: ClubMatch

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text(metaLabel).font(TLFont.mono(9.5)).tracking(0.4).foregroundStyle(TLColor.fg3)
                Spacer()
                duprBadge
            }
            teamRow(label: match.teamALabel, scores: match.teamAScore, winner: match.winningTeam == "a")
            teamRow(label: match.teamBLabel, scores: match.teamBScore, winner: match.winningTeam == "b")
        }
        .padding(.horizontal, 14).padding(.vertical, 13)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var metaLabel: String {
        var parts: [String] = []
        if let d = match.playedDate {
            let f = DateFormatter(); f.locale = Locale(identifier: "vi_VN"); f.dateFormat = "dd/MM HH:mm"
            parts.append(f.string(from: d))
        }
        parts.append(match.formatLabel)
        return parts.joined(separator: " · ")
    }

    private func teamRow(label: String, scores: [Int], winner: Bool) -> some View {
        HStack(spacing: 10) {
            if winner {
                Image(systemName: "checkmark").font(.system(size: 11, weight: .heavy)).foregroundStyle(TLColor.accentText)
            } else {
                Spacer().frame(width: 14)
            }
            Text(label).font(TLFont.sans(14, winner ? .semibold : .regular))
                .foregroundStyle(winner ? TLColor.fg : TLColor.fg3).lineLimit(1)
            Spacer(minLength: 8)
            HStack(spacing: 9) {
                ForEach(Array(scores.enumerated()), id: \.offset) { i, s in
                    Text("\(s)").font(TLFont.mono(15, .bold)).monospacedDigit()
                        .foregroundStyle(gameWon(i) ? TLColor.accentText : TLColor.fg4)
                        .frame(width: 17)
                }
            }
        }
    }

    private func gameWon(_ i: Int) -> Bool {
        guard i < match.teamAScore.count, i < match.teamBScore.count else { return false }
        return match.teamAScore[i] != match.teamBScore[i]
            ? ((match.winningTeam == "a") == (match.teamAScore[i] > match.teamBScore[i]))
            : false
    }

    @ViewBuilder
    private var duprBadge: some View {
        switch match.duprState {
        case .submitted: badge("ĐÃ GỬI DUPR", color: TLColor.accentText, bg: TLColor.accent.opacity(0.1))
        case .ready: badge("SẴN SÀNG GỬI", color: TLColor.gold, bg: TLColor.gold.opacity(0.1))
        case .draft: badge("NHÁP", color: TLColor.fg3, bg: .clear)
        }
    }

    private func badge(_ text: String, color: Color, bg: Color) -> some View {
        Text(text).font(TLFont.mono(8.5, .bold)).tracking(0.5).foregroundStyle(color)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(bg, in: RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(color.opacity(0.3), lineWidth: 1))
    }
}

// MARK: - Event loader (drill-in by slug from a club page)

struct EventBySlugView: View {
    let slug: String
    let fallbackTitle: String

    @State private var event: SocialEvent?
    @State private var failed = false
    private let repo = SocialRepository()

    var body: some View {
        Group {
            if let event {
                SocialDetailView(event: event)
            } else if failed {
                VStack(spacing: 10) {
                    Image(systemName: "calendar.badge.exclamationmark").font(.largeTitle).foregroundStyle(TLColor.fg3)
                    Text("Không tải được buổi chơi").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity).background(TLColor.bg)
            } else {
                ZStack { TLColor.bg.ignoresSafeArea(); ProgressView().tint(TLColor.accentText) }
            }
        }
        .navigationTitle(fallbackTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do { event = try await repo.event(slug: slug) } catch { failed = true }
        }
    }
}
