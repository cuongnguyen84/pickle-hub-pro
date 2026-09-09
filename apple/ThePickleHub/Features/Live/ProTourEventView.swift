import SwiftUI

@Observable
@MainActor
final class ProTourEventViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    let slug: String
    var phase: Phase = .loading
    var event: ProTourEvent?
    var results = ProResults.empty
    var searchQuery = ""

    private let repository: any ProTourRepositoryProtocol
    private var lastResultsFetch: Date?

    init(slug: String, repository: any ProTourRepositoryProtocol = ProTourRepository()) {
        self.slug = slug
        self.repository = repository
    }

    var filteredResults: ProResults { ProResultsLogic.filter(results, query: searchQuery) }

    func load(forceResults: Bool = false) async {
        if event == nil { phase = .loading }
        do {
            if event == nil {
                event = try await repository.events(forceRefresh: false).first { $0.slug == slug }
            }
            guard let event else {
                phase = .failed(String(localized: "Không tìm thấy giải đấu"))
                return
            }
            if !forceResults,
               let lastResultsFetch,
               Date().timeIntervalSince(lastResultsFetch) < 30 {
                phase = .loaded
                return
            }
            results = try await repository.results(for: event)
            lastResultsFetch = Date()
            phase = .loaded
        } catch {
            if self.event == nil || results == .empty {
                phase = .failed(error.localizedDescription)
            }
        }
    }
}

struct ProTourEventView: View {
    @State private var model: ProTourEventViewModel
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL

    init(slug: String) {
        _model = State(initialValue: ProTourEventViewModel(slug: slug))
    }

