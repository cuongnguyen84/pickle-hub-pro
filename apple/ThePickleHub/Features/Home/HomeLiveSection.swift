import SwiftUI

/// "Trực tiếp" — live broadcasts, or upcoming scheduled ones when nothing is
/// on air (mirrors web LiveSection: scheduled streams must always surface on
/// Home). Tapping opens the web player (native Mux player is Phase 6).
struct HomeLiveSection: View {
    let liveStreams: [LivestreamSummary]
    let scheduledStreams: [LivestreamSummary]
    let onOpenWeb: (URL) -> Void

    private var isLive: Bool { !liveStreams.isEmpty }
    private var streams: [LivestreamSummary] { isLive ? liveStreams : scheduledStreams }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                if isLive {
                    Circle().fill(TLColor.live).frame(width: 8, height: 8)
                }
                Text(isLive ? "Trực tiếp" : "Sắp phát sóng")
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

/// "20:00 · 8/7" local-time label for a scheduled stream.
func scheduledTimeLabel(_ stream: LivestreamSummary) -> String? {
    guard let date = stream.scheduledDate else { return nil }
    let time = date.formatted(date: .omitted, time: .shortened)
    let comps = Calendar.current.dateComponents([.day, .month], from: date)
    return "\(time) · \(comps.day ?? 0)/\(comps.month ?? 0)"
}

private struct LiveCard: View {
    let stream: LivestreamSummary

    private var badge: AnyView {
        AnyView(
            VStack {
                HStack {
                    HStack(spacing: 5) {
                        Circle().fill(.white).frame(width: 5, height: 5)
                        Text(stream.isLive ? "ON AIR" : "SẮP PHÁT")
                            .font(TLFont.mono(9, .bold)).tracking(0.8).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(stream.isLive ? TLColor.live : TLColor.fg2, in: Capsule())
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
                FeedThumbnail(url: url, aspect: 16.0 / 9.0, overlay: badge)
            } else {
                Rectangle()
                    .fill(TLColor.surface2)
                    .aspectRatio(16.0 / 9.0, contentMode: .fit)
                    .overlay { badge }
                    .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            }

            Text(stream.displayTitle)
                .font(TLFont.sans(16, .semibold))
                .foregroundStyle(TLColor.fg)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                if let org = stream.orgName {
                    Text(org).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                }
                if !stream.isLive, let when = scheduledTimeLabel(stream) {
                    if stream.orgName != nil {
                        Text("·").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                    }
                    Text(when).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                }
            }
        }
        .feedCard()
    }
}
