import Foundation

/// Local resume-playback positions for streams + videos, keyed by id. Stored in
/// UserDefaults (account sync is a later phase). Used to show a progress bar and
/// "▸ Còn N phút" on replay cards and to resume the player at the saved second.
struct WatchProgress: Codable, Equatable {
    let position: Double   // seconds watched
    let duration: Double   // total seconds (0 if unknown)
    let updatedAt: Date

    var fraction: Double {
        guard duration > 0 else { return 0 }
        return min(1, max(0, position / duration))
    }
    var remainingSeconds: Double { max(0, duration - position) }
    /// True once the user is meaningfully into the video but not basically done.
    var isResumable: Bool { position > 15 && (duration == 0 || position < duration - 20) }
}

enum WatchProgressStore {
    private static let key = "watch_progress_v1"
    private static let maxEntries = 100

    static func all() -> [String: WatchProgress] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let dict = try? JSONDecoder().decode([String: WatchProgress].self, from: data) else { return [:] }
        return dict
    }

    static func get(_ id: String) -> WatchProgress? { all()[id] }

    static func set(_ id: String, position: Double, duration: Double) {
        var dict = all()
        dict[id] = WatchProgress(position: position, duration: duration, updatedAt: Date())
        // Trim oldest if the map grows unbounded.
        if dict.count > maxEntries {
            let keep = dict.sorted { $0.value.updatedAt > $1.value.updatedAt }.prefix(maxEntries)
            dict = Dictionary(uniqueKeysWithValues: keep.map { ($0.key, $0.value) })
        }
        if let data = try? JSONEncoder().encode(dict) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func remove(_ id: String) {
        var dict = all()
        dict.removeValue(forKey: id)
        if let data = try? JSONEncoder().encode(dict) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
