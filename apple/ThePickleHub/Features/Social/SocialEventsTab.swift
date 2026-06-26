import SwiftUI

@Observable
final class SocialEventsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var events: [SocialEvent] = []
    var counts: [UUID: Int] = [:]
    private let repo = SocialRepository()

    /// Events grouped by day, in chronological order, with a VN section label.
    var groups: [(label: String, events: [SocialEvent])] {
        let cal = Calendar.current
        let withDates = events.compactMap { e -> (Date, SocialEvent)? in e.startDate.map { ($0, e) } }
        let grouped = Dictionary(grouping: withDates) { cal.startOfDay(for: $0.0) }
        return grouped.keys.sorted().map { day in
            (Self.dayLabel(day), grouped[day]!.sorted { $0.0 < $1.0 }.map { $0.1 })
        }
    }

    private static let dayFmt: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "vi_VN"); f.dateFormat = "dd.MM"; return f
    }()
    private static func dayLabel(_ day: Date) -> String {
        let cal = Calendar.current
        let date = dayFmt.string(from: day)
        if cal.isDateInToday(day) { return "HÔM NAY · \(date)" }
        if cal.isDateInTomorrow(day) { return "NGÀY MAI · \(date)" }
        let wd = DateFormatter(); wd.locale = Locale(identifier: "vi_VN"); wd.dateFormat = "EEEE"
        return "\(wd.string(from: day).uppercased()) · \(date)"
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
    @State private var openWeb: IdentifiedURL?

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
        .sheet(item: $openWeb) { SafariView(url: $0.url).ignoresSafeArea() }
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
        Button { Haptics.light(); openWeb = IdentifiedURL(url: WebRoutes.base.appending(path: "social")) } label: {
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
                    sectionHeader(group.label)
                    ForEach(group.events) { event in
                        SocialEventBigCard(event: event, registered: model.counts[event.id])
                    }
                }
                .padding(.horizontal, 18).padding(.top, 16)
            }
        }
    }

    private func sectionHeader(_ label: String) -> some View {
        HStack(spacing: 10) {
            Text(label).font(TLFont.mono(11, .semibold)).tracking(1.5).foregroundStyle(TLColor.fg2)
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
                    if let max = maxPlayers { tag("\(max) chỗ") }
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
        let f = DateFormatter(); f.locale = Locale(identifier: "vi_VN"); f.dateFormat = "HH:mm"
        let startStr = f.string(from: start)
        if let endStr = event.endAt.flatMap { SocialDate.parse($0) }.map({ f.string(from: $0) }) {
            return "\(startStr) – \(endStr)"
        }
        return startStr
    }

    @ViewBuilder
    private var remainingBadge: (some View)? {
        if let rem = remaining {
            if rem <= 0 {
                badgeView("HẾT CHỖ", color: TLColor.fg3, bg: TLColor.surface2)
            } else if rem <= 1 {
                badgeView("CÒN \(rem) CHỖ", color: TLColor.live, bg: TLColor.live.opacity(0.12))
            } else if rem <= 4 {
                badgeView("\(rem) CHỖ CÒN LẠI", color: TLColor.gold, bg: TLColor.gold.opacity(0.12))
            } else {
                badgeView("\(rem) CHỖ CÒN LẠI", color: TLColor.accentText, bg: TLColor.accent.opacity(0.1))
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
