import AudioToolbox
import SwiftUI
import UIKit

@Observable
@MainActor
private final class DashboardPickerModel {
    enum Phase { case loading, loaded, failed(String) }
    var phase: Phase = .loading
    var tournaments: [ActiveDashboardTournament] = []
    private let repository = TournamentDashboardRepository()

    func load() async {
        phase = .loading
        tournaments = await repository.activeTournaments()
        phase = .loaded
    }
}

struct TournamentDashboardPickerView: View {
    @State private var model = DashboardPickerModel()
    @State private var target: ActiveDashboardTournament?

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                ScrollView { TLLoadingView(rows: 4).padding(22) }
            case .failed(let message):
                TLErrorState(message: message) { Task { await model.load() } }
            case .loaded:
                if model.tournaments.isEmpty {
                    TLEmptyState(
                        icon: "display",
                        title: "Chưa có giải đang diễn ra",
                        subtitle: "Bảng sân xuất hiện khi Quick Table vào vòng bảng/playoff, Team Match đang thi đấu hoặc giải loại trực tiếp đã bắt đầu."
                    )
                } else {
                    List(model.tournaments) { tournament in
                        Button {
                            Haptics.light()
                            target = tournament
                        } label: {
                            HStack(spacing: 14) {
                                Image(systemName: tournament.type.icon)
                                    .font(.system(size: 17, weight: .medium))
                                    .foregroundStyle(TLColor.accentText)
                                    .frame(width: 44, height: 44)
                                    .background(
                                        TLColor.accent.opacity(0.1),
                                        in: RoundedRectangle(cornerRadius: 12)
                                    )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(tournament.name)
                                        .font(TLFont.sans(15, .semibold))
                                        .foregroundStyle(TLColor.fg)
                                        .lineLimit(2)
                                    Text(tournament.type.label.uppercased())
                                        .font(TLFont.mono(9, .bold))
                                        .tracking(0.8)
                                        .foregroundStyle(TLColor.fg3)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(TLColor.fg4)
                            }
                            .frame(minHeight: 58)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(TLColor.surface)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Bảng sân trực tiếp")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .navigationDestination(item: $target) { tournament in
            TournamentDashboardView(tournament: tournament)
        }
    }
}

@Observable
@MainActor
private final class TournamentDashboardModel {
    enum Phase { case loading, loaded, failed(String) }
    var phase: Phase = .loading
    var snapshot: TournamentDashboardSnapshot?
    var soundEnabled = true

    private let tournament: ActiveDashboardTournament
    private let repository = TournamentDashboardRepository()
    private let refreshGate = TournamentRefreshGate()
    @ObservationIgnored private var realtime: TournamentRealtimeSubscription?
    @ObservationIgnored private var didLoadOnce = false

    init(tournament: ActiveDashboardTournament) {
        self.tournament = tournament
    }

    func load() async {
        await refreshGate.perform { [weak self] in
            guard let self else { return }
            do {
                let oldScores = self.scoreSignature(self.snapshot)
                let loaded = try await self.repository.load(self.tournament)
                self.snapshot = loaded
                self.phase = .loaded
                if self.didLoadOnce, self.soundEnabled, oldScores != self.scoreSignature(loaded) {
                    AudioServicesPlaySystemSound(1104)
                }
                self.didLoadOnce = true
                await self.ensureRealtime()
            } catch {
                if self.snapshot == nil {
                    self.phase = .failed(error.localizedDescription)
                }
            }
        }
    }

    func stop() async {
        let active = realtime
        realtime = nil
        await active?.stop()
    }

    private func ensureRealtime() async {
        guard realtime == nil else { return }
        let reload: @Sendable () async -> Void = { [weak self] in
            await self?.load()
        }
        switch tournament.type {
        case .quickTable:
            realtime = TournamentService.shared.watchQuickTable(
                tableID: tournament.id,
                onChange: reload
            )
        case .teamMatch:
            realtime = TournamentService.shared.watchTeamMatch(
                tournamentID: tournament.id,
                onChange: reload
            )
        case .doublesElimination:
            realtime = TournamentService.shared.watchDoublesElim(
                tournamentID: tournament.id,
                onChange: reload
            )
        }
    }

