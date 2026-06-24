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

    // MARK: Admin scope

    /// True when the signed-in user holds the `admin` role. Mirrors the web
    /// `useAdminAuth` check (user_roles WHERE user_id = uid AND role = 'admin').
    /// Non-throwing — any failure (signed out / RLS / network) reads as not-admin.
    func isCurrentUserAdmin() async -> Bool {
        guard let uid = try? await client.auth.session.user.id.uuidString.lowercased() else { return false }
        struct RoleRow: Decodable { let role: String }
        do {
            let rows: [RoleRow] = try await client
                .from("user_roles")
                .select("role")
                .eq("user_id", value: uid)
                .eq("role", value: "admin")
                .limit(1)
                .execute().value
            return !rows.isEmpty
        } catch { return false }
    }

    /// Admin-only: every tournament across all 4 formats, newest first. Lightweight
    /// on purpose — NO per-row registration counts (that would be 100+ queries on
    /// prod). Creator display names are batch-resolved from public_profiles so the
    /// admin can see who owns each. Returns [] on failure. Caller gates on admin.
    func allTournaments(limit: Int = 200) async -> [MyTournament] {
        async let quick = allRows(
            table: "quick_tables",
            select: "id, share_id, name, is_doubles, player_count, status, created_at, creator_user_id",
            format: .quickTable, owner: { $0.creatorUserID }, limit: limit)
        async let doubles = allRows(
            table: "doubles_elimination_tournaments",
            select: "id, share_id, name, team_count, status, created_at, creator_user_id",
            format: .doublesElim, owner: { $0.creatorUserID }, limit: limit)
        async let team = allRows(
            table: "team_match_tournaments",
            select: "id, share_id, name, status, created_at, created_by",
            format: .teamMatch, owner: { $0.createdBy }, limit: limit)
        async let flex = allRows(
            table: "flex_tournaments",
            select: "id, share_id, name, status, created_at, creator_user_id",
            format: .flex, owner: { $0.creatorUserID }, limit: limit)

        let pairs = await quick + doubles + team + flex
        let ownerIDs = Set(pairs.compactMap { $0.1?.lowercased() })
        let names = await displayNames(ids: ownerIDs)

        let merged = pairs.map { pair -> MyTournament in
            var tournament = pair.0
            if let oid = pair.1?.lowercased(), let name = names[oid] {
                tournament.creatorName = name
            }
            return tournament
        }
        return merged.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    /// Generic light fetch for the admin scope. Owner column differs per table, so
    /// the caller supplies the select list + an owner-id extractor.
    private func allRows(
        table: String, select: String, format: BracketFormat,
        owner: @escaping (AllToolRow) -> String?, limit: Int
    ) async -> [(MyTournament, String?)] {
        do {
            let rows: [AllToolRow] = try await client
                .from(table)
                .select(select)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { (Self.lightMap($0, format: format), owner($0)) }
        } catch { return [] }
    }

    /// Batch-resolve display names for a set of owner ids (lower-cased keys).
    private func displayNames(ids: Set<String>) async -> [String: String] {
        guard !ids.isEmpty else { return [:] }
        struct ProfileRow: Decodable {
            let id: String
            let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" }
        }
        do {
            let rows: [ProfileRow] = try await client
                .from("public_profiles")
                .select("id, display_name")
                .in("id", values: Array(ids))
                .execute().value
            var map: [String: String] = [:]
            for row in rows {
                if let name = row.displayName?.nonEmpty { map[row.id.lowercased()] = name }
            }
            return map
        } catch { return [:] }
    }

    /// Row shape covering all 4 tables in the admin scope — unselected columns
    /// decode to nil (synthesized Decodable uses decodeIfPresent for optionals).
    private struct AllToolRow: Decodable {
        let id: UUID
        let shareID: String
        let name: String?
        let status: String?
        let createdAt: String?
        let isDoubles: Bool?
        let playerCount: Int?
        let teamCount: Int?
        let creatorUserID: String?
        let createdBy: String?
        enum CodingKeys: String, CodingKey {
            case id, name, status
            case shareID = "share_id"
            case createdAt = "created_at"
            case isDoubles = "is_doubles"
            case playerCount = "player_count"
            case teamCount = "team_count"
            case creatorUserID = "creator_user_id"
            case createdBy = "created_by"
        }
    }

    /// Map without registration enrichment — capacity from the row, registered 0.
    private static func lightMap(_ r: AllToolRow, format: BracketFormat) -> MyTournament {
        let state: TournamentState
        switch r.status {
        case "completed": state = .completed
        case "setup", "draft": state = .draft
        case "registration_open": state = .open
        case "group_stage", "playoff", "ongoing": state = .ongoing
        default: state = .ongoing
        }
        let capacity = r.teamCount ?? r.playerCount ?? 0
        return MyTournament(
            id: r.id, shareID: r.shareID, name: r.name ?? "",
            isDoubles: r.isDoubles ?? true, capacity: capacity, registered: 0,
            state: state, createdAt: Self.parseDate(r.createdAt), format: format
        )
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
