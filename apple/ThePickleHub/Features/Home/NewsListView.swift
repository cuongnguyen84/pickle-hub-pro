import SwiftUI

/// Full list of recent news, reached from the Home "Xem thêm".
struct NewsListView: View {
    @State private var items: [FeedItem] = []
    @State private var phase: Phase = .loading

    private let repo = FeedRepository()

    private enum Phase: Equatable { case loading, loaded, failed(String) }

    var body: some View {
        ScrollView {
            switch phase {
            case .loading:
                ProgressView().tint(TLColor.accentText).padding(.top, 60)
            case .failed(let message):
                VStack(spacing: 10) {
                    Text("Không tải được tin tức").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
                    Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
                    Button("Thử lại") { Task { await load() } }.foregroundStyle(TLColor.accentText)
                }
                .padding(.horizontal, 32).padding(.top, 60)
            case .loaded:
                LazyVStack(spacing: 14) {
                    ForEach(items) { item in
                        if case .news(let news) = item.kind {
                            NavigationLink {
                                NewsDetailView(news: news, publishedAt: item.publishedAt)
                            } label: {
                                FeedNewsCard(news: news, publishedAt: item.publishedAt)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Tin tức")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
    }

    private func load() async {
        phase = .loading
        do {
            items = try await repo.news()
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}
