import SwiftUI

/// The Line type scale — 5 named roles wrapping `TLFont`. Three voices:
/// serif for display/player names, sans for titles & body, mono for data.
/// Each keeps `relativeTo:` so Dynamic Type still scales. Sizes are defaults;
/// pass an override when a surface genuinely needs it.
enum TLType {
    /// Editorial display — section titles, player names (Instrument Serif).
    static func displaySerif(_ size: CGFloat = 28) -> Font {
        TLFont.serif(size, relativeTo: .title)
    }
    /// Card / row titles (Geist semibold).
    static func titleSans(_ size: CGFloat = 17) -> Font {
        TLFont.sans(size, .semibold, relativeTo: .headline)
    }
    /// Body copy (Geist regular).
    static func bodySans(_ size: CGFloat = 15) -> Font {
        TLFont.sans(size, .regular, relativeTo: .body)
    }
    /// Numbers, scores, DUPR (Geist Mono).
    static func dataMono(_ size: CGFloat = 14) -> Font {
        TLFont.mono(size, .semibold, relativeTo: .body)
    }
    /// Eyebrow labels / kickers — pair with `.tracking(...)` at the call site.
    static func eyebrowMono(_ size: CGFloat = 10) -> Font {
        TLFont.mono(size, .semibold, relativeTo: .caption2)
    }
}
