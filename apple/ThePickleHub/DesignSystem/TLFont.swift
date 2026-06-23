import SwiftUI
import UIKit

/// The Line type system, mirroring the web font stack exactly:
/// - **Geist** — UI / body text
/// - **Geist Mono** — eyebrows, labels, scores, badges (the "data" voice)
/// - **Instrument Serif** (italic) — editorial display titles
///
/// Fonts are bundled under `Resources/Fonts` and registered via `UIAppFonts`.
/// All helpers scale with Dynamic Type via `relativeTo:`.
enum TLFont {
    enum Sans {
        case regular, medium, semibold, bold
        var name: String {
            switch self {
            case .regular:  return "Geist-Regular"
            case .medium:   return "Geist-Medium"
            case .semibold: return "Geist-SemiBold"
            case .bold:     return "Geist-Bold"
            }
        }
    }

    enum Mono {
        case medium, semibold, bold
        var name: String {
            switch self {
            case .medium:   return "GeistMono-Medium"
            case .semibold: return "GeistMono-SemiBold"
            case .bold:     return "GeistMono-Bold"
            }
        }
    }

    static func sans(_ size: CGFloat, _ weight: Sans = .regular, relativeTo: Font.TextStyle = .body) -> Font {
        .custom(weight.name, size: size, relativeTo: relativeTo)
    }

    static func mono(_ size: CGFloat, _ weight: Mono = .medium, relativeTo: Font.TextStyle = .caption) -> Font {
        .custom(weight.name, size: size, relativeTo: relativeTo)
    }

    static func serif(_ size: CGFloat, italic: Bool = true, relativeTo: Font.TextStyle = .title2) -> Font {
        .custom(italic ? "InstrumentSerif-Italic" : "InstrumentSerif-Regular", size: size, relativeTo: relativeTo)
    }

    /// UIKit handles for bar appearances (nav/tab titles).
    enum UIKitFont {
        static func sans(_ size: CGFloat, _ weight: Sans = .semibold) -> UIFont {
            UIFont(name: weight.name, size: size) ?? .systemFont(ofSize: size, weight: .semibold)
        }
        static func serif(_ size: CGFloat) -> UIFont {
            UIFont(name: "InstrumentSerif-Regular", size: size) ?? .systemFont(ofSize: size, weight: .bold)
        }
    }
}
