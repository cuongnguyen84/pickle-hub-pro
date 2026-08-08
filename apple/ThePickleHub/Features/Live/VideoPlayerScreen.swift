import SwiftUI
import AVKit

/// Native HLS/MP4 player for Mux streams + storage videos. Mux playback ids map
/// to `stream.mux.com/<id>.m3u8`, which AVPlayer plays directly — no web embed.
///
/// For VOD (a `progressKey` is supplied) it resumes at the last watched second
/// and saves progress to `WatchProgressStore` periodically, with a "Xem từ đầu"
/// control. Live streams pass `progressKey: nil` (no resume). AVPlayer surfaces
/// AirPlay + the system PiP button through the standard player controls.
struct VideoPlayerScreen: View {
    private enum PlaybackQuality: Int, CaseIterable, Identifiable {
        case auto = 0
        case p1080 = 1080
        case p720 = 720
        case p540 = 540
        case p360 = 360
        case p270 = 270

        var id: Int { rawValue }
        var label: String { self == .auto ? "Tự động" : "\(rawValue)p" }
        var muxResolution: String? { self == .auto ? nil : "\(rawValue)p" }
        var resolution: CGSize {
            switch self {
            case .auto: return .zero
            case .p1080: return CGSize(width: 1920, height: 1080)
            case .p720: return CGSize(width: 1280, height: 720)
            case .p540: return CGSize(width: 960, height: 540)
            case .p360: return CGSize(width: 640, height: 360)
            case .p270: return CGSize(width: 480, height: 270)
            }
        }
    }

    let url: URL
    let title: String
    var progressKey: String? = nil
    /// When set, a live-chat panel renders under the player (livestreams/replays).
    var livestreamID: UUID? = nil

    @State private var player: AVPlayer?
    @State private var observer: Any?
    @State private var playbackQuality: PlaybackQuality = .auto

    private var isHLS: Bool { url.pathExtension.lowercased() == "m3u8" }
    private var isMuxHLS: Bool {
        isHLS && url.host?.lowercased().hasSuffix("mux.com") == true
    }

    var body: some View {
        Group {
            if let livestreamID {
                // Player pinned at 16:9 up top, chat fills the rest.
                VStack(spacing: 0) {
                    playerView
                        .aspectRatio(16.0 / 9.0, contentMode: .fit)
                        .background(Color.black)
                    ChatPanel(livestreamID: livestreamID.uuidString.lowercased())
                }
            } else {
                playerView
                    .background(Color.black)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if progressKey != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Xem từ đầu") { player?.seek(to: .zero) }
                        .font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.accentText)
                }
            }
        }
        .onAppear(perform: start)
        .onDisappear(perform: stop)
    }

    private var playerView: some View {
        ZStack(alignment: .topTrailing) {
            VideoPlayer(player: player)
            if isHLS {
                qualityMenu.padding(8)
            }
        }
    }

    private var qualityMenu: some View {
        Menu {
            ForEach(PlaybackQuality.allCases) { quality in
                Button {
                    playbackQuality = quality
                    applyPlaybackQuality()
                } label: {
                    if playbackQuality == quality {
                        Label(quality.label, systemImage: "checkmark")
                    } else {
                        Text(quality.label)
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "gearshape.fill")
                Text(playbackQuality == .auto ? "Auto" : playbackQuality.label)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .frame(height: 38)
            .background(.black.opacity(0.55), in: Capsule())
        }
        .accessibilityLabel("Chất lượng video")
        .accessibilityValue(playbackQuality.label)
    }

    private func start() {
        configureAudioSession()
        guard player == nil else { player?.play(); return }
        let item = makePlayerItem(for: playbackQuality)
        let avPlayer = AVPlayer(playerItem: item)
        player = avPlayer

        // Resume VOD at the saved position.
        if let key = progressKey, let saved = WatchProgressStore.get(key), saved.isResumable {
            avPlayer.seek(to: CMTime(seconds: saved.position, preferredTimescale: 600))
        }
        // Persist progress every 5s while playing.
        if let key = progressKey {
            observer = avPlayer.addPeriodicTimeObserver(
                forInterval: CMTime(seconds: 5, preferredTimescale: 1), queue: .main
            ) { _ in
                let pos = avPlayer.currentTime().seconds
                let dur = avPlayer.currentItem?.duration.seconds ?? 0
                guard pos.isFinite, pos > 0 else { return }
                WatchProgressStore.set(key, position: pos, duration: dur.isFinite ? dur : 0)
            }
        }
        avPlayer.play()
    }

    private func applyPlaybackQuality() {
        guard let player else { return }

        // AVPlayer's preferredMaximumResolution is advisory and may keep the
        // current rendition. Mux manifest constraints make a manual selection
        // deterministic by returning only the requested rendition.
        let position = player.currentTime()
        let shouldResume = player.timeControlStatus != .paused
        player.replaceCurrentItem(with: makePlayerItem(for: playbackQuality))

        if progressKey != nil, position.isValid, position.seconds.isFinite {
            player.seek(to: position, toleranceBefore: .zero, toleranceAfter: .zero)
        }
        if shouldResume { player.play() }
    }

    private func makePlayerItem(for quality: PlaybackQuality) -> AVPlayerItem {
        let item = AVPlayerItem(url: playbackURL(for: quality))
        item.preferredMaximumResolution = quality.resolution
        item.preferredPeakBitRate = 0
        return item
    }

    private func playbackURL(for quality: PlaybackQuality) -> URL {
        guard isMuxHLS, var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }

        var queryItems = components.queryItems ?? []
        queryItems.removeAll { $0.name == "min_resolution" || $0.name == "max_resolution" }
        if let resolution = quality.muxResolution {
            queryItems.append(URLQueryItem(name: "min_resolution", value: resolution))
            queryItems.append(URLQueryItem(name: "max_resolution", value: resolution))
        }
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url ?? url
    }

    private func stop() {
        if let observer { player?.removeTimeObserver(observer); self.observer = nil }
        // Final save on exit.
        if let key = progressKey, let p = player {
            let pos = p.currentTime().seconds
            let dur = p.currentItem?.duration.seconds ?? 0
            if pos.isFinite, pos > 0 { WatchProgressStore.set(key, position: pos, duration: dur.isFinite ? dur : 0) }
        }
        player?.pause()
    }

    private func configureAudioSession() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)
    }
}
