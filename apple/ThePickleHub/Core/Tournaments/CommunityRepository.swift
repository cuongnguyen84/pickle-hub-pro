import Foundation
import Supabase

/// Public "Community" tournaments across the 4 bracket formats — the native
/// equivalent of the web `/tournaments` Community tab (active + open-registration
/// brackets anyone can watch/join). Each format is fetched independently and
/// fails soft. Returns `[MyTournament]` so it reuses the Tools card + routing.
struct CommunityRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static func date(_ s: String?) -> Date? {
        guard let s else { return nil }
        return iso.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    /// All active public community tournaments, newest first.
    func activeCommunity(limit: Int = 20) async -> [MyTournament] {
        async let q = quickTables(limit: limit)
        async let t = teamMatches(limit: limit)
        async let d = doublesElim(limit: limit)
        async let f = flex(limit: limit)
        let all = await q + t + d + f
        return all.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    // MARK: Quick Tables (is_public, active statuses)

    private func quickTables(limit: Int) async -> [MyTournament] {
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?
            let player_count: Int?; let requires_registration: Bool?; let is_doubles: Bool?; let created_at: String?
        }
        do {
            let rows: [Row] = try await client.from("quick_tables")
                .select("id, name, share_id, status, player_count, requires_registration, is_doubles, created_at")
                .eq("is_public", value: true)
                .in("status", values: ["setup", "group_stage", "playoff"])
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                let state: TournamentState = {
                    switch r.status {
                    case "group_stage", "playoff": return .ongoing
                    case "setup": return (r.requires_registration == true) ? .open : .draft
                    default: return .draft
                    }
                }()
                return MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? "Bảng đấu nhanh",
                    isDoubles: r.is_doubles ?? true, capacity: r.player_count ?? 0, registered: 0,
                    state: state, createdAt: Self.date(r.created_at), format: .quickTable
                )
            }
        } catch { return [] }
    }

    // MARK: Team Match (registration / ongoing)

    private func teamMatches(limit: Int) async -> [MyTournament] {
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?
            let team_count: Int?; let created_at: String?
        }
        do {
            let rows: [Row] = try await client.from("team_match_tournaments")
                .select("id, name, share_id, status, team_count, created_at")
                .in("status", values: ["registration", "ongoing"])
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? "Đấu đồng đội",
                    isDoubles: true, capacity: r.team_count ?? 0, registered: 0,
                    state: r.status == "ongoing" ? .ongoing : .open,
                    createdAt: Self.date(r.created_at), format: .teamMatch
                )
            }
        } catch { return [] }
    }

    // MARK: Doubles Elimination (setup / active / ongoing)

    private func doublesElim(limit: Int) async -> [MyTournament] {
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?
            let team_count: Int?; let created_at: String?
        }
        do {
            let rows: [Row] = try await client.from("doubles_elimination_tournaments")
                .select("id, name, share_id, status, team_count, created_at")
                .in("status", values: ["setup", "active", "ongoing"])
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? "Loại trực tiếp",
                    isDoubles: true, capacity: r.team_count ?? 0, registered: 0,
                    state: r.status == "setup" ? .draft : .ongoing,
                    createdAt: Self.date(r.created_at), format: .doublesElim
                )
            }
        } catch { return [] }
    }

    // MARK: Flex (is_public, setup / active / ongoing)

    private func flex(limit: Int) async -> [MyTournament] {
        struct Row: Decodable {
            let id: UUID; let name: String?; let share_id: String; let status: String?; let created_at: String?
        }
        do {
            let rows: [Row] = try await client.from("flex_tournaments")
                .select("id, name, share_id, status, created_at")
                .eq("is_public", value: true)
                .in("status", values: ["setup", "active", "ongoing"])
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.map { r in
                MyTournament(
                    id: r.id, shareID: r.share_id, name: r.name ?? "Giải linh hoạt",
                    isDoubles: true, capacity: 0, registered: 0,
                    state: r.status == "setup" ? .draft : .ongoing,
                    createdAt: Self.date(r.created_at), format: .flex
                )
            }
        } catch { return [] }
    }
}
