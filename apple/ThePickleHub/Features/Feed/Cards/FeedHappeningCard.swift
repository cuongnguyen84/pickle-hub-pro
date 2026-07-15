import SwiftUI

/// Live platform activity card: 🔴 live stream, 🏆 open-registration
/// tournament, 📅 upcoming social event. One card for all three — they
/// differ by exactly (badge, tint, CTA). Mirrors web `FeedHappeningCard.tsx`.
struct FeedHappeningCard: View {
    let happening: FeedHappening

    private var badge: String {
        switch happening.kind {
        case .live:       return "🔴 Đang live"
        case .tournament: return "🏆 Giải đấu"
        case .event:      return "📅 Sự kiện"
        }
    }

    private var tint: Color {
        happening.kind == .live ? TLColor.live : TLColor.accentText
    }

    private var cta: String {
        switch happening.kind {
        case .live:       return "Xem ngay"
        case .tournament: return "Đăng ký ngay"
        case .event:      return "Xem chi tiết"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(badge)
                .font(TLFont.mono(11, .semibold))
                .textCase(.uppercase)
                .tracking(0.6)
                .foregroundStyle(tint)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .overlay(
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .strokeBorder(tint.opacity(0.6), lineWidth: 1)
                )

            Text(happening.title)
                .font(TLFont.serif(24))
                .foregroundStyle(TLColor.fg)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            Text(happening.meta)
                .font(TLFont.sans(14))
                .foregroundStyle(TLColor.fg2)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            HStack(spacing: 4) {
                Text(cta)
                Image(systemName: "arrow.right")
            }
            .font(TLFont.sans(13, .medium))
            .foregroundStyle(tint)
        }
        .feedCard()
    }
}
