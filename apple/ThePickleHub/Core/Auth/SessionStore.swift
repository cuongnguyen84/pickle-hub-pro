import Foundation
import Observation
import Supabase

/// Stable identity exposed to the UI. Keeping the user id in state prevents a
/// refreshed or replaced session from being mistaken for the previous user.
struct SessionUserIdentity: Equatable, Sendable {
    let id: UUID
    let email: String?
    let phone: String?

    var displayLabel: String {
        if let email, !email.isEmpty { return email }
        if let phone, !phone.isEmpty { return phone }
        return "—"
    }
}

/// SDK-independent auth event used by the state reducer and unit tests.
struct SessionLifecycleEvent: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        case initialSession
        case passwordRecovery
        case signedIn
        case signedOut
        case tokenRefreshed
        case userUpdated
        case userDeleted
        case mfaChallengeVerified
    }

    let kind: Kind
    let identity: SessionUserIdentity?
}

enum SessionLifecycleDecision: Equatable, Sendable {
    case signedOut
    case signedIn(SessionUserIdentity)
}

/// Conservative reducer: every session-bearing event requires an identity;
/// invalid/missing sessions and explicit invalidation always sign out.
enum SessionLifecycleReducer {
    static func reduce(_ event: SessionLifecycleEvent) -> SessionLifecycleDecision {
        switch event.kind {
        case .signedOut, .userDeleted:
            return .signedOut
        case .initialSession, .passwordRecovery, .signedIn, .tokenRefreshed,
             .userUpdated, .mfaChallengeVerified:
            guard let identity = event.identity else { return .signedOut }
            return .signedIn(identity)
        }
    }
}

extension SessionLifecycleEvent {
    init(supabaseEvent: AuthChangeEvent, session: Session?) {
        let kind: Kind
        switch supabaseEvent {
        case .initialSession: kind = .initialSession
        case .passwordRecovery: kind = .passwordRecovery
        case .signedIn: kind = .signedIn
        case .signedOut: kind = .signedOut
        case .tokenRefreshed: kind = .tokenRefreshed
        case .userUpdated: kind = .userUpdated
        case .userDeleted: kind = .userDeleted
        case .mfaChallengeVerified: kind = .mfaChallengeVerified
        }
        self.init(kind: kind, identity: session.map(SessionUserIdentity.init))
    }
}

private extension SessionUserIdentity {
    init(session: Session) {
        self.init(id: session.user.id, email: session.user.email, phone: session.user.phone)
    }
}

/// Observable auth state for the app. Backed by supabase-swift, which persists
/// the session in the Keychain and auto-refreshes tokens.
@MainActor
@Observable
final class SessionStore {
    enum State: Equatable {
        case unknown
        case signedOut
        case signedIn(SessionUserIdentity)
    }

    var state: State = .unknown
    var lastError: String?
    var isWorking = false

    private let client: SupabaseClient
    private let currentIdentity: () -> SessionUserIdentity?
    private let makeAuthEvents: () -> AsyncStream<SessionLifecycleEvent>
    private let clearExternalAuth: () -> Void

    @ObservationIgnored
    private var authListenerTask: Task<Void, Never>?

    init(
        client: SupabaseClient = SupabaseManager.shared.client,
        currentIdentity: (() -> SessionUserIdentity?)? = nil,
        makeAuthEvents: (() -> AsyncStream<SessionLifecycleEvent>)? = nil,
        clearExternalAuth: @escaping () -> Void = { GoogleAuthService.signOut() }
    ) {
        self.client = client
        self.currentIdentity = currentIdentity ?? {
            client.auth.currentSession.map(SessionUserIdentity.init)
        }
        self.makeAuthEvents = makeAuthEvents ?? {
            Self.liveAuthEvents(client: client)
        }
        self.clearExternalAuth = clearExternalAuth
    }

    deinit {
        authListenerTask?.cancel()
    }

    /// Starts one lifetime auth listener, then immediately applies the local
    /// Keychain session as an offline-safe launch fallback. Later SDK events
    /// replace that provisional state after refresh/revocation checks.
    func bootstrap() async {
        startAuthListenerIfNeeded()
        guard state == .unknown else { return }
        apply(.init(kind: .initialSession, identity: currentIdentity()))
    }

    // MARK: - Email / password

    func signIn(email: String, password: String) async {
        await run {
            let session = try await self.client.auth.signIn(email: email, password: password)
            self.apply(.init(kind: .signedIn, identity: SessionUserIdentity(session: session)))
        }
    }

    // MARK: - Google (native SDK → Supabase OIDC)

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
            self.apply(.init(kind: .signedIn, identity: SessionUserIdentity(session: session)))
        }
    }

    // MARK: - Phone OTP

    func sendPhoneOTP(phone: String) async -> Bool {
        var ok = false
        await run {
            try await self.client.auth.signInWithOTP(phone: phone)
            ok = true
        }
        return ok
    }

    func verifyPhoneOTP(phone: String, code: String) async {
        await run {
            try await self.client.auth.verifyOTP(phone: phone, token: code, type: .sms)
            let session = try await self.client.auth.session
            self.apply(.init(kind: .signedIn, identity: SessionUserIdentity(session: session)))
        }
    }

    // MARK: - Sign out

    func signOut() async {
        await run {
            // Supabase clears its local session and emits `.signedOut` before
            // attempting the remote logout request. The defer keeps UI and the
            // Google SDK clean even if that request fails offline.
            defer {
                self.apply(.init(kind: .signedOut, identity: nil))
            }
            try await self.client.auth.signOut()
        }
    }

    // MARK: - Listener / reducer

    private func startAuthListenerIfNeeded() {
        guard authListenerTask == nil else { return }
        let events = makeAuthEvents()
        authListenerTask = Task { [weak self] in
            for await event in events {
                guard !Task.isCancelled, let self else { return }
                self.apply(event)
            }
        }
    }

    private func apply(_ event: SessionLifecycleEvent) {
        lastError = nil
        switch SessionLifecycleReducer.reduce(event) {
        case .signedIn(let identity):
            state = .signedIn(identity)
        case .signedOut:
            let needsExternalCleanup = state != .signedOut
            state = .signedOut
            isWorking = false
            if needsExternalCleanup { clearExternalAuth() }
        }
    }

    nonisolated private static func liveAuthEvents(
        client: SupabaseClient
    ) -> AsyncStream<SessionLifecycleEvent> {
        AsyncStream { continuation in
            let task = Task {
                for await (event, session) in client.auth.authStateChanges {
                    guard !Task.isCancelled else { break }
                    continuation.yield(.init(supabaseEvent: event, session: session))
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - Helpers

    /// Wraps an auth action with the shared loading/error handling.
    private func run(_ action: () async throws -> Void) async {
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
