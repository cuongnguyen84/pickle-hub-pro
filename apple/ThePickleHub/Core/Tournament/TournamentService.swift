import Foundation
@preconcurrency import Supabase

/// Shared tournament-side helpers used by the native Bracket Lab screens.
/// Phase-0 roadmap item: keep current-user lookup and realtime invalidation
/// logic in one place instead of duplicating it across Quick Table / Doubles
/// Elim / Team Match view models.
@MainActor
final class TournamentService {
    static let shared = TournamentService()

    private let client: SupabaseClient

    private init(client: SupabaseClient = SupabaseManager.shared.client) {
        self.client = client
    }

    func currentUserID() async -> UUID? {
        try? await client.auth.session.user.id
    }

    /// One shared admin permission check for every Bracket Lab format.
    /// Web grants the same role full organizer/scoring access.
    func isCurrentUserAdmin() async -> Bool {
        guard let userID = await currentUserID() else { return false }
        struct RoleRow: Decodable { let role: String }
        let rows: [RoleRow]? = try? await client
            .from("user_roles")
            .select("role")
            .eq("user_id", value: userID)
            .eq("role", value: "admin")
            .limit(1)
            .execute().value
        return rows?.isEmpty == false
    }

    struct DuprIdentity: Equatable {
        let connected: Bool
        let rating: Double?
    }

    /// Verified DUPR state used by every native tournament registration gate.
    func currentUserDupr() async -> DuprIdentity {
        guard let userID = await currentUserID() else {
            return DuprIdentity(connected: false, rating: nil)
        }
        struct ProfileRow: Decodable {
            let method: String?
            let doubles: Double?
            let singles: Double?
            enum CodingKeys: String, CodingKey {
                case method = "dupr_connected_via"
                case doubles = "dupr_doubles"
                case singles = "dupr_singles"
            }
        }
        let row: ProfileRow? = try? await client
            .from("profiles")
            .select("dupr_connected_via, dupr_doubles, dupr_singles")
            .eq("id", value: userID)
            .single()
            .execute().value
        return DuprIdentity(
            connected: row?.method == "sso" && (row?.doubles ?? row?.singles) != nil,
            rating: row?.doubles ?? row?.singles
        )
    }

    func watchQuickTable(tableID: UUID, onChange: @escaping @Sendable () async -> Void) -> TournamentRealtimeSubscription {
        watch(
            channelName: "quick-table:\(tableID.uuidString.lowercased())",
            filterValue: tableID.uuidString.lowercased(),
            tables: [
                .init(name: "quick_tables", filterColumn: "id"),
                .init(name: "quick_table_matches", filterColumn: "table_id"),
                .init(name: "quick_table_players", filterColumn: "table_id"),
                .init(name: "quick_table_groups", filterColumn: "table_id"),
                .init(name: "quick_table_registrations", filterColumn: "table_id"),
                .init(name: "quick_table_teams", filterColumn: "table_id"),
                .init(name: "quick_table_partner_invitations", filterColumn: "table_id"),
                .init(name: "quick_table_referees", filterColumn: "table_id"),
            ],
            onChange: onChange
        )
    }

    func watchDoublesElim(tournamentID: UUID, onChange: @escaping @Sendable () async -> Void) -> TournamentRealtimeSubscription {
        watch(
            channelName: "doubles-elim:\(tournamentID.uuidString.lowercased())",
            filterValue: tournamentID.uuidString.lowercased(),
            tables: [
                .init(name: "doubles_elimination_tournaments", filterColumn: "id"),
                .init(name: "doubles_elimination_matches", filterColumn: "tournament_id"),
                .init(name: "doubles_elimination_teams", filterColumn: "tournament_id"),
                .init(name: "doubles_elimination_referees", filterColumn: "tournament_id"),
            ],
            onChange: onChange
        )
    }

    func watchTeamMatch(tournamentID: UUID, onChange: @escaping @Sendable () async -> Void) -> TournamentRealtimeSubscription {
        watch(
            channelName: "team-match:\(tournamentID.uuidString.lowercased())",
            filterValue: tournamentID.uuidString.lowercased(),
            tables: [
                .init(name: "team_match_tournaments", filterColumn: "id"),
                .init(name: "team_match_matches", filterColumn: "tournament_id"),
                .init(name: "team_match_games", filterColumn: nil),
                .init(name: "team_match_teams", filterColumn: "tournament_id"),
                .init(name: "team_match_roster", filterColumn: nil),
                .init(name: "team_match_referees", filterColumn: "tournament_id"),
            ],
            onChange: onChange
        )
    }

