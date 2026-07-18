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
    // a11y 2026-07-08: was dark 0x54514C (2.52:1) / light 0xA6A29A (2.44:1) —
    // both failed WCAG; now 4.59:1 / 4.53:1. Mirrors web --tl-fg-4 fix.
    static let fg4       = dyn(dark: 0x7C7973, light: 0x787366)

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

    // ── DS-02 canonical parity with web `--tl-*` (docs/design-tokens.md) ──
    // The accent* family above stays as the platform-local dual-accent
    // implementation (fill vs text); `green` maps to the text-legible
    // variant, matching web's light-mode retune of --tl-green.
    static let green      = dyn(dark: 0xB5E853, light: 0x5C7A1E)
    static let greenDim   = dyn(dark: 0x9CCC3F, light: 0x4A6418)
    static let greenGlow  = dynAlpha(dark: 0xB5E853, light: 0x5E7D1F,
                                     darkAlpha: 0.16, lightAlpha: 0.14)
    static let goldGlow   = dynAlpha(dark: 0xE9B649, light: 0x8A6410,
                                     darkAlpha: 0.12, lightAlpha: 0.12)
    static let blue       = dyn(dark: 0x4F9BFF, light: 0x1D63C4)
    static let blueGlow   = dynAlpha(dark: 0x4F9BFF, light: 0x1D63C4,
                                     darkAlpha: 0.12, lightAlpha: 0.12)
    /// Two-tone display "dim" — the faded half of split serif headlines.
    static let dim        = dyn(dark: 0x9A978F, light: 0x5A5750)
    /// Thinnest separator (web alias of border; a real token here).
    static let hairline   = dyn(dark: 0x22252A, light: 0xE7E3DA)
    // Per-tournament-format identity accents (web has no light retune for
    // qt/team/flex; elim mirrors --tl-gold's paper-legible amber).
    static let accentQt   = dyn(dark: 0x00B96B, light: 0x00B96B)
    static let accentElim = dyn(dark: 0xE9B649, light: 0x8A6410)
    static let accentFlex = dyn(dark: 0x4F9BFF, light: 0x4F9BFF)
    static let accentTeam = dyn(dark: 0xFF7A4D, light: 0xFF7A4D)

    // DUPR brand tint for the Home header rating chip — from the design spec
    // `hsl(151 60% 30% / .1)` fill + `hsl(151 55% 32% / .55)` border (green, both modes).
    static let duprTint   = Color(hex: 0x1F7A4E, alpha: 0.10)
    static let duprBorder = Color(hex: 0x257E53, alpha: 0.55)

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

    /// Dynamic translucent color (glow tokens) — hue and alpha per mode.
    private static func dynAlpha(
        dark: UInt, light: UInt, darkAlpha: CGFloat, lightAlpha: CGFloat
    ) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: dark, alpha: darkAlpha)
                : UIColor(hex: light, alpha: lightAlpha)
        })
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
