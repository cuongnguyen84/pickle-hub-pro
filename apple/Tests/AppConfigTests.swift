import Testing
import SwiftUI
@testable import ThePickleHub

struct DesignSystemTests {
    @Test func colorHexDecodesChannels() {
        let resolved = TLColor.green.resolve(in: EnvironmentValues())
        // #00B96B -> r=0, g=185, b=107
        #expect(resolved.red == 0)
        #expect(Int((resolved.green * 255).rounded()) == 185)
        #expect(Int((resolved.blue * 255).rounded()) == 107)
    }

    @Test func radiusScaleIsAscending() {
        #expect(TLRadius.sm < TLRadius.lg)
        #expect(TLRadius.lg < TLRadius.xl)
    }
}
