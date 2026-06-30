import SwiftUI

/// The Line segmented control — the single capsule picker that replaces the
/// four hand-rolled copies in Rankings / Live / Social / Tools.
///
/// Selected segment gets the lime fill + ink text; 180ms ease + light haptic on
/// change (motion is purely the fill cross-fade, safe under Reduce Motion).
/// `indicator` lets a segment show a leading dot (e.g. the Live "đang có trận").
struct TLSegmented<T: Hashable>: View {
    let options: [T]
    @Binding var selection: T
    let label: (T) -> String
    var indicator: (T) -> Bool = { _ in false }
    /// Accessibility suffix appended when `indicator` is true.
    var indicatorHint: String = ""

    var body: some View {
        HStack(spacing: TLSpacing.xs) {
            ForEach(options, id: \.self) { option in
                let selected = option == selection
                let dot = indicator(option)
                Button {
                    Haptics.light()
                    withAnimation(.easeInOut(duration: 0.18)) { selection = option }
                } label: {
                    HStack(spacing: 5) {
                        if dot {
                            Circle()
                                .fill(selected ? TLColor.accentInk : TLColor.live)
                                .frame(width: 6, height: 6)
                        }
                        Text(label(option))
                    }
                    .font(TLFont.sans(13, selected ? .semibold : .medium))
                    .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(selected ? TLColor.accent : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(label(option) + (dot ? ", \(indicatorHint)" : ""))
            }
        }
        .padding(TLSpacing.xs)
        .background(TLColor.surface, in: Capsule())
        .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
    }
}
