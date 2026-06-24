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

    /// Quick tables created by the signed-in user, newest first, enriched with a
    /// registration/roster count so cards can show progress + status. Returns []
    /// when signed out.
    func myTournaments(limit: Int = 20) async throws -> [MyTournament] {
        guard let uid = try? await client.auth.session.user.id.uuidString.lowercased() else { return [] }

        async let quickRows: [QuickTableRow] = client
            .from("quick_tables")
            .select("id, share_id, name, is_doubles, player_count, status, requires_registration, start_time, created_at")
            .eq("creator_user_id", value: uid)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute().value
        async let doublesRows: [DEListRow] = client
            .from("doubles_elimination_tournaments")
            .select("id, share_id, name, team_count, status, created_at")
            .eq("creator_user_id", value: uid)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute().value
        // Team Match owner column is `created_by` (NOT creator_user_id) — see web
        // MyTournaments.tsx. Flex uses creator_user_id. Neither has a native view
        // yet, so cards open the web on tap.
        async let teamRows: [SimpleToolRow] = client
            .from("team_match_tournaments")
            .select("id, share_id, name, status, created_at")
            .eq("created_by", value: uid)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute().value
        async let flexRows: [SimpleToolRow] = client
            .from("flex_tournaments")
            .select("id, share_id, name, status, created_at")
            .eq("creator_user_id", value: uid)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute().value

        let quick = try await quickRows
        let doubles = try await doublesRows
        let team = try await teamRows
        let flex = try await flexRows

        // Enrich the registration-aware formats in parallel; team/flex map directly.
        let enriched: [MyTournament] = try await withThrowingTaskGroup(of: MyTournament.self) { group in
            for row in quick { group.addTask { try await enrich(row) } }
            for row in doubles { group.addTask { try await enrich(row) } }
            var result: [MyTournament] = []
            for try await item in group { result.append(item) }
            return result
        }
        let simple = team.map { Self.map($0, format: .teamMatch) } + flex.map { Self.map($0, format: .flex) }
        return (enriched + simple).sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
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

    private func enrich(_ row: QuickTableRow) async throws -> MyTournament {
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

    private func enrich(_ row: DEListRow) async throws -> MyTournament {
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
