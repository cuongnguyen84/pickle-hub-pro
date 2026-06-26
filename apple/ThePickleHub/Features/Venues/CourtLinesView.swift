import SwiftUI

/// CSS-free pickleball court placeholder used when a venue has no cover image:
/// a tinted gradient with low-opacity court lines (boundary + center line +
/// kitchen/cross line). Port of the mockup's court-lines placeholder.
struct CourtLinesView: View {
    var tint: Color = TLColor.accent

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                LinearGradient(colors: [tint.opacity(0.18), Color.black.opacity(0.35)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                Color.black.opacity(0.25)
                Path { p in
                    let inset = CGRect(x: w * 0.13, y: h * 0.16, width: w * 0.74, height: h * 0.68)
                    p.addRect(inset)
                    p.move(to: CGPoint(x: w * 0.5, y: inset.minY)); p.addLine(to: CGPoint(x: w * 0.5, y: inset.maxY))
                    p.move(to: CGPoint(x: inset.minX, y: h * 0.5)); p.addLine(to: CGPoint(x: inset.maxX, y: h * 0.5))
                }
                .stroke(tint.opacity(0.32), lineWidth: 1.4)
            }
        }
    }
}

/// Simple wrapping chip layout (iOS 16+ Layout). Used for "browse by city".
struct WrapChips<Item: Hashable, Chip: View>: View {
    let items: [Item]
    @ViewBuilder let chip: (Item) -> Chip

    var body: some View {
        FlowLayout(spacing: 8, lineSpacing: 8) {
            ForEach(items, id: \.self) { chip($0) }
        }
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0; y += lineHeight + lineSpacing; lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX; y += lineHeight + lineSpacing; lineHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
