import SwiftUI

/// Shared building blocks for feed cards: the eyebrow strip, remote thumbnail,
/// and the surface chrome — kept in one place so every card type reads the same.

/// Small uppercase metadata strip above a card's title.
struct FeedEyebrow<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: 6) {
            content
        }
        .font(TLFont.mono(11, .semibold))
        .textCase(.uppercase)
        .tracking(0.6)
        .lineLimit(1)
    }
}

/// Eyebrow pieces. Free helpers (not statics on the generic `FeedEyebrow`) so
/// the generic parameter never has to be inferred at the call site.
enum EyebrowText {
    static func time(_ date: Date?) -> some View {
        Text(FeedDate.relative(date)).foregroundStyle(TLColor.fg3)
    }
    static var dot: some View {
        Text("·").foregroundStyle(TLColor.fg4)
    }
    static func label(_ string: String) -> some View {
        Text(string).foregroundStyle(TLColor.fg3)
    }
    static func accent(_ string: String) -> some View {
        Text(string).foregroundStyle(TLColor.accentText)
    }
}

/// Remote image sized to a fixed aspect ratio, fill-cropped, rounded.
struct FeedThumbnail: View {
    let url: URL
    var aspect: CGFloat = 16.0 / 9.0
    var overlay: AnyView?

    var body: some View {
        Rectangle()
            .fill(TLColor.surface2)
            .aspectRatio(aspect, contentMode: .fit)
            .overlay {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .empty:
                        ProgressView().tint(TLColor.fg3)
                    case .failure:
                        Image(systemName: "photo")
                            .font(.title2)
                            .foregroundStyle(TLColor.fg4)
                    @unknown default:
                        Color.clear
                    }
                }
            }
            .overlay { overlay }
            .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
    }
}

extension View {
    /// The dark surface + hairline border every feed card sits on.
    func feedCard() -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
                    .strokeBorder(TLColor.border, lineWidth: 1)
            )
    }
}
