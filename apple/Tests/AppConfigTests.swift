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

@Suite("Release activation gate")
struct ReleaseActivationGateTests {
    @Test("Site key alone cannot activate production registration")
    func keyAloneIsDisabled() {
        #expect(!enabled(flag: "NO", key: "0x4AAAA-valid-key", environment: "production",
                         bundle: "net.thepicklehub.app"))
    }

    @Test("Production activation requires the exact live bundle")
    func productionBundleIsPinned() {
        #expect(enabled(flag: "YES", key: "0x4AAAA-valid-key", environment: "production",
                        bundle: "net.thepicklehub.app"))
        #expect(!enabled(flag: "YES", key: "0x4AAAA-valid-key", environment: "production",
                         bundle: "net.thepicklehub.app.dev"))
    }

    @Test("Development activation is explicit and isolated from the live bundle")
    func developmentBundleIsPinned() {
        #expect(enabled(flag: "true", key: "0x4AAAA-valid-key", environment: "development",
                        bundle: "net.thepicklehub.app.dev"))
        #expect(!enabled(flag: "true", key: "0x4AAAA-valid-key", environment: "development",
                         bundle: "net.thepicklehub.app"))
    }

    @Test("Malformed or unexpanded values fail closed")
    func malformedValuesFailClosed() {
        #expect(!enabled(flag: "YES", key: "$(TURNSTILE_SITE_KEY)", environment: "production",
                         bundle: "net.thepicklehub.app"))
        #expect(!enabled(flag: "$(NATIVE_EVENT_REGISTRATION_ENABLED)", key: "0x4AAAA-valid-key",
                         environment: "production", bundle: "net.thepicklehub.app"))
    }

    private func enabled(flag: String?, key: String?, environment: String?, bundle: String?) -> Bool {
        AppConfig.nativeEventRegistrationEnabled(
            activationValue: flag, siteKeyValue: key,
            environmentValue: environment, bundleIdentifier: bundle)
    }
}

@Suite("Remote push release gate")
struct RemotePushReleaseGateTests {
    private let appID = "1:574564887581:ios:abcdef0123456789"
    private let senderID = "574564887581"
    private let apiKey = "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123456"
    private let projectID = "pickle-hub-production"

    @Test("Valid production config enables FCM for the live bundle")
    func validProductionConfiguration() {
        let config = configuration(flag: "YES", environment: "production",
                                   bundle: "net.thepicklehub.app")
        #expect(config?.bundleIdentifier == "net.thepicklehub.app")
        #expect(config?.googleAppID == appID)
    }

    @Test("Push remains off unless explicitly activated")
    func explicitActivationRequired() {
        #expect(configuration(flag: "NO", environment: "production",
                              bundle: "net.thepicklehub.app") == nil)
        #expect(configuration(flag: "$(REMOTE_PUSH_ENABLED)", environment: "production",
                              bundle: "net.thepicklehub.app") == nil)
    }

    @Test("Development and lookalike bundles cannot use production FCM")
    func productionIdentityIsPinned() {
        #expect(configuration(flag: "YES", environment: "development",
                              bundle: "net.thepicklehub.app.dev") == nil)
        #expect(configuration(flag: "YES", environment: "production",
                              bundle: "net.thepicklehub.app.preview") == nil)
    }

    @Test("Malformed Firebase identifiers fail closed")
    func malformedIdentifiersFailClosed() {
        #expect(configuration(flag: "YES", environment: "production",
                              bundle: "net.thepicklehub.app", appID: "$(FIREBASE_GOOGLE_APP_ID)") == nil)
        #expect(configuration(flag: "YES", environment: "production",
                              bundle: "net.thepicklehub.app", apiKey: "not-an-api-key") == nil)
    }

    private func configuration(
        flag: String?, environment: String?, bundle: String?,
        appID: String? = nil, apiKey: String? = nil
    ) -> AppConfig.FirebaseMessagingConfiguration? {
        AppConfig.firebaseMessagingConfiguration(
            activationValue: flag,
            environmentValue: environment,
            bundleIdentifier: bundle,
            googleAppID: appID ?? self.appID,
            gcmSenderID: senderID,
            apiKey: apiKey ?? self.apiKey,
            projectID: projectID
        )
    }
}
