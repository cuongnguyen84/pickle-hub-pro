import Foundation

/// D3 (proposal native-bilingual): default theo Region — máy Region VN nói tiếng Việt
/// dù ngôn ngữ hệ thống là EN. Cơ chế = per-app AppleLanguages để mọi tầng
/// (SwiftUI Text, String(localized:), Locale.current) cùng một ngôn ngữ.
enum AppLanguage: String, CaseIterable {
    case system, vi, en

    static let seededKey = "appLanguage.seeded"

    /// Gọi SỚM NHẤT có thể trong App.init, trước mọi lookup localization.
    static func bootstrap() {
        let d = UserDefaults.standard
        guard d.string(forKey: seededKey) == nil else { return }
        d.set("1", forKey: seededKey)
        // Chỉ seed khi Region VN mà ngôn ngữ đang resolve không phải vi
        if Locale.current.region?.identifier == "VN",
           Bundle.main.preferredLocalizations.first != "vi" {
            d.set(["vi"], forKey: "AppleLanguages")
        }
    }

    static var current: AppLanguage {
        guard let langs = UserDefaults.standard.array(forKey: "AppleLanguages") as? [String],
              let first = langs.first else { return .system }
        // Chỉ coi là lựa chọn tường minh khi app từng ghi đè
        if first.hasPrefix("vi") { return .vi }
        if first.hasPrefix("en") { return .en }
        return .system
    }

    static func apply(_ choice: AppLanguage) {
        let d = UserDefaults.standard
        switch choice {
        case .system: d.removeObject(forKey: "AppleLanguages")
        case .vi: d.set(["vi"], forKey: "AppleLanguages")
        case .en: d.set(["en"], forKey: "AppleLanguages")
        }
    }
}
