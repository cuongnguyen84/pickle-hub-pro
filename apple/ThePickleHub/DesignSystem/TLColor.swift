import SwiftUI
import UIKit

/// The Line theme tokens. Each token resolves per `colorScheme` — dark is the
/// shipped **Variant B** retune (optic-lime accent, dual fill/text), light is the
/// warm-paper theme added in Phase 8. Semantics and grid are identical across
/// modes; only the ink and paper flip. Because these are dynamic `UIColor`s, every
/// `TLColor.x` call site adapts automatically — no per-view branching.
///
/// "Lime luôn có nghĩa": `accent` (fill) stays lime in both modes; `accentText`
/// (lime *text*) darkens to `#5C7A1E` on light so it stays legible on paper.
enum TLColor {
    static let bg        = dyn(dark: 0x08090A, light: 0xFBFAF7)
    static let bgElev    = dyn(dark: 0x0F1012, light: 0xFFFFFF)
    static let surface   = dyn(dark: 0x131416, light: 0xFFFFFF)
    static let surface2  = dyn(dark: 0x1A1C1F, light: 0xF1EEE7)
    static let border    = dyn(dark: 0x22252A, light: 0xE7E3DA)
    static let border2   = dyn(dark: 0x2E3238, light: 0xD8D3C8)

    static let fg        = dyn(dark: 0xF5F3EE, light: 0x1A1C1F)
    static let fg2       = dyn(dark: 0xC7C3BB, light: 0x3F423F)
    static let fg3       = dyn(dark: 0x8C897F, light: 0x6E6B63)
    static let fg4       = dyn(dark: 0x54514C, light: 0xA6A29A)

    // Dual accent system:
    //  • accent     — fills (buttons, score chips, glow) — lime in both modes
    //  • accentInk  — text/icons sitting ON an accent fill (near-black), both modes
    //  • accentText — accent-coloured text on the page — bright lime (dark) /
    //                 deep lime `#5C7A1E` (light) so it reads on paper
    //  • accentDim  — muted accent for gradients / secondary marks
    static let accent     = dyn(dark: 0xB5E853, light: 0xB5E853)
    static let accentInk  = dyn(dark: 0x0B1402, light: 0x0B1402)
    static let accentText = dyn(dark: 0xBDEE5C, light: 0x5C7A1E)
    static let accentDim  = dyn(dark: 0x9CCC3F, light: 0x5C7A1E)

    static let live      = dyn(dark: 0xFF5147, light: 0xE5352B)
    static let gold      = dyn(dark: 0xEAB64B, light: 0xA97B12)

    // UIKit chrome handles (nav/tab bars) — dynamic so they re-resolve on a
    // light↔dark switch. Same hexes as the tokens above.
    static let uiBg     = uiDyn(dark: 0x08090A, light: 0xFBFAF7)
    static let uiFg     = uiDyn(dark: 0xF5F3EE, light: 0x1A1C1F)
    static let uiFg3    = uiDyn(dark: 0x8C897F, light: 0x6E6B63)
    static let uiAccent = uiDyn(dark: 0xB5E853, light: 0xB5E853)

    /// Dynamic color that flips with the interface style.
    private static func dyn(dark: UInt, light: UInt) -> Color {
        Color(uiColor: uiDyn(dark: dark, light: light))
    }

    /// UIKit handle (bar appearances) — must stay dynamic so the nav/tab chrome
    /// re-resolves on a light↔dark switch instead of freezing at launch style.
    static func uiDyn(dark: UInt, light: UInt) -> UIColor {
        UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        }
    }
}

enum TLRadius {
    static let sm: CGFloat = 10 // --tl-radius
    static let lg: CGFloat = 14 // --tl-radius-lg
    static let xl: CGFloat = 20 // --tl-radius-xl
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue:  Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

extension UIColor {
    convenience init(hex: UInt, alpha: CGFloat = 1) {
        self.init(
            red:   CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue:  CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}
