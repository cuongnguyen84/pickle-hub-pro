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
/// Tapping any playable item opens the native AVPlayer screen.
struct LiveView: View {
    @State private var model = LiveViewModel()
    @State private var segment: LiveViewModel.Segment = .live

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    segmentPicker
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                    content
                }
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .background(TLColor.bg)
            .navigationTitle("Trực tiếp")
            .navigationBarTitleDisplayMode(.large)
            .task { await model.load() }
            .refreshable { await model.reload() }
        }
    }

    private var segmentPicker: some View {
        HStack(spacing: 4) {
            ForEach(LiveViewModel.Segment.allCases) { option in
                let selected = option == segment
                Button { segment = option } label: {
                    Text(option.label)
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
            ProgressView().tint(TLColor.accentText).padding(.top, 60)
        case .failed(let message):
            errorState(message)
        case .loaded:
            switch segment {
            case .live: streamList(model.streams, emptyText: "Chưa có buổi phát nào.")
            case .replays: streamList(model.replays, emptyText: "Chưa có bản phát lại.")
            case .videos: videoList(model.videos)
            }
        }
    }

    @ViewBuilder
    private func streamList(_ items: [LivestreamSummary], emptyText: String) -> some View {
        if items.isEmpty {
            emptyState(emptyText)
        } else {
            LazyVStack(spacing: 16) {
                ForEach(items) { stream in
                    streamRow(stream)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private func streamRow(_ stream: LivestreamSummary) -> some View {
        if let url = stream.playbackURL {
            NavigationLink {
                VideoPlayerScreen(url: url, title: stream.displayTitle)
            } label: {
                MediaCard(
                    thumbURL: stream.thumbURL,
                    title: stream.displayTitle,
                    meta: stream.orgName,
                    badge: stream.isLive ? .live : (stream.isEnded ? nil : .scheduled),
                    duration: nil
                )
            }
            .buttonStyle(.plain)
        } else {
            // Scheduled, no stream yet — show as a non-tappable card.
            MediaCard(
                thumbURL: stream.thumbURL,
                title: stream.displayTitle,
                meta: stream.orgName,
                badge: .scheduled,
                duration: nil
            )
        }
    }

    @ViewBuilder
    private func videoList(_ items: [VideoSummary]) -> some View {
        if items.isEmpty {
            emptyState("Chưa có video.")
        } else {
            LazyVStack(spacing: 16) {
                ForEach(items) { video in
                    if let url = video.playbackURL {
                        NavigationLink {
                            VideoPlayerScreen(url: url, title: video.title)
                        } label: {
                            MediaCard(
                                thumbURL: video.thumbURL,
                                title: video.title,
                                meta: video.orgName,
                                badge: nil,
                                duration: video.durationText
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func emptyState(_ text: String) -> some View {
        Text(text)
            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity).padding(.top, 60)
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

/// Shared media card for streams + videos: 16:9 thumbnail with an optional
/// status badge / duration chip, title, and a meta line.
private struct MediaCard: View {
    enum Badge { case live, scheduled }

    let thumbURL: URL?
    let title: String
    let meta: String?
    let badge: Badge?
    let duration: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topLeading) {
                thumbnail
                if let badge { badgeView(badge).padding(8) }
                if let duration {
                    Text(duration)
                        .font(TLFont.mono(10, .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(.black.opacity(0.7), in: RoundedRectangle(cornerRadius: 4))
                        .padding(8)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(TLFont.serif(19)).foregroundStyle(TLColor.fg).lineLimit(2)
                if let meta = meta?.nonEmpty {
                    Text(meta).font(TLFont.mono(10)).tracking(0.4).textCase(.uppercase).foregroundStyle(TLColor.fg3)
                }
            }
        }
    }

    private var thumbnail: some View {
        Rectangle().fill(TLColor.surface2)
            .aspectRatio(16.0 / 9.0, contentMode: .fit)
            .overlay {
                if let thumbURL {
                    AsyncImage(url: thumbURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Color.clear
                    }
                } else {
                    Image(systemName: "play.rectangle").font(.largeTitle).foregroundStyle(TLColor.fg4)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 44)).foregroundStyle(.white.opacity(0.9))
                    .shadow(radius: 6)
            )
    }

    private func badgeView(_ badge: Badge) -> some View {
        HStack(spacing: 5) {
            Circle().fill(badge == .live ? TLColor.live : TLColor.gold).frame(width: 6, height: 6)
            Text(badge == .live ? "TRỰC TIẾP" : "SẮP DIỄN RA")
                .font(TLFont.mono(9, .bold)).tracking(0.6)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(.black.opacity(0.65), in: Capsule())
    }
}
