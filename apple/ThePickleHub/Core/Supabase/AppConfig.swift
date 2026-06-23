import Foundation

/// Reads runtime config injected into Info.plist from `Config/Secrets.xcconfig`.
enum AppConfig {
    static var supabaseURL: URL {
        guard
            let ref = infoString("SupabaseProjectRef"), !ref.isEmpty,
            let url = URL(string: "https://\(ref).supabase.co")
        else {
            fatalError("Missing SupabaseProjectRef — copy Secrets.example.xcconfig → Secrets.xcconfig")
        }
        return url
    }

    static var supabaseAnonKey: String {
        guard let key = infoString("SupabaseAnonKey"), !key.isEmpty else {
            fatalError("Missing SupabaseAnonKey — copy Secrets.example.xcconfig → Secrets.xcconfig")
        }
        return key
    }

    private static func infoString(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
