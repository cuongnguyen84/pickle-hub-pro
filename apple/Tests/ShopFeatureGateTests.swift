import Testing
@testable import ThePickleHub

@Suite("Shop two-key feature gate")
struct ShopFeatureGateTests {
    @Test("Both explicit keys enable the pilot")
    func bothKeysAreRequired() {
        #expect(ShopFeatureGate.isEnabled(builtInValue: "YES", pilotEnabledValue: "true"))
    }

    @Test("Either disabled key closes every Shop entry")
    func eitherKeyCanCloseThePilot() {
        #expect(!ShopFeatureGate.isEnabled(builtInValue: "NO", pilotEnabledValue: "YES"))
        #expect(!ShopFeatureGate.isEnabled(builtInValue: "YES", pilotEnabledValue: "NO"))
    }

    @Test("Missing, malformed and unexpanded values fail closed")
    func invalidValuesFailClosed() {
        #expect(!ShopFeatureGate.isEnabled(builtInValue: nil, pilotEnabledValue: "YES"))
        #expect(!ShopFeatureGate.isEnabled(builtInValue: "YES", pilotEnabledValue: "$(SHOP_NATIVE_PILOT_ENABLED)"))
        #expect(!ShopFeatureGate.isEnabled(builtInValue: "enabled", pilotEnabledValue: "YES"))
    }
}
