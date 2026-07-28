import Foundation
import Observation
import Supabase
import AuthenticationServices

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
    private let validateStoredSession: () async -> Error?

    @ObservationIgnored
    private var authListenerTask: Task<Void, Never>?
    @ObservationIgnored
    private var appleRawNonce: String?

    init(
        client: SupabaseClient = SupabaseManager.shared.client,
        currentIdentity: (() -> SessionUserIdentity?)? = nil,
        makeAuthEvents: (() -> AsyncStream<SessionLifecycleEvent>)? = nil,
        clearExternalAuth: @escaping () -> Void = { GoogleAuthService.signOut() },
        validateStoredSession: (() async -> Error?)? = nil
    ) {
        self.client = client
        self.currentIdentity = currentIdentity ?? {
            client.auth.currentSession.map(SessionUserIdentity.init)
        }
        self.makeAuthEvents = makeAuthEvents ?? {
            Self.liveAuthEvents(client: client)
        }
        self.clearExternalAuth = clearExternalAuth
        // `auth.session` tự refresh khi cần; ném lỗi = session lưu trữ không
        // còn dùng được (trừ lỗi mạng — caller tự phân biệt).
        self.validateStoredSession = validateStoredSession ?? {
            do { _ = try await client.auth.session; return nil } catch { return error }
        }
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
        var identity = currentIdentity()
        // Zombie signed-in (bug 28/07): keychain còn session nhưng refresh
        // token đã chết → UI như đang đăng nhập trong khi MỌI request đi nặc
        // danh (chuông đòi login, giải biến mất, membership=anonymous). Boot
        // phải validate session lưu trữ; chết thật (không phải lỗi mạng) thì
        // xóa khỏi keychain và vào màn đăng nhập. Launch offline giữ nguyên
        // session — URLError không bị coi là session chết.
        if identity != nil, let error = await validateStoredSession(), !(error is URLError) {
            identity = nil
            try? await client.auth.signOut(scope: .local)
        }
        apply(.init(kind: .initialSession, identity: identity))
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
                    accessToken: tokens.accessToken,
                    nonce: tokens.rawNonce
                )
            )
            self.apply(.init(kind: .signedIn, identity: SessionUserIdentity(session: session)))
        }
    }

    // MARK: - Apple (native AuthenticationServices → Supabase OIDC)

    func prepareAppleSignIn(_ request: ASAuthorizationAppleIDRequest) {
        lastError = nil
        isWorking = true
        do {
            appleRawNonce = try AppleAuthService.prepare(request)
        } catch {
            appleRawNonce = nil
            isWorking = false
            lastError = error.localizedDescription
        }
    }

    func completeAppleSignIn(_ result: Result<ASAuthorization, Error>) async {
        let rawNonce = appleRawNonce
        appleRawNonce = nil

        switch result {
        case .failure(let error):
            isWorking = false
            if !AppleAuthService.isCancellation(error) {
                lastError = error.localizedDescription
            }
        case .success(let authorization):
            await run {
                let credentials = try AppleAuthService.credentials(
                    from: authorization,
                    rawNonce: rawNonce
                )
                let session = try await self.client.auth.signInWithIdToken(
                    credentials: .init(
                        provider: .apple,
                        idToken: credentials.idToken,
                        nonce: credentials.rawNonce
                    )
                )
                await self.persistAppleDisplayNameIfNeeded(
                    credentials.displayName,
                    session: session
                )
                self.apply(.init(
                    kind: .signedIn,
                    identity: SessionUserIdentity(session: session)
                ))
            }
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
            await RemotePushService.shared.prepareForSignOut()
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

    /// Apple only returns the person's name on the first authorization. Store
    /// it opportunistically without overwriting a profile name the user already
    /// chose. Name persistence is best-effort and must never block sign-in.
    private func persistAppleDisplayNameIfNeeded(
        _ displayName: String?,
        session: Session
    ) async {
        guard let displayName else { return }
        _ = try? await client.auth.update(
            user: UserAttributes(data: [
                "display_name": .string(displayName),
                "full_name": .string(displayName)
            ])
        )

        struct ProfileName: Decodable {
            let displayName: String?
            enum CodingKeys: String, CodingKey {
                case displayName = "display_name"
            }
        }
        struct ProfileNameUpdate: Encodable {
            let display_name: String
        }

        let profile: ProfileName? = try? await client.from("profiles")
            .select("display_name")
            .eq("id", value: session.user.id)
            .single()
            .execute()
            .value
        let current = profile?.displayName?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let emailFallback = session.user.email?
            .split(separator: "@", maxSplits: 1)
            .first
            .map(String.init)
        guard current?.isEmpty != false || current == emailFallback else { return }

        _ = try? await client.from("profiles")
            .update(ProfileNameUpdate(display_name: displayName))
            .eq("id", value: session.user.id)
            .execute()
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
