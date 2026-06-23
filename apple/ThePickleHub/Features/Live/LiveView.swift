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
    }

    enum Phase: Equatable {
        case loading, loaded, failed(String)
    }

    var phase: Phase = .loading
    var streams: [LivestreamSummary] = []
    var replays: [LivestreamSummary] = []
    var videos: [VideoSummary] = []

    private let repo = LiveRepository()
    private var loaded = false

    /// Any stream currently broadcasting — drives the default tab + the live dot.
    var hasLive: Bool { streams.contains { $0.isLive } }

    @MainActor
    func load() async {
        if loaded { return }
        phase = .loading
        do {
            async let live = repo.liveAndUpcoming()
            async let replay = repo.replays()
            async let vids = repo.videos()
            streams = try await live
            replays = try await replay
            videos = try await vids
            loaded = true
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func reload() async {
        loaded = false
        await load()
    }
}

/// Live tab — livestreams (live + scheduled), replays, and highlight videos.
/// Defaults to Phát lại; auto-selects Trực tiếp when something is broadcasting.
struct LiveView: View {
    @State private var model = LiveViewModel()
    @State private var segment: LiveViewModel.Segment = .replays
    @State private var didAutoSelect = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    segmentPicker.padding(.horizontal, 16)
                    content
                }
                .padding(.top, 4)
                .padding(.bottom, 28)
            }
            .background(TLColor.bg)
            .navigationTitle("Trực tiếp")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await model.load()
                if !didAutoSelect {
                    didAutoSelect = true
                    if model.hasLive { segment = .live }
                }
            }
            .refreshable { await model.reload() }
        }
    }

    private var segmentPicker: some View {
        HStack(spacing: 4) {
            ForEach(LiveViewModel.Segment.allCases) { option in
                let selected = option == segment
                Button { withAnimation(.easeInOut(duration: 0.18)) { segment = option } } label: {
                    HStack(spacing: 5) {
                        if option == .live && model.hasLive {
                            Circle().fill(selected ? TLColor.accentInk : TLColor.live).frame(width: 6, height: 6)
                        }
                        Text(option.label)
                    }
                    .font(TLFont.sans(13, selected ? .semibold : .medium))
                    .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                    .frame(maxWidth: .infinity).padding(.vertical, 9)
                    .background(selected ? TLColor.accent : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(TLColor.surface, in: Capsule())
        .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).padding(.top, 80)
        case .failed(let message):
            errorState(message)
        case .loaded:
            switch segment {
            case .live: streamSection(model.streams, empty: "Chưa có buổi phát nào.")
            case .replays: streamSection(model.replays, empty: "Chưa có bản phát lại.")
            case .videos: videoSection(model.videos)
            }
        }
    }

    // MARK: Streams (live / replays) — hero + list

    @ViewBuilder
    private func streamSection(_ items: [LivestreamSummary], empty: String) -> some View {
        if items.isEmpty {
            emptyState(empty)
        } else {
            VStack(spacing: 18) {
                heroLink(for: items[0]) { stream in
                    HeroMediaCard(thumbURL: stream.thumbURL, title: stream.displayTitle,
                                  meta: stream.orgName, badge: badge(for: stream), duration: nil)
                }
                if items.count > 1 {
                    LazyVStack(spacing: 14) {
                        ForEach(items.dropFirst()) { stream in
                            rowLink(for: stream) {
                                ListMediaCard(thumbURL: stream.thumbURL, title: stream.displayTitle,
                                              meta: stream.orgName, badge: badge(for: stream), duration: nil)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private func videoSection(_ items: [VideoSummary]) -> some View {
        if items.isEmpty {
            emptyState("Chưa có video.")
        } else {
            VStack(spacing: 18) {
                if let first = items.first, first.playbackURL != nil {
                    NavigationLink {
                        VideoPlayerScreen(url: first.playbackURL!, title: first.title)
                    } label: {
                        HeroMediaCard(thumbURL: first.thumbURL, title: first.title,
                                      meta: first.orgName, badge: nil, duration: first.durationText)
                    }
                    .buttonStyle(.plain)
                }
                LazyVStack(spacing: 14) {
                    ForEach(items.dropFirst()) { video in
                        if let url = video.playbackURL {
                            NavigationLink {
                                VideoPlayerScreen(url: url, title: video.title)
                            } label: {
                                ListMediaCard(thumbURL: video.thumbURL, title: video.title,
                                              meta: video.orgName, badge: nil, duration: video.durationText)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func badge(for stream: LivestreamSummary) -> MediaBadge? {
        if stream.isLive { return .live }
        if !stream.isEnded { return .scheduled }
        return nil
    }

    @ViewBuilder
    private func heroLink<Label: View>(for stream: LivestreamSummary, @ViewBuilder label: (LivestreamSummary) -> Label) -> some View {
        if let url = stream.playbackURL {
            NavigationLink { VideoPlayerScreen(url: url, title: stream.displayTitle) } label: { label(stream) }
                .buttonStyle(.plain)
        } else {
            label(stream)
        }
    }

    @ViewBuilder
    private func rowLink<Label: View>(for stream: LivestreamSummary, @ViewBuilder label: () -> Label) -> some View {
        if let url = stream.playbackURL {
            NavigationLink { VideoPlayerScreen(url: url, title: stream.displayTitle) } label: { label() }
                .buttonStyle(.plain)
        } else {
            label()
        }
    }

    private func emptyState(_ text: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "play.slash").font(.system(size: 34)).foregroundStyle(TLColor.fg4)
            Text(text).font(TLFont.sans(14)).foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity).padding(.top, 80)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "dot.radiowaves.up.forward").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.reload() } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

enum MediaBadge { case live, scheduled }

private struct BadgePill: View {
    let badge: MediaBadge
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(badge == .live ? TLColor.live : TLColor.gold).frame(width: 6, height: 6)
            Text(badge == .live ? "TRỰC TIẾP" : "SẮP DIỄN RA")
                .font(TLFont.mono(9, .bold)).tracking(0.8)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 9).padding(.vertical, 5)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(.white.opacity(0.15), lineWidth: 1))
    }
}

private struct DurationPill: View {
    let text: String
    var body: some View {
        Text(text)
            .font(TLFont.mono(10, .semibold)).foregroundStyle(.white)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 5))
    }
}

/// Large editorial hero: full-bleed thumbnail, gradient scrim, title overlaid.
private struct HeroMediaCard: View {
    let thumbURL: URL?
    let title: String
    let meta: String?
    let badge: MediaBadge?
    let duration: String?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Rectangle().fill(TLColor.surface2)
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .overlay {
                    if let thumbURL {
                        AsyncImage(url: thumbURL) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                    } else {
                        Image(systemName: "play.rectangle").font(.system(size: 40)).foregroundStyle(TLColor.fg4)
                    }
                }
                .clipped()

            LinearGradient(colors: [.clear, .black.opacity(0.85)], startPoint: .center, endPoint: .bottom)

            VStack(alignment: .leading, spacing: 8) {
                if let badge { BadgePill(badge: badge) }
                Text(title).font(TLFont.serif(24)).foregroundStyle(.white).lineLimit(3)
                if let meta = meta?.nonEmpty {
                    Text(meta.uppercased()).font(TLFont.mono(10, .medium)).tracking(0.6).foregroundStyle(.white.opacity(0.7))
                }
            }
            .padding(16)

            Image(systemName: "play.circle.fill")
                .font(.system(size: 52)).foregroundStyle(.white.opacity(0.92)).shadow(radius: 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)

            if let duration {
                DurationPill(text: duration)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(10)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: TLRadius.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.xl, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.3), radius: 14, y: 8)
    }
}

/// Compact list row: thumbnail left, title + meta right.
private struct ListMediaCard: View {
    let thumbURL: URL?
    let title: String
    let meta: String?
    let badge: MediaBadge?
    let duration: String?

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                Rectangle().fill(TLColor.surface2)
                    .frame(width: 132, height: 76)
                    .overlay {
                        if let thumbURL {
                            AsyncImage(url: thumbURL) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                        } else {
                            Image(systemName: "play.rectangle").foregroundStyle(TLColor.fg4)
                        }
                    }
                    .clipped()
                    .overlay(Image(systemName: "play.circle.fill").font(.system(size: 26)).foregroundStyle(.white.opacity(0.9)))
                if let duration { DurationPill(text: duration).padding(5) }
            }
            .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))

            VStack(alignment: .leading, spacing: 5) {
                if let badge { BadgePill(badge: badge) }
                Text(title).font(TLFont.serif(17)).foregroundStyle(TLColor.fg).lineLimit(2)
                if let meta = meta?.nonEmpty {
                    Text(meta.uppercased()).font(TLFont.mono(9, .medium)).tracking(0.5).foregroundStyle(TLColor.fg3).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
    }
}
