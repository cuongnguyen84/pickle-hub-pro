import Foundation

/// Reads runtime config injected into Info.plist from `Config/Secrets.xcconfig`.
enum AppConfig {
    enum BuildEnvironment: String, Equatable {
        case development
        case production
    }

    struct FirebaseMessagingConfiguration: Equatable, Sendable {
        let googleAppID: String
        let gcmSenderID: String
        let apiKey: String
        let projectID: String
        let bundleIdentifier: String
    }

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

    /// Public client-side key. An empty/unexpanded value intentionally keeps
    /// event registration on the production web flow.
    static var turnstileSiteKey: String? {
        validTurnstileSiteKey(infoString("TurnstileSiteKey"))
    }

    static var buildEnvironment: BuildEnvironment? {
        infoString("BuildEnvironment").flatMap(BuildEnvironment.init(rawValue:))
    }

    static var nativeEventRegistrationEnabled: Bool {
        nativeEventRegistrationEnabled(
            activationValue: infoString("NativeEventRegistrationEnabled"),
            siteKeyValue: infoString("TurnstileSiteKey"),
            environmentValue: infoString("BuildEnvironment"),
            bundleIdentifier: Bundle.main.bundleIdentifier)
    }

    /// FCM is allowed only for the exact production app identity. Invalid,
    /// missing or unexpanded values disable push at runtime; shipping preflight
    /// separately rejects an artifact in that state to prevent a regression.
    static var firebaseMessagingConfiguration: FirebaseMessagingConfiguration? {
        firebaseMessagingConfiguration(
            activationValue: infoString("RemotePushEnabled"),
            environmentValue: infoString("BuildEnvironment"),
            bundleIdentifier: Bundle.main.bundleIdentifier,
            googleAppID: infoString("FirebaseGoogleAppID"),
            gcmSenderID: infoString("FirebaseGCMSenderID"),
            apiKey: infoString("FirebaseAPIKey"),
            projectID: infoString("FirebaseProjectID")
        )
    }

    /// Pure release gate kept internal for contract tests. Production requires
    /// the exact live bundle ID; development can exercise the flow only through
    /// an explicit command-line/config override.
    static func nativeEventRegistrationEnabled(
        activationValue: String?, siteKeyValue: String?,
        environmentValue: String?, bundleIdentifier: String?
    ) -> Bool {
        let enabledValues = ["1", "true", "yes"]
        guard let flag = activationValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              enabledValues.contains(flag),
              validTurnstileSiteKey(siteKeyValue) != nil,
              let environmentValue,
              let environment = BuildEnvironment(rawValue: environmentValue),
              let bundleIdentifier else { return false }

        switch environment {
        case .development:
            return bundleIdentifier == "net.thepicklehub.app.dev"
        case .production:
            return bundleIdentifier == "net.thepicklehub.app"
        }
    }

    static func validTurnstileSiteKey(_ rawValue: String?) -> String? {
        guard let value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              value.range(of: #"^[A-Za-z0-9_-]{10,128}$"#,
                          options: .regularExpression) != nil else { return nil }
        return value
    }

    static func firebaseMessagingConfiguration(
        activationValue: String?, environmentValue: String?, bundleIdentifier: String?,
        googleAppID: String?, gcmSenderID: String?, apiKey: String?, projectID: String?
    ) -> FirebaseMessagingConfiguration? {
        guard isEnabled(activationValue),
              environmentValue == BuildEnvironment.production.rawValue,
              let bundleIdentifier,
              bundleIdentifier == "net.thepicklehub.app",
              let googleAppID = validValue(googleAppID,
                                           pattern: #"^1:[0-9]{6,}:ios:[A-Fa-f0-9]{8,}$"#),
              let gcmSenderID = validValue(gcmSenderID, pattern: #"^[0-9]{6,}$"#),
              let apiKey = validValue(apiKey, pattern: #"^AIza[A-Za-z0-9_-]{20,}$"#),
              let projectID = validValue(projectID,
                                         pattern: #"^[a-z][a-z0-9-]{4,62}$"#)
        else { return nil }

        return FirebaseMessagingConfiguration(
            googleAppID: googleAppID,
            gcmSenderID: gcmSenderID,
            apiKey: apiKey,
            projectID: projectID,
            bundleIdentifier: bundleIdentifier
        )
    }

    private static func isEnabled(_ rawValue: String?) -> Bool {
        guard let value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() else { return false }
        return ["1", "true", "yes"].contains(value)
    }

    private static func validValue(_ rawValue: String?, pattern: String) -> String? {
        guard let value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              value.range(of: pattern, options: .regularExpression) != nil
        else { return nil }
        return value
    }

    private static func infoString(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
