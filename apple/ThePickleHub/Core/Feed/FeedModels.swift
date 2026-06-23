import Foundation

/// A player inside a match's `participants` JSONB array.
struct FeedParticipant: Decodable, Identifiable, Equatable {
    let playerID: String
    let team: String          // "a" | "b"
    let position: Int?
    let username: String?
    let displayName: String?
    let avatarURL: String?
    let isGhost: Bool?
    let duprDoubles: Double?

    var id: String { playerID }

    var resolvedName: String {
        displayName?.nonEmpty ?? username?.nonEmpty ?? "Người chơi ẩn"
    }

    enum CodingKeys: String, CodingKey {
        case playerID = "player_id"
        case team
        case position
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case isGhost = "is_ghost"
        case duprDoubles = "dupr_doubles"
    }
}

/// Raw row returned by the `get_feed_timeline` RPC — a discriminated union
/// across match / blog / video, keyed by `item_type`. Columns not relevant to
/// a given type come back NULL, hence the wide optionality.
struct FeedRow: Decodable {
    let itemType: String
    let itemID: UUID
    let publishedAt: String
    let score: Double

    // match
    let slug: String?
    let format: String?
    let matchType: String?
    let verificationStatus: String?
    let venueName: String?
    let teamAScore: [Int]?
    let teamBScore: [Int]?
    let winningTeam: String?
    let participants: [FeedParticipant]?
    let kudosCount: Int?
    let commentCount: Int?
    let sourceProvider: String?
    let tournamentName: String?
    let tournamentEvent: String?
    let roundName: String?

    // blog / video
    let title: String?
    let excerpt: String?
    let coverImageURL: String?
    let category: String?
    let durationSeconds: Int?

    enum CodingKeys: String, CodingKey {
        case itemType = "item_type"
        case itemID = "item_id"
        case publishedAt = "published_at"
        case score
        case slug
        case format
        case matchType = "match_type"
        case verificationStatus = "verification_status"
        case venueName = "venue_name"
        case teamAScore = "team_a_score"
        case teamBScore = "team_b_score"
        case winningTeam = "winning_team"
        case participants
        case kudosCount = "kudos_count"
        case commentCount = "comment_count"
        case sourceProvider = "source_provider"
        case tournamentName = "tournament_name"
        case tournamentEvent = "tournament_event"
        case roundName = "round_name"
        case title
        case excerpt
        case coverImageURL = "cover_image_url"
        case category
        case durationSeconds = "duration_seconds"
    }
}

// MARK: - View models (one per discriminated kind)

struct FeedMatch: Equatable {
    let slug: String?
    let format: String
    let matchType: String
    let verificationStatus: String
    let venueName: String?
    let teamAScore: [Int]
    let teamBScore: [Int]
    let winningTeam: String
    let participants: [FeedParticipant]
    let kudosCount: Int
    let commentCount: Int
    let sourceProvider: String
    let tournamentName: String?
    let tournamentEvent: String?
    let roundName: String?

    var isTournament: Bool { sourceProvider != "community" }
}

struct FeedBlog: Equatable {
    let slug: String
    let title: String
    let excerpt: String?
    let coverImageURL: String?
    let category: String?
}

struct FeedVideo: Equatable {
    let videoID: UUID
    let title: String
    let description: String?
    let thumbnailURL: String?
    let durationSeconds: Int?
    let isShort: Bool
}

/// Keyset pagination cursor `(score DESC, item_id DESC)`.
struct FeedCursor: Equatable {
    let score: Double
    let itemID: UUID
}

/// Normalized, render-ready feed entry.
struct FeedItem: Identifiable, Equatable {
    let id: UUID
    let publishedAt: Date?
    let score: Double
    let kind: Kind

    enum Kind: Equatable {
        case match(FeedMatch)
        case blog(FeedBlog)
        case video(FeedVideo)
    }

    var cursor: FeedCursor { FeedCursor(score: score, itemID: id) }

    init?(row: FeedRow) {
        let date = FeedDate.parse(row.publishedAt)
        switch row.itemType {
        case "match":
            let match = FeedMatch(
                slug: row.slug,
                format: row.format ?? "doubles",
                matchType: row.matchType ?? "rec",
                verificationStatus: row.verificationStatus ?? "pending",
                venueName: row.venueName,
                teamAScore: row.teamAScore ?? [],
                teamBScore: row.teamBScore ?? [],
                winningTeam: row.winningTeam ?? "a",
                participants: row.participants ?? [],
                kudosCount: row.kudosCount ?? 0,
                commentCount: row.commentCount ?? 0,
                sourceProvider: row.sourceProvider ?? "community",
                tournamentName: row.tournamentName,
                tournamentEvent: row.tournamentEvent,
                roundName: row.roundName
            )
            self.init(id: row.itemID, publishedAt: date, score: row.score, kind: .match(match))

        case "blog":
            guard let title = row.title?.nonEmpty, let slug = row.slug?.nonEmpty else { return nil }
            let blog = FeedBlog(
                slug: slug,
                title: title,
                excerpt: row.excerpt,
                coverImageURL: row.coverImageURL,
                category: row.category
            )
            self.init(id: row.itemID, publishedAt: date, score: row.score, kind: .blog(blog))

        case "video":
            guard let title = row.title?.nonEmpty else { return nil }
            let video = FeedVideo(
                videoID: row.itemID,
                title: title,
                description: row.excerpt,
                thumbnailURL: row.coverImageURL,
                durationSeconds: row.durationSeconds,
                isShort: row.category == "short"
            )
            self.init(id: row.itemID, publishedAt: date, score: row.score, kind: .video(video))

        default:
            return nil
        }
    }

    private init(id: UUID, publishedAt: Date?, score: Double, kind: Kind) {
        self.id = id
        self.publishedAt = publishedAt
        self.score = score
        self.kind = kind
    }
}

extension String {
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
