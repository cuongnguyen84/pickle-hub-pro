import SwiftUI
import AVKit

/// Native HLS/MP4 player for Mux streams + storage videos. Mux playback ids map
/// to `stream.mux.com/<id>.m3u8`, which AVPlayer plays directly — no web embed.
struct VideoPlayerScreen: View {
    let url: URL
    let title: String

    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .background(Color.black)
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                if player == nil {
                    let avPlayer = AVPlayer(url: url)
                    player = avPlayer
                    avPlayer.play()
                }
            }
            .onDisappear {
                player?.pause()
            }
    }
}
