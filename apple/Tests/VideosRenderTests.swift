import XCTest
import SwiftUI
@testable import ThePickleHub

/// Render-smoke for the N1/N2 videos UI (same DS-03 pattern as
/// TLComponentsRenderTests): proves the card and the Home section build a real
/// hierarchy and lay out to a sane size with both a natively playable video
/// (Mux id → NavigationLink) and a web-fallback one (no playable URL → Button).
final class VideosRenderTests: XCTestCase {

    private func stubVideo(mux: String?, storage: String?, type: String) -> VideoSummary {
        VideoSummary(
            id: UUID(),
            title: "Chung kết đôi nam — highlight",
            thumbnailPath: nil,
            muxPlaybackID: mux,
            storagePath: storage,
            durationSeconds: 754,
            publishedAt: "2026-07-20T10:00:00Z",
            type: type,
            organization: .init(name: "ThePickleHub")
        )
    }

    private func assertRenders<V: View>(_ view: V, _ name: String) {
        let host = UIHostingController(rootView: view)
        host.view.frame = CGRect(x: 0, y: 0, width: 320, height: 800)
        host.view.layoutIfNeeded()
        let size = host.sizeThatFits(in: CGSize(width: 320, height: CGFloat.greatestFiniteMagnitude))
        XCTAssertGreaterThan(size.height, 0, "\(name) collapsed to zero height")
        XCTAssertTrue(size.height.isFinite, "\(name) has unbounded height")
    }

    func testPlaybackURLPrefersMuxThenStorage() {
        let mux = stubVideo(mux: "abc123", storage: "clips/final.mp4", type: "long")
        XCTAssertEqual(mux.playbackURL?.absoluteString, "https://stream.mux.com/abc123.m3u8")

        let storageOnly = stubVideo(mux: nil, storage: "clips/final.mp4", type: "long")
        XCTAssertEqual(storageOnly.playbackURL, storageOnly.videoFileURL)

        let none = stubVideo(mux: nil, storage: nil, type: "long")
        XCTAssertNil(none.playbackURL, "no source must fall back to the web player")
    }

    func testVideoHighlightCardRenders() {
        assertRenders(VideoHighlightCard(video: stubVideo(mux: "abc", storage: nil, type: "long")), "VideoHighlightCard")
    }

    func testHomeVideosSectionRendersBothLinkKinds() {
        let videos = [
            stubVideo(mux: "abc", storage: nil, type: "long"),   // native NavigationLink
            stubVideo(mux: nil, storage: nil, type: "short"),    // web-hop Button fallback
        ]
        // No NavigationStack wrapper: it reports zero sizeThatFits in a bare
        // hosting controller; NavigationLink still builds fine without one.
        assertRenders(HomeVideosSection(videos: videos, onOpenWeb: { _ in }), "HomeVideosSection")
    }
}
