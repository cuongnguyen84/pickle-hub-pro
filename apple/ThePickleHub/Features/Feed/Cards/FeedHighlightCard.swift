import SwiftUI

/// System-generated highlight card (feed_highlights): player milestones,
/// weekly DUPR movers, pro tour digests, AI weekly recaps. Bodies are
/// pre-rendered Vietnamese text from the feed-generate cron; multi-line
/// bodies (leaderboard top-5) keep their line breaks.
/// Mirrors web `FeedHighlightCard.tsx`.
struct FeedHighlightCard: View {
    let highlight: FeedHighlight
    let publishedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            FeedEyebrow {
                EyebrowText.time(publishedAt)
                EyebrowText.dot
                EyebrowText.accent(highlight.badge)
            }

            Text(highlight.title)
                .font(TLFont.serif(22))
                .foregroundStyle(TLColor.fg)
                .lineLimit(3)
                .multilineTextAlignment(.leading)

            if let body = highlight.body?.nonEmpty {
                Text(body)
                    .font(TLFont.sans(14))
                    .foregroundStyle(TLColor.fg2)
                    .lineSpacing(3)
                    .multilineTextAlignment(.leading)
            }
        }
        .feedCard()
    }
}
