import SwiftUI

/// "Trực tiếp" — one featured stream as a full card (live first, else the
/// soonest scheduled), the rest as compact schedule rows so many streams no
/// longer stack full-height down the homepage. Scheduled streams stay visible
/// under a live broadcast so the upcoming lineup is always readable.
/// Tapping opens the native player / waiting room (LiveWatchScreen).
struct HomeLiveSection: View {
    let liveStreams: [LivestreamSummary]
    let scheduledStreams: [LivestreamSummary]
    /// Luồng vừa kết thúc (repo đã lọc ≤7 ngày) — hàng replay dưới lineup.
    var endedStreams: [LivestreamSummary] = []

    private var isLive: Bool { !liveStreams.isEmpty }
    /// Live now (soonest-created first from repo) then upcoming by start time.
    private var ordered: [LivestreamSummary] { liveStreams + scheduledStreams }
    private var featured: LivestreamSummary? { ordered.first }
    private var rest: [LivestreamSummary] { Array(ordered.dropFirst().prefix(5)) }

    private var headTitle: String {
        if isLive { return "Trực tiếp" }
        if !ordered.isEmpty { return String(localized: "Sắp phát sóng") }
        return String(localized: "Vừa phát sóng")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                if isLive {
                    Circle().fill(TLColor.live).frame(width: 8, height: 8)
                }
                Text(headTitle)
                    .font(TLFont.serif(26))
                    .foregroundStyle(TLColor.fg)
                if liveStreams.count > 1 {
                    Text("\(liveStreams.count) SÂN")
                        .font(TLFont.mono(9, .bold)).tracking(0.8)
                        .foregroundStyle(TLColor.live)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .overlay(Capsule().strokeBorder(TLColor.live.opacity(0.45), lineWidth: 1))
                }
            }

            if let featured {
                NavigationLink { LiveWatchScreen(stream: featured) } label: {
                    LiveCard(stream: featured)
                }
                .buttonStyle(.plain)
            }

            // Replay "vừa kết thúc" nhập chung list — nhận diện bằng chip
            // XEM LẠI highlight trong row, không heading riêng chiếm chỗ.
            let listRows = rest + endedStreams
            if !listRows.isEmpty {
                streamRows(listRows)
            }
        }
    }

    private func streamRows(_ streams: [LivestreamSummary]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(streams.enumerated()), id: \.element.id) { idx, stream in
                NavigationLink { LiveWatchScreen(stream: stream) } label: {
                    CompactStreamRow(stream: stream)
                }
                .buttonStyle(.plain)
                if idx < streams.count - 1 {
                    Divider().overlay(TLColor.border).padding(.leading, 122)
                }
            }
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }
}

/// "20:00 · 8/7" local-time label for a scheduled stream.
func scheduledTimeLabel(_ stream: LivestreamSummary) -> String? {
    guard let date = stream.scheduledDate else { return nil }
    let time = date.formatted(date: .omitted, time: .shortened)
    let comps = Calendar.current.dateComponents([.day, .month], from: date)
    return "\(time) · \(comps.day ?? 0)/\(comps.month ?? 0)"
}

/// "8/7" — ngày kết thúc cho hàng replay "Vừa kết thúc".
func endedTimeLabel(_ stream: LivestreamSummary) -> String? {
    guard let date = stream.endedDate else { return nil }
    let comps = Calendar.current.dateComponents([.day, .month], from: date)
    return "\(comps.day ?? 0)/\(comps.month ?? 0)"
}

/// Dense row for the non-featured streams: small thumb + status + title.
private struct CompactStreamRow: View {
    let stream: LivestreamSummary

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .topLeading) {
                if let url = stream.thumbURL {
                    AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { TLColor.surface2 }
                } else {
                    TLColor.surface2
                }
            }
            .frame(width: 98, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(alignment: .topLeading) {
                if stream.isLive {
                    HStack(spacing: 3) {
                        Circle().fill(.white).frame(width: 4, height: 4)
                        Text("LIVE").font(TLFont.mono(7.5, .bold)).tracking(0.6).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 5).padding(.vertical, 2.5)
                    .background(TLColor.live, in: RoundedRectangle(cornerRadius: 4))
                    .padding(4)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(stream.displayTitle)
                    .font(TLFont.sans(13.5, .semibold))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(2)
                HStack(spacing: 5) {
                    if stream.isLive {
                        Text("ĐANG PHÁT").font(TLFont.mono(9.5, .semibold)).foregroundStyle(TLColor.live)
                    } else if stream.isEnded {
                        Text("XEM LẠI")
                            .font(TLFont.mono(8, .bold)).tracking(0.5)
                            .foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 6).padding(.vertical, 2.5)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 4))
                        if let when = endedTimeLabel(stream) {
                            Text(when).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                        }
                    } else if let when = scheduledTimeLabel(stream) {
                        Text(when).font(TLFont.mono(9.5, .semibold)).foregroundStyle(TLColor.accentText)
                    }
                    if let org = stream.orgName {
                        Text("· \(org)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4).lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(TLColor.fg4)
        }
        .padding(12)
        .contentShape(Rectangle())
    }
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
