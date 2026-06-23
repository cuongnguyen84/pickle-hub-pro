import SwiftUI

/// Aggregated news entry. Mirrors the web FeedNewsCard: source in the eyebrow,
/// optional "AI" badge for machine-translated items, serif headline, summary.
struct FeedNewsCard: View {
    let news: FeedNews
    let publishedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            FeedEyebrow {
                EyebrowText.time(publishedAt)
                if let source = news.source?.nonEmpty {
                    EyebrowText.dot
                    EyebrowText.label(source)
                }
                EyebrowText.dot
                EyebrowText.accent("TIN")
                if news.aiTranslated {
                    EyebrowText.dot
                    Text("AI").foregroundStyle(TLColor.gold)
                }
            }

            if let urlString = news.imageURL, let url = URL(string: urlString) {
                FeedThumbnail(url: url, aspect: 16.0 / 9.0)
            }

            Text(news.title)
                .font(TLFont.serif(27))
                .foregroundStyle(TLColor.fg)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)

            if let summary = news.summary.nonEmpty {
                Text(summary)
                    .font(TLFont.sans(15))
                    .foregroundStyle(TLColor.fg2)
                    .lineSpacing(3)
                    .lineLimit(3)
            }
        }
        .feedCard()
    }
}