    var body: some View {
        ScrollView {
            switch model.phase {
            case .loading:
                TLLoadingView(rows: 5).padding(20)
            case .failed(let message):
                TLErrorState(message: message) { Task { await model.load(forceResults: true) } }
            case .loaded:
                loadedContent
            }
        }
        .background(TLColor.bg)
        .navigationTitle(model.event.map(eventName) ?? String(localized: "Kết quả giải đấu"))
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $model.searchQuery, prompt: String(localized: "Tìm vận động viên"))
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            // A task keyed by scenePhase is cancelled by SwiftUI in background
            // and on disappear. Every activation refreshes immediately.
            await model.load(forceResults: true)
            while !Task.isCancelled {
                let seconds: Double = model.event?.phase() == .live ? 60 : 3_600
                do { try await Task.sleep(for: .seconds(seconds)) } catch { return }
                guard !Task.isCancelled else { return }
                await model.load()
            }
        }
        .refreshable { await model.load(forceResults: true) }
    }

    @ViewBuilder
    private var loadedContent: some View {
        if let event = model.event {
            VStack(alignment: .leading, spacing: 24) {
                eventHeader(event)
                let shown = model.filteredResults
                let live = ProResultsLogic.liveMatches(shown, language: language)
                if !live.isEmpty { liveSection(live) }
                if shown.total == 0 {
                    TLEmptyState(
                        icon: model.searchQuery.isEmpty ? "sportscourt" : "magnifyingglass",
                        title: model.searchQuery.isEmpty ? "Chưa có kết quả" : "Không tìm thấy vận động viên",
                        subtitle: model.searchQuery.isEmpty
                            ? "Kết quả sẽ xuất hiện khi các trận đấu bắt đầu."
                            : "Thử một tên khác hoặc bỏ dấu tiếng Việt."
                    )
                } else {
                    summary(shown)
                    ForEach(shown.events) { eventResult in
                        eventSection(eventResult)
                    }
                }
                sourceLinks(event)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 18)
        }
    }

    private func eventHeader(_ event: ProTourEvent) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                eventLogo(event, size: 62)
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 7) {
                        statusPill(event.phase())
                        Text(event.tier.uppercased())
                            .font(TLType.eyebrowMono(9)).foregroundStyle(.white.opacity(0.75))
                    }
                    Text(eventName(event))
                        .font(TLFont.serif(25)).foregroundStyle(.white)
                    Text("\(flag(event.countryCode))  \(event.city), \(event.country)")
                        .font(TLType.bodySans(13)).foregroundStyle(.white.opacity(0.82))
                }
            }
            HStack(spacing: 14) {
                Label(event.formattedDates(language: language), systemImage: "calendar")
                if let venue = event.venue { Label(venue, systemImage: "mappin.and.ellipse") }
            }
            .font(TLFont.sans(11, .medium)).foregroundStyle(.white.opacity(0.82))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: event.brandBackground == nil
                    ? [Color(hex: 0x17211B), Color(hex: 0x263D2C)]
                    : [Color(hex: 0x15283D), Color(hex: 0x233E57)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: TLRadius.xl, style: .continuous)
        )
        .accessibilityElement(children: .combine)
    }

    private func summary(_ results: ProResults) -> some View {
        HStack(spacing: 8) {
            summaryChip("\(results.total)", label: String(localized: "trận đấu"), color: TLColor.accentText)
            summaryChip("\(results.vietnamCount)", label: "🇻🇳", color: TLColor.live)
            Spacer()
            Text(String(localized: "Cập nhật tự động"))
                .font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.fg4)
        }
    }

    private func summaryChip(_ value: String, label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text(value).font(TLFont.mono(11, .bold)).foregroundStyle(color)
            Text(label).font(TLFont.sans(11)).foregroundStyle(TLColor.fg3)
        }
        .padding(.horizontal, 9).padding(.vertical, 6)
        .background(TLColor.surface2, in: Capsule())
    }

    private func liveSection(_ live: [ProLiveMatch]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Circle().fill(TLColor.live).frame(width: 7, height: 7)
                Text(String(localized: "ĐANG DIỄN RA"))
                    .font(TLType.eyebrowMono(10)).tracking(1).foregroundStyle(TLColor.live)
                Spacer()
                Text("\(live.count)").font(TLFont.mono(10, .bold)).foregroundStyle(TLColor.live)
            }
            ForEach(live) { item in
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.eventLabel.uppercased())
                        .font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.live)
                    ProTourMatchRow(match: item.match)
                }
            }
        }
        .padding(14)
        .background(TLColor.live.opacity(0.07), in: RoundedRectangle(cornerRadius: TLRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.live.opacity(0.45), lineWidth: 1))
    }

    private func eventSection(_ event: ProResultEvent) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text(language == "vi" ? event.labelVI : event.labelEN)
                    .font(TLFont.serif(22)).foregroundStyle(TLColor.fg)
                Spacer()
                Text("\(event.matchCount)")
                    .font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg4)
            }
            if let champion = event.champion {
                HStack(spacing: 8) {
                    Image(systemName: "trophy.fill").foregroundStyle(TLColor.gold)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "VÔ ĐỊCH"))
                            .font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.gold)
                        Text(ProResultsLogic.playersLine(champion))
                            .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg)
                    }
                }
                .padding(11).frame(maxWidth: .infinity, alignment: .leading)
                .background(TLColor.gold.opacity(0.08), in: RoundedRectangle(cornerRadius: TLRadius.sm))
            }
            ForEach(event.rounds) { round in
                VStack(alignment: .leading, spacing: 8) {
                    Text(language == "vi" ? round.labelVI : round.labelEN)
                        .font(TLType.eyebrowMono(10)).tracking(0.7).foregroundStyle(TLColor.fg3)
                    ForEach(round.matches) { ProTourMatchRow(match: $0) }
                }
            }
        }
        .padding(15)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func sourceLinks(_ event: ProTourEvent) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(String(localized: "NGUỒN CHÍNH THỨC"))
                .font(TLType.eyebrowMono(9)).foregroundStyle(TLColor.fg4)
            HStack(spacing: 10) {
                sourceButton(String(localized: "Trang giải đấu"), url: event.officialURL)
                sourceButton(String(localized: "Sơ đồ thi đấu"), url: event.bracketsURL)
            }
        }
    }

    private func sourceButton(_ title: String, url: String) -> some View {
        Button { if let url = URL(string: url) { openURL(url) } } label: {
            Label(title, systemImage: "arrow.up.right")
                .font(TLFont.sans(12, .semibold)).foregroundStyle(TLColor.accentText)
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(TLColor.surface2, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func eventLogo(_ event: ProTourEvent, size: CGFloat) -> some View {
        AsyncImage(url: event.logoRemoteURL) { phase in
            if let image = phase.image {
                image.resizable().scaledToFit().padding(5)
            } else {
                Image(systemName: "trophy.fill").font(.system(size: size * 0.38)).foregroundStyle(TLColor.gold)
            }
        }
        .frame(width: size, height: size)
        .background(.white.opacity(0.11), in: RoundedRectangle(cornerRadius: 12))
    }

    private func statusPill(_ phase: ProTourEventPhase) -> some View {
        let content: (String, Color) = switch phase {
        case .live: (String(localized: "LIVE"), TLColor.live)
        case .upcoming: (String(localized: "SẮP DIỄN RA"), TLColor.accent)
        case .finished: (String(localized: "ĐÃ KẾT THÚC"), Color.white.opacity(0.65))
        }
        return Text(content.0).font(TLType.eyebrowMono(8)).foregroundStyle(phase == .upcoming ? TLColor.accentInk : .white)
            .padding(.horizontal, 7).padding(.vertical, 4).background(content.1, in: Capsule())
    }

    private var language: String {
        Locale.current.language.languageCode?.identifier == "vi" ? "vi" : "en"
    }
    private func eventName(_ event: ProTourEvent) -> String { language == "vi" ? event.nameVI : event.nameEN }
    private func flag(_ code: String) -> String {
        String(String.UnicodeScalarView(code.uppercased().prefix(2).unicodeScalars.compactMap {
            UnicodeScalar(127_397 + Int($0.value))
        }))
    }
}

private struct ProTourMatchRow: View {
    let match: ProResultMatch

    var body: some View {
        let court = match.courtNumber?.trimmingCharacters(in: .whitespacesAndNewlines)
        HStack(spacing: 0) {
            Rectangle().fill(match.isLive ? TLColor.live : TLColor.border2).frame(width: 3)
            VStack(spacing: 8) {
                playerRow(match.teamA, scores: match.games.map(\.a), winner: match.winner == "a")
                playerRow(match.teamB, scores: match.games.map(\.b), winner: match.winner == "b")
                if match.isLive || court?.isEmpty == false {
                    HStack {
                        if match.isLive {
                            Text("LIVE").font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.live)
                        }
                        Spacer()
                        if let court, !court.isEmpty {
                            Text("\(language == "vi" ? "Sân" : "Court") \(court)")
                                .font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                        }
                    }
                }
            }
            .padding(11)
        }
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm))
        .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm))
    }

    private var language: String {
        Locale.current.language.languageCode?.identifier == "vi" ? "vi" : "en"
    }

    private func playerRow(_ players: [ProResultPlayer], scores: [Int], winner: Bool) -> some View {
        HStack(spacing: 8) {
            if players.contains(where: \.isVietnamese) { Text("🇻🇳").font(.system(size: 12)) }
            Text(ProResultsLogic.playersLine(players))
                .font(TLFont.sans(12.5, winner ? .bold : .medium))
                .foregroundStyle(winner ? TLColor.fg : TLColor.fg2).lineLimit(2)
            Spacer(minLength: 8)
            Text(scores.isEmpty ? "—" : scores.map(String.init).joined(separator: "  "))
                .font(TLFont.mono(11, winner ? .bold : .medium))
                .foregroundStyle(winner ? TLColor.accentText : TLColor.fg3)
        }
    }
}
