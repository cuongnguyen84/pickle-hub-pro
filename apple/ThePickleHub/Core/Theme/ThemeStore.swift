import SwiftUI
import Observation

/// User's theme choice, persisted across launches. `.system` follows iOS; the
/// other two force light/dark regardless of the device setting.
enum ThemeMode: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }

    var label: String {
        switch self {
        // key literal "Tự động" = System (nghĩa Automatic đã tách quickTable.seeding.automatic)
        case .system: return String(localized: "Tự động")
        case .light:  return String(localized: "Sáng")
        case .dark:   return String(localized: "Tối")
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
