import SwiftUI

/// Verified badge, a native port of the web `VerifiedBadge` (PR #1139
/// final shape, picked by Cuong from his sample): the OUTLINE rosette
/// seal - serrated ring, check inside, NO fill - in the strong green
/// #b5e853 for BOTH themes (light mode deliberately does not pale it).
struct VerifiedBadge: View {
    var size: CGFloat = 16

    var body: some View {
        VerifiedSealShape()
            .stroke(
                VerifiedBadge.green,
                style: StrokeStyle(lineWidth: size * 2.2 / 24, lineCap: .round, lineJoin: .round)
            )
            .overlay(
                VerifiedCheckShape()
                    .stroke(
                        VerifiedBadge.green,
                        style: StrokeStyle(lineWidth: size * 2.6 / 24, lineCap: .round, lineJoin: .round)
                    )
            )
            .frame(width: size, height: size)
            .accessibilityLabel("Đã xác minh")
    }

    /// Fixed #b5e853 in both themes, per the web component.
    static let green = Color(red: 0xB5 / 255, green: 0xE8 / 255, blue: 0x53 / 255)
}

/// The rosette ring, reconstructed from the web SVG path (viewBox 24):
/// 8 identical scallops. Each scallop is the minor arc (115 degrees) of
/// a circle of radius 4 whose center sits at distance 6.01 from the
/// seal center - on the INNER side, so the arc bulges outward to
/// radius ~10 at the scallop mids while the endpoints sit at radius
/// 8.82, 45 degrees apart. These are the exact constants the SVG arc
/// commands encode (large-arc=0, sweep=1 picks this center).
struct VerifiedSealShape: Shape {
    /// Geometry in the 24-unit viewBox space, exposed for tests.
    static let center = CGPoint(x: 12, y: 12)
    static let scallopCenterDistance: CGFloat = 6.01
    static let endpointDistance: CGFloat = 8.82
    static let scallopRadius: CGFloat = 4

    static func endpoint(atDegrees degrees: Double) -> CGPoint {
        let radians = degrees * .pi / 180
        return CGPoint(
            x: center.x + endpointDistance * CGFloat(cos(radians)),
            y: center.y + endpointDistance * CGFloat(sin(radians))
        )
    }

    static func scallopCenter(atDegrees degrees: Double) -> CGPoint {
        let radians = degrees * .pi / 180
        return CGPoint(
            x: center.x + scallopCenterDistance * CGFloat(cos(radians)),
            y: center.y + scallopCenterDistance * CGFloat(sin(radians))
        )
    }

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 24
        func map(_ point: CGPoint) -> CGPoint {
            CGPoint(
                x: rect.minX + (point.x - 12) * scale + rect.width / 2,
                y: rect.minY + (point.y - 12) * scale + rect.height / 2
            )
        }
        var path = Path()
        for index in 0..<8 {
            let mid = 225.0 + 45.0 * Double(index)
            let scallop = Self.scallopCenter(atDegrees: mid)
            let start = Self.endpoint(atDegrees: mid - 22.5)
            let end = Self.endpoint(atDegrees: mid + 22.5)
            // Normalize the endpoints onto the scallop circle so every
            // arc is exact despite the rounded SVG constants.
            func onCircle(_ point: CGPoint) -> CGPoint {
                let dx = point.x - scallop.x
                let dy = point.y - scallop.y
                let length = max(0.001, hypot(dx, dy))
                return CGPoint(
                    x: scallop.x + dx / length * Self.scallopRadius,
                    y: scallop.y + dy / length * Self.scallopRadius
                )
            }
            let startPoint = onCircle(start)
            let endPoint = onCircle(end)
            if index == 0 { path.move(to: map(startPoint)) }
            let startAngle = Angle(radians: atan2(startPoint.y - scallop.y, startPoint.x - scallop.x))
            let endAngle = Angle(radians: atan2(endPoint.y - scallop.y, endPoint.x - scallop.x))
            path.addArc(
                center: map(scallop),
                radius: Self.scallopRadius * scale,
                startAngle: startAngle,
                endAngle: endAngle,
                clockwise: true
            )
        }
        path.closeSubpath()
        return path
    }
}

/// The check inside the seal: polyline (9, 12) -> (11, 14) -> (15, 10)
/// in viewBox space, exactly as the web SVG.
struct VerifiedCheckShape: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 24
        func map(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(
                x: rect.minX + (x - 12) * scale + rect.width / 2,
                y: rect.minY + (y - 12) * scale + rect.height / 2
            )
        }
        var path = Path()
        path.move(to: map(9, 12))
        path.addLine(to: map(11, 14))
        path.addLine(to: map(15, 10))
        return path
    }
}
