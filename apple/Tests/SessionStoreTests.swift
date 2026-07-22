import Foundation
import Supabase
import Testing
@testable import ThePickleHub

struct SessionStoreTests {
    private let first = SessionUserIdentity(
        id: UUID(uuidString: "10000000-0000-4000-8000-000000000001")!,
        email: "first@example.com",
        phone: nil
    )
    private let refreshed = SessionUserIdentity(
        id: UUID(uuidString: "20000000-0000-4000-8000-000000000002")!,
        email: nil,
        phone: "+84900000000"
    )

    @Test func initialSessionNilSignsOut() {
        let result = SessionLifecycleReducer.reduce(
            .init(kind: .initialSession, identity: nil)
        )
        #expect(result == .signedOut)
    }

    @Test func initialAndSignedInUseCorrectIdentity() {
        #expect(SessionLifecycleReducer.reduce(
            .init(kind: .initialSession, identity: first)
        ) == .signedIn(first))
        #expect(SessionLifecycleReducer.reduce(
            .init(kind: .signedIn, identity: refreshed)
        ) == .signedIn(refreshed))
    }

    @Test func tokenRefreshKeepsSignedInAndUpdatesIdentity() {
        #expect(SessionLifecycleReducer.reduce(
            .init(kind: .tokenRefreshed, identity: refreshed)
        ) == .signedIn(refreshed))
        #expect(SessionLifecycleReducer.reduce(
            .init(kind: .tokenRefreshed, identity: nil)
        ) == .signedOut)
    }

    @Test func signedOutAndUserDeletedInvalidateSession() {
        #expect(SessionLifecycleReducer.reduce(
            .init(kind: .signedOut, identity: first)
        ) == .signedOut)
        #expect(SessionLifecycleReducer.reduce(
            .init(kind: .userDeleted, identity: first)
        ) == .signedOut)
    }

    @Test func otherSessionEventsRefreshIdentity() {
        for kind in [
            SessionLifecycleEvent.Kind.passwordRecovery,
            .userUpdated,
            .mfaChallengeVerified,
        ] {
            #expect(SessionLifecycleReducer.reduce(
                .init(kind: kind, identity: refreshed)
            ) == .signedIn(refreshed))
        }
    }

    @Test @MainActor func bootstrapIsOfflineSafeAndStartsOnlyOneListener() async {
        let source = TestAuthEventSource()
        var externalCleanupCount = 0
        let store = SessionStore(
            client: testClient(),
            currentIdentity: { nil },
            makeAuthEvents: { source.makeStream() },
            clearExternalAuth: { externalCleanupCount += 1 }
        )

        await store.bootstrap()
        await store.bootstrap()

        #expect(store.state == .signedOut)
        #expect(source.streamRequestCount == 1)
        #expect(externalCleanupCount == 1)

        source.yield(.init(kind: .signedIn, identity: first))
        await settleTasks()
        #expect(store.state == .signedIn(first))

        source.yield(.init(kind: .tokenRefreshed, identity: refreshed))
        await settleTasks()
        #expect(store.state == .signedIn(refreshed))

        source.yield(.init(kind: .signedOut, identity: nil))
        await settleTasks()
        #expect(store.state == .signedOut)
        #expect(externalCleanupCount == 2)
    }

    private func testClient() -> SupabaseClient {
        SupabaseClient(
            supabaseURL: URL(string: "http://127.0.0.1:54321")!,
            supabaseKey: "session-store-test-key"
        )
    }

    @MainActor
    private func settleTasks() async {
        for _ in 0..<8 { await Task.yield() }
    }
}

@MainActor
private final class TestAuthEventSource {
    private let stream: AsyncStream<SessionLifecycleEvent>
    private let continuation: AsyncStream<SessionLifecycleEvent>.Continuation
    private(set) var streamRequestCount = 0

    init() {
        let pair = AsyncStream<SessionLifecycleEvent>.makeStream()
        stream = pair.stream
        continuation = pair.continuation
    }

    func makeStream() -> AsyncStream<SessionLifecycleEvent> {
        streamRequestCount += 1
        return stream
    }

    func yield(_ event: SessionLifecycleEvent) {
        continuation.yield(event)
    }
}
