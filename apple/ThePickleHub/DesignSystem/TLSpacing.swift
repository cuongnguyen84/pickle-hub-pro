import CoreFoundation

/// The Line spacing scale — 8-pt grid. Every gap/padding pulls from here so we
/// stop sprinkling magic `.padding(16)` across views.
enum TLSpacing {
    static let xs:  CGFloat = 4
    static let sm:  CGFloat = 8
    static let md:  CGFloat = 12
    static let lg:  CGFloat = 16
    static let xl:  CGFloat = 24
    static let xxl: CGFloat = 32
}
