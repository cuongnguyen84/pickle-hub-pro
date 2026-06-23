import SwiftUI

/// Full list of published VI blog posts, reached from the Home "Xem thêm".
struct BlogListView: View {
    @State private var posts: [BlogPostSummary] = []
    @State private var phase: Phase = .loading

    private let repo = HomeRepository()

    private enum Phase: Equatable { case loading, loaded, failed(String) }

    var body: some View {
        ScrollView {
            switch phase {
            case .loading:
                ProgressView().tint(TLColor.accentText).padding(.top, 60)
            case .failed(let message):
                VStack(spacing: 10) {
                    Text("Không tải được bài viết").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
                    Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
                    Button("Thử lại") { Task { await load() } }.foregroundStyle(TLColor.accentText)
                }
                .padding(.horizontal, 32).padding(.top, 60)
            case .loaded:
                LazyVStack(spacing: 16) {
                    ForEach(posts) { StoryLink(post: $0) }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Bài viết")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
    }

    private func load() async {
        phase = .loading
        do {
            posts = try await repo.featuredPosts(limit: 30)
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}
