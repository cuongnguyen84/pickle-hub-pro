import SwiftUI
import Observation

/// User's theme choice, persisted across launches. `.system` follows iOS; the
/// other two force light/dark regardless of the device setting.
enum ThemeMode: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: return "Tự động"
        case .light:  return "Sáng"
        case .dark:   return "Tối"
        }
    }

    /// nil = follow the system appearance.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light:  return .light
        case .dark:   return .dark
        }
    }
}

@Observable
final class ThemeStore {
    private static let key = "themeMode"

    var mode: ThemeMode {
        didSet { UserDefaults.standard.set(mode.rawValue, forKey: Self.key) }
    }

    init() {
        let raw = UserDefaults.standard.string(forKey: Self.key)
        mode = raw.flatMap(ThemeMode.init) ?? .system
    }
}
