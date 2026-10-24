import Foundation
import Testing
@testable import ThePickleHub

/// B3 review-prompt policy: ask only after genuinely positive use, never in
/// the first week, never in a session that hit an error, at most once per
/// 90 days from the app side (Apple enforces its own 3-per-365-days cap).
struct ReviewPromptPolicyTests {
    private let t0 = Date(timeIntervalSince1970: 1_800_000_000)
    private func day(_ n: Double) -> Date { t0.addingTimeInterval(n * 86_400) }

    private func state(moments: Set<ReviewPromptMoment>, age: Double = 30,
                       lastPrompt: Date? = nil, errorSession: String? = nil) -> ReviewPromptState {
        ReviewPromptState(firstLaunchAt: t0, moments: moments,
                          lastPromptAt: lastPrompt, errorSessionID: errorSession)
    }

    @Test func needsTwoDistinctMoments() {
        let one = state(moments: [.registration])
        #expect(!ReviewPromptPolicy.isEligible(state: one, now: day(30), sessionID: "s1"))
        let two = state(moments: [.registration, .resultsViewed])
        #expect(ReviewPromptPolicy.isEligible(state: two, now: day(30), sessionID: "s1"))
    }

    @Test func lockedDuringFirstWeek() {
        let s = state(moments: [.registration, .resultsViewed])
        #expect(!ReviewPromptPolicy.isEligible(state: s, now: day(6.9), sessionID: "s1"))
        #expect(ReviewPromptPolicy.isEligible(state: s, now: day(7), sessionID: "s1"))
    }

    @Test func ninetyDayCapBetweenAsks() {
        let s = state(moments: [.registration, .resultsViewed], lastPrompt: day(10))
        #expect(!ReviewPromptPolicy.isEligible(state: s, now: day(99), sessionID: "s1"))
        #expect(ReviewPromptPolicy.isEligible(state: s, now: day(100), sessionID: "s1"))
    }

    @Test func errorSuppressesOnlyItsOwnSession() {
        let s = state(moments: [.registration, .resultsViewed], errorSession: "s1")
        #expect(!ReviewPromptPolicy.isEligible(state: s, now: day(30), sessionID: "s1"))
        #expect(ReviewPromptPolicy.isEligible(state: s, now: day(30), sessionID: "s2"))
    }

    @MainActor
    @Test func storeRecordsMomentsAndRestartsClockWhenAsking() {
        let defaults = UserDefaults(suiteName: "ReviewPromptTests-\(UUID().uuidString)")!
        let store = ReviewPromptStore(defaults: defaults, now: t0)
        #expect(store.recordPositive(.registration, now: day(30)) == false) // only one moment
        #expect(store.recordPositive(.resultsViewed, now: day(30)) == true) // second moment -> ask
        #expect(store.state.lastPromptAt == day(30))
        // Inside the 90-day window a further moment must not ask again.
        #expect(store.recordPositive(.registration, now: day(60)) == false)
        // A fresh store over the same defaults sees the persisted state.
        let reloaded = ReviewPromptStore(defaults: defaults, now: day(200))
        #expect(reloaded.state.moments == [.registration, .resultsViewed])
        #expect(reloaded.state.lastPromptAt == day(30))
    }

    @MainActor
    @Test func storeErrorBlocksAskingForTheSession() {
        let defaults = UserDefaults(suiteName: "ReviewPromptTests-\(UUID().uuidString)")!
        let store = ReviewPromptStore(defaults: defaults, now: t0)
        _ = store.recordPositive(.registration, now: day(30))
        store.recordError()
        #expect(store.recordPositive(.resultsViewed, now: day(30)) == false)
    }
}
