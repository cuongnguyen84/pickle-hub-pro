import SwiftUI

/// Status pill shared by the tournament list and detail. Live (ongoing) reads
/// red, upcoming reads lime, ended reads muted.
struct TournamentStatusBadge: View {
    let kind: TournamentStatus

    private var tint: Color {
        switch kind {
        case .ongoing:  return TLColor.live
        case .upcoming: return TLColor.accentText
        case .ended:    return TLColor.fg3
        }
    }

    var body: some View {
        HStack(spacing: 5) {
            if kind.isLive {
                Circle().fill(TLColor.live).frame(width: 6, height: 6)
            }
            Text(kind.label)
                .font(TLFont.mono(10, .semibold))
                .tracking(0.8)
                .textCase(.uppercase)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(tint.opacity(0.12), in: Capsule())
    }
}
