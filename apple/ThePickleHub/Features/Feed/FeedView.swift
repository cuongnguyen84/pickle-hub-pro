import SwiftUI

/// The native `/feed` — a scored, mixed timeline of matches, blog posts, and
/// videos from `get_feed_timeline`. Tapping a card opens its web page in an
/// in-app Safari sheet until native detail screens land. News joins in Phase 3.
struct FeedView: View {
    @State private var model = FeedViewModel()
    @State private var openURL: IdentifiedURL?
    @State private var showComposer = false

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
        .overlay(alignment: .bottomTrailing) {
            // Admin-only in this phase, mirroring the web gate: the
            // composer button floats above the assistant launcher.
            if model.isAdmin {
                Button {
                    showComposer = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(TLColor.accentInk)
                        .frame(width: 52, height: 52)
                        .background(TLColor.accent, in: Circle())
                        .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Tạo bài đăng")
                .padding(.trailing, 16)
                .padding(.bottom, 70)
            }
        }
        .sheet(isPresented: $showComposer) {
            SocialPostComposerView {
                Task { await model.refresh() }
            }
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
                    ProgressView().tint(TLColor.accentText).padding(.vertical, 16)
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
            ProgressView().tint(TLColor.accentText)
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
                .foregroundStyle(TLColor.accentText)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
        .padding(.top, 80)
    }
}

/// Dispatches a `FeedItem` to its card. Match / blog / news push a native
/// detail screen; video still opens the web player in Safari (native player is
/// Phase 6).
private struct FeedTimelineRow: View {
    let item: FeedItem
    let onOpenWeb: (URL) -> Void

    var body: some View {
        switch item.kind {
        case .match(let match):
            // Match details expand inline via the card's own dropdown.
            FeedMatchCard(match: match, publishedAt: item.publishedAt)
        case .blog(let blog):
            NavigationLink {
                BlogReaderView(slug: blog.slug, title: blog.title)
            } label: {
                FeedBlogCard(blog: blog, publishedAt: item.publishedAt)
            }
            .buttonStyle(.plain)
        case .news(let news):
            NavigationLink {
                NewsDetailView(news: news, publishedAt: item.publishedAt)
            } label: {
                FeedNewsCard(news: news, publishedAt: item.publishedAt)
            }
            .buttonStyle(.plain)
        case .video(let video):
            NavigationLink {
                FeedVideoPlayerView(video: video)
            } label: {
                FeedVideoCard(video: video, publishedAt: item.publishedAt)
            }
            .buttonStyle(.plain)
        case .embed(let embed):
            // Opens instagram.com directly (universal link → IG app when
            // installed) — the card handles its own tap via openURL.
            FeedEmbedCard(embed: embed, publishedAt: item.publishedAt)
        case .happening(let happening):
            Button {
                onOpenWeb(happening.url)
            } label: {
                FeedHappeningCard(happening: happening)
            }
            .buttonStyle(.plain)
        case .highlight(let highlight):
            if let url = highlight.url {
                Button {
                    onOpenWeb(url)
                } label: {
                    FeedHighlightCard(highlight: highlight, publishedAt: item.publishedAt)
                }
                .buttonStyle(.plain)
            } else {
                FeedHighlightCard(highlight: highlight, publishedAt: item.publishedAt)
            }
        case .socialPost(let post):
            FeedSocialPostCard(post: post, publishedAt: item.publishedAt)
        }
    }
}
