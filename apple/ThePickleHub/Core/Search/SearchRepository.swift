import Foundation
import Supabase

// Native global search — mirrors the web (`/search` covers tournaments + media)
// plus player search (profiles, the high-value mobile case). Each category is an
// independent ILIKE query. Players → native profile; tournament → native detail;
// video → native player.

struct SearchPlayerHit: Identifiable, Equatable {
    let id: UUID
    let username: String?
    let displayName: String
    let avatarURL: String?
    let duprDoubles: Double?
    let duprSingles: Double?
    var rating: Double? { duprDoubles ?? duprSingles }
}

struct SearchVideoHit: Identifiable, Equatable, Hashable {
    let id: UUID
    let title: String
    let thumbnailURL: String?
    let durationSeconds: Int?

    var asFeedVideo: FeedVideo {
        FeedVideo(videoID: id, title: title, description: nil,
                  thumbnailURL: thumbnailURL, durationSeconds: durationSeconds, isShort: false)
    }
}

struct SearchResults: Equatable {
    var players: [SearchPlayerHit] = []
    var tournaments: [Tournament] = []
    var videos: [SearchVideoHit] = []
    var isEmpty: Bool { players.isEmpty && tournaments.isEmpty && videos.isEmpty }
}

struct SearchRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }
    private static let limit = 12

    /// Escape PostgREST ILIKE wildcards (`%` and `_`) in user input.
    private static func escape(_ q: String) -> String {
        q.replacingOccurrences(of: "%", with: "\\%").replacingOccurrences(of: "_", with: "\\_")
    }

    func search(_ rawQuery: String) async -> SearchResults {
        let q = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return SearchResults() }
        async let players = searchPlayers(q)
        async let tournaments = searchTournaments(q)
        async let videos = searchVideos(q)
        return await SearchResults(players: players, tournaments: tournaments, videos: videos)
    }

    private func searchPlayers(_ q: String) async -> [SearchPlayerHit] {
        struct Row: Decodable {
            let id: UUID
            let username: String?
            let displayName: String?
            let avatarURL: String?
            let duprSingles: Double?
            let duprDoubles: Double?
            enum CodingKeys: String, CodingKey {
                case id, username
                case displayName = "display_name"
                case avatarURL = "avatar_url"
                case duprSingles = "dupr_singles"
                case duprDoubles = "dupr_doubles"
            }
        }
        let pattern = "%\(Self.escape(q))%"
        guard let rows: [Row] = try? await client
            .from("profiles")
            .select("id, username, display_name, avatar_url, dupr_singles, dupr_doubles")
            .eq("is_ghost", value: false)
            .or("display_name.ilike.\(pattern),username.ilike.\(pattern)")
            .limit(Self.limit).execute().value else { return [] }
        return rows.map {
            SearchPlayerHit(id: $0.id, username: $0.username?.nonEmpty,
                            displayName: $0.displayName?.nonEmpty ?? ($0.username.map { "@\($0)" } ?? "Người chơi"),
                            avatarURL: $0.avatarURL, duprDoubles: $0.duprDoubles, duprSingles: $0.duprSingles)
        }
    }

    private func searchTournaments(_ q: String) async -> [Tournament] {
        let pattern = "%\(Self.escape(q))%"
        guard let rows: [Tournament] = try? await client
            .from("tournaments")
            .select("id, name, slug, start_date, end_date, status, description, organization:organizations(name, slug, logo_url)")
            .or("name.ilike.\(pattern),description.ilike.\(pattern)")
            .order("start_date", ascending: false)
            .limit(Self.limit).execute().value else { return [] }
        return rows
    }

    private func searchVideos(_ q: String) async -> [SearchVideoHit] {
        struct Row: Decodable {
            let id: UUID
            let title: String
            let thumbnailURL: String?
            let durationSeconds: Int?
            enum CodingKeys: String, CodingKey {
                case id, title
                case thumbnailURL = "thumbnail_url"
                case durationSeconds = "duration_seconds"
            }
        }
        let pattern = "%\(Self.escape(q))%"
        guard let rows: [Row] = try? await client
            .from("videos")
            .select("id, title, thumbnail_url, duration_seconds")
            .eq("status", value: "published")
            .or("title.ilike.\(pattern),description.ilike.\(pattern)")
            .order("published_at", ascending: false)
            .limit(Self.limit).execute().value else { return [] }
        return rows.map { SearchVideoHit(id: $0.id, title: $0.title, thumbnailURL: $0.thumbnailURL, durationSeconds: $0.durationSeconds) }
    }
}
