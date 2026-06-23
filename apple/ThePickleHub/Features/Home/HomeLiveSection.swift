import SwiftUI

/// "Trực tiếp" — currently-live broadcasts. Hidden when nothing is live. Tapping
/// opens the web player (native Mux player is Phase 6).
struct HomeLiveSection: View {
    let streams: [LivestreamSummary]
    let onOpenWeb: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Circle().fill(TLColor.live).frame(width: 8, height: 8)
                Text("Trực tiếp")
                    .font(TLFont.serif(26))
                    .foregroundStyle(TLColor.fg)
            }

            VStack(spacing: 12) {
                ForEach(streams) { stream in
                    Button { onOpenWeb(WebRoutes.live(id: stream.id)) } label: {
                        LiveCard(stream: stream)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct LiveCard: View {
    let stream: LivestreamSummary

    private var onAirBadge: AnyView {
        AnyView(
            VStack {
                HStack {
                    HStack(spacing: 5) {
                        Circle().fill(.white).frame(width: 5, height: 5)
                        Text("ON AIR").font(TLFont.mono(9, .bold)).tracking(0.8).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(TLColor.live, in: Capsule())
                    Spacer()
                }
                Spacer()
            }
            .padding(10)
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let url = stream.thumbURL {
                FeedThumbnail(url: url, aspect: 16.0 / 9.0, overlay: onAirBadge)
            } else {
                Rectangle()
                    .fill(TLColor.surface2)
                    .aspectRatio(16.0 / 9.0, contentMode: .fit)
                    .overlay { onAirBadge }
                    .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            }

            Text(stream.displayTitle)
                .font(TLFont.sans(16, .semibold))
                .foregroundStyle(TLColor.fg)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            if let org = stream.orgName {
                Text(org).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
            }
        }
        .feedCard()
    }
}
