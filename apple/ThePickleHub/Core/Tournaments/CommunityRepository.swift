import Foundation
import Supabase

/// Public "Community" tournaments across the 4 bracket formats — the native
/// equivalent of the web `/tournaments` Community tab (active + open-registration
/// brackets anyone can watch/join). Each format is fetched independently and
/// fails soft. Returns `[MyTournament]` so it reuses the Tools card + routing.
struct CommunityRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static func isoFormatter() -> ISO8601DateFormatter {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }
    private static func date(_ s: String?) -> Date? {
        guard let s else { return nil }
        return isoFormatter().date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    /// All active public community tournaments, newest first.
    func activeCommunity(limit: Int = 20) async -> [MyTournament] {
        await fetchAll(completed: false, limit: limit)
    }

    /// Completed public community tournaments — backs the "Đã kết thúc" filter.
    /// Fetched lazily on first switch (most users never open it).
    func completedCommunity(limit: Int = 20) async -> [MyTournament] {
        await fetchAll(completed: true, limit: limit)
    }

    private func fetchAll(completed: Bool, limit: Int) async -> [MyTournament] {
        async let q = quickTables(limit: limit, completed: completed)
        async let t = teamMatches(limit: limit, completed: completed)
        async let d = doublesElim(limit: limit, completed: completed)
        async let f = flex(limit: limit, completed: completed)
        let all = await q + t + d + f
        return all.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    // MARK: Quick Tables (is_public, active statuses)

    /// PostgREST embedded aggregate — `relation(count)` decodes as `[{"count": n}]`.
    private struct CountRow: Decodable { let count: Int }

    private func quickTables(limit: Int, completed: Bool) async -> [MyTournament] {
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?
            let player_count: Int?; let requires_registration: Bool?; let is_doubles: Bool?; let created_at: String?
            // Approved-only registration counts (badge #429) — one embedded count
            // per registration table, singles vs doubles. Same query, no N+1.
            let quick_table_registrations: [CountRow]?
            let quick_table_teams: [CountRow]?
        }
        do {
            let rows: [Row] = try await client.from("quick_tables")
                .select("id, name, share_id, status, player_count, requires_registration, is_doubles, created_at, quick_table_registrations(count), quick_table_teams(count)")
                .eq("is_public", value: true)
                .in("status", values: completed ? ["completed"] : ["setup", "group_stage", "playoff"])
                .eq("quick_table_registrations.status", value: "approved")
                .eq("quick_table_teams.team_status", value: "approved")
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                let state: TournamentState = {
                    switch r.status {
                    case "group_stage", "playoff": return .ongoing
                    case "completed": return .completed
                    case "setup": return (r.requires_registration == true) ? .open : .draft
                    default: return .draft
                    }
                }()
                let doubles = r.is_doubles ?? true
                let approved = (doubles ? r.quick_table_teams : r.quick_table_registrations)?.first?.count ?? 0
                return MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? "Bảng đấu nhanh",
                    isDoubles: doubles, capacity: r.player_count ?? 0, registered: approved,
                    state: state, createdAt: Self.date(r.created_at), format: .quickTable
                )
            }
        } catch { assertionFailure("CommunityRepository.quickTables: \(error)"); return [] }
    }

    // MARK: Team Match (registration / ongoing)

    private func teamMatches(limit: Int, completed: Bool) async -> [MyTournament] {
        struct TeamRef: Decodable { let tournament_id: UUID }
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?
            let team_count: Int?; let created_at: String?
            // ponytail: narrow embed (not `(count)`) — anon RLS on team_match_teams
            // only allows narrow column selects (#430), the count aggregate 42501s.
            let team_match_teams: [TeamRef]?
        }
        do {
            let rows: [Row] = try await client.from("team_match_tournaments")
                .select("id, name, share_id, status, team_count, created_at, team_match_teams(tournament_id)")
                .in("status", values: completed ? ["completed"] : ["registration", "ongoing"])
                .eq("team_match_teams.status", value: "approved")
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                let state: TournamentState = {
                    switch r.status {
                    case "ongoing": return .ongoing
                    case "completed": return .completed
                    default: return .open
                    }
                }()
                return MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? String(localized: "Đấu đồng đội"),
                    isDoubles: true, capacity: r.team_count ?? 0,
                    registered: r.team_match_teams?.count ?? 0,
                    state: state,
                    createdAt: Self.date(r.created_at), format: .teamMatch
                )
            }
        } catch { assertionFailure("CommunityRepository.teamMatches: \(error)"); return [] }
    }

    // MARK: Doubles Elimination (setup / active / ongoing)

    private func doublesElim(limit: Int, completed: Bool) async -> [MyTournament] {
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?
            let team_count: Int?; let created_at: String?
        }
        do {
            let rows: [Row] = try await client.from("doubles_elimination_tournaments")
                .select("id, name, share_id, status, team_count, created_at")
                .in("status", values: completed ? ["completed"] : ["setup", "active", "ongoing"])
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? BracketFormat.doublesElim.labelVi,
                    isDoubles: true, capacity: r.team_count ?? 0, registered: 0,
                    state: Self.bracketState(r.status),
                    createdAt: Self.date(r.created_at), format: .doublesElim
                )
            }
        } catch { assertionFailure("CommunityRepository.doublesElim: \(error)"); return [] }
    }

    /// setup → draft, completed → completed, everything else → ongoing.
    private static func bracketState(_ status: String?) -> TournamentState {
        switch status {
        case "setup": return .draft
        case "completed": return .completed
        default: return .ongoing
        }
    }

    // MARK: Flex (is_public, setup / active / ongoing)

    private func flex(limit: Int, completed: Bool) async -> [MyTournament] {
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?; let created_at: String?
        }
        do {
            let rows: [Row] = try await client.from("flex_tournaments")
                .select("id, name, share_id, status, created_at")
                .eq("is_public", value: true)
                .in("status", values: completed ? ["completed"] : ["setup", "active", "ongoing"])
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? String(localized: "Giải linh hoạt"),
                    isDoubles: true, capacity: 0, registered: 0,
                    state: Self.bracketState(r.status),
                    createdAt: Self.date(r.created_at), format: .flex
                )
            }
        } catch { assertionFailure("CommunityRepository.flex: \(error)"); return [] }
    }
}
