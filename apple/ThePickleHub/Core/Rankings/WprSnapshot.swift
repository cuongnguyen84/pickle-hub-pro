import Foundation

/// PPA Tour World Pickleball Rankings (WPR) — the same editorial excerpt as web
/// `/rankings/ppa-tour`: top 25 per board + Vietnam / Viet-origin highlights, with
/// credit and a link back to the source. Bundled as `wpr-rankings.json`, generated
/// from `src/content/ppa-rankings.ts` by `scripts/gen-native-wpr.mjs` (never edit
/// the JSON by hand — the web file is the single source of truth, and a vitest
/// parity test fails if they drift). No full mirror: PPA ToS.
enum WprBoard: String, CaseIterable, Identifiable, Decodable {
    case men, women
    var id: String { rawValue }
    var labelVi: String { self == .men ? String(localized: "Nam") : String(localized: "Nữ") }
}

struct WprEntry: Decodable, Identifiable, Equatable {
    let rank: Int
    let name: String
    let points: Double
    let eventsPlayed: Int
    let country: String
    let countryCode: String
    let isTied: Bool?
    var id: String { "\(rank)-\(name)" }
    var rankText: String { String(format: "%02d", rank) + (isTied == true ? "=" : "") }
}

struct WprVietHighlight: Decodable, Identifiable, Equatable {
    let board: WprBoard
    let rank: Int
    let name: String
    let countryCode: String
    let points: Double
    var id: String { "\(board.rawValue)-\(rank)" }
    var rankText: String { String(format: "%02d", rank) }
}

struct WprSnapshotData: Decodable {
    let fetchedAt: String
    let sourceUrl: String
    let men: [WprEntry]
    let women: [WprEntry]
    let vietHighlights: [WprVietHighlight]
}

enum WprSnapshot {
    static let data: WprSnapshotData? = {
        guard let url = Bundle.main.url(forResource: "wpr-rankings", withExtension: "json"),
              let raw = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(WprSnapshotData.self, from: raw)
    }()

    static func board(_ board: WprBoard) -> [WprEntry] {
        board == .men ? (data?.men ?? []) : (data?.women ?? [])
    }
    static var vietHighlights: [WprVietHighlight] { data?.vietHighlights ?? [] }
    static var sourceURL: URL {
        URL(string: data?.sourceUrl ?? "https://www.ppatour.com/rankings/")!
    }

    /// 12212.5 → "12.212,5" in vi, "12,212.5" in en (web: Intl.NumberFormat, maximumFractionDigits 1).
    static func points(_ value: Double, locale: Locale = .current) -> String {
        let f = NumberFormatter()
        f.locale = locale
        f.numberStyle = .decimal
        f.maximumFractionDigits = 1
        return f.string(from: NSNumber(value: value)) ?? String(value)
    }

    /// "vn" → 🇻🇳 (regional-indicator pair).
    static func flag(_ countryCode: String) -> String {
        countryCode.uppercased().unicodeScalars.reduce(into: "") { out, scalar in
            guard scalar.value >= 65, scalar.value <= 90,
                  let s = Unicode.Scalar(0x1F1E6 + scalar.value - 65) else { return }
            out.unicodeScalars.append(s)
        }
    }

    static func countryName(_ code: String, fallback: String, locale: Locale = .current) -> String {
        locale.localizedString(forRegionCode: code.uppercased()) ?? fallback
    }

    /// Date ThePickleHub pulled the numbers (not PPA's update date) — "27 thg 8, 2026".
    static func fetchedLabel(locale: Locale = .current) -> String {
        guard let raw = data?.fetchedAt else { return "" }
        let iso = DateFormatter()
        iso.locale = Locale(identifier: "en_US_POSIX")
        iso.dateFormat = "yyyy-MM-dd"
        guard let date = iso.date(from: raw) else { return raw }
        let out = DateFormatter()
        out.locale = locale
        out.setLocalizedDateFormatFromTemplate("dMMMy")   // vi: "27 thg 8, 2026" (.medium would prepend "ngày")
        return out.string(from: date)
    }
}
