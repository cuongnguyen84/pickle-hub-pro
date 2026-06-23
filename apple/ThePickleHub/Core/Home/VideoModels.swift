import Foundation

/// A published highlight video for the homepage "Sân đấu" section.
struct VideoSummary: Decodable, Identifiable, Equatable {
    let id: UUID
    let title: String
    let thumbnailPath: String?
    let muxPlaybackID: String?
    let durationSeconds: Int?
    let publishedAt: String?
    let type: String?
    let organization: VideoOrg?

    struct VideoOrg: Decodable, Equatable {
        let name: String?
    }

    var orgName: String? { organization?.name?.nonEmpty }
    var isShort: Bool { type == "short" }

    /// Prefer an explicit thumbnail; fall back to the Mux poster frame.
    var thumbURL: URL? {
        if let path = thumbnailPath?.nonEmpty { return WebRoutes.asset(path) }
        if let mux = muxPlaybackID?.nonEmpty {
            return URL(string: "https://image.mux.com/\(mux)/thumbnail.jpg?width=640&fit_mode=preserve")
        }
        return nil
    }

    var durationText: String? { FeedFormat.duration(durationSeconds) }

    enum CodingKeys: String, CodingKey {
        case id, title, type, organization
        case thumbnailPath = "thumbnail_url"
        case muxPlaybackID = "mux_playback_id"
        case durationSeconds = "duration_seconds"
        case publishedAt = "published_at"
    }
}
