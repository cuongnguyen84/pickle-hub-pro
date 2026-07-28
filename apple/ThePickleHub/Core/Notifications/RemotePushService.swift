import FirebaseCore
@preconcurrency import FirebaseMessaging
import Foundation
import Supabase
import UIKit
import UserNotifications

/// Pure payload routing shared by the app delegate and contract tests. FCM
/// data values arrive as strings; unsupported destinations simply open the app
/// without inventing a route.
enum RemoteNotificationRoute {
    static func deepLink(from userInfo: [AnyHashable: Any]) -> DeepLink? {
        if let rawID = string("livestreamID", in: userInfo),
           let id = UUID(uuidString: rawID) {
            return .livestream(id: id)
        }

        if let linkURL = string("link_url", in: userInfo),
           let link = deepLink(fromPath: linkURL) {
            return link
        }

        if let slug = string("event_slug", in: userInfo)?.nonEmpty {
            return .socialEvent(slug: slug)
        }

        // Parity with the Capacitor hook: the legacy organization/tournament
        // payload treated related_id as a livestream destination.
        if let entityType = string("entity_type", in: userInfo),
           ["organization", "tournament"].contains(entityType),
           let rawID = string("related_id", in: userInfo),
           let id = UUID(uuidString: rawID) {
            return .livestream(id: id)
        }
        return nil
    }

    private static func deepLink(fromPath rawValue: String) -> DeepLink? {
        if let absoluteURL = URL(string: rawValue), absoluteURL.scheme != nil {
            return DeepLink.parse(absoluteURL)
        }
        guard rawValue.hasPrefix("/") else { return nil }

        // Organizer notifications may append /danh-sach; the native detail is
        // still the closest safe destination.
        let segments = rawValue.split(separator: "/").map(String.init)
        if segments.count >= 2, segments[0] == "social" {
            return .socialEvent(slug: segments[1])
        }
        return URL(string: "https://thepicklehub.net\(rawValue)").flatMap(DeepLink.parse)
    }

    private static func string(_ key: String, in userInfo: [AnyHashable: Any]) -> String? {
        (userInfo[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Owns the APNs → FCM → Supabase token lifecycle. Runtime config is fail-
/// closed; a release cannot activate this service unless it is the exact live
/// bundle and all public Firebase identifiers validate.
@MainActor
final class RemotePushService: NSObject, MessagingDelegate {
    static let shared = RemotePushService()

    private struct PushTokenRow: Encodable {
        let user_id: UUID
        let token: String
        let platform = "ios"
    }

    private struct Binding: Equatable {
        let userID: UUID
        let token: String
    }

    private static let tokenGenerationKey = "native_fcm_token_generation"
    private static let tokenGeneration = 1

    private var isStarted = false
    private var acceptsTokens = false
    private var authenticatedUserID: UUID?
    private var latestToken: String?
    private var persistedBinding: Binding?
    private var persistenceTask: Task<Void, Never>?

    private override init() {}

    func start(application: UIApplication) {
        guard !isStarted, let config = AppConfig.firebaseMessagingConfiguration else { return }
        isStarted = true

        let options = FirebaseOptions(
            googleAppID: config.googleAppID,
            gcmSenderID: config.gcmSenderID
        )
        options.apiKey = config.apiKey
        options.projectID = config.projectID
        options.bundleID = config.bundleIdentifier
        FirebaseApp.configure(options: options)
        Messaging.messaging().delegate = self

        Task { await prepareTokenLifecycle(application: application) }
    }

    func setAPNSToken(_ token: Data) {
        guard isStarted else { return }
        Messaging.messaging().apnsToken = token
    }

    /// Called whenever native auth state changes. Crossing an account boundary
    /// rotates the FCM token, so one physical device cannot keep receiving push
    /// for a previously signed-in account even if a stale DB row survives.
    func setAuthenticatedUserID(_ userID: UUID?) {
        guard isStarted else { return }
        let previous = authenticatedUserID
        authenticatedUserID = userID
        persistedBinding = nil

        if let previous, previous != userID {
            Task { await rotateTokenForPrivacy() }
            return
        }
        persistIfReady()
    }

    /// Removes the known binding while the user's JWT is still valid, then
    /// invalidates the token itself. DB deletion is best-effort; FCM rotation is
    /// the privacy backstop when the network is unavailable.
    func prepareForSignOut() async {
        guard isStarted else { return }
        persistenceTask?.cancel()

        if let userID = authenticatedUserID, let token = latestToken {
            do {
                try await SupabaseManager.shared.client.from("push_tokens")
                    .delete()
                    .eq("user_id", value: userID)
                    .eq("token", value: token)
                    .execute()
            } catch {
                // Rotation below invalidates delivery even if this stale row
                // cannot be deleted until the server prunes UNREGISTERED.
            }
        }

        authenticatedUserID = nil
        persistedBinding = nil
        await rotateTokenForPrivacy()
    }

    nonisolated func messaging(_ messaging: Messaging,
                               didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        Task { @MainActor in
            self.accept(fcmToken: fcmToken)
        }
    }

    private func prepareTokenLifecycle(application: UIApplication) async {
        let defaults = UserDefaults.standard
        if defaults.integer(forKey: Self.tokenGenerationKey) < Self.tokenGeneration {
            acceptsTokens = false
            guard await deleteFCMToken() else { return }
            defaults.set(Self.tokenGeneration, forKey: Self.tokenGenerationKey)
        }

        acceptsTokens = true
        do {
            _ = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            // APNs registration still runs; a later Settings change can grant
            // alerts without requiring another binary.
        }
        application.registerForRemoteNotifications()
        requestCurrentFCMToken()
    }

    private func rotateTokenForPrivacy() async {
        acceptsTokens = false
        latestToken = nil
        persistedBinding = nil
        guard await deleteFCMToken() else { return }
        acceptsTokens = true
        requestCurrentFCMToken()
    }

    private func deleteFCMToken() async -> Bool {
        await withCheckedContinuation { continuation in
            Messaging.messaging().deleteToken { error in
                continuation.resume(returning: error == nil)
            }
        }
    }

    private func requestCurrentFCMToken() {
        Messaging.messaging().token { [weak self] token, _ in
            guard let token else { return }
            Task { @MainActor in self?.accept(fcmToken: token) }
        }
    }

    private func accept(fcmToken: String) {
        guard acceptsTokens, !fcmToken.isEmpty else { return }
        latestToken = fcmToken
        persistIfReady()
    }

    private func persistIfReady() {
        guard let userID = authenticatedUserID, let token = latestToken else { return }
        let binding = Binding(userID: userID, token: token)
        guard binding != persistedBinding else { return }

        persistenceTask?.cancel()
        persistenceTask = Task {
            do {
                try await SupabaseManager.shared.client.from("push_tokens")
                    .upsert(PushTokenRow(user_id: userID, token: token),
                            onConflict: "user_id,token")
                    .execute()
                guard !Task.isCancelled,
                      self.authenticatedUserID == userID,
                      self.latestToken == token else { return }
                self.persistedBinding = binding
            } catch {
                // Best-effort. Firebase will emit the token again after refresh;
                // auth state changes also retry this binding.
            }
        }
    }
}
