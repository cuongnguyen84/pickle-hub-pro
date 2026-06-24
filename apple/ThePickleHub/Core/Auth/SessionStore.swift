import Foundation
import Observation
import Supabase

/// Observable auth state for the app. Backed by supabase-swift, which persists
/// the session in the Keychain and auto-refreshes tokens.
@Observable
final class SessionStore {
    enum State: Equatable {
        case unknown
        case signedOut
        case signedIn(email: String)
    }

    var state: State = .unknown
    var lastError: String?
    var isWorking = false

    private let client = SupabaseManager.shared.client

    @MainActor
    func bootstrap() async {
        // Use the locally-stored session (synchronous, NO network) so a slow or
        // dead network can't hang the launch on a token refresh — which would
        // leave RootView stuck on `.unknown` (black screen). supabase-swift
        // auto-refreshes the token in the background once connectivity returns.
        if let session = client.auth.currentSession {
            state = .signedIn(email: session.user.email ?? "—")
        } else {
            state = .signedOut
        }
    }

    // MARK: - Email / password

    @MainActor
    func signIn(email: String, password: String) async {
        await run {
            let session = try await self.client.auth.signIn(email: email, password: password)
            self.state = .signedIn(email: session.user.email ?? email)
        }
    }

    // MARK: - Google (native SDK → Supabase OIDC)

    @MainActor
    func signInWithGoogle() async {
        await run {
            let tokens = try await GoogleAuthService.signIn()
            let session = try await self.client.auth.signInWithIdToken(
                credentials: .init(
                    provider: .google,
                    idToken: tokens.idToken,
                    accessToken: tokens.accessToken
                )
            )
            self.state = .signedIn(email: session.user.email ?? "—")
        }
    }

    // MARK: - Phone OTP

    @MainActor
    func sendPhoneOTP(phone: String) async -> Bool {
        var ok = false
        await run {
            try await self.client.auth.signInWithOTP(phone: phone)
            ok = true
        }
        return ok
    }

    @MainActor
    func verifyPhoneOTP(phone: String, code: String) async {
        await run {
            try await self.client.auth.verifyOTP(phone: phone, token: code, type: .sms)
            let session = try await self.client.auth.session
            self.state = .signedIn(email: session.user.email ?? phone)
        }
    }

    // MARK: - Sign out

    @MainActor
    func signOut() async {
        await run {
            try? await self.client.auth.signOut()
            GoogleAuthService.signOut()
            self.state = .signedOut
        }
    }

    // MARK: - Helpers

    /// Wraps an auth action with the shared loading/error handling.
    @MainActor
    private func run(_ action: @escaping () async throws -> Void) async {
        lastError = nil
        isWorking = true
        defer { isWorking = false }
        do {
            try await action()
        } catch {
            lastError = error.localizedDescription
        }
    }
}
