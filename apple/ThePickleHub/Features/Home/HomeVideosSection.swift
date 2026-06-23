import SwiftUI

/// "Sân đấu." — highlight videos. Tapping opens the web player (native player
/// is Phase 6).
struct HomeVideosSection: View {
    let videos: [VideoSummary]
    let onOpenWeb: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HomeSectionHeader(title: "Sân đấu.")

            VStack(spacing: 12) {
                ForEach(videos) { video in
                    Button { onOpenWeb(WebRoutes.video(id: video.id)) } label: {
                        VideoHighlightCard(video: video)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct VideoHighlightCard: View {
    let video: VideoSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            poster

            Text(video.title)
                .font(TLFont.sans(16, .semibold))
                .foregroundStyle(TLColor.fg)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                if let org = video.orgName {
                    Text(org)
                    Text("·").foregroundStyle(TLColor.fg4)
                }
                Text(FeedDate.relative(FeedDate.parse(video.publishedAt ?? "")))
                if let duration = video.durationText {
                    Text("·").foregroundStyle(TLColor.fg4)
                    Text(duration)
                }
            }
            .font(TLFont.mono(10))
            .foregroundStyle(TLColor.fg3)
        }
        .feedCard()
    }

    private var playBadge: AnyView {
        AnyView(
            Image(systemName: "play.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(.white.opacity(0.92))
                .shadow(color: .black.opacity(0.4), radius: 8)
        )
    }

    @ViewBuilder
    private var poster: some View {
        if let url = video.thumbURL {
            FeedThumbnail(url: url, aspect: 16.0 / 9.0, overlay: playBadge)
        } else {
            Rectangle()
                .fill(TLColor.surface2)
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .overlay { playBadge }
                .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        }
    }
}
