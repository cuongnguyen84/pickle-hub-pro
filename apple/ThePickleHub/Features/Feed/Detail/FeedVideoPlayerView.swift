import SwiftUI

/// Loads a feed video's playable URL (Mux HLS / storage file) and plays it
/// natively via AVPlayer (VideoPlayerScreen). Falls back to the web page if the
/// video has no playable source. Replaces the old Safari hand-off for feed
/// video cards.
struct FeedVideoPlayerView: View {
    let video: FeedVideo

    @State private var phase: Phase = .loading
    @State private var showWeb = false

    enum Phase: Equatable { case loading, ready(URL), failed }

    private let repo = FeedRepository()

    var body: some View {
        Group {
            switch phase {
            case .loading:
                ZStack {
                    Color.black.ignoresSafeArea()
                    ProgressView().tint(.white)
                }
            case .ready(let url):
                VideoPlayerScreen(url: url, title: video.title)
            case .failed:
                VStack(spacing: 12) {
                    Image(systemName: "film.stack").font(.largeTitle).foregroundStyle(TLColor.fg3)
                    Text("Không phát được video này").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                    Button("Mở trên web") { showWeb = true }.foregroundStyle(TLColor.accentText)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(TLColor.bg)
            }
        }
        .navigationTitle(video.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let playback = await repo.videoPlayback(id: video.videoID) {
                phase = .ready(playback.url)
            } else {
                phase = .failed
            }
        }
        .sheet(isPresented: $showWeb) {
            SafariView(url: WebRoutes.video(id: video.videoID)).ignoresSafeArea()
        }
    }
}
