import SwiftUI

/// The user's DUPR rating chip that fills the gap between the two Home toolbar
/// pills (design ref `ThePickleHub Home.dc.html`). Three states:
///   • loading  → skeleton pill
///   • rated    → `DUPR <score> ▲.04`, tap → rating/profile screen
///   • unlinked → `DUPR · Kết nối`, tap → DUPR link flow (web)
struct DuprHeaderChip: View {
    let state: State
    let onTap: () -> Void

    enum State: Equatable {
        case loading
        case unlinked
        case rated(rating: Double, delta: Double?)
    }

    private let shape = Capsule(style: .continuous)

    var body: some View {
        switch state {
        case .loading:
            content(loading: true).redacted(reason: .placeholder)
        default:
            Button(action: onTap) { content(loading: false) }
                .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func content(loading: Bool) -> some View {
        HStack(spacing: 7) {
            Text("DUPR")
                .font(TLFont.mono(11, .medium)).tracking(1.3)
                .foregroundStyle(TLColor.fg3)

            switch state {
            case .rated(let rating, let delta):
                Text(String(format: "%.2f", rating))
                    .font(TLFont.mono(16, .bold))
                    .foregroundStyle(TLColor.accentText)
                if let delta {
                    deltaLabel(delta)
                }
            case .unlinked:
                Text("· Kết nối")
                    .font(TLFont.mono(11, .semibold))
                    .foregroundStyle(TLColor.accentText)
            case .loading:
                Text("0.00").font(TLFont.mono(16, .bold))
            }
        }
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
        .padding(.horizontal, 14)
        .frame(minHeight: 44)                       // ≥44pt tap target
        .background(TLColor.duprTint, in: shape)
        .overlay(shape.strokeBorder(TLColor.duprBorder, lineWidth: 1))
        .contentShape(shape)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    /// `▲.04` (green up) / `▼.04` (red down). Leading zero dropped per design.
    @ViewBuilder
    private func deltaLabel(_ delta: Double) -> some View {
        let up = delta > 0
        let num = String(format: "%.2f", abs(delta)).replacingOccurrences(of: "0.", with: ".")
        Text("\(up ? "▲" : "▼")\(num)")
            .font(TLFont.mono(11, .semibold))
            .foregroundStyle(up ? TLColor.accentText : TLColor.live)
    }

    private var accessibilityText: String {
        switch state {
        case .loading: return "Đang tải điểm DUPR"
        case .unlinked: return "Kết nối DUPR"
        case .rated(let r, let d):
            let base = "Điểm DUPR \(String(format: "%.2f", r))"
            guard let d else { return base }
            return base + (d > 0 ? ", tăng \(String(format: "%.2f", d))" : ", giảm \(String(format: "%.2f", abs(d)))")
        }
    }
}
