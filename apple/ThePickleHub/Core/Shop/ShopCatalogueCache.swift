import Foundation

actor ShopCatalogueCache {
    struct Entry: Codable, Sendable {
        let storedAt: Date
        let page: ShopProductPage
    }

    private let directory: URL
    private let freshFor: TimeInterval
    private let staleFor: TimeInterval
    private let now: @Sendable () -> Date
    private var memory: [String: Entry] = [:]

    init(
        directory: URL? = nil,
        freshFor: TimeInterval = 5 * 60,
        staleFor: TimeInterval = 24 * 60 * 60,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.directory = directory ?? FileManager.default.urls(
            for: .cachesDirectory, in: .userDomainMask
        )[0].appending(path: "shop-public-v1", directoryHint: .isDirectory)
        self.freshFor = freshFor
        self.staleFor = staleFor
        self.now = now
    }

    func freshPage(for key: String) -> ShopProductPage? { page(for: key, maximumAge: freshFor) }

    func stalePage(for key: String) -> ShopProductPage? {
        guard var page = page(for: key, maximumAge: staleFor) else { return nil }
        page.isOfflineFallback = true
        return page
    }

    func store(_ page: ShopProductPage, for key: String) {
        var publicPage = page
        publicPage.isOfflineFallback = false
        let entry = Entry(storedAt: now(), page: publicPage)
        memory[key] = entry
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try JSONEncoder.shopCache.encode(entry).write(
                to: fileURL(for: key), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
            )
        } catch { /* cache failure must never fail a public read */ }
    }

    private func page(for key: String, maximumAge: TimeInterval) -> ShopProductPage? {
        let entry = memory[key] ?? load(key)
        guard let entry, now().timeIntervalSince(entry.storedAt) <= maximumAge else { return nil }
        memory[key] = entry
        return entry.page
    }

    private func load(_ key: String) -> Entry? {
        guard let data = try? Data(contentsOf: fileURL(for: key)) else { return nil }
        return try? JSONDecoder.shopCache.decode(Entry.self, from: data)
    }

    private func fileURL(for key: String) -> URL {
        let safe = Data(key.utf8).base64EncodedString()
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
        return directory.appending(path: safe + ".json")
    }
}

private extension JSONEncoder {
    static var shopCache: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

private extension JSONDecoder {
    static var shopCache: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
