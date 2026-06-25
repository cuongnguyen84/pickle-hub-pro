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
    let url: URL
    let title: String
    var progressKey: String? = nil

    @State private var player: AVPlayer?
    @State private var observer: Any?

    var body: some View {
        VideoPlayer(player: player)
            .background(Color.black)
            .ignoresSafeArea(edges: .bottom)
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

    private func start() {
        configureAudioSession()
        guard player == nil else { player?.play(); return }
        let avPlayer = AVPlayer(url: url)
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
