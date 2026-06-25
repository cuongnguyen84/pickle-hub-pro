import Foundation

/// A row from the `public_livestreams` view, for the homepage live section.
struct LivestreamSummary: Decodable, Identifiable, Equatable {
    let id: UUID
    let title: String?
    let thumbnailPath: String?
    let muxPlaybackID: String?
    let muxAssetPlaybackID: String?
    let scheduledStartAt: String?
    let endedAt: String?
    let status: String?
    let vodURL: String?
    let hlsURL: String?
    let organization: Org?

    struct Org: Decodable, Equatable {
        let name: String?
    }

    var orgName: String? { organization?.name?.nonEmpty }
    var displayTitle: String { title?.nonEmpty ?? "Livestream" }
    var isLive: Bool { status == "live" }
    var isEnded: Bool { status == "ended" }
    var isScheduled: Bool { status == "scheduled" }

    var scheduledDate: Date? { scheduledStartAt.flatMap { FeedDate.parse($0) } }
    var endedDate: Date? { endedAt.flatMap { FeedDate.parse($0) } }

    var thumbURL: URL? {
        if let path = thumbnailPath?.nonEmpty { return WebRoutes.asset(path) }
        if let mux = muxPlaybackID?.nonEmpty {
            return URL(string: "https://image.mux.com/\(mux)/thumbnail.jpg?width=640&fit_mode=preserve")
        }
        return nil
    }

    /// HLS URL playable directly by AVPlayer. While live, use the live-edge
    /// playback id; once ended, the live id 412s ("live_stream_inactive") so we
    /// must use the recorded ASSET playback id instead.
    var playbackURL: URL? {
        func muxHLS(_ id: String) -> URL? { URL(string: "https://stream.mux.com/\(id).m3u8") }
        if isLive, let mux = muxPlaybackID?.nonEmpty { return muxHLS(mux) }
        if let asset = muxAssetPlaybackID?.nonEmpty { return muxHLS(asset) }
        if let mux = muxPlaybackID?.nonEmpty { return muxHLS(mux) }
        if let hls = hlsURL?.nonEmpty { return URL(string: hls) }
        if let vod = vodURL?.nonEmpty { return URL(string: vod) }
        return nil
    }

    enum CodingKeys: String, CodingKey {
        case id, title, status, organization
        case thumbnailPath = "thumbnail_url"
        case muxPlaybackID = "mux_playback_id"
        case muxAssetPlaybackID = "mux_asset_playback_id"
        case scheduledStartAt = "scheduled_start_at"
        case endedAt = "ended_at"
        case vodURL = "vod_url"
        case hlsURL = "hls_url"
    }
}
