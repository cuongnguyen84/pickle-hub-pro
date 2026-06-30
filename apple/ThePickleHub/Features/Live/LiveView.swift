import SwiftUI

@Observable
final class LiveViewModel {
    enum Segment: String, CaseIterable, Identifiable {
        case live, replays, videos
        var id: String { rawValue }
        var label: String {
            switch self {
            case .live: return "Trực tiếp"
            case .replays: return "Phát lại"
            case .videos: return "Video"
            }
        }
        var serifTitle: String {
            switch self {
            case .live: return "Trực tiếp"
            case .replays: return "Phát lại"
            case .videos: return "Video"
            }
        }
    }

    enum Phase: Equatable { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var streams: [LivestreamSummary] = []      // live + scheduled
    var replays: [LivestreamSummary] = []
    var videos: [VideoSummary] = []

    private let repo = LiveRepository()

    var liveStreams: [LivestreamSummary] { streams.filter { $0.isLive } }
    var upcoming: [LivestreamSummary] {
        streams.filter { $0.isScheduled }.sorted { ($0.scheduledDate ?? .distantFuture) < ($1.scheduledDate ?? .distantFuture) }
    }
    var hasLive: Bool { !liveStreams.isEmpty }

    /// Replays/videos the user left part-way, newest progress first.
    var continueWatching: [(id: String, title: String, thumb: URL?, url: URL?, progress: WatchProgress)] {
        var out: [(String, String, URL?, URL?, WatchProgress, Date)] = []
        for s in replays {
            if let p = WatchProgressStore.get(s.id.uuidString), p.isResumable {
                out.append((s.id.uuidString, s.displayTitle, s.thumbURL, s.playbackURL, p, p.updatedAt))
            }
        }
        for v in videos {
            if let p = WatchProgressStore.get(v.id.uuidString), p.isResumable {
                out.append((v.id.uuidString, v.title, v.thumbURL, v.playbackURL, p, p.updatedAt))
            }
        }
        return out.sorted { $0.5 > $1.5 }.map { ($0.0, $0.1, $0.2, $0.3, $0.4) }
    }

