import SwiftUI

/// Profile cover band, the native twin of the web `ProfileCover`
/// (PR #1134): the uploaded cover photo when present, otherwise a
/// generated cover - a deterministic two-tone gradient from
/// `CoverPalette`, a faint pickleball-court line pattern, and the
/// display-name initial as a serif watermark.
struct ProfileCoverView: View {
    let coverURL: String?
    let username: String?
    let displayName: String

    var body: some View {
        ZStack {
            if let urlString = coverURL?.nonEmpty, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        generated
                    }
                }
            } else {
                generated
            }
        }
        .aspectRatio(3, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var generated: some View {
        let palette = CoverPalette.pair(for: username ?? displayName)
        return ZStack {
            LinearGradient(
                colors: [palette.from, palette.to],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Canvas { context, size in
                // Court lines, mirroring the web SVG (viewBox 1200x400,
                // slice): border, two service lines, center line, circle.
                let sx = size.width / 1200
                let sy = size.height / 400
                var lines = Path()
                lines.addRect(CGRect(x: 30 * sx, y: 30 * sy, width: 1140 * sx, height: 340 * sy))
                lines.move(to: CGPoint(x: 600 * sx, y: 30 * sy))
                lines.addLine(to: CGPoint(x: 600 * sx, y: 370 * sy))
                lines.move(to: CGPoint(x: 430 * sx, y: 30 * sy))
                lines.addLine(to: CGPoint(x: 430 * sx, y: 370 * sy))
                lines.move(to: CGPoint(x: 770 * sx, y: 30 * sy))
                lines.addLine(to: CGPoint(x: 770 * sx, y: 370 * sy))
                lines.addEllipse(in: CGRect(
                    x: (600 - 86) * sx, y: (200 - 86) * sy,
                    width: 172 * sx, height: 172 * sy
                ))
                context.stroke(lines, with: .color(.white.opacity(0.20)), lineWidth: 3 * sx)
            }
            Text(String(displayName.prefix(1)).uppercased())
                .font(TLFont.serif(150))
                .foregroundStyle(.white.opacity(0.13))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .padding(.trailing, 20)
                .offset(y: 34)
        }
    }
}
