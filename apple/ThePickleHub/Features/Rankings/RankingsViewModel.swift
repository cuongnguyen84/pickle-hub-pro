import Foundation
import Observation

/// DUPR leaderboard across scopes (Vietnam live + static DUPR.com snapshot) and
/// per-scope formats, mirroring the web `/rankings`.
@Observable
final class RankingsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    private(set) var phase: Phase = .loading
    private(set) var rows: [RankRow] = []
    private(set) var scope: DuprScope = .vietnam
    private(set) var format: DuprFormat = .doubles

    private let repo = RankingsRepository()

    var formats: [DuprFormat] { availableFormats(for: scope) }

    @MainActor
    func load() async { await reload() }

    @MainActor
    func selectScope(_ newScope: DuprScope) async {
        guard newScope != scope else { return }
        scope = newScope
        if !availableFormats(for: newScope).contains(format) {
            format = defaultFormat(for: newScope)
        }
        await reload()
    }

    @MainActor
    func selectFormat(_ newFormat: DuprFormat) async {
        guard newFormat != format else { return }
        format = newFormat
        await reload()
    }

    @MainActor
    private func reload() async {
        phase = .loading
        if scope.isVietnam {
            do {
                let fmt: RankingsRepository.Format = (format == .singles) ? .singles : .doubles
                let live = try await repo.vietnam(format: fmt)
                rows = live.map {
                    RankRow(id: "vn-\($0.rank)", rank: $0.rank, name: $0.resolvedName,
                            subtitle: $0.city?.nonEmpty, rating: $0.duprRating,
                            avatarURL: $0.avatarURL, username: $0.username, isStale: $0.isStale)
                }
                phase = .loaded
            } catch {
                rows = []
                phase = .failed(error.localizedDescription)
            }
        } else {
            let players = DuprSnapshot.players(scope: scope, format: format)
            rows = players.map {
                RankRow(id: "\(scope.rawValue)-\(format.rawValue)-\($0.rank)", rank: $0.rank, name: $0.name,
                        subtitle: $0.age.map { "\($0) tuổi" }, rating: $0.rating,
                        avatarURL: nil, username: nil, isStale: false)
            }
            phase = .loaded
        }
    }
}