    private func scoreSignature(_ snapshot: TournamentDashboardSnapshot?) -> String {
        snapshot?.matches.map {
            "\($0.id.uuidString):\($0.status):\($0.scoreA ?? 0):\($0.scoreB ?? 0)"
        }.joined(separator: "|") ?? ""
    }
}

struct TournamentDashboardView: View {
    let tournament: ActiveDashboardTournament

    @State private var model: TournamentDashboardModel
    @State private var tvMode = false

    init(tournament: ActiveDashboardTournament) {
        self.tournament = tournament
        _model = State(initialValue: TournamentDashboardModel(tournament: tournament))
    }

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                ScrollView { TLLoadingView(rows: 4).padding(22) }
            case .failed(let message):
                TLErrorState(message: message) { Task { await model.load() } }
            case .loaded:
                if let snapshot = model.snapshot {
                    dashboard(snapshot)
                }
            }
        }
        .background(TLColor.bg)
        .navigationTitle(tournament.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    model.soundEnabled.toggle()
                    Haptics.light()
                } label: {
                    Image(systemName: model.soundEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                }
                .accessibilityLabel(model.soundEnabled ? "Tắt âm báo" : "Bật âm báo")

                Button {
                    Haptics.light()
                    tvMode = true
                } label: {
                    Image(systemName: "display")
                }
                .accessibilityLabel("Mở chế độ TV")
            }
        }
        .fullScreenCover(isPresented: $tvMode) {
            if let snapshot = model.snapshot {
                TournamentTVModeView(snapshot: snapshot) { tvMode = false }
            }
        }
        .tournamentDetailLifecycle(
            id: "dashboard:\(tournament.type.rawValue):\(tournament.id)",
            pollInterval: .seconds(10),
            load: { await model.load() },
            stop: { await model.stop() }
        )
    }

    @ViewBuilder
    private func dashboard(_ snapshot: TournamentDashboardSnapshot) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("BẢNG SÂN TRỰC TIẾP")
                            .font(TLFont.mono(10, .bold))
                            .tracking(1.5)
                            .foregroundStyle(TLColor.accentText)
                        Text(snapshot.tournament.name)
                            .font(TLFont.serif(28))
                            .italic()
                            .foregroundStyle(TLColor.fg)
                    }
                    Spacer()
                    liveIndicator
                }

                if snapshot.tournament.type == .teamMatch {
                    teamMatches(snapshot)
                } else if snapshot.courts.isEmpty {
                    TLEmptyState(
                        icon: "sportscourt",
                        title: "Chưa có lịch sân",
                        subtitle: "Hãy gán sân và giờ thi đấu cho các trận."
                    )
                } else {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 285), spacing: 12)],
                        spacing: 12
                    ) {
                        ForEach(snapshot.courts) { court in
                            TournamentCourtCard(court: court)
                        }
                    }
                }
            }
            .padding(22)
        }
    }

    private var liveIndicator: some View {
        HStack(spacing: 6) {
            Circle().fill(TLColor.live).frame(width: 7, height: 7)
            Text("TỰ CẬP NHẬT")
                .font(TLFont.mono(8.5, .bold))
                .tracking(0.7)
                .foregroundStyle(TLColor.fg3)
        }
    }

    @ViewBuilder
    private func teamMatches(_ snapshot: TournamentDashboardSnapshot) -> some View {
        if snapshot.liveTeamMatches.isEmpty && snapshot.nextTeamMatches.isEmpty {
            TLEmptyState(icon: "sportscourt", title: "Chưa có trận đang chờ")
        } else {
            if !snapshot.liveTeamMatches.isEmpty {
                dashboardHeading(String(localized: "TRẬN ĐANG DIỄN RA"), live: true)
                ForEach(snapshot.liveTeamMatches) { match in
                    DashboardMatchCard(match: match, isLive: true)
                }
            }
            if !snapshot.nextTeamMatches.isEmpty {
                dashboardHeading("SẮP TỚI")
                ForEach(snapshot.nextTeamMatches) { match in
                    DashboardMatchCard(match: match, isLive: false)
                }
            }
        }
    }

    private func dashboardHeading(_ title: String, live: Bool = false) -> some View {
        HStack(spacing: 8) {
            if live {
                Text("LIVE")
                    .font(TLFont.mono(8, .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(TLColor.live, in: Capsule())
            }
            Text(title)
                .font(TLFont.mono(11, .semibold))
                .tracking(1)
                .foregroundStyle(TLColor.fg2)
        }
    }
}

private struct TournamentCourtCard: View {
    let court: TournamentCourt

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack {
                Text("SÂN \(court.courtNumber)")
                    .font(TLFont.mono(12, .bold))
                    .tracking(0.8)
                    .foregroundStyle(TLColor.fg)
                Spacer()
                status
            }

            if let live = court.liveMatch {
                VStack(alignment: .leading, spacing: 8) {
                    Text("ĐANG THI ĐẤU")
                        .font(TLFont.mono(8.5, .bold))
                        .tracking(0.8)
                        .foregroundStyle(TLColor.accentText)
                    ScoreLine(match: live, large: false)
                }
                .padding(12)
                .background(TLColor.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
            }

            if let next = court.nextMatch {
                VStack(alignment: .leading, spacing: 7) {
                    HStack {
                        Text("TRẬN KẾ TIẾP")
                        Spacer()
                        if let time = next.startTime?.nonEmpty { Text(time) }
                    }
                    .font(TLFont.mono(8.5, .semibold))
                    .foregroundStyle(TLColor.fg3)
                    HStack {
                        Text(next.teamA).lineLimit(1)
                        Spacer()
                        Text("VS").foregroundStyle(TLColor.fg4)
                        Spacer()
                        Text(next.teamB).lineLimit(1)
                    }
                    .font(TLFont.sans(13, .medium))
                    .foregroundStyle(TLColor.fg2)
                }
                .padding(12)
                .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 11))
            }

            if court.liveMatch == nil && court.nextMatch == nil {
                Text("Sân trống")
                    .font(TLFont.sans(13))
                    .foregroundStyle(TLColor.fg3)
                    .frame(maxWidth: .infinity, minHeight: 54)
            }
        }
        .padding(15)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(court.liveMatch == nil ? TLColor.border : TLColor.accent.opacity(0.4))
        )
    }

    @ViewBuilder
    private var status: some View {
        if court.liveMatch != nil {
            Text("LIVE")
                .font(TLFont.mono(8, .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(TLColor.live, in: Capsule())
        } else if court.nextMatch != nil {
            Text("SẮP TỚI")
                .font(TLFont.mono(8, .bold))
                .foregroundStyle(TLColor.fg3)
        } else {
            Text("TRỐNG")
                .font(TLFont.mono(8, .bold))
                .foregroundStyle(TLColor.fg4)
        }
    }
}

private struct DashboardMatchCard: View {
    let match: TournamentDashboardMatch
    let isLive: Bool

    var body: some View {
        Group {
            if isLive {
                ScoreLine(match: match, large: false)
            } else {
                HStack(spacing: 10) {
                    Text(match.teamA).frame(maxWidth: .infinity, alignment: .leading).lineLimit(1)
                    Text("VS").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                    Text(match.teamB).frame(maxWidth: .infinity, alignment: .trailing).lineLimit(1)
                }
                .font(TLFont.sans(14, .semibold))
                .foregroundStyle(TLColor.fg)
            }
        }
        .padding(16)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(isLive ? TLColor.accent.opacity(0.4) : TLColor.border)
        )
    }
}

