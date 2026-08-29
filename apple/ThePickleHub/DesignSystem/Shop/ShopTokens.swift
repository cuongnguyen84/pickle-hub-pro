import SwiftUI

/// Commerce-specific aliases. These keep Shop intent stable while the base
/// design system remains free to evolve its palette and geometry.
enum ShopTokens {
    static let cardBackground = TLColor.surface
    static let mediaBackground = TLColor.surface2
    static let primaryAction = TLColor.accent
    static let primaryActionText = TLColor.accentInk
    static let verified = TLColor.accentText
    static let unavailable = Color.red

    static let cardRadius = TLRadius.xl
    static let controlRadius = TLRadius.lg
    static let minimumTouchTarget: CGFloat = 44
}
