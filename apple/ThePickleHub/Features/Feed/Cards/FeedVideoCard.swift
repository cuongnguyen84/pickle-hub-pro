import SwiftUI

/// Video entry. Long-form gets a 16:9 banner; shorts get a tall 9:16 frame.
struct FeedVideoCard: View {
    let video: FeedVideo
    let publishedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            FeedEyebrow {
                EyebrowText.time(publishedAt)
                EyebrowText.dot
                EyebrowText.accent(FeedFormat.videoKind(isShort: video.isShort))
                if let duration = FeedFormat.duration(video.durationSeconds) {
                    EyebrowText.dot
                    EyebrowText.label(duration)
                }
            }

            thumbnail

            Text(video.title)
                .font(.system(.title2, design: .serif).italic())
                .foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)

            if let description = video.description?.nonEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(TLColor.fg2)
                    .lineLimit(2)
            }
        }
        .feedCard()
    }

    @ViewBuilder
    private var thumbnail: some View {
        let playBadge = AnyView(
            Image(systemName: "play.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(.white.opacity(0.92))
                .shadow(color: .black.opacity(0.4), radius: 8)
        )
        if let urlString = video.thumbnailURL, let url = URL(string: urlString) {
            if video.isShort {
                HStack {
                    Spacer()
                    FeedThumbnail(url: url, aspect: 9.0 / 16.0, overlay: playBadge)
                        .frame(maxWidth: 220)
                    Spacer()
                }
            } else {
                FeedThumbnail(url: url, aspect: 16.0 / 9.0, overlay: playBadge)
            }
        }
    }
}
