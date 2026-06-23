import SwiftUI

/// The native `/feed` — a scored, mixed timeline of matches, blog posts, and
/// videos from `get_feed_timeline`. Tapping a card opens its web page in an
/// in-app Safari sheet until native detail screens land. News joins in Phase 3.
struct FeedView: View {
    @State private var model = FeedViewModel()
    @State private var openURL: IdentifiedURL?

    var body: some View {
        ScrollView {
            content
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
        }
        .background(TLColor.bg)
        .navigationTitle("Bảng tin")
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await model.refresh() }
        .task { await model.loadInitial() }
        .sheet(item: $openURL) { item in
            SafariView(url: item.url).ignoresSafeArea()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading where model.items.isEmpty:
            loadingState
        case .failed(let message) where model.items.isEmpty:
            errorState(message)
        default:
            LazyVStack(spacing: 14) {
                ForEach(model.items) { item in
                    FeedTimelineRow(item: item) { openURL = IdentifiedURL(url: $0) }
                        .task { await model.loadMoreIfNeeded(currentItem: item) }
                }
                if model.isLoadingMore {
                    ProgressView().tint(TLColor.green).padding(.vertical, 16)
                }
                if model.reachedEnd, !model.items.isEmpty {
                    Text("· Hết bảng tin ·")
                        .font(.caption2.weight(.medium))
                        .tracking(1.5)
                        .foregroundStyle(TLColor.fg4)
                        .padding(.vertical, 20)
                }
            }
        }
    }

    private var loadingState: some View {
        VStack(spacing: 14) {
            ProgressView().tint(TLColor.green)
            Text("Đang tải bảng tin…")
                .font(.footnote)
                .foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(TLColor.fg3)
            Text("Không tải được bảng tin")
                .font(.headline)
                .foregroundStyle(TLColor.fg)
            Text(message)
                .font(.caption)
                .foregroundStyle(TLColor.fg3)
                .multilineTextAlignment(.center)
                .textSelection(.enabled)
            Button("Thử lại") { Task { await model.refresh() } }
                .foregroundStyle(TLColor.green)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
        .padding(.top, 80)
    }
}

/// Dispatches a `FeedItem` to its card and makes the whole card tap-to-open.
private struct FeedTimelineRow: View {
    let item: FeedItem
    let onOpen: (URL) -> Void

    var body: some View {
        Button {
            if let url { onOpen(url) }
        } label: {
            card
        }
        .buttonStyle(.plain)
    }

    private var url: URL? {
        switch item.kind {
        case .match(let match): return match.slug.map { WebRoutes.match(slug: $0) }
        case .blog(let blog): return WebRoutes.blog(slug: blog.slug)
        case .video(let video): return WebRoutes.video(id: video.videoID)
        }
    }

    @ViewBuilder
    private var card: some View {
        switch item.kind {
        case .match(let match): FeedMatchCard(match: match, publishedAt: item.publishedAt)
        case .blog(let blog): FeedBlogCard(blog: blog, publishedAt: item.publishedAt)
        case .video(let video): FeedVideoCard(video: video, publishedAt: item.publishedAt)
        }
    }
}
