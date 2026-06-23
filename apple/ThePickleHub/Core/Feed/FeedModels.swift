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
    let notes: String?

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
        case notes
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
    let notes: String?

    var isTournament: Bool { sourceProvider != "community" }

    /// Decodes the MLP team-matchup payload carried in `notes` (JSON). Returns
    /// nil for non-MLP matches — those have constant per-game lineups (= the
    /// team participants), so the generic score breakdown applies instead.
    /// Mirrors `parseNotes()` in web `FeedMlpMatchCard.tsx`.
    var mlpNotes: MlpMatchupNotes? {
        guard let notes, let data = notes.data(using: .utf8),
              let parsed = try? JSONDecoder().decode(MlpMatchupNotes.self, from: data),
              parsed.format == "mlp_team_matchup" else { return nil }
        return parsed
    }
}

/// MLP matchup payload encoded in `matches.notes`. Each "Ván" (game) is played
/// by a DIFFERENT pairing (WD / MD / MXD1 / MXD2 / DB), so the lineups live here
/// rather than in the flat `participants` array. Schema mirrors the web
/// `MlpMatchupNotes` interface.
struct MlpMatchupNotes: Decodable, Equatable {
    let format: String
    let teamA: Team
    let teamB: Team
    let games: [Game]

    struct Team: Decodable, Equatable {
        let name: String
        let logo: String?
        let matchupWins: Int

        enum CodingKeys: String, CodingKey {
            case name, logo
            case matchupWins = "matchup_wins"
        }
    }

    struct Game: Decodable, Equatable {
        let label: String
        let scoreA: Int
        let scoreB: Int
        let playersA: [String]
        let playersB: [String]
        let winner: String?    // "a" | "b" | null

        enum CodingKeys: String, CodingKey {
            case label, winner
            case scoreA = "score_a"
            case scoreB = "score_b"
            case playersA = "players_a"
            case playersB = "players_b"
        }
    }

    enum CodingKeys: String, CodingKey {
        case format, games
        case teamA = "team_a"
        case teamB = "team_b"
    }
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

struct FeedNews: Equatable {
    let slug: String
    let title: String
    let summary: String
    let imageURL: String?
    let source: String?
    let language: String   // "vi" | "en"
    let aiTranslated: Bool
}

/// A `news_items` row. News is not part of `get_feed_timeline`; it is queried
/// separately and merged into the stream by score, mirroring the web Trending
/// feed (`src/hooks/social/useFeedNews.ts`).
struct FeedNewsRow: Decodable {
    let id: UUID
    let title: String
    let summary: String
    let source: String?
    let imageURL: String?
    let language: String
    let slug: String?
    let publishedAt: String
    let aiTranslated: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, summary, source, language, slug
        case imageURL = "image_url"
        case publishedAt = "published_at"
        case aiTranslated = "ai_translated"
    }
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
        case news(FeedNews)
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
                roundName: row.roundName,
                notes: row.notes
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

    /// Builds a news entry, computing the client-side score
    /// `recency_decay + 1.2` exactly as `useFeedNews.ts` does, so news
    /// interleaves with the RPC stream on the same scale.
    init?(news row: FeedNewsRow, now: Date) {
        guard let slug = row.slug?.nonEmpty else { return nil }
        let date = FeedDate.parse(row.publishedAt)
        let ageHours = max(0, now.timeIntervalSince(date ?? now) / 3600)
        let score = exp(-ageHours / 48.0) + 1.2
        let news = FeedNews(
            slug: slug,
            title: row.title,
            summary: row.summary,
            imageURL: row.imageURL,
            source: row.source,
            language: row.language,
            aiTranslated: row.aiTranslated
        )
        self.init(id: row.id, publishedAt: date, score: score, kind: .news(news))
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
