import SwiftUI

@Observable
final class SocialEventsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var events: [SocialEvent] = []
    var counts: [UUID: Int] = [:]
    private let repo = SocialRepository()

    /// Events grouped by day, in chronological order, with a localized section label.
    var groups: [(label: String, events: [SocialEvent])] {
        let cal = Calendar.current
        let withDates = events.compactMap { e -> (Date, SocialEvent)? in e.startDate.map { ($0, e) } }
        let grouped = Dictionary(grouping: withDates) { cal.startOfDay(for: $0.0) }
        return grouped.keys.sorted().map { day in
            (Self.dayLabel(day), grouped[day]!.sorted { $0.0 < $1.0 }.map { $0.1 })
        }
    }

    private static func dayLabel(_ day: Date) -> String {
        let cal = Calendar.current
        let date = day.formatted(.dateTime.day(.twoDigits).month(.twoDigits))
        if cal.isDateInToday(day) { return String(localized: "HÔM NAY · \(date)") }
        if cal.isDateInTomorrow(day) { return String(localized: "NGÀY MAI · \(date)") }
        return "\(day.formatted(.dateTime.weekday(.wide)).uppercased()) · \(date)"
    }

    @MainActor
    func load() async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            events = try await repo.upcomingEvents()
            phase = .loaded
            counts = await repo.registrationCounts(eventIDs: events.map { $0.id })
        } catch { phase = .failed(error.localizedDescription) }
    }
}