private struct ScoreLine: View {
    let match: TournamentDashboardMatch
    let large: Bool

    var body: some View {
        HStack(spacing: large ? 18 : 9) {
            Text(match.teamA)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(2)
            Text("\(match.scoreA ?? 0)")
            Text(":").foregroundStyle(large ? Color.white.opacity(0.35) : TLColor.fg4)
            Text("\(match.scoreB ?? 0)")
            Text(match.teamB)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .lineLimit(2)
        }
        .font(large ? .system(size: 30, weight: .bold, design: .rounded) : TLFont.sans(15, .bold))
        .foregroundStyle(large ? Color.white : TLColor.fg)
        .monospacedDigit()
    }
}

private struct TournamentTVModeView: View {
    let snapshot: TournamentDashboardSnapshot
    let onExit: () -> Void

    @State private var page = 0
    @State private var autoRotate = true

    private var items: [TVItem] {
        if snapshot.tournament.type == .teamMatch {
            return snapshot.liveTeamMatches.map { .match($0) }
                + snapshot.nextTeamMatches.map { .match($0) }
        }
        return snapshot.courts.map { .court($0) }
    }
    private var pages: Int { max(1, Int(ceil(Double(items.count) / 6.0))) }
    private var currentItems: [TVItem] {
        let start = min(page * 6, items.count)
        return Array(items.dropFirst(start).prefix(6))
    }

