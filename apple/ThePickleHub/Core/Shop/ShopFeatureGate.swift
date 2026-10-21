import Foundation

/// Two-key launch gate for the native Shop pilot.
///
/// `builtIn` controls whether an artifact is intended to contain the native
/// capability. `pilotEnabled` is the release/deployment switch. Both values
/// must be explicit and true; missing or unexpanded build settings fail closed.
enum ShopFeatureGate {
    static var isEnabled: Bool {
        isEnabled(
            builtInValue: Bundle.main.object(forInfoDictionaryKey: "ShopNativeBuiltIn") as? String,
            pilotEnabledValue: Bundle.main.object(forInfoDictionaryKey: "ShopNativePilotEnabled") as? String
        )
    }

    static func isEnabled(builtInValue: String?, pilotEnabledValue: String?) -> Bool {
        enabled(builtInValue) && enabled(pilotEnabledValue)
    }

    private static func enabled(_ rawValue: String?) -> Bool {
        guard let value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        else { return false }
        return ["1", "true", "yes"].contains(value)
    }
}