    @MainActor
    func load(force: Bool = false) async {
        if case .loaded = phase, !force {} else if !force { phase = .loading }
        do {
            async let live = repo.liveAndUpcoming()
            async let replay = repo.replays()
            async let vids = repo.videos()
            streams = try await live
            replays = try await replay
            videos = try await vids
            phase = .loaded
        } catch {
            if streams.isEmpty && replays.isEmpty { phase = .failed(error.localizedDescription) }
        }
    }
}

/// Live tab — cinematic broadcast layout (approved "Phương Án A"): editorial
/// header, segmented Trực tiếp/Phát lại/Video, a hero court, rails of other live
/// courts, an upcoming schedule with reminders, and replays with resume.
/// Only real backend data is shown (no fabricated viewers/scores).
struct LiveView: View {
    @State private var model = LiveViewModel()
    @State private var segment: LiveViewModel.Segment = .live
    @State private var didAutoSelect = false
    @State private var replayFilter: String? = nil   // org/tournament name chip
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    editorialHeader
                    segmentPicker
                    content
                }
                .padding(.top, 4)
                .padding(.bottom, 32)
            }
            .background(TLColor.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarButtons }
            .task {
                await model.load()
                if !didAutoSelect { didAutoSelect = true; segment = model.hasLive ? .live : .replays }
            }
            .task(id: segment) {
                // Poll while on the Live tab so badges/scores reflect status changes
                // without a manual reload (no websocket backend yet).
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(20))
                    if Task.isCancelled { break }
                    if segment == .live { await model.load(force: true) }
                }
            }
            .refreshable { await model.load(force: true) }
        }
    }

    // MARK: Header

    private var editorialHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("THEPICKLEHUB").font(TLFont.mono(10, .semibold)).tracking(2.8).foregroundStyle(TLColor.accentText)
            Text(segment.serifTitle).font(TLFont.serif(28)).foregroundStyle(TLColor.fg)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 22)
        .accessibilityElement(children: .combine)
    }

    @ToolbarContentBuilder
    private var toolbarButtons: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: 10) {
                NavigationLink { SearchView() } label: {
                    Image(systemName: "magnifyingglass").foregroundStyle(TLColor.fg2)
                }.accessibilityLabel("Tìm kiếm")
                NavigationLink { ProfileView() } label: {
                    Image(systemName: "person.crop.circle").foregroundStyle(TLColor.accentText)
                }.accessibilityLabel("Hồ sơ")
            }
        }
    }

    private var segmentPicker: some View {
        TLSegmented(
            options: LiveViewModel.Segment.allCases,
            selection: $segment,
            label: { $0.label },
            indicator: { $0 == .live && model.hasLive },
            indicatorHint: "đang có trận trực tiếp"
        )
        .padding(.horizontal, 22)
    }

    // MARK: Content router

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading: skeleton
        case .failed(let message): errorState(message)
        case .loaded:
            switch segment {
            case .live: liveContent
            case .replays: replayContent
            case .videos: videoContent
            }
        }
    }

    // MARK: Live segment

    @ViewBuilder
    private var liveContent: some View {
        let live = model.liveStreams
        let upcoming = model.upcoming
        if live.isEmpty && upcoming.isEmpty {
            emptyState(icon: "dot.radiowaves.up.forward", title: "Hiện chưa có trận trực tiếp",
                       subtitle: "Các buổi phát sẽ xuất hiện ở đây khi bắt đầu.")
            if !model.replays.isEmpty { featuredReplays }
        } else {
            VStack(alignment: .leading, spacing: 26) {
                if let hero = live.first ?? upcoming.first {
                    LiveHeroCard(stream: hero, reduceMotion: reduceMotion)
                }
                if live.count > 1 {
                    otherCourtsRail(Array(live.dropFirst()))
                }
                if !upcoming.isEmpty {
                    upcomingSection(upcoming)
                }
                if !model.replays.isEmpty { featuredReplays }
            }
        }
    }

    private func otherCourtsRail(_ streams: [LivestreamSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Sân khác đang live", livePulse: true, trailing: "\(streams.count + 1) sân")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(streams) { s in LiveCourtCard(stream: s, reduceMotion: reduceMotion) }
                }
                .padding(.horizontal, 22)
            }
        }
    }

    private func upcomingSection(_ streams: [LivestreamSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Sắp phát")
            VStack(spacing: 10) {
                ForEach(streams) { s in ScheduleRow(stream: s) }
            }
            .padding(.horizontal, 22)
        }
    }

    private var featuredReplays: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Phát lại nổi bật")
            VStack(spacing: 14) {
                ForEach(model.replays.prefix(4)) { ReplayRow(stream: $0) }
            }
            .padding(.horizontal, 22)
        }
    }

    // MARK: Replays segment

    @ViewBuilder
    private var replayContent: some View {
        if model.replays.isEmpty {
            emptyState(icon: "play.slash", title: "Chưa có bản phát lại", subtitle: "Các trận đã phát sẽ được lưu lại ở đây.")
        } else {
            VStack(alignment: .leading, spacing: 22) {
                filterChips
                let cont = model.continueWatching
                if !cont.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        sectionHeader("Xem tiếp")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(cont, id: \.id) { item in ContinueCard(item: item) }
                            }
                            .padding(.horizontal, 22)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    sectionHeader("Mới nhất")
                    VStack(spacing: 14) {
                        ForEach(filteredReplays) { ReplayRow(stream: $0) }
                    }
                    .padding(.horizontal, 22)
                }
            }
        }
    }

    private var filterOptions: [String] {
        var seen = Set<String>()
        return model.replays.compactMap { $0.orgName }.filter { seen.insert($0).inserted }
    }
    private var filteredReplays: [LivestreamSummary] {
        guard let f = replayFilter else { return model.replays }
        return model.replays.filter { $0.orgName == f }
    }

    @ViewBuilder
    private var filterChips: some View {
        if !filterOptions.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("Tất cả", active: replayFilter == nil) { replayFilter = nil }
                    ForEach(filterOptions, id: \.self) { name in
                        chip(name, active: replayFilter == name) { replayFilter = (replayFilter == name ? nil : name) }
                    }
                }
                .padding(.horizontal, 22)
            }
        }
    }

    private func chip(_ text: String, active: Bool, _ action: @escaping () -> Void) -> some View {
        Button { Haptics.light(); withAnimation(.easeInOut(duration: 0.15)) { action() } } label: {
            Text(text).font(TLFont.mono(11, active ? .semibold : .medium))
                .foregroundStyle(active ? TLColor.accentText : TLColor.fg2)
                .padding(.horizontal, 14).padding(.vertical, 7)
                .background(active ? TLColor.accent.opacity(0.12) : TLColor.surface, in: Capsule())
                .overlay(Capsule().strokeBorder(active ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Videos segment

    @ViewBuilder
    private var videoContent: some View {
        if model.videos.isEmpty {
            emptyState(icon: "film", title: "Chưa có video", subtitle: "Video nổi bật sẽ xuất hiện ở đây.")
        } else {
            VStack(spacing: 14) {
                ForEach(model.videos) { VideoRow(video: $0) }
            }
            .padding(.horizontal, 22)
        }
    }

    // MARK: Shared section header

    private func sectionHeader(_ title: String, livePulse: Bool = false, trailing: String? = nil) -> some View {
        HStack(spacing: 10) {
            if livePulse {
                LivePulseDot(reduceMotion: reduceMotion)
            } else {
                RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 14)
            }
            Text(title.uppercased()).font(TLFont.mono(12, .medium)).tracking(2).foregroundStyle(TLColor.fg2)
            Rectangle().fill(LinearGradient(colors: [(livePulse ? TLColor.live : TLColor.accent).opacity(0.4), .clear],
                                            startPoint: .leading, endPoint: .trailing)).frame(height: 1)
            if let trailing { Text(trailing).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3) }
        }
        .padding(.horizontal, 22)
    }

    // MARK: States

    private var skeleton: some View {
        VStack(alignment: .leading, spacing: 20) {
            RoundedRectangle(cornerRadius: TLRadius.xl, style: .continuous).fill(TLColor.surface)
                .aspectRatio(16.0 / 9.0, contentMode: .fit).padding(.horizontal, 22)
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 12).fill(TLColor.surface).frame(width: 138, height: 80)
                    VStack(alignment: .leading, spacing: 8) {
                        RoundedRectangle(cornerRadius: 4).fill(TLColor.surface).frame(height: 14)
                        RoundedRectangle(cornerRadius: 4).fill(TLColor.surface).frame(width: 120, height: 10)
                    }
                    Spacer()
                }
                .padding(.horizontal, 22)
            }
        }
        .redacted(reason: .placeholder)
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 34)).foregroundStyle(TLColor.fg4)
            Text(title).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
            Text(subtitle).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.vertical, 50)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không kết nối được luồng").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(force: true) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

// MARK: - Live pulse dot (respects Reduce Motion)

struct LivePulseDot: View {
    let reduceMotion: Bool
    @State private var animate = false
    var body: some View {
        ZStack {
            if !reduceMotion {
                Circle().fill(TLColor.live.opacity(0.5)).scaleEffect(animate ? 2.1 : 1).opacity(animate ? 0 : 0.5)
            }
            Circle().fill(TLColor.live)
        }
        .frame(width: 7, height: 7)
        .onAppear { if !reduceMotion { withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { animate = true } } }
        .accessibilityHidden(true)
    }
}
