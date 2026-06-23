import Foundation
import Observation

/// Loads the Vietnam DUPR leaderboard for the selected format (Đôi/Đơn).
@Observable
final class RankingsViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    private(set) var rows: [RankingRow] = []

    private let repo = RankingsRepository()

    @MainActor
    func load(format: RankingsRepository.Format) async {
        phase = .loading
        do {
            rows = try await repo.vietnam(format: format)
            phase = .loaded
        } catch {
            rows = []
            phase = .failed(error.localizedDescription)
        }
    }
}