    func watchFlex(tournamentID: UUID, onChange: @escaping @Sendable () async -> Void) -> TournamentRealtimeSubscription {
        watch(
            channelName: "flex:\(tournamentID.uuidString.lowercased())",
            filterValue: tournamentID.uuidString.lowercased(),
            tables: [
                .init(name: "flex_tournaments", filterColumn: "id"),
                .init(name: "flex_matches", filterColumn: "tournament_id"),
                .init(name: "flex_players", filterColumn: "tournament_id"),
                .init(name: "flex_teams", filterColumn: "tournament_id"),
                .init(name: "flex_groups", filterColumn: "tournament_id"),
                .init(name: "flex_group_items", filterColumn: nil),
                .init(name: "flex_team_members", filterColumn: nil),
                .init(name: "flex_player_stats", filterColumn: nil),
                .init(name: "flex_pair_stats", filterColumn: nil),
                .init(name: "flex_tournament_referees", filterColumn: "tournament_id"),
            ],
            onChange: onChange
        )
    }

    private struct WatchedTable {
        let name: String
        let filterColumn: String?
    }

    private func watch(
        channelName: String,
        filterValue: String,
        tables: [WatchedTable],
        onChange: @escaping @Sendable () async -> Void
    ) -> TournamentRealtimeSubscription {
        let channel = client.channel(channelName)
        let invalidator = TournamentRealtimeInvalidator(onChange: onChange)
        let tasks = tables.map { table in
            let filter = table.filterColumn.map {
                RealtimePostgresFilter.eq($0, value: filterValue)
            }
            return observe(
                channel,
                schema: "public",
                table: table.name,
                filter: filter,
                invalidator: invalidator
            )
        } + [
            Task {
                do {
                    try await channel.subscribeWithError()
                } catch is CancellationError {
                    // Normal when the screen disappears or the user switches tournaments.
                } catch {
                    // Best-effort stream: polling remains as a safety net.
                }
            }
        ]
        return TournamentRealtimeSubscription(channel: channel, tasks: tasks, invalidator: invalidator)
    }

    private func observe(
        _ channel: RealtimeChannelV2,
        schema: String,
        table: String,
        filter: RealtimePostgresFilter?,
        invalidator: TournamentRealtimeInvalidator
    ) -> Task<Void, Never> {
        Task {
            let stream = channel.postgresChange(AnyAction.self, schema: schema, table: table, filter: filter)
            for await _ in stream {
                invalidator.invalidate()
            }
        }
    }
}

/// Coalesces bursts from several watched tables into one reload. A tournament
/// mutation often touches a match, standings and roster row in the same
/// transaction, so reloading once after the burst avoids redundant requests.
@MainActor
private final class TournamentRealtimeInvalidator {
    private let onChange: @Sendable () async -> Void
    private var pending: Task<Void, Never>?

    init(onChange: @escaping @Sendable () async -> Void) {
        self.onChange = onChange
    }

    func invalidate() {
        pending?.cancel()
        pending = Task { [onChange] in
            do {
                try await Task.sleep(for: .milliseconds(500))
                guard !Task.isCancelled else { return }
                await onChange()
            } catch is CancellationError {
                // A newer database event replaced this pending reload.
            } catch {
                // Duration sleep has no other expected failure mode.
            }
        }
    }

    func cancel() {
        pending?.cancel()
        pending = nil
    }
}

@MainActor
final class TournamentRealtimeSubscription {
    private let channel: RealtimeChannelV2
    private var tasks: [Task<Void, Never>]
    private let invalidator: TournamentRealtimeInvalidator

    fileprivate init(
        channel: RealtimeChannelV2,
        tasks: [Task<Void, Never>],
        invalidator: TournamentRealtimeInvalidator
    ) {
        self.channel = channel
        self.tasks = tasks
        self.invalidator = invalidator
    }

    func stop() async {
        invalidator.cancel()
        tasks.forEach { $0.cancel() }
        tasks.removeAll()
        await SupabaseManager.shared.client.removeChannel(channel)
    }
}

/// Serializes detail reloads and guarantees that an event arriving while a
/// request is in flight gets one fresh pass afterwards. All callers awaiting a
/// reload are resumed only after their requested generation has completed.
@MainActor
final class TournamentRefreshGate {
    typealias Operation = @MainActor () async -> Void

    private struct Waiter {
        let generation: Int
        let continuation: CheckedContinuation<Void, Never>
    }

    private var requestedGeneration = 0
    private var completedGeneration = 0
    private var isRunning = false
    private var latestOperation: Operation?
    private var waiters: [Waiter] = []

    func perform(_ operation: @escaping Operation) async {
        requestedGeneration += 1
        let callerGeneration = requestedGeneration
        latestOperation = operation

        if isRunning {
            await withCheckedContinuation { continuation in
                waiters.append(Waiter(generation: callerGeneration, continuation: continuation))
            }
            return
        }

        isRunning = true
        while completedGeneration < requestedGeneration {
            let generation = requestedGeneration
            guard let operation = latestOperation else { break }
            await operation()
            completedGeneration = generation
            resumeCompletedWaiters()
        }
        isRunning = false
    }

    private func resumeCompletedWaiters() {
        var pending: [Waiter] = []
        for waiter in waiters {
            if waiter.generation <= completedGeneration {
                waiter.continuation.resume()
            } else {
                pending.append(waiter)
            }
        }
        waiters = pending
    }
}