/// Sub-tab "Xé vé" — upcoming social events grouped by day, faithful to the
/// mockup (capacity bar, remaining-slots badge, "Xé vé" CTA). Reuses
/// SocialRepository + SocialDetailView.
struct SocialEventsTab: View {
    let goToCourts: () -> Void
    @State private var model = SocialEventsViewModel()
    @State private var showCreate = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                courtsStrip
                createCTA
                content
            }
            .padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .task { if case .loading = model.phase { await model.load() } }
        .refreshable { await model.load() }
        .sheet(isPresented: $showCreate) {
            AuthenticationRequiredView {
                SocialEventClubPicker {
                    Task { await model.load() }
                }
            }
        }
    }

    private var courtsStrip: some View {
        Button { Haptics.light(); goToCourts() } label: {
            HStack(spacing: 11) {
                Image(systemName: "sportscourt.fill").font(.system(size: 14)).foregroundStyle(TLColor.accentText)
                Text("Xem các sân pickleball gần bạn").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2)
                Spacer()
                Text("XEM SÂN ›").font(TLFont.mono(10, .bold)).foregroundStyle(TLColor.accentText)
            }
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 18).padding(.bottom, 12)
    }

    private var createCTA: some View {
        Button {
            Haptics.light()
            showCreate = true
        } label: {
            HStack {
                HStack(spacing: 12) {
                    Image(systemName: "plus").font(.system(size: 20, weight: .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(width: 42, height: 42).background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Mở buổi chơi").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                        Text("Chọn sân, giờ và trình độ").font(TLFont.mono(10.5)).foregroundStyle(TLColor.fg3)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 15, weight: .semibold)).foregroundStyle(TLColor.accentText)
            }
            .padding(15)
            .background(LinearGradient(colors: [TLColor.accent.opacity(0.14), TLColor.surface], startPoint: .topLeading, endPoint: .bottomTrailing),
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 18).padding(.bottom, 6)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 50)
        case .failed(let message):
            errorState(message)
        case .loaded where model.events.isEmpty:
            emptyState
        case .loaded:
            ForEach(Array(model.groups.enumerated()), id: \.offset) { _, group in
                VStack(alignment: .leading, spacing: 12) {
                    sectionHeader(verbatim: group.label)
                    ForEach(group.events) { event in
                        SocialEventBigCard(event: event, registered: model.counts[event.id])
                    }
                }
                .padding(.horizontal, 18).padding(.top, 16)
            }
        }
    }

    /// Group labels are already-localized runtime strings (dayLabel) — verbatim path.
    private func sectionHeader(verbatim label: String) -> some View {
        HStack(spacing: 10) {
            Text(verbatim: label).font(TLFont.mono(11, .semibold)).tracking(1.5).foregroundStyle(TLColor.fg2)
            Rectangle().fill(LinearGradient(colors: [TLColor.border, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Chưa có buổi chơi sắp tới").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
            Text("Mở buổi chơi để rủ mọi người nhé.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity).padding(.top, 50)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar.badge.exclamationmark").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được sự kiện").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load() } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 50)
    }
}

/// The organizer RPC requires every social event to belong to a club. The
/// Social-level CTA therefore resolves the signed-in user's clubs before
/// opening the same native form used from a club detail screen.
private struct SocialEventClubPicker: View {
    let onCreated: () -> Void
    @State private var clubs: [ClubListItem] = []
    @State private var selected: ClubListItem?
    @State private var loading = true
    @State private var error: String?
    @State private var showCreateClub = false

    var body: some View {
        Group {
            if let selected {
                CreateSocialEventView(clubID: selected.id, onCreated: onCreated)
            } else {
                NavigationStack {
                    Group {
                        if loading {
                            ProgressView().tint(TLColor.accentText)
                        } else if let error {
                            TLEmptyState(
                                icon: "wifi.exclamationmark",
                                title: "Không tải được CLB",
                                subtitle: LocalizedStringKey(error)
                            )
                        } else if clubs.isEmpty {
                            VStack(spacing: 18) {
                                TLEmptyState(
                                    icon: "person.3",
                                    title: "Bạn chưa có CLB",
                                    subtitle: "Hãy tạo CLB trước khi mở buổi chơi."
                                )
                                Button {
                                    Haptics.light()
                                    showCreateClub = true
                                } label: {
                                    Label("Tạo CLB", systemImage: "plus")
                                        .font(TLFont.sans(15, .bold))
                                        .foregroundStyle(TLColor.accentInk)
                                        .frame(minWidth: 150)
                                        .padding(.vertical, 12)
                                        .background(TLColor.accent, in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        } else {
                            List(clubs) { club in
                                Button {
                                    Haptics.light()
                                    selected = club
                                } label: {
                                    HStack(spacing: 12) {
                                        ClubLogo(url: club.logoURLResolved, initials: club.initials, size: 42)
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(club.name)
                                                .font(TLFont.sans(15, .semibold))
                                                .foregroundStyle(TLColor.fg)
                                            if let location = club.locationText?.nonEmpty {
                                                Text(location)
                                                    .font(TLFont.sans(12))
                                                    .foregroundStyle(TLColor.fg3)
                                            }
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .foregroundStyle(TLColor.fg4)
                                    }
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(TLColor.surface)
                            }
                            .scrollContentBackground(.hidden)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(TLColor.bg)
                    .navigationTitle("Chọn CLB tổ chức")
                    .navigationBarTitleDisplayMode(.inline)
                    .sheet(isPresented: $showCreateClub) {
                        CreateClubView {
                            Task { await reloadClubs() }
                        }
                    }
                }
            }
        }
        .task { await loadClubs() }
    }

    @MainActor
    private func loadClubs() async {
        guard loading else { return }
        let repo = ClubRepository()
        guard let userID = await repo.currentUserID() else { return }
        do {
            clubs = try await repo.list(limit: 100).filter { $0.createdBy == userID }
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    @MainActor
    private func reloadClubs() async {
        loading = true
        error = nil
        clubs = []
        await loadClubs()
    }
}

/// Big event card matching the mockup: time range + remaining badge, serif
/// title, location, tag row, capacity bar, registered count + "Xé vé".
private struct SocialEventBigCard: View {
    let event: SocialEvent
    let registered: Int?

    private var maxPlayers: Int? { event.maxPlayers }
    private var remaining: Int? {
        guard let max = maxPlayers, let reg = registered else { return nil }
        return max - reg
    }
    private var fillFraction: Double {
        guard let max = maxPlayers, max > 0, let reg = registered else { return 0 }
        return min(1, Double(reg) / Double(max))
    }

    var body: some View {
        NavigationLink { SocialDetailView(event: event) } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Text(timeRange).font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.accentText)
                    Spacer()
                    if let badge = remainingBadge { badge }
                }
                Text(event.title).font(TLFont.serif(23)).foregroundStyle(TLColor.fg).lineLimit(2)
                    .padding(.top, 9).fixedSize(horizontal: false, vertical: true)
                if let loc = event.locationText?.nonEmpty {
                    Label(loc, systemImage: "mappin.and.ellipse").font(TLFont.sans(13)).foregroundStyle(TLColor.fg2).lineLimit(1).padding(.top, 7)
                }
                FlowLayout(spacing: 8, lineSpacing: 8) {
                    tag(event.priceLabel)
                    if let level = event.levelLabel { tag(level) }
                    if let max = maxPlayers { tag(String(localized: "\(max) chỗ")) }
                }
                .padding(.top, 12)

                if maxPlayers != nil {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(TLColor.surface2)
                            Capsule().fill(fillFraction >= 0.9 ? TLColor.gold : TLColor.accent)
                                .frame(width: max(5, geo.size.width * fillFraction))
                        }
                    }
                    .frame(height: 5).padding(.top, 13)
                    HStack {
                        Text(registered.map { "\($0) / \(maxPlayers ?? 0) đã đăng ký" } ?? "Đang tải…")
                            .font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                        Spacer()
                        Text("Xé vé").font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 16).padding(.vertical, 7)
                            .background(TLColor.accent, in: Capsule())
                    }
                    .padding(.top, 9)
                }
            }
            .feedCard()
        }
        .buttonStyle(.plain)
    }

    private var timeRange: String {
        guard let start = event.startDate else { return "" }
        let startStr = start.formatted(date: .omitted, time: .shortened)
        if let endAt = event.endAt, let end = SocialDate.parse(endAt) {
            return "\(startStr) – \(end.formatted(date: .omitted, time: .shortened))"
        }
        return startStr
    }

    @ViewBuilder
    private var remainingBadge: (some View)? {
        if let rem = remaining {
            if rem <= 0 {
                badgeView(String(localized: "HẾT CHỖ"), color: TLColor.fg3, bg: TLColor.surface2)
            } else if rem <= 1 {
                badgeView(String(localized: "CÒN \(rem) CHỖ"), color: TLColor.live, bg: TLColor.live.opacity(0.12))
            } else if rem <= 4 {
                badgeView(String(localized: "\(rem) CHỖ CÒN LẠI"), color: TLColor.gold, bg: TLColor.gold.opacity(0.12))
            } else {
                badgeView(String(localized: "\(rem) CHỖ CÒN LẠI"), color: TLColor.accentText, bg: TLColor.accent.opacity(0.1))
            }
        }
    }

    private func badgeView(_ text: String, color: Color, bg: Color) -> some View {
        Text(text).font(TLFont.mono(9, .bold)).tracking(0.4).foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(bg, in: Capsule())
            .overlay(Capsule().strokeBorder(color.opacity(0.25), lineWidth: 1))
    }

    private func tag(_ text: String) -> some View {
        Text(text).font(TLFont.mono(10)).foregroundStyle(TLColor.fg2)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(TLColor.surface2, in: Capsule())
            .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
    }
}
