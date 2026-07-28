import SwiftUI

/// Full video replay list — native mirror of the web `/videos` page. Reached
/// from the Home "Sân đấu" section's "Xem tất cả". Same data source as the
/// homepage section (`videos` table, published, newest first) with the web's
/// all / long / short filter applied client-side.
struct VideosListView: View {
    @State private var videos: [VideoSummary] = []
    @State private var phase: Phase = .loading
    @State private var filter: Filter = .all
    @State private var openURL: IdentifiedURL?

    private let repo = HomeRepository()

    private enum Phase: Equatable { case loading, loaded, failed(String) }

    private enum Filter: CaseIterable {
        case all, long, short

        var label: String {
            switch self {
            case .all: return "Tất cả"
            case .long: return "Highlights"
            case .short: return String(localized: "Clip ngắn")
            }
        }
    }

    private var items: [VideoSummary] {
        switch filter {
        case .all: return videos
        case .long: return videos.filter { $0.type == "long" }
        case .short: return videos.filter { $0.isShort }
        }
    }

    var body: some View {
        ScrollView {
            switch phase {
            case .loading:
                ProgressView().tint(TLColor.accentText).padding(.top, 60)
            case .failed(let message):
                VStack(spacing: 10) {
                    Text("Không tải được video").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
                    Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
                    Button("Thử lại") { Task { await load() } }.foregroundStyle(TLColor.accentText)
                }
                .padding(.horizontal, 32).padding(.top, 60)
            case .loaded:
                VStack(alignment: .leading, spacing: 14) {
                    TLSegmented(options: Filter.allCases, selection: $filter) { $0.label }

                    if items.isEmpty {
                        VStack(spacing: 6) {
                            Text("Chưa có video.")
                                .font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
                            Text("Quay lại sau — video mới được đăng mỗi tuần.")
                                .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 48)
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(items) { video in
                                if let url = video.playbackURL {
                                    NavigationLink {
                                        VideoPlayerScreen(url: url, title: video.title, progressKey: video.id.uuidString)
                                    } label: {
                                        VideoHighlightCard(video: video)
                                    }
                                    .buttonStyle(.plain)
                                } else {
                                    Button { openURL = IdentifiedURL(url: WebRoutes.video(id: video.id)) } label: {
                                        VideoHighlightCard(video: video)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Video")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $openURL) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    private func load() async {
        if videos.isEmpty { phase = .loading }
        do {
            // ponytail: same query as the Home section — web /videos uses limit 60.
            videos = try await repo.highlightVideos(limit: 60)
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}
