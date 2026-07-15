import SwiftUI

/// Instagram reel card. Nothing is downloaded or re-hosted — tapping opens
/// the reel URL, which iOS routes to the Instagram app when installed
/// (universal link) or Safari otherwise. Mirrors web `FeedEmbedCard.tsx`.
struct FeedEmbedCard: View {
    let embed: FeedEmbed
    let publishedAt: Date?

    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            openURL(embed.url)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                FeedEyebrow {
                    EyebrowText.time(publishedAt)
                    if let author = embed.authorName?.nonEmpty {
                        EyebrowText.dot
                        EyebrowText.label("@\(author)")
                    }
                    Spacer(minLength: 8)
                    EyebrowText.accent("▶ Reel · Instagram")
                }

                if let thumbnail = embed.thumbnailURL {
                    FeedThumbnail(
                        url: thumbnail,
                        aspect: 4.0 / 3.0,
                        overlay: AnyView(playOverlay)
                    )
                }

                Text(embed.caption?.nonEmpty ?? "Video pickleball trên Instagram")
                    .font(TLFont.serif(22))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 6) {
                    Image(systemName: "play.circle.fill")
                    Text("Xem trên Instagram")
                }
                .font(TLFont.sans(13, .medium))
                .foregroundStyle(TLColor.accentText)
            }
            .feedCard()
        }
        .buttonStyle(.plain)
    }

    /// Big centered play glyph over the poster frame — the visual cue that
    /// this card is a video, since playback happens on Instagram.
    private var playOverlay: some View {
        Image(systemName: "play.circle.fill")
            .font(.system(size: 44))
            .symbolRenderingMode(.palette)
            .foregroundStyle(.white, .black.opacity(0.45))
            .shadow(radius: 6)
    }
}
