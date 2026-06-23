import SwiftUI

/// "Tin mới." — compact latest-news list (news_items via FeedRepository).
struct HomeNewsSection: View {
    let items: [FeedItem]   // .news kind, carrying publishedAt

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HomeSectionHeader(title: "Tin mới.")

            VStack(spacing: 0) {
                ForEach(items.prefix(3)) { item in
                    if case .news(let news) = item.kind {
                        NavigationLink {
                            NewsDetailView(news: news, publishedAt: item.publishedAt)
                        } label: {
                            HomeNewsRow(news: news, publishedAt: item.publishedAt)
                        }
                        .buttonStyle(.plain)

                        Rectangle().fill(TLColor.border).frame(height: 1)
                    }
                }
            }

            NavigationLink {
                NewsListView()
            } label: {
                HomeSeeMore(label: "Xem thêm tin tức")
            }
            .buttonStyle(.plain)
        }
    }
}

private struct HomeNewsRow: View {
    let news: FeedNews
    let publishedAt: Date?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                if let source = news.source?.nonEmpty {
                    Text(source)
                        .font(TLFont.mono(10, .semibold))
                        .tracking(0.6)
                        .textCase(.uppercase)
                        .foregroundStyle(TLColor.fg3)
                        .lineLimit(1)
                }
                Text(news.title)
                    .font(TLFont.serif(17))
                    .foregroundStyle(TLColor.accentText)
                    .lineSpacing(1)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Text(FeedDate.relative(publishedAt))
                    .font(TLFont.mono(10))
                    .foregroundStyle(TLColor.fg4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let urlString = news.imageURL, let url = WebRoutes.asset(urlString) {
                FeedThumbnail(url: url, aspect: 1)
                    .frame(width: 84, height: 84)
            }
        }
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}
