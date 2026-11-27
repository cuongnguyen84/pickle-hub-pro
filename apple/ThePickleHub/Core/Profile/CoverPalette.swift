import SwiftUI

/// Deterministic generated-cover palettes for profiles without an
/// uploaded cover photo - a bit-exact port of the web
/// `src/lib/social/cover-palette.ts` (PR #1134), so the same username
/// gets the same two-tone gradient on web and native.
enum CoverPalette {
    /// The web palette pairs, as hex values.
    static let palettes: [(from: UInt32, to: UInt32)] = [
        (0x0B3D2E, 0x00B56B),
        (0x10243E, 0x2F7FD0),
        (0x3D2B0B, 0xD09A2F),
        (0x2B103E, 0x7A4FD0),
        (0x0E3A3A, 0x2FB5A8),
        (0x401622, 0xD04F6A),
    ]

    /// The web hash: h = h * 31 + charCodeAt(i), kept in UInt32
    /// (JS `>>> 0`) over UTF-16 code units.
    static func hash(_ seed: String) -> UInt32 {
        var h: UInt32 = 0
        for unit in seed.utf16 {
            h = h &* 31 &+ UInt32(unit)
        }
        return h
    }

    static func pair(for seed: String) -> (from: Color, to: Color) {
        let (from, to) = palettes[Int(hash(seed) % UInt32(palettes.count))]
        return (Color(hex: from), Color(hex: to))
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
