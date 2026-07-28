import Foundation
import Supabase

/// Native data access for the web `parent_tournaments` feature.
struct ParentTournamentRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let parentSelect =
        "id, creator_user_id, name, description, banner_url, event_date, location, share_id, is_featured, created_at, updated_at"
    private static let eventSelect =
        "id, share_id, name, status, format, is_doubles, player_count, created_at, parent_tournament_id"

    func currentUserID() async -> UUID? {
        try? await client.auth.session.user.id
    }

    func mine() async throws -> [ParentTournament] {
        guard let userID = await currentUserID() else { return [] }
        return try await client.from("parent_tournaments")
            .select(Self.parentSelect)
            .eq("creator_user_id", value: userID)
            .order("created_at", ascending: false)
            .execute().value
    }

    func load(shareID: String) async throws -> ParentTournamentDetail {
        let tournament: ParentTournament = try await client.from("parent_tournaments")
            .select(Self.parentSelect)
            .eq("share_id", value: shareID)
            .single().execute().value
        let events: [ParentTournamentEvent] = try await client.from("quick_tables")
            .select(Self.eventSelect)
            .eq("parent_tournament_id", value: tournament.id)
            .order("created_at", ascending: true)
            .execute().value
        return ParentTournamentDetail(tournament: tournament, events: events)
    }

    private struct CreateRow: Encodable {
        let creator_user_id: UUID
        let name: String
        let description: String?
        let event_date: String?
        let location: String?
    }

    func create(name: String, description: String?, eventDate: String?,
                location: String?) async throws -> ParentTournament {
        guard let userID = await currentUserID() else {
            throw NSError(
                domain: "parent-tournament",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: String(localized: "Bạn cần đăng nhập để tạo giải tổng.")]
            )
        }
        let safeName = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        guard !safeName.isEmpty else {
            throw NSError(
                domain: "parent-tournament",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: String(localized: "Vui lòng nhập tên giải tổng.")]
            )
        }
        return try await client.from("parent_tournaments")
            .insert(CreateRow(
                creator_user_id: userID,
                name: safeName,
                description: description?.trimmedNonEmpty.map { String($0.prefix(500)) },
                event_date: eventDate?.nonEmpty,
                location: location?.trimmedNonEmpty.map { String($0.prefix(200)) }
            ))
            .select(Self.parentSelect)
            .single().execute().value
    }

    func attach(tableShareID: String, to parentID: UUID) async throws {
        struct Patch: Encodable { let parent_tournament_id: UUID }
        try await client.from("quick_tables")
            .update(Patch(parent_tournament_id: parentID))
            .eq("share_id", value: tableShareID)
            .execute()
    }

    /// Sub-events are detached, not deleted — the FK is ON DELETE SET NULL.
    func delete(id: UUID) async throws {
        try await client.from("parent_tournaments").delete().eq("id", value: id).execute()
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
