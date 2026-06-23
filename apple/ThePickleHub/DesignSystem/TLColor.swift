import SwiftUI

/// The Line theme tokens (dark), ported from `src/styles/the-line.css` +
/// the shipped **Variant B** retune (`mockups/taste-landing-b.html`): the accent
/// is optic-lime, not emerald, and uses a dual fill/text system.
/// Single source of truth for color in the native app.
enum TLColor {
    static let bg        = Color(hex: 0x08090A) // --tl-bg
    static let bgElev    = Color(hex: 0x0F1012) // --tl-bg-elev
    static let surface   = Color(hex: 0x131416) // --tl-surface
    static let surface2  = Color(hex: 0x1A1C1F) // --tl-surface-2
    static let border    = Color(hex: 0x22252A) // --tl-border
    static let border2   = Color(hex: 0x2E3238) // --tl-border-2

    static let fg        = Color(hex: 0xF5F3EE) // --tl-fg
    static let fg2       = Color(hex: 0xC7C3BB) // --tl-fg-2
    static let fg3        = Color(hex: 0x8C897F) // --tl-fg-3
    static let fg4        = Color(hex: 0x54514C) // --tl-fg-4

    // Variant B accent — optic-lime. Dual system:
    //  • accent     — fills (buttons, score chips, glow)
    //  • accentInk  — text/icons sitting ON an accent fill (near-black)
    //  • accentText — accent-coloured text on the dark bg (brighter, legible)
    //  • accentDim  — muted accent for gradients / secondary marks
    static let accent     = Color(hex: 0xB5E853) // --tl-accent
    static let accentInk  = Color(hex: 0x0B1402) // --tl-accent-ink
    static let accentText = Color(hex: 0xBDEE5C) // --tl-accent-text
    static let accentDim  = Color(hex: 0x9CCC3F) // --tl-accent-dim

    static let live      = Color(hex: 0xFF5147) // --tl-live
    static let gold      = Color(hex: 0xEAB64B) // --tl-gold
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
