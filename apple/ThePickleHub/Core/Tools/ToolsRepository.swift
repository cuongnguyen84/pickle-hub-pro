import Foundation
import Supabase

/// Reads the current user's Bracket Lab tournaments for the Tools hub. Brackets
/// are created/scored on the web for now, so this is read-only + enrichment.
struct ToolsRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static func parseDate(_ s: String?) -> Date? {
        guard let s else { return nil }
        return iso.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    /// All Bracket Lab tournaments the signed-in user owns, across the 4 formats,
    /// newest first. Each format is fetched independently and tolerant of failure
    /// (RLS/cancellation/missing rows) so one bad query never blanks the list.
    /// Returns [] when signed out. Non-throwing on purpose.
    func myTournaments(limit: Int = 20) async -> [MyTournament] {
        guard let uid = try? await client.auth.session.user.id.uuidString.lowercased() else { return [] }

        async let quick = quickTournaments(uid: uid, limit: limit)
        async let doubles = doublesTournaments(uid: uid, limit: limit)
        // Team Match owner column is `created_by` (NOT creator_user_id) — see web
        // MyTournaments.tsx. Flex uses creator_user_id. Neither has a native view
        // yet, so cards open the web on tap.
        async let team = simpleTournaments(table: "team_match_tournaments", ownerColumn: "created_by", uid: uid, limit: limit, format: .teamMatch)
        async let flex = simpleTournaments(table: "flex_tournaments", ownerColumn: "creator_user_id", uid: uid, limit: limit, format: .flex)

        let all = await quick + doubles + team + flex
        return all.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    private func quickTournaments(uid: String, limit: Int) async -> [MyTournament] {
        do {
            let rows: [QuickTableRow] = try await client
                .from("quick_tables")
                .select("id, share_id, name, is_doubles, player_count, status, requires_registration, start_time, created_at")
                .eq("creator_user_id", value: uid)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return await withTaskGroup(of: MyTournament.self) { group in
                for row in rows { group.addTask { await enrich(row) } }
                var result: [MyTournament] = []
                for await item in group { result.append(item) }
                return result
            }
        } catch { return [] }
    }

    private func doublesTournaments(uid: String, limit: Int) async -> [MyTournament] {
        do {
            let rows: [DEListRow] = try await client
                .from("doubles_elimination_tournaments")
                .select("id, share_id, name, team_count, status, created_at")
                .eq("creator_user_id", value: uid)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return await withTaskGroup(of: MyTournament.self) { group in
                for row in rows { group.addTask { await enrich(row) } }
                var result: [MyTournament] = []
                for await item in group { result.append(item) }
                return result
            }
        } catch { return [] }
    }

    private func simpleTournaments(table: String, ownerColumn: String, uid: String, limit: Int, format: BracketFormat) async -> [MyTournament] {
        do {
            let rows: [SimpleToolRow] = try await client
                .from(table)
                .select("id, share_id, name, status, created_at")
                .eq(ownerColumn, value: uid)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { Self.map($0, format: format) }
        } catch { return [] }
    }

    /// Minimal row shared by Team Match + Flex (no capacity/registration surfaced).
    private struct SimpleToolRow: Decodable {
        let id: UUID
        let shareID: String
        let name: String?
        let status: String?
        let createdAt: String?
        enum CodingKeys: String, CodingKey {
            case id, name, status
            case shareID = "share_id"
            case createdAt = "created_at"
        }
    }

    private static func map(_ row: SimpleToolRow, format: BracketFormat) -> MyTournament {
        let state: TournamentState
        switch row.status {
        case "completed": state = .completed
        case "setup", "draft": state = .draft
        default: state = .ongoing   // active / ongoing / registration_*
        }
        return MyTournament(
            id: row.id, shareID: row.shareID, name: row.name ?? "",
            isDoubles: true, capacity: 0, registered: 0,
            state: state, createdAt: Self.parseDate(row.createdAt), format: format
        )
    }

    private func enrich(_ row: QuickTableRow) async -> MyTournament {
        let requiresReg = row.requiresRegistration ?? false
        let capacity = row.playerCount ?? 0
        let registered = (try? await count(row: row, requiresReg: requiresReg)) ?? 0
        let state = Self.state(status: row.status, requiresReg: requiresReg,
                               registered: registered, capacity: capacity)
        return MyTournament(
            id: row.id,
            shareID: row.shareID,
            name: row.name ?? "",
            isDoubles: row.isDoubles ?? true,
            capacity: capacity,
            registered: registered,
            state: state,
            createdAt: Self.parseDate(row.createdAt)
        )
    }

    /// Raw `doubles_elimination_tournaments` row owned by the current user.
    private struct DEListRow: Decodable {
        let id: UUID
        let shareID: String
        let name: String?
        let teamCount: Int?
        let status: String?
        let createdAt: String?
        enum CodingKeys: String, CodingKey {
            case id, name, status
            case shareID = "share_id"
            case teamCount = "team_count"
            case createdAt = "created_at"
        }
    }

    private func enrich(_ row: DEListRow) async -> MyTournament {
        let capacity = row.teamCount ?? 0
        let registered = (try? await client
            .from("doubles_elimination_teams")
            .select("id", head: true, count: .exact)
            .eq("tournament_id", value: row.id)
            .execute().count) ?? 0
        let state: TournamentState
        switch row.status {
        case "completed": state = .completed
        case "ongoing": state = .ongoing
        case "registration_open": state = (capacity > 0 && registered >= capacity) ? .full : .open
        default: state = .draft   // setup
        }
        return MyTournament(
            id: row.id, shareID: row.shareID, name: row.name ?? "",
            isDoubles: true, capacity: capacity, registered: registered,
            state: state, createdAt: Self.parseDate(row.createdAt), format: .doublesElim
        )
    }

    /// Registration count for registration-mode tables; actual roster size otherwise.
    private func count(row: QuickTableRow, requiresReg: Bool) async throws -> Int {
        if requiresReg {
            let response = try await client
                .from("quick_table_registrations")
                .select("id", head: true, count: .exact)
                .eq("table_id", value: row.id)
                .neq("status", value: "rejected")
                .execute()
            return response.count ?? 0
        } else {
            let response = try await client
                .from("quick_table_players")
                .select("id", head: true, count: .exact)
                .eq("table_id", value: row.id)
                .execute()
            return response.count ?? 0
        }
    }

    private static func state(status: String?, requiresReg: Bool, registered: Int, capacity: Int) -> TournamentState {
        switch status {
        case "completed": return .completed
        case "group_stage", "playoff": return .ongoing
        default: // setup
            guard requiresReg else { return .draft }
            if capacity > 0 && registered >= capacity { return .full }
            return .open
        }
    }
}