    private enum TVItem: Identifiable {
        case court(TournamentCourt)
        case match(TournamentDashboardMatch)
        var id: String {
            switch self {
            case .court(let court): "court-\(court.id)"
            case .match(let match): "match-\(match.id)"
            }
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack(spacing: 14) {
                    Text(snapshot.tournament.name)
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer()
                    Button {
                        autoRotate.toggle()
                    } label: {
                        Label(
                            autoRotate ? "Tự chuyển" : "Đã dừng",
                            systemImage: autoRotate ? "arrow.triangle.2.circlepath" : "pause.fill"
                        )
                    }
                    .buttonStyle(.bordered)
                    .tint(.white)
                    if pages > 1 {
                        Text("\(page + 1)/\(pages)")
                            .font(.system(size: 14, weight: .semibold, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    Button(action: onExit) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(.white)
                    .accessibilityLabel("Thoát chế độ TV")
                }

                if currentItems.isEmpty {
                    ContentUnavailableView(
                        "Chưa có trận đang chờ",
                        systemImage: "sportscourt"
                    )
                    .foregroundStyle(.white)
                } else {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 300), spacing: 14)],
                        spacing: 14
                    ) {
                        ForEach(currentItems) { item in
                            tvCard(item)
                        }
                    }
                    .frame(maxHeight: .infinity)
                }
            }
            .padding(22)
        }
        .persistentSystemOverlays(.hidden)
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .task(id: "\(autoRotate)-\(pages)") {
            guard autoRotate, pages > 1 else { return }
            while !Task.isCancelled {
                do {
                    try await Task.sleep(for: .seconds(10))
                } catch {
                    return
                }
                withAnimation(.easeInOut(duration: 0.25)) {
                    page = (page + 1) % pages
                }
            }
        }
    }

    @ViewBuilder
    private func tvCard(_ item: TVItem) -> some View {
        switch item {
        case .court(let court):
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text("SÂN \(court.courtNumber)")
                        .font(.system(size: 20, weight: .bold))
                    Spacer()
                    if court.liveMatch != nil {
                        Text("LIVE")
                            .font(.system(size: 12, weight: .black))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(Color.red, in: Capsule())
                    }
                }
                if let live = court.liveMatch {
                    ScoreLine(match: live, large: true)
                } else {
                    Text("SÂN TRỐNG")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.white.opacity(0.4))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                if let next = court.nextMatch {
                    Divider().overlay(Color.white.opacity(0.15))
                    HStack {
                        Text("TIẾP THEO")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(.yellow)
                        Spacer()
                        Text("\(next.teamA)  VS  \(next.teamB)")
                            .font(.system(size: 16, weight: .semibold))
                            .lineLimit(1)
                    }
                }
            }
            .tvCardStyle()

        case .match(let match):
            VStack(alignment: .leading, spacing: 18) {
                Text(match.isLive ? "LIVE" : "SẮP TỚI")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(match.isLive ? .white : .yellow)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(match.isLive ? Color.red : Color.yellow.opacity(0.15), in: Capsule())
                ScoreLine(match: match, large: true)
            }
            .tvCardStyle()
        }
    }
}

private extension View {
    func tvCardStyle() -> some View {
        padding(22)
            .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
            .foregroundStyle(.white)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
            )
    }
}
