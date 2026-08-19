import SwiftUI

/// Public shop renditions are revocable. This loader deliberately avoids the
/// shared URL cache so an unpublished/rejected asset is not retained on disk by
/// the app after the CDN/public object has been withdrawn.
enum ShopImageRequestPolicy {
    static let maximumBytes = 12 * 1_024 * 1_024

    static func request(for url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 20
        request.setValue("image/avif,image/webp,image/jpeg,image/png", forHTTPHeaderField: "Accept")
        return request
    }

    static func accepts(response: URLResponse, bytes: Int) -> Bool {
        guard bytes > 0, bytes <= maximumBytes,
              let response = response as? HTTPURLResponse,
              (200..<300).contains(response.statusCode) else { return false }
        return response.mimeType?.hasPrefix("image/") == true
    }
}

struct ShopRemoteImage<Placeholder: View>: View {
    let url: URL?
    let contentMode: ContentMode
    @ViewBuilder let placeholder: () -> Placeholder
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
            } else {
                placeholder()
            }
        }
        .task(id: url) { await load() }
    }

    private func load() async {
        image = nil
        guard let url else { return }
        do {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.urlCache = nil
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            let session = URLSession(configuration: configuration)
            let (data, response) = try await session.data(for: ShopImageRequestPolicy.request(for: url))
            guard ShopImageRequestPolicy.accepts(response: response, bytes: data.count),
                  let decoded = UIImage(data: data) else { return }
            try Task.checkCancellation()
            image = decoded
        } catch {
            // Revoked, offline and malformed images all fall back to the stable
            // product/category placeholder. Buyer navigation remains usable.
        }
    }
}
