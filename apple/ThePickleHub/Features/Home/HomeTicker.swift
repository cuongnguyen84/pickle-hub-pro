import SwiftUI

/// Gold results ticker bar — a horizontally-scrolling marquee of recent match
/// results that loops continuously, matching the web `/` ticker.
///
/// The moving strip lives in an `.overlay` on a full-width `Color.clear`, so its
/// (very large) intrinsic width can NOT propagate up and shove the vertical
/// ScrollView sideways. Offset is driven per-frame by `TimelineView(.animation)`
/// — not a `.repeatForever` transaction, which would leak into sibling views.
struct HomeTicker: View {
    let items: [TickerItem]

    @State private var stripSize: CGSize = .zero

    private static let gap: CGFloat = 24      // spacing between the two copies
    private static let speed: Double = 42     // points per second

    private var travel: CGFloat { stripSize.width + Self.gap }

    /// One pass of the results, laid out inline.
    private var strip: some View {
        HStack(spacing: Self.gap) {
            ForEach(items) { item in
                HStack(spacing: 6) {
                    Text(item.body)
                        .foregroundStyle(TLColor.fg)          // bright, readable
                    if let trail = item.trail {
                        Text(trail)
                            .foregroundStyle(TLColor.gold)    // score/meta pops gold
                    }
                }
                .lineLimit(1)
            }
        }
        .font(TLFont.mono(11, .medium))
        .fixedSize()
    }

    var body: some View {
        HStack(spacing: 12) {
            HStack(spacing: 5) {
                Circle().fill(TLColor.gold).frame(width: 5, height: 5)
                Text("KẾT QUẢ")
                    .font(TLFont.mono(10, .semibold)).tracking(0.6)
                    .foregroundStyle(TLColor.gold)
            }
            .fixedSize()

            Color.clear
                .frame(height: max(stripSize.height, 16))
                .frame(maxWidth: .infinity)
                .overlay(alignment: .leading) {
                    TimelineView(.animation) { timeline in
                        HStack(spacing: Self.gap) {
                            strip
                                .onGeometryChange(for: CGSize.self) { $0.size } action: { s in
                                    if s != stripSize { stripSize = s }
                                }
                            strip
                        }
                        .offset(x: marqueeOffset(at: timeline.date))
                    }
                }
                .clipped()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface)
        .overlay(Rectangle().fill(TLColor.border).frame(height: 1), alignment: .bottom)
    }

    private func marqueeOffset(at date: Date) -> CGFloat {
        guard travel > 0, stripSize.width > 0 else { return 0 }
        let t = date.timeIntervalSinceReferenceDate * Self.speed
        return -CGFloat(t.truncatingRemainder(dividingBy: Double(travel)))
    }
}
