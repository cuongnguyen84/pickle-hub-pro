import Foundation

/// Positive moments that can earn an App Store review prompt (ASO package B3,
/// approved 2026-10-24). The prompt itself is Apple's system dialog
/// (SKStoreReviewController via SwiftUI's `requestReview`): Apple decides
/// whether it appears at all and caps it at 3 showings per 365 days. This
/// store only decides when the app is ALLOWED to ask.
enum ReviewPromptMoment: String, Codable, CaseIterable {
    /// The user completed a tournament registration.
    case registration
    /// The user opened a pro-tour event whose results loaded with matches.
    case resultsViewed
}

/// Durable prompt bookkeeping, persisted as JSON in UserDefaults.
struct ReviewPromptState: Codable, Equatable {
    var firstLaunchAt: Date
    var moments: Set<ReviewPromptMoment>
    var lastPromptAt: Date?
    /// The app-launch session that most recently hit an error, if any.
    /// Prompts are suppressed for the rest of that session.
    var errorSessionID: String?

    static func fresh(now: Date) -> ReviewPromptState {
        ReviewPromptState(firstLaunchAt: now, moments: [], lastPromptAt: nil, errorSessionID: nil)
    }
}

/// Pure eligibility rules — kept separate from storage so they are unit
/// testable without UserDefaults or a clock dependency.
enum ReviewPromptPolicy {
    /// Never prompt during the first week after the first launch.
    static let minimumAccountAgeDays = 7
    /// The app asks at most once per 90 days (Apple may still decline).
    static let minimumDaysBetweenPrompts = 90
    /// Distinct positive moments required before the first ask.
    static let requiredMoments = 2

    static func isEligible(state: ReviewPromptState, now: Date, sessionID: String) -> Bool {
        guard state.moments.count >= requiredMoments else { return false }
        guard now.timeIntervalSince(state.firstLaunchAt) >= Double(minimumAccountAgeDays) * 86_400 else { return false }
        if let last = state.lastPromptAt,
           now.timeIntervalSince(last) < Double(minimumDaysBetweenPrompts) * 86_400 {
            return false
        }
        if state.errorSessionID == sessionID { return false }
        return true
    }
}

/// UserDefaults-backed store shared by the prompt touchpoints. Main-actor
/// confined: every caller is a view or view model on the main actor.
@MainActor
final class ReviewPromptStore {
    static let shared = ReviewPromptStore()

    private let defaults: UserDefaults
    private let storageKey = "reviewPrompt.state.v1"
    /// One id per app launch — an error suppresses prompts only for the
    /// remainder of the launch that produced it.
    let sessionID = UUID().uuidString
    private(set) var state: ReviewPromptState

    init(defaults: UserDefaults = .standard, now: Date = Date()) {
        self.defaults = defaults
        if let data = defaults.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode(ReviewPromptState.self, from: data) {
            state = decoded
        } else {
            state = .fresh(now: now)
            save()
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(state) {
            defaults.set(data, forKey: storageKey)
        }
    }

    /// Records a positive moment. Returns true exactly when the caller should
    /// request the system review prompt now; the 90-day clock restarts at
    /// that point whether or not Apple actually shows the dialog.
    @discardableResult
    func recordPositive(_ moment: ReviewPromptMoment, now: Date = Date()) -> Bool {
        state.moments.insert(moment)
        save()
        guard ReviewPromptPolicy.isEligible(state: state, now: now, sessionID: sessionID) else {
            return false
        }
        state.lastPromptAt = now
        save()
        return true
    }

    /// Marks the current launch session as error-tainted: no prompt is
    /// requested for the rest of this session.
    func recordError() {
        state.errorSessionID = sessionID
        save()
    }
}
