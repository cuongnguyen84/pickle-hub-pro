import Foundation

/// A row from the `public_livestreams` view, for the homepage live section.
struct LivestreamSummary: Decodable, Identifiable, Equatable {
    let id: UUID
    let title: String?
    let thumbnailPath: String?
    let muxPlaybackID: String?
    let scheduledStartAt: String?
    let organization: Org?

    struct Org: Decodable, Equatable {
        let name: String?
    }

    var orgName: String? { organization?.name?.nonEmpty }
    var displayTitle: String { title?.nonEmpty ?? "Livestream" }

    var thumbURL: URL? {
        if let path = thumbnailPath?.nonEmpty { return WebRoutes.asset(path) }
        if let mux = muxPlaybackID?.nonEmpty {
            return URL(string: "https://image.mux.com/\(mux)/thumbnail.jpg?width=640&fit_mode=preserve")
        }
        return nil
    }

    enum CodingKeys: String, CodingKey {
        case id, title, organization
        case thumbnailPath = "thumbnail_url"
        case muxPlaybackID = "mux_playback_id"
        case scheduledStartAt = "scheduled_start_at"
    }
}
