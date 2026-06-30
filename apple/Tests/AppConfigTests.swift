import Testing
import SwiftUI
@testable import ThePickleHub

struct DesignSystemTests {
    @Test func colorHexDecodesChannels() {
        let resolved = TLColor.accent.resolve(in: EnvironmentValues())
        // #B5E853 -> r=181, g=232, b=83
        #expect(Int((resolved.red * 255).rounded()) == 181)
        #expect(Int((resolved.green * 255).rounded()) == 232)
        #expect(Int((resolved.blue * 255).rounded()) == 83)
    }

    @Test func radiusScaleIsAscending() {
        #expect(TLRadius.sm < TLRadius.lg)
        #expect(TLRadius.lg < TLRadius.xl)
    }
}
