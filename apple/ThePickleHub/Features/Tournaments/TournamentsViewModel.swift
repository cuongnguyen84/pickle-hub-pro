import Foundation
import Observation

/// Loads pro tournaments and orders them ongoing → upcoming → ended (then by
/// start date, newest first) — the same ordering as the web Watch tab.
@Observable
final class TournamentsViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    private(set) var tournaments: [Tournament] = []

    private let repo = TournamentsRepository()

    @MainActor
    func load() async {
        phase = .loading
        do {
            let rows = try await repo.list()
            tournaments = rows.sorted { lhs, rhs in
                if lhs.kind.priority != rhs.kind.priority {
                    return lhs.kind.priority < rhs.kind.priority
                }
                return (lhs.startDate ?? "") > (rhs.startDate ?? "")
            }
            phase = .loaded
        } catch {
            tournaments = []
            phase = .failed(error.localizedDescription)
        }
    }
}
