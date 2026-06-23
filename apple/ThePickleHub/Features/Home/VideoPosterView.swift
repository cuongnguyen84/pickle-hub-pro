import SwiftUI
import UIKit
import AVFoundation

/// Renders a poster frame extracted from a remote video file (used when a video
/// has only a `storage_path`, no thumbnail/Mux id — the web shows a muted
/// <video> first frame). Frames are cached so scrolling doesn't re-decode.
struct VideoPosterView: View {
    let url: URL
    var aspect: CGFloat = 16.0 / 9.0

    @State private var image: UIImage?

    var body: some View {
        Rectangle()
            .fill(TLColor.surface2)
            .aspectRatio(aspect, contentMode: .fit)
            .overlay {
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .task(id: url) {
                image = await VideoPosterCache.shared.poster(for: url)
            }
    }
}

/// Actor-isolated cache + extractor for first-frame posters.
actor VideoPosterCache {
    static let shared = VideoPosterCache()

    private var cache: [URL: UIImage] = [:]

    func poster(for url: URL) async -> UIImage? {
        if let cached = cache[url] { return cached }
        let asset = AVURLAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 640, height: 360)
        let time = CMTime(seconds: 1, preferredTimescale: 60)
        do {
            let cgImage = try await generator.image(at: time).image
            let image = UIImage(cgImage: cgImage)
            cache[url] = image
            return image
        } catch {
            return nil
        }
    }
}
