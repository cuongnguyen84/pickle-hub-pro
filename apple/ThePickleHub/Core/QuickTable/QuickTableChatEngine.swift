import Foundation

// MARK: - Quick-table CHAT engine (bản Swift của web src/lib/quick-table-chat.ts)
//
// Tầng tất định phía client của tính năng "Tạo giải chia bảng bằng chat AI":
// đọc số liệu từ câu nói (readUserFacts), áp bản vá của mô hình vào nháp
// (applyPatch), soạn câu trả lời chỉ nói điều nháp thật sự đổi (factualAck /
// replyFromDraft) và máy trạng thái bước hỏi (nextSlot). Phần suy luận ngôn
// ngữ nằm ở edge function `quick-table-chat` dùng chung với web — file này
// KHÔNG gọi mạng. Luật thi đấu (chia bảng, series, hạt giống) tái dùng
// QTSeries / GroupSuggestion / QTSeedingV2 sẵn có của app; các hàm riêng của
// luồng chat (gồm luật vòng tròn 1 bảng + vòng trực tiếp 2/4 đội của PR web
// #920) port 1:1 theo bản TypeScript, test mirror ở QuickTableChatEngineTests.

struct QTChatEntry: Equatable {
    var p1: String
    var p2: String?
    var team: String?
    var seed: Int?
    init(p1: String, p2: String? = nil, team: String? = nil, seed: Int? = nil) {
        self.p1 = p1; self.p2 = p2; self.team = team; self.seed = seed
    }
    var label: String { p2.map { "\(p1) & \($0)" } ?? p1 }
}

struct QTChatDraft: Equatable {
    var isDoubles: Bool?
    var playerCount: Int?
    var groupCount: Int?
    var name: String?
    var entries: [QTChatEntry]?
    var rosterMode: String?          // "now" | "later" | "registration"
    var courts: [Int]?
    var groupCourts: [Int?]?         // index 0 = bảng A; nil = không gán
    var startTime: String?
    var defaultSets: Int?
    var series: Int?
    var seriesStyle: String?         // "series" | "medal"
    var seriesSizes: [Int]?
    var advancePerGroup: Int?
    var pairingDone: Bool?
    var optionsDone: Bool?
    var courtsDone: Bool?
    var timeDone: Bool?
}

/// Bản vá đã gõ kiểu (từ mô hình hoặc từ readUserFacts). Mọi trường đều tuỳ
/// chọn; `advancePerGroup`/`playerCount` phân biệt "không nói" với "xoá" qua
/// các cờ clear* (web dùng null tường minh trong JSON).
struct QTChatPatch {
    var isDoubles: Bool?
    var playerCount: Int?
    var clearPlayerCount = false
    var groupCount: Int?
    var name: String?
    var entries: [QTChatEntry]?
    var rosterMode: String?
    var courts: [Int]?
    var groupCourts: [Int?]?
    var startTime: String?
    var timeDone: Bool?
    var defaultSets: Int?
    var series: Int?
    var seriesSizes: [Int]?
    var seriesStyle: String?
    var seriesModeByRank = false
    var advancePerGroup: Int?
    var clearAdvancePerGroup = false
}

enum QTChatSlot: String {
    case format, count, tooMany = "too_many", pairing, mismatch, groups, series
    case roster, paste, name, courts, startTime = "start_time", options, confirm
}

enum QTChatEngine {
    static let maxChatEntries = 48
    static let minGroup = 3
    static let maxGroup = 8
    static let maxGroups = 16
    static let maxSeries = 3
    private static let rankSeriesCap = 8

    // MARK: fold + regex helpers

    /// Gấp dấu + thường hoá như web fold(): NFD, bỏ dấu phụ, đ→d, gọn khoảng trắng.
    static func fold(_ s: String) -> String {
        var t = s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
        t = t.replacingOccurrences(of: "đ", with: "d").replacingOccurrences(of: "Đ", with: "d")
        t = t.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        return t.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func rx(_ pattern: String, caseInsensitive: Bool = false) -> NSRegularExpression {
        // Các mẫu ở đây là hằng số đã kiểm chứng — force try là an toàn.
        try! NSRegularExpression(pattern: pattern, options: caseInsensitive ? [.caseInsensitive] : [])
    }

    /// Nhóm bắt (1...) của trận khớp đầu tiên; nil nếu không khớp.
    private static func firstGroups(_ pattern: String, in s: String, caseInsensitive: Bool = false) -> [String?]? {
        let r = rx(pattern, caseInsensitive: caseInsensitive)
        let range = NSRange(s.startIndex..., in: s)
        guard let m = r.firstMatch(in: s, range: range) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            guard let rr = Range(m.range(at: i), in: s) else { return nil }
            return String(s[rr])
        }
    }

    private static func allGroups(_ pattern: String, in s: String, caseInsensitive: Bool = false) -> [[String?]] {
        let r = rx(pattern, caseInsensitive: caseInsensitive)
        let range = NSRange(s.startIndex..., in: s)
        return r.matches(in: s, range: range).map { m in
            (0..<m.numberOfRanges).map { i in
                guard let rr = Range(m.range(at: i), in: s) else { return nil }
                return String(s[rr])
            }
        }
    }

    private static func test(_ pattern: String, in s: String, caseInsensitive: Bool = false) -> Bool {
        firstGroups(pattern, in: s, caseInsensitive: caseInsensitive) != nil
    }

    private static func clean(_ s: String?, limit: Int = 60) -> String {
        guard let s else { return "" }
        let t = s.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String(t.prefix(limit))
    }

    // MARK: group options (mirror web groupOptions/findGroupOption)

    struct GroupOption: Equatable {
        let groupCount: Int
        let sizes: [Int]
        let recommended: Bool
        let playoffSize: Int
        let wildcards: Int
    }

    private static func oneGroup(_ n: Int) -> GroupOption? {
        guard n >= 2 && n <= maxGroup else { return nil }
        return GroupOption(groupCount: 1, sizes: [n], recommended: n < 6, playoffSize: 0, wildcards: 0)
    }

    static func groupOptions(_ n: Int) -> [GroupOption] {
        guard n >= 2 else { return [] }
        let suggestions = n < 6 ? [] : GroupSuggestion.suggest(playerCount: n)
        let multi = suggestions.map {
            GroupOption(groupCount: $0.groupCount, sizes: $0.playersPerGroup.sorted(by: >),
                        recommended: $0.isRecommended, playoffSize: $0.totalPlayoffSpots,
                        wildcards: $0.wildcardNeeded)
        }
        if let one = oneGroup(n) { return [one] + multi }
        return multi
    }

    static func customGroupOption(_ n: Int, _ g: Int) -> GroupOption? {
        if g == 1 { return oneGroup(n) }
        guard g >= 2 && g <= maxGroups else { return nil }
        let sizes = (0..<g).map { n / g + ($0 < n % g ? 1 : 0) }
        guard let last = sizes.last, last >= minGroup, let first = sizes.first, first <= maxGroup else { return nil }
        guard let a = QTSeries.plan(sizes: sizes, k: 1)?.first else { return nil }
        return GroupOption(groupCount: g, sizes: sizes, recommended: false,
                           playoffSize: a.bracket, wildcards: a.size - 2 * g)
    }

    static func findGroupOption(_ n: Int, _ g: Int?) -> GroupOption? {
        guard let g else { return nil }
        return groupOptions(n).first { $0.groupCount == g } ?? customGroupOption(n, g)
    }

    static func groupChoices(_ n: Int) -> [GroupOption] {
        let base = groupOptions(n)
        if let four = customGroupOption(n, Int((Double(n) / 4).rounded())),
           n >= 12, !base.contains(where: { $0.groupCount == four.groupCount }) {
            return base + [four]
        }
        return base
    }

    // MARK: series helpers (mirror resolveSeriesSizes / rankSeriesSizes của web)

    static func resolveSeriesSizes(_ raw: [Int]?, total: Int) -> [Int]? {
        guard var sizes = raw, sizes.count >= 1, sizes.count <= rankSeriesCap else { return nil }
        if sizes.contains(where: { $0 < 0 }) { return nil }
        let free = sizes.filter { $0 == 0 }.count
        let rest = total - sizes.reduce(0, +)
        if free > 0 {
            guard rest >= free * 2 else { return nil }
            var left = rest
            var slots = free
            for i in sizes.indices where sizes[i] == 0 {
                sizes[i] = Int(ceil(Double(left) / Double(slots)))
                left -= sizes[i]
                slots -= 1
            }
        }
        if sizes.contains(where: { $0 < 2 }) || sizes.reduce(0, +) > total { return nil }
        return sizes
    }

    /// Cỡ nhánh "mỗi hạng một vòng" cho 1 bảng: lấy 2 hoặc 4 đội đầu bảng
    /// (mirror singleGroupPlayoffPlans của web, PR #920).
    static func singleGroupPlayoffPlans(_ groupSize: Int) -> [[Int]] {
        var plans: [[Int]] = []
        if groupSize >= 4 { plans.append([4]) }
        if groupSize >= 3 { plans.append([2]) }
        return plans
    }

    private static func rankSeriesSizes(_ groupSizes: [Int]) -> [Int]? {
        guard groupSizes.count >= 2 else { return nil }
        let depth = min(rankSeriesCap, groupSizes.max() ?? 0)
        var sizes: [Int] = []
        for t in 0..<depth {
            let n = groupSizes.filter { $0 > t }.count
            if n >= 2 { sizes.append(n) }
        }
        return sizes.count >= 2 ? sizes : nil
    }

    private static func seriesName(_ style: String?, _ division: Int, _ lang: String) -> String {
        if style == "medal" {
            let named = (lang == "en" ? ["Gold bracket", "Silver bracket", "Bronze bracket"]
                                     : ["Vàng", "Bạc", "Đồng"])
            if division >= 0 && division < named.count { return named[division] }
        }
        if lang == "vi" { return "Vòng loại \(division + 1)" }
        let letter = division >= 0 && division < 26
            ? String(UnicodeScalar(UInt8(65 + division))) : String(division + 1)
        return "Series \(letter)"
    }

    private static func seriesLine(_ name: String, _ size: Int, _ byes: Int, _ lang: String, _ unit: String?) -> String {
        if lang == "vi" {
            return "\(name): \(size) \(unit ?? "đội")" + (byes > 0 ? " (\(byes) được nghỉ vòng đầu)" : "")
        }
        return "\(name): \(size) \(unit ?? "teams")" + (byes > 0 ? " (\(byes) byes)" : "")
    }

    // MARK: draft helpers

    static func entryCount(_ d: QTChatDraft) -> Int {
        if let e = d.entries, !e.isEmpty { return e.count }
        return d.playerCount ?? 0
    }

    static func needsPairing(_ d: QTChatDraft) -> Bool {
        d.isDoubles == true && d.pairingDone != true
            && !(d.entries?.isEmpty ?? true) && (d.entries?.allSatisfy { $0.p2 == nil } ?? false)
    }

    private static func groupSizes(_ d: QTChatDraft) -> [Int] {
        findGroupOption(entryCount(d), d.groupCount)?.sizes ?? []
    }

    private static func seriesCap(_ d: QTChatDraft) -> Int {
        guard let o = findGroupOption(entryCount(d), d.groupCount), o.groupCount >= 2 else { return 1 }
        return QTSeries.cap(sizes: o.sizes)
    }

    private static func customSeries(_ d: QTChatDraft) -> [Int]? {
        d.seriesSizes.flatMap { resolveSeriesSizes($0, total: entryCount(d)) }
    }

    /// Các nhánh sẽ tạo: (size, byes) từng nhánh; nil = 1 nhánh mặc định.
    private static func draftSeriesPlan(_ d: QTChatDraft) -> [(size: Int, byes: Int)]? {
        if let custom = customSeries(d) {
            return custom.map { (size: $0, byes: QTSeedingV2.nextPowerOf2(max(2, $0)) - $0) }
        }
        let k = min(d.series ?? 1, seriesCap(d))
        guard k > 1, let plan = QTSeries.plan(sizes: groupSizes(d), k: k) else { return nil }
        return plan.map { (size: $0.size, byes: $0.byes) }
    }

    /// "top N mỗi bảng" = đúng N × số bảng, không kéo thêm hạng 3 cho đủ cây.
    static func lockAdvance(_ d: QTChatDraft) -> QTChatDraft {
        guard let n = d.advancePerGroup, let g = d.groupCount else { return d }
        let qual = n * g
        let total = entryCount(d)
        var out = d
        if qual < 2 || (total > 0 && qual > total) {
            out.advancePerGroup = nil
            return out
        }
        if d.series == 1, d.seriesSizes?.count == 1, d.seriesSizes?.first == qual { return d }
        out.series = 1
        out.seriesSizes = [qual]
        return out
    }

    static func nextSlot(_ d: QTChatDraft) -> QTChatSlot {
        if d.isDoubles == nil { return .format }
        if (d.entries?.isEmpty ?? true) && d.playerCount == nil { return .count }
        if entryCount(d) > maxChatEntries { return .tooMany }
        if entryCount(d) < 2 { return .count }
        if needsPairing(d) { return .pairing }
        if let e = d.entries, !e.isEmpty, let pc = d.playerCount, pc != e.count { return .mismatch }
        if findGroupOption(entryCount(d), d.groupCount) == nil { return .groups }
        let cap = seriesCap(d)
        if cap > 1 && customSeries(d) == nil && (d.series == nil || (d.series ?? 0) > cap) { return .series }
        if d.entries?.isEmpty ?? true {
            if d.rosterMode == nil { return .roster }
            if d.rosterMode == "now" { return .paste }
        }
        if (d.name ?? "").trimmingCharacters(in: .whitespaces).isEmpty { return .name }
        if d.courtsDone != true && (d.courts?.isEmpty ?? true) { return .courts }
        if !(d.courts?.isEmpty ?? true) && d.timeDone != true && d.startTime == nil { return .startTime }
        if !(d.entries?.isEmpty ?? true) && d.optionsDone != true { return .options }
        return .confirm
    }

    // MARK: nhận diện thể thức + đọc số liệu từ câu nói

    /// "Không chia bảng", "đánh vòng tròn 1 bảng", "just round robin, no groups":
    /// yêu cầu THỂ THỨC vòng tròn một bảng, không phải điền số bảng thường.
    static func wantsSingleGroupRoundRobin(_ text: String) -> Bool {
        let folded = fold(text)
            .replacingOccurrences(of: "\\bvongtron\\b", with: "vong tron", options: .regularExpression)
            .replacingOccurrences(of: "\\broundrobin\\b", with: "round robin", options: .regularExpression)
        if test("\\bkhong chia bang\\b", in: folded) { return true }
        let rr = test("\\bvong tron\\b", in: folded) || test("\\bround[ -]robin\\b", in: folded)
        guard rr else { return false }
        return test("\\b(1|mot)\\s+bang\\b", in: folded)
            || test("\\bbang duy nhat\\b", in: folded)
            || test("\\bchi (danh )?vong tron\\b", in: folded)
            || test("\\b(single|one) group\\b", in: folded)
            || test("\\bno groups?\\b", in: folded)
            || test("\\b(just|only) round[ -]robin\\b", in: folded)
    }

    static func sanitizeGroupCourts(_ raw: [Int?]?) -> [Int?]? {
        guard let raw else { return nil }
        let out = Array(raw.prefix(maxGroups)).map { v -> Int? in
            guard let v, v >= 1 && v < 100 else { return nil }
            return v
        }
        return out.contains(where: { $0 != nil }) ? out : nil
    }

    private static func groupLetter(_ i: Int) -> String {
        String(UnicodeScalar(UInt8(65 + i)))
    }

    static func groupCourtsLine(_ d: QTChatDraft, lang: String) -> String? {
        let pins = (d.groupCourts ?? []).enumerated().compactMap { i, c in c.map { (court: $0, i: i) } }
        guard !pins.isEmpty else { return nil }
        return pins.map { p in
            lang == "vi" ? "Bảng \(groupLetter(p.i)) → sân \(p.court)"
                         : "Group \(groupLetter(p.i)) → court \(p.court)"
        }.joined(separator: " · ")
    }

    /// Số liệu người dùng đã nói trong câu, không cần mô hình (mirror readUserFacts).
    static func readUserFacts(_ text: String) -> QTChatPatch {
        let folded = fold(text)
            .replacingOccurrences(of: "\\bvongtron\\b", with: "vong tron", options: .regularExpression)
            .replacingOccurrences(of: "\\broundrobin\\b", with: "round robin", options: .regularExpression)
            .replacingOccurrences(of: "\\bbangh\\b", with: "bang", options: .regularExpression)
            .replacingOccurrences(of: "\\bsann\\b", with: "san", options: .regularExpression)
        var out = QTChatPatch()
        // "đổi chỗ / đổi tên" cũng gấp thành "doi" — không được hiểu thành đánh đôi.
        let spoken = folded
            .replacingOccurrences(of: "\\bdoi (cho|ten)\\b", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\bten cap\\b", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\bcap mau\\b", with: " ", options: .regularExpression)
        let singles = test("\\b(don|singles)\\b", in: spoken)
        let doubles = test("\\b(doi|doubles|cap)\\b", in: spoken)
        if singles && !doubles { out.isDoubles = false }
        else if doubles { out.isDoubles = true }

        let advancePhrase = "(?:top|lay|chon)\\s*(\\d{1,2})\\s*(?:nguoi|doi|vdv)?\\s*(?:moi|per)\\s*(?:bang|group)\\b"
        if let count = firstGroups("\\b(\\d{1,3})\\s*(doi|vdv|nguoi|cap|pairs|players|teams)\\b", in: folded),
           let nStr = count[1], let n = Int(nStr) {
            let advHit = firstGroups(advancePhrase, in: folded)
            let insideAdvance = advHit != nil && (advHit?[0]?.contains(count[0] ?? "") ?? false)
            if !insideAdvance && n >= 2 && n <= 500 { out.playerCount = n }
        }

        let grid = firstGroups("\\b(\\d{1,2})\\s*[x×]\\s*(\\d{1,2})\\b", in: folded)
        let groups = firstGroups("(?:chia\\s+)?(\\d{1,2})\\s+(?:bang|groups?)\\b", in: folded)
        if let grid, let g1 = grid[1].flatMap(Int.init), let g2 = grid[2].flatMap(Int.init),
           g2 >= minGroup && g2 <= maxGroup {
            out.groupCount = g1
        } else if let groups, let g = groups[1].flatMap(Int.init), g >= 1 && g <= maxGroups {
            out.groupCount = g
        }
        // "3 bảng, mỗi bảng 6 người" = 18 người, không phải 6 người chia 3 bảng.
        if let each = firstGroups("\\b(\\d{1,2})\\s*(?:nguoi|doi|vdv)\\s*(?:moi|per)\\s*bang\\b", in: folded),
           let grouped = firstGroups("\\b(\\d{1,2})\\s*bang\\b", in: folded),
           let size = each[1].flatMap(Int.init), let g = grouped[1].flatMap(Int.init),
           size >= minGroup && size <= maxGroup && g >= 1 && g <= maxGroups {
            out.playerCount = size * g
            out.groupCount = g
        }

        // "lấy 4 đội vào trực tiếp", "top 2 vào bán kết", "take 4 into the knockout":
        // số đội đi tiếp nói thẳng, không cần chữ "mỗi bảng" (PR web #920).
        if let advDirect = firstGroups("(?:top|lay|chon|take)\\s*(\\d{1,2})\\s*(?:doi|nguoi|vdv|teams?|players?)?\\s*(?:vao|di|into)?\\s*(?:vong\\s*)?(?:the\\s+)?(?:truc tiep|ban ket|chung ket|playoff|knockout)", in: folded),
           let n = advDirect[1].flatMap(Int.init), n >= 1 && n <= 8 {
            out.advancePerGroup = n
        }
        // Thể thức vòng tròn một bảng nói bằng lời cũng là 1 bảng.
        if wantsSingleGroupRoundRobin(text) { out.groupCount = 1 }

        // Tên giải: "tên giải …" / "giải …" ở đầu câu.
        var rawName = ""
        if let labeled = firstGroups("(?:tên giải|ten giai|tên là|ten la|gọi là|goi la|name is|named)\\s*[:：]?\\s*([^,\\n]+)", in: text, caseInsensitive: true) {
            rawName = labeled[1] ?? ""
        } else if let lead = firstGroups("^(?:giải|giai)\\s+([^,\\n]+)", in: text, caseInsensitive: true) {
            rawName = lead[1] ?? ""
        }
        if !rawName.isEmpty {
            // Cắt tại mốc số lượng/thể thức như web (split tại \d+ người/đôi…, đánh/chia/vòng).
            if let cut = firstGroups("^(.+?)\\s+(?=\\d+\\s*(?:người|nguoi|đôi|doi|đơn|don|vđv|vdv|cặp|cap)\\b|đánh\\b|danh\\b|chia\\b|vòng\\b|vong\\b)", in: rawName, caseInsensitive: true) {
                rawName = cut[1] ?? rawName
            }
            rawName = rawName.replacingOccurrences(of: "\\s+(đôi|doi|đơn|don|doubles|singles|playoff)\\s*$", with: "", options: .regularExpression, range: nil)
            rawName = rawName.trimmingCharacters(in: CharacterSet(charactersIn: "\"“”"))
            rawName = rawName.replacingOccurrences(of: "[,.:;]+$", with: "", options: .regularExpression)
            if rawName.count >= 2 && rawName.count <= 80 { out.name = rawName }
        }

        // Gán sân theo bảng: "bảng A sân 1" / "sân 1 cho bảng A" (ca thật 01:51
        // 22/10/2026 từng bị hiểu thành unsupported + reply rỗng ở web).
        var pins: [Int?] = []
        var pinFound = false
        func pinPair(_ letter: String, _ court: Int) {
            guard let ch = letter.lowercased().first, let ascii = ch.asciiValue else { return }
            let idx = Int(ascii) - 97
            guard idx >= 0 && idx < maxGroups && court >= 1 && court < 100 else { return }
            while pins.count <= idx { pins.append(nil) }
            pins[idx] = court
            pinFound = true
        }
        for m in allGroups("(?:group|bang)\\s*([a-z])\\b[^,;.]{0,40}?(?:court|san)\\s*(\\d{1,2})\\b", in: folded) {
            if let l = m[1], let c = m[2].flatMap(Int.init) { pinPair(l, c) }
        }
        for m in allGroups("(?:court|san)\\s*(\\d{1,2})\\b[^,;.]{0,25}?(?:cho|for)\\s*(?:group|bang)\\s*([a-z])\\b", in: folded) {
            if let c = m[1].flatMap(Int.init), let l = m[2] { pinPair(l, c) }
        }
        if pinFound { out.groupCourts = pins }

        if let courts = firstGroups("\\b(\\d{1,2})\\s*(?:san|courts?)\\b", in: folded),
           let n = courts[1].flatMap(Int.init), n >= 1 && n <= 50 {
            out.courts = Array(1...n)
        }

        if let hm = firstGroups("\\b([01]?\\d|2[0-3]):([0-5]\\d)\\b", in: text),
           let h = hm[1], let mi = hm[2] {
            out.startTime = "\(h.count == 1 ? "0" : "")\(h):\(mi)"
        } else if let st = firstGroups("\\b(\\d{1,2})\\s*h\\s*(\\d{1,2})?\\s*(toi|sang|chieu|trua|pm|am)?\\b", in: folded),
                  var h = st[1].flatMap(Int.init) {
            let mi = st[2].flatMap(Int.init) ?? 0
            let part = st[3]
            if (part == "toi" || part == "pm" || part == "chieu") && h < 12 { h += 12 }
            if h <= 23 && mi <= 59 {
                out.startTime = String(format: "%02d:%02d", h, mi)
                out.timeDone = true
            }
        }
        // Đã nói số sân mà không nói giờ thì không hỏi giờ — giờ không bắt buộc.
        if out.courts != nil && out.startTime == nil { out.timeDone = true }

        // "mỗi bảng lấy 2" / "top 2 mỗi bảng" — một vòng loại, đúng N mỗi bảng.
        let adv = firstGroups("(?:moi|per)\\s+(?:bang|group)\\s+(?:lay|chon|take|advance)\\s+(\\d{1,2})", in: folded)
            ?? firstGroups("(?:top|lay|chon|advance)\\s+(\\d{1,2})\\s*(?:nguoi|doi|vdv|teams?|players?)?\\s*(?:moi|per)\\s+(?:bang|group)\\b", in: folded)
        let manyBrackets = test("nhieu vong|nhieu nhanh|multiple bracket|several bracket", in: folded)
        if !manyBrackets {
            if let adv, let n = adv[1].flatMap(Int.init) { out.advancePerGroup = n }
            else if test("top\\s*2\\b|nhat nhi moi bang|1st and 2nd", in: folded) { out.advancePerGroup = 2 }
            if out.advancePerGroup != nil { out.series = 1 }
        }
        return out
    }

    // MARK: áp bản vá vào nháp

    private static func sanitizeEntries(_ raw: [QTChatEntry]?) -> [QTChatEntry]? {
        guard let raw else { return nil }
        var out: [QTChatEntry] = []
        for e in raw.prefix(200) {
            let p1 = clean(e.p1)
            if p1.isEmpty { continue }
            let p2 = clean(e.p2)
            let team = clean(e.team)
            out.append(QTChatEntry(p1: p1, p2: p2.isEmpty ? nil : p2,
                                   team: team.isEmpty ? nil : team,
                                   seed: (e.seed ?? 0) > 0 ? e.seed : nil))
        }
        return out
    }

    /// Áp bản vá vào nháp. Không tin mô hình: mọi trường đều kiểm kiểu/khoảng.
    static func applyPatch(_ d: QTChatDraft, _ p: QTChatPatch) -> QTChatDraft {
        var next = d
        if let isD = p.isDoubles {
            if isD != d.isDoubles { next.pairingDone = false }
            next.isDoubles = isD
        }
        let entries = sanitizeEntries(p.entries)
        if let entries, !entries.isEmpty {
            next.entries = entries
            next.rosterMode = "now"
            next.pairingDone = entries.contains { $0.p2 != nil } || (d.pairingDone ?? false)
        }
        if let c = p.playerCount, c >= 1 && c <= 500 { next.playerCount = c }
        else if let entries, !entries.isEmpty { next.playerCount = entries.count }
        let askedGroups = p.groupCount.map { $0 >= 1 && $0 <= maxGroups } ?? false
        if let g = p.groupCount, askedGroups { next.groupCount = g }
        let name = clean(p.name, limit: 100)
        if !name.isEmpty { next.name = name }
        if p.rosterMode == "later" || p.rosterMode == "registration" {
            if next.entries?.isEmpty ?? true { next.rosterMode = p.rosterMode }
        }
        if let courts = p.courts {
            let uniq = Array(Set(courts.filter { $0 > 0 && $0 < 100 })).sorted()
            if !uniq.isEmpty { next.courts = uniq; next.courtsDone = true }
        }
        if let pins = sanitizeGroupCourts(p.groupCourts) {
            next.groupCourts = pins
            // Sân gán cho bảng cũng là sân của giải: gộp vào danh sách sân.
            let pinned = pins.compactMap { $0 }
            next.courts = Array(Set((next.courts ?? []) + pinned)).sorted()
            next.courtsDone = true
        }
        if let st = p.startTime, test("^([01]\\d|2[0-3]):[0-5]\\d$", in: st) {
            next.startTime = st
            next.timeDone = true
        }
        if p.timeDone == true { next.timeDone = true }
        // Số bảng không chia được thì không ghi vào nháp.
        if askedGroups {
            let n = entryCount(next)
            if n >= 2 && findGroupOption(n, next.groupCount) == nil {
                next.groupCount = (d.groupCount.flatMap { findGroupOption(n, $0) != nil ? $0 : nil })
            }
        }
        if let ds = p.defaultSets, [1, 3, 5].contains(ds) { next.defaultSets = ds }
        if let s = p.series, [1, 2, 3].contains(s) {
            next.series = s
            next.seriesSizes = nil
            if p.clearAdvancePerGroup { next.advancePerGroup = nil }
        }
        if let sizes = p.seriesSizes, !sizes.isEmpty {
            if let resolved = resolveSeriesSizes(sizes, total: entryCount(next)) {
                next.seriesSizes = resolved
                next.series = resolved.count
            }
        }
        if p.seriesStyle == "series" || p.seriesStyle == "medal" { next.seriesStyle = p.seriesStyle }
        if p.seriesModeByRank {
            if let sizes = rankSeriesSizes(groupSizes(next)) {
                next.seriesSizes = sizes
                next.series = sizes.count
                next.advancePerGroup = nil
                if sizes.count > maxSeries { next.seriesStyle = "series" }
            }
        }
        if p.clearAdvancePerGroup { next.advancePerGroup = nil }
        else if let adv = p.advancePerGroup, adv >= 1 && adv <= 8 { next.advancePerGroup = adv }
        return lockAdvance(next)
    }

    private static func isNameCell(_ s: String) -> Bool {
        if !test("\\p{L}", in: s) { return false }
        if s.split(separator: " ").count > 5 || s.contains("http") || s.contains("@") { return false }
        if test("^(đã|chưa|da|chua)\\s*(ck|chuyển|chuyen|đóng|dong|tt)", in: s, caseInsensitive: true) { return false }
        if test("^(team|đội|doi|cặp|cap|nhóm|nhom|pair)\\s*#?\\d+$", in: s, caseInsensitive: true) { return false }
        if test("^(nữ|male|female|x|ok|có|không|yes|no)$", in: s, caseInsensitive: true) { return false }
        return !test("^[\\d\\s.,:/+()kđ₫vndVND-]+$", in: s)
    }

    static func looksLikeNameList(_ text: String) -> Bool {
        let lines = text.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let named = lines.filter { line in
            isNameCell(line) || line.components(separatedBy: CharacterSet(charactersIn: "\t,;|"))
                .contains { isNameCell($0.trimmingCharacters(in: .whitespaces)) }
        }
        return named.count >= 2
    }

    private static func structuralEdit(_ text: String) -> Bool {
        test("doi cho|swap |doi ten|rename |chia\\s+\\d+\\s*bang|\\d+\\s*[x×]\\s*\\d+", in: fold(text))
    }

    /// Câu hỏi hoặc danh sách dán thì vẫn cần mô hình. Số liệu và lệnh sửa thì không.
    static func messageNeedsModel(_ text: String) -> Bool {
        if looksLikeNameList(text) { return true }
        return text.contains("?") || test("the nao|bao nhieu|tai sao|\\bhow\\b|\\bwhat\\b|\\bwhy\\b", in: fold(text))
    }

    /// "dùng tên mẫu" / "chưa có tên" → Đội 1… hoặc Người 1…, sửa được sau.
    static func placeholderEntries(_ text: String, _ d: QTChatDraft) -> [QTChatEntry]? {
        let f = fold(text)
        let sample = test("ten mau|ten cap mau|dung mau|sample name|placeholder", in: f)
        let noNames = test("chua co ten", in: f) && !test("nhap sau|de sau", in: f)
        guard sample || noNames else { return nil }
        let n = min(entryCount(d), maxChatEntries)
        guard n >= 2 else { return nil }
        let singles = d.isDoubles == false
        return (0..<n).map { QTChatEntry(p1: singles ? "Người \($0 + 1)" : "Đội \($0 + 1)") }
    }

    private static func findEntry(_ entries: [QTChatEntry], _ query: String) -> Int {
        let q = fold(query).replacingOccurrences(of: "^(doi|vdv|cap)\\s+", with: "", options: .regularExpression)
        guard !q.isEmpty else { return -1 }
        if let exact = entries.firstIndex(where: { fold($0.p1) == q || ($0.p2.map { fold($0) } == q) || fold($0.label) == q }) {
            return exact
        }
        return entries.firstIndex { fold($0.p1).contains(q) || ($0.p2.map { fold($0).contains(q) } ?? false) || fold($0.label).contains(q) } ?? -1
    }

    /// Đổi chỗ / đổi tên / chia bảng trên đúng danh sách đang có.
    /// Trả nil khi câu không chứa lệnh hay số liệu.
    static func applySpokenEdit(_ draft: QTChatDraft, _ text: String) -> QTChatDraft? {
        let facts = readUserFacts(text)
        var next = draft
        var touched = false
        // facts rỗng ⇔ mọi trường đều nil/false (QTChatPatch không có isEmpty sẵn).
        let factsEmpty = facts.isDoubles == nil && facts.playerCount == nil && facts.groupCount == nil
            && facts.name == nil && facts.entries == nil && facts.rosterMode == nil && facts.courts == nil
            && facts.groupCourts == nil && facts.startTime == nil && facts.timeDone == nil
            && facts.defaultSets == nil && facts.series == nil && facts.seriesSizes == nil
            && facts.seriesStyle == nil && !facts.seriesModeByRank && facts.advancePerGroup == nil
            && !facts.clearAdvancePerGroup && !facts.clearPlayerCount
        if !factsEmpty {
            next = applyPatch(next, facts)
            touched = true
        }
        // "Mỗi bảng một sân": gán lần lượt các sân đã biết cho từng bảng.
        if next.groupCourts == nil && test("moi bang (mot|1) san|each group .*own court|one court per group", in: fold(text)) {
            let g = next.groupCount ?? 0
            let cs = next.courts ?? []
            if g >= 2 && cs.count >= g {
                next.groupCourts = Array(cs.prefix(g)).map { Optional($0) }
                touched = true
            }
        }
        if let placeholders = placeholderEntries(text, next) {
            next.entries = placeholders
            next.playerCount = placeholders.count
            next.rosterMode = "now"
            next.pairingDone = true
            touched = true
        }
        if var entries = next.entries {
            var rosterTouched = false
            for m in allGroups("(?:đổi chỗ|doi cho|swap)\\s+(.+?)\\s+(?:với|voi|và|va|and|with)\\s+([^,\\n]+)", in: text, caseInsensitive: true) {
                guard let a = m[1], let b = m[2] else { continue }
                let i = findEntry(entries, a)
                let j = findEntry(entries, b)
                if i >= 0 && j >= 0 && i != j {
                    entries.swapAt(i, j)
                    rosterTouched = true
                }
            }
            for m in allGroups("(?:đổi tên|doi ten|rename)\\s+(.+?)\\s+(?:thành|thanh|to)\\s+([^,\\n]+)", in: text, caseInsensitive: true) {
                guard let a = m[1], let b = m[2] else { continue }
                let i = findEntry(entries, a)
                let name = String(clean(b, limit: 60))
                if i >= 0 && !name.isEmpty {
                    let target = fold(a)
                    let e = entries[i]
                    if let p2 = e.p2, fold(p2).contains(target) && !fold(e.p1).contains(target) {
                        entries[i].p2 = name
                    } else {
                        entries[i].p1 = name
                    }
                    rosterTouched = true
                }
            }
            if rosterTouched {
                next.entries = entries
                next.playerCount = entries.count
                touched = true
            }
        }
        guard touched else { return nil }
        return lockAdvance(next)
    }

    /// Danh sách mô hình bịa (không có trong câu, không phải lệnh sửa) thì bỏ.
    static func dropInventedRoster(_ patch: QTChatPatch, _ text: String, _ before: [QTChatEntry]?) -> QTChatPatch {
        var p = patch
        let facts = readUserFacts(text)
        if facts.advancePerGroup != nil && facts.groupCount == nil { p.groupCount = nil }
        if p.playerCount != nil && facts.playerCount == nil && !looksLikeNameList(text) { p.playerCount = nil }
        guard let entries = p.entries else { return p }
        if looksLikeNameList(text) { return p }
        if structuralEdit(text) { p.entries = nil; return p }
        let known = Set((before ?? []).map { fold($0.label) })
        let folded = fold(text)
        let invented = entries.filter { !known.contains(fold($0.label)) && !folded.contains(fold($0.p1)) }
        if (before?.isEmpty ?? true) && invented.count == entries.count { p.entries = nil }
        return p
    }

    // MARK: câu trả lời

    static func playoffSummary(_ d: QTChatDraft, lang: String) -> String? {
        let g = d.groupCount ?? 0
        let vi = lang == "vi"
        if g < 2 {
            guard g == 1 else { return nil }
            // Một bảng vẫn được đánh vòng loại trực tiếp: lấy 2 hoặc 4 đội đầu
            // bảng, cặp đấu theo hạt giống cao gặp thấp (1–4, 2–3 / CK 1–2).
            let adv = d.advancePerGroup
            let u = d.isDoubles == false ? (vi ? "người" : "players") : (vi ? "đội" : "teams")
            if adv == 4 {
                return vi
                    ? "Vòng loại trực tiếp: lấy 4 \(u) đầu bảng — Bán kết: \(u) 1 gặp \(u) 4, \(u) 2 gặp \(u) 3"
                    : "Knockout: top 4 \(u) advance — Semifinals: seed 1 vs seed 4, seed 2 vs seed 3"
            }
            if adv == 2 {
                return vi
                    ? "Vòng loại trực tiếp: lấy 2 \(u) đầu bảng — Chung kết: \(u) 1 gặp \(u) 2"
                    : "Knockout: top 2 \(u) advance — Final: seed 1 vs seed 2"
            }
            if let adv {
                return vi ? "Vòng loại trực tiếp: lấy \(adv) \(u) đầu bảng"
                          : "Knockout: top \(adv) \(u) advance"
            }
            return vi ? "Một bảng vòng tròn" : "One round-robin group"
        }
        if let adv = d.advancePerGroup {
            let n = adv * g
            return vi
                ? "Vòng loại trực tiếp: đúng \(adv) mỗi bảng (\(n)), không lấy thêm hạng 3"
                : "Playoff: exactly \(adv) from each group (\(n)), no extra 3rd places"
        }
        guard let plan = draftSeriesPlan(d) else {
            return vi ? "Vòng loại trực tiếp: nhất và nhì mỗi bảng" : "Playoff: 1st and 2nd from each group"
        }
        let u = d.isDoubles == false ? (vi ? "người" : "players") : (vi ? "đội" : "teams")
        return plan.enumerated().map { i, sl in
            seriesLine(seriesName(d.seriesStyle, i, lang), sl.size, sl.byes, lang, u)
        }.joined(separator: " · ")
    }

    private static let unchangedVI = "Bản nháp chưa đổi."
    private static let unchangedEN = "The draft did not change."

    /// Câu trả lời chỉ nói điều bản nháp thực sự đổi.
    static func factualAck(before: QTChatDraft, after: QTChatDraft, lang: String, request: String = "") -> String {
        let vi = lang == "vi"
        let u = after.isDoubles == false ? (vi ? "người" : "players") : (vi ? "đội" : "teams")
        var bits: [String] = []
        let asked = request.isEmpty ? QTChatPatch() : readUserFacts(request)
        let knownField = entryCount(after) >= 2
        let askedGroupsOk = asked.groupCount != nil && knownField
            && (asked.groupCount.flatMap { findGroupOption(entryCount(after), $0) } != nil)
        let rrSingle = !request.isEmpty && wantsSingleGroupRoundRobin(request)
        if let ag = asked.groupCount, knownField && !askedGroupsOk {
            bits.append(vi ? "Không chia được \(ag) bảng (mỗi bảng 3–8 \(u))."
                           : "Can't make \(ag) groups (3–8 \(u) each).")
        } else if rrSingle && after.groupCount == 1 && knownField && findGroupOption(entryCount(after), 1) != nil {
            // Đòi thể thức thì câu trả lời phải gọi tên thể thức + cách xếp hạng.
            bits.append(vi
                ? "Đã chia 1 bảng đấu vòng tròn: các \(u) gặp nhau vòng tròn, xếp hạng theo điểm"
                : "Split into 1 round-robin group: every \(u) plays each other, ranked by points")
        } else if let gc = after.groupCount, gc != before.groupCount,
                  findGroupOption(entryCount(after), gc) != nil {
            bits.append(vi ? "Đã chia \(gc) bảng." : "Split into \(gc) groups.")
            // Nguyên tắc chung: luôn gọi tên thể thức đã chọn.
            if gc == 1, let ps = playoffSummary(after, lang: lang) { bits.append(ps) }
        }
        if let name = after.name, name != before.name {
            bits.append(vi ? "Tên giải: \(name)." : "Name: \(name).")
        }
        if let adv = after.advancePerGroup, adv != before.advancePerGroup {
            let ps = playoffSummary(after, lang: lang) ?? ""
            // Bit chia bảng đã gọi tên thể thức thì không lặp câu thể thức thuần;
            // câu cặp đấu vòng loại là nội dung khác, vẫn phải nêu.
            let plainFormatLine = ps == (vi ? "Một bảng vòng tròn" : "One round-robin group")
            if !ps.isEmpty && !(plainFormatLine && bits.joined(separator: " ").contains(vi ? "vòng tròn" : "round-robin")) {
                bits.append(ps)
            }
        }
        let prev = before.entries ?? []
        let next = after.entries ?? []
        let added = next.filter { e in !prev.contains { fold($0.label) == fold(e.label) } }
        let listed = looksLikeNameList(request)
            || (!added.isEmpty && added.allSatisfy { fold(request).contains(fold($0.p1)) })
        let samples = test("ten mau|ten cap mau|dung mau|chua co ten|sample name", in: fold(request))
        if !added.isEmpty && samples {
            let shown = added.prefix(6).map { $0.label }.joined(separator: ", ")
            let more = added.count > 6 ? (vi ? " và \(added.count - 6) nữa" : " and \(added.count - 6) more") : ""
            bits.append(vi ? "Đã tạo \(added.count) tên mẫu: \(shown)\(more)."
                           : "Added \(added.count) placeholder names: \(shown)\(more).")
        } else if !added.isEmpty && listed {
            let shown = added.prefix(6).map { $0.label }.joined(separator: ", ")
            let more = added.count > 6 ? (vi ? " và \(added.count - 6) nữa" : " and \(added.count - 6) more") : ""
            bits.append(vi ? "Đã nhận \(added.count) \(u): \(shown)\(more)."
                           : "Got \(added.count) \(u): \(shown)\(more).")
        } else if next.isEmpty, let pc = after.playerCount, pc != before.playerCount {
            bits.append("\(pc) \(u).")
        }
        if !prev.isEmpty && next.count == prev.count {
            var moved: [String] = []
            for i in next.indices {
                if next[i].label != prev[i].label && prev.contains(where: { $0.label == next[i].label }) {
                    moved.append(next[i].label)
                }
            }
            let renamed = next.enumerated().filter { i, e in
                fold(prev[i].label) != fold(e.label)
                    && !prev.contains { fold($0.label) == fold(e.label) }
            }
            if moved.count >= 2 && renamed.isEmpty {
                bits.append(vi ? "Đã đổi chỗ \(moved.prefix(2).joined(separator: " và "))."
                               : "Swapped \(moved.prefix(2).joined(separator: " and ")).")
            }
            for (_, e) in renamed {
                bits.append(vi ? "Đã đổi tên thành \(e.label)." : "Renamed to \(e.label).")
            }
        }
        if after.courts != before.courts, let courts = after.courts, !courts.isEmpty {
            bits.append(vi ? "\(courts.count) sân, đánh song song."
                           : "\(courts.count) courts, playing at the same time.")
        }
        if after.groupCourts != before.groupCourts {
            if let line = groupCourtsLine(after, lang: lang) { bits.append(line) }
        }
        if let st = after.startTime, st != before.startTime { bits.append(st) }
        let sentences = bits
            .map { $0.trimmingCharacters(in: CharacterSet(charactersIn: ". ")) }
            .filter { !$0.isEmpty }
        return sentences.isEmpty ? (vi ? unchangedVI : unchangedEN)
                                   : sentences.joined(separator: ". ") + "."
    }

    private static func stripClaims(_ reply: String) -> String {
        var s = reply.replacingOccurrences(
            of: "(?:đã|da)\\s+(?:nhận|nhan|chia|đổi|doi|xếp|xep|ghép|ghep|cập nhật|cap nhat)\\s+[^.!\\n]*",
            with: "", options: [.regularExpression, .caseInsensitive])
        s = s.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func replyFromDraft(before: QTChatDraft, after: QTChatDraft, llmReply: String, lang: String, request: String = "") -> String {
        let fact = factualAck(before: before, after: after, lang: lang, request: request)
        let unchanged = fact == (lang == "vi" ? unchangedVI : unchangedEN)
        let cleaned = replyFromDraftTrim(stripClaims(llmReply))
        if unchanged { return cleaned.isEmpty ? fact : cleaned }
        if !request.isEmpty && messageNeedsModel(request) && !cleaned.isEmpty { return "\(fact) \(cleaned)" }
        return fact
    }

    private static func replyFromDraftTrim(_ s: String) -> String {
        s.trimmingCharacters(in: CharacterSet(charactersIn: ". "))
    }

    /// Câu trả lời dự phòng không bao giờ rỗng (luật #910: unsupported cũng phải có câu).
    static func fallbackReply(intent: String, unmet: String?, lang: String) -> String {
        let vi = lang == "vi"
        if intent == "unsupported" {
            return vi
                ? "Mình chưa hỗ trợ\(unmet.map { " yêu cầu này: \($0)" } ?? " yêu cầu này"). Bạn cứ tạo giải như bình thường trước — các thiết lập nâng cao (gán sân, thể thức riêng…) có thể chỉnh thêm ở trang giải sau khi tạo. Mình tiếp tục nhé."
                : "I can't do that yet\(unmet.map { ": \($0)" } ?? ""). Go ahead and create the tournament as usual — advanced settings can be adjusted on the tournament page afterwards. Let's continue."
        }
        if intent == "off_topic" {
            return vi
                ? "Mình chỉ giúp tạo giải chia bảng ở đây. Mình tiếp tục với giải của bạn nhé."
                : "I can only help create group-stage tournaments here. Let's continue with yours."
        }
        return vi ? "Mình chưa rõ ý bạn — mình tiếp tục với bản nháp hiện tại nhé."
                  : "I didn't quite get that — let's continue with the current draft."
    }
}

// MARK: - PR-2: cầu nối với edge function `quick-table-chat`
//
// Các hàm tất định còn lại của web mà PR-1 chưa cần: lọc bản vá của mô hình
// (trustPatch), trả lời tại chỗ bước sân/giờ (localSlotPatch), bảng số liệu
// gửi kèm cho mô hình (chatFacts), và cầu nối JSON patch <-> QTChatPatch.

/// Giá trị JSON tự do — giữ nguyên `null` tường minh (web phân biệt "không
/// nói" với "xoá" bằng null, vd player_count: null = xoá số lượng).
enum QTChatJSONValue: Equatable, Codable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([QTChatJSONValue])
    case object([String: QTChatJSONValue])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let n = try? c.decode(Double.self) { self = .number(n); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let a = try? c.decode([QTChatJSONValue].self) { self = .array(a); return }
        if let o = try? c.decode([String: QTChatJSONValue].self) { self = .object(o); return }
        self = .null
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .number(let n): try c.encode(n)
        case .bool(let b): try c.encode(b)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        case .null: try c.encodeNil()
        }
    }

    var intValue: Int? { if case .number(let n) = self { return Int(n) }; return nil }
    var stringValue: String? { if case .string(let s) = self { return s }; return nil }
    var boolValue: Bool? { if case .bool(let b) = self { return b }; return nil }
}

extension QTChatPatch {
    /// Dịch patch JSON của mô hình (khoá snake_case) sang QTChatPatch.
    static func fromModelJSON(_ obj: [String: QTChatJSONValue]) -> QTChatPatch {
        var p = QTChatPatch()
        if let v = obj["is_doubles"] { p.isDoubles = v.boolValue }
        if let v = obj["player_count"] {
            if v == .null { p.clearPlayerCount = true } else { p.playerCount = v.intValue }
        }
        if let v = obj["group_count"] { p.groupCount = v.intValue }
        if let v = obj["name"] { p.name = v.stringValue }
        if let v = obj["entries"], case .array(let items) = v {
            p.entries = items.compactMap { item -> QTChatEntry? in
                guard case .object(let e) = item, let p1 = e["p1"]?.stringValue, !p1.isEmpty else { return nil }
                return QTChatEntry(p1: p1, p2: e["p2"]?.stringValue, team: e["team"]?.stringValue,
                                   seed: e["seed"]?.intValue)
            }
        }
        if let v = obj["roster_mode"] { p.rosterMode = v.stringValue }
        if let v = obj["courts"], case .array(let items) = v { p.courts = items.compactMap { $0.intValue } }
        if let v = obj["group_courts"], case .array(let items) = v {
            p.groupCourts = items.map { $0.intValue }
        }
        if let v = obj["start_time"] { p.startTime = v.stringValue }
        if let v = obj["time_done"] { p.timeDone = v.boolValue }
        if let v = obj["default_sets"] { p.defaultSets = v.intValue }
        if let v = obj["series"] { p.series = v.intValue }
        if let v = obj["series_sizes"], case .array(let items) = v { p.seriesSizes = items.compactMap { $0.intValue } }
        if let v = obj["series_style"] { p.seriesStyle = v.stringValue }
        if obj["series_mode"]?.stringValue == "by_rank" { p.seriesModeByRank = true }
        if let v = obj["advance_per_group"] {
            if v == .null { p.clearAdvancePerGroup = true } else { p.advancePerGroup = v.intValue }
        }
        return p
    }
}

extension QTChatEngine {
    /// "nhất vào A, nhì vào B" — không phải "nhất nhì cùng vào A". (web wantsRankSeries)
    static func wantsRankSeries(_ text: String) -> Bool {
        let t = text.lowercased()
        if test("mỗi hạng|moi hang|từng hạng|tung hang|mỗi thứ hạng|each place|each rank|one series per|per place", in: t) { return true }
        let toA = test("nhất\\s*(?:bảng\\s*)?(?:vào|sang|→|->)\\s*(?:series\\s*)?a\\b", in: t)
            && test("nhì\\s*(?:bảng\\s*)?(?:vào|sang|→|->)", in: t)
        let toEn = test("1st\\s*(?:place\\s*)?(?:to|into)\\s*(?:series\\s*)?a\\b", in: t)
            && test("2nd\\s*(?:place\\s*)?(?:to|into)", in: t)
        return toA || toEn
    }

    /// AI hay tự điền mặc định cho trường người dùng chưa hề nhắc (vd "8 sân" →
    /// start_time 08:00). Chỉ giữ các trường tuỳ chọn khi đúng bước đang hỏi
    /// hoặc tin nhắn có nhắc tới. (web trustPatch — chạy trên JSON thô.)
    static func trustPatch(_ obj: [String: QTChatJSONValue], text: String, slot: QTChatSlot) -> [String: QTChatJSONValue] {
        var p = obj
        let t = text.lowercased()
        let said = { (pattern: String) in test(pattern, in: t) }
        let byRank = wantsRankSeries(text)
        if slot != .startTime && !said("\\d\\s*(h|g|giờ|gio|:\\d)|\\b(am|pm)\\b|sáng|chiều|tối|trưa|morning|evening|o'?clock") { p["start_time"] = nil }
        if slot != .courts && !said("sân|san\\b|court") { p["courts"] = nil }
        // Gán sân theo bảng chỉ tin khi câu có nhắc cả sân lẫn bảng.
        if !said("sân|san\\b|court") || !said("bảng|bang\\b|group") { p["group_courts"] = nil }
        if slot != .series && !said("nhánh|nhanh|series|vàng|bạc|đồng|gold|silver|bronze|top\\s*\\d|bracket|vòng trong|vòng loại|knockout|playoff") && !byRank {
            p["series"] = nil; p["series_style"] = nil; p["series_sizes"] = nil; p["series_mode"] = nil
        }
        if byRank {
            p["series_mode"] = .string("by_rank")
            p["series"] = nil
            p["series_sizes"] = nil
        }
        if !said("set|bo\\d|best of|ván|van\\b") { p["default_sets"] = nil }
        return p
    }

    /// Trả lời bước số sân/giờ không cần AI: "8", "8 sân" / "7h", "19:30", "7h30". (web localSlotPatch)
    static func localSlotPatch(_ text: String, slot: QTChatSlot) -> QTChatPatch? {
        let t = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if slot == .courts {
            guard let g = firstGroups("^(\\d{1,2})\\s*(sân|san|courts?)?$", in: t),
                  let n = g[1].flatMap({ Int($0) }), (1...50).contains(n) else { return nil }
            var p = QTChatPatch()
            p.courts = Array(1...n)
            return p
        }
        if slot == .startTime {
            if test("^(bây giờ|bay gio|now)$", in: t) {
                let now = Date()
                let cal = Calendar.current
                var p = QTChatPatch()
                p.startTime = String(format: "%02d:%02d", cal.component(.hour, from: now), cal.component(.minute, from: now))
                return p
            }
            if test("^(để sau|de sau|later|skip|bỏ qua|bo qua|chưa biết|chua biet)$", in: t) {
                var p = QTChatPatch()
                p.timeDone = true
                return p
            }
            guard let g = firstGroups("^(\\d{1,2})\\s*(?:h|g|giờ|:)?\\s*(\\d{2})?$", in: t),
                  let h = g[1].flatMap({ Int($0) }) else { return nil }
            let mm = g[2].flatMap { Int($0) } ?? 0
            if h > 23 || mm > 59 { return nil }
            var p = QTChatPatch()
            p.startTime = String(format: "%02d:%02d", h, mm)
            return p
        }
        return nil
    }

    /// Số liệu do code tính, gửi kèm cho AI để nó TRẢ LỜI câu hỏi bằng con số
    /// thật thay vì tự bịa. (web chatFacts — port nguyên văn, kể cả dòng mô tả
    /// 1 bảng ở describe(): câu trả lời cuối vẫn qua replyFromDraft/factualAck
    /// phía client như web.)
    static func chatFacts(_ d: QTChatDraft, lang: String) -> String {
        let n = entryCount(d)
        if n < 2 { return "" }
        let en = lang == "en"
        let u = d.isDoubles == false ? (en ? "players" : "người") : (en ? "teams" : "đội")
        let style = d.seriesStyle ?? "series"
        func range(_ o: GroupOption) -> String {
            o.sizes[0] == o.sizes[o.sizes.count - 1] ? "\(o.sizes[0])" : "\(o.sizes[o.sizes.count - 1])–\(o.sizes[0])"
        }
        func describe(_ o: GroupOption) -> String {
            if o.groupCount < 2 { return "1 bảng vòng tròn \(n) \(u), không có vòng loại trực tiếp." }
            let a = QTSeries.plan(sizes: o.sizes, k: 1)![0]
            let wc = a.size - 2 * o.groupCount
            var lines = [
                "\(o.groupCount) bảng × \(range(o)) \(u): vòng loại trực tiếp lấy nhất và nhì \(o.groupCount) bảng = \(2 * o.groupCount)"
                + (wc > 0 ? " + \(wc) \(u) hạng 3 = \(a.size)" : "")
                + " → \(a.bracket) suất\(a.byes > 0 ? " (\(a.byes) \(u) xếp cao được nghỉ vòng đầu)" : ""); \(n - a.size) \(u) dừng ở vòng bảng."
            ]
            for k in 2...maxSeries {
                if let plan = QTSeries.plan(sizes: o.sizes, k: k) {
                    lines.append("  \(k) vòng loại mặc định: \(plan.enumerated().map { seriesLine(seriesName(style, $0.offset, "vi"), $0.element.size, $0.element.byes, "vi", u) }.joined(separator: "; ")).")
                    continue
                }
                var top = 1
                while top * 2 <= n / 2 { top *= 2 }
                let alt = resolveSeriesSizes([top] + Array(repeating: 0, count: k - 1), total: n)
                lines.append("  \(k) vòng loại theo luật mặc định: KHÔNG chia được."
                    + (alt != nil ? " Muốn \(k) vòng loại thì đặt cỡ tuỳ chỉnh, ví dụ \(alt!.enumerated().map { seriesLine(seriesName(style, $0.offset, "vi"), $0.element, QTSeedingV2.nextPowerOf2($0.element) - $0.element, "vi", u) }.joined(separator: "; "))." : ""))
            }
            return lines.joined(separator: "\n")
        }
        var options = groupChoices(n)
        let chosen = findGroupOption(n, d.groupCount)
        if let chosen, !options.contains(where: { $0.groupCount == chosen.groupCount }) { options.append(chosen) }
        let plan = draftSeriesPlan(d)
        return ([
            "Số \(u): \(n).",
            "Chia bảng: \(minGroup)–\(maxGroup) \(u) thì được đúng 1 bảng vòng tròn. Hoặc 2–\(maxGroups) bảng, mỗi bảng \(minGroup)–\(maxGroup) \(u). Một số cách:",
        ] + options.map(describe) + [
            chosen != nil ? "Đang chọn: \(chosen!.groupCount) bảng × \(range(chosen!))." : "Chưa chọn cách chia bảng.",
            (d.advancePerGroup != nil && d.groupCount != nil)
                ? "ĐÃ CHỐT: đúng \(d.advancePerGroup!) mỗi bảng = \(d.advancePerGroup! * d.groupCount!) vào vòng loại trực tiếp. KHÔNG lấy thêm hạng 3."
                : "",
            plan != nil ? "Vòng loại đang chọn: \(plan!.enumerated().map { seriesLine(seriesName(style, $0.offset, "vi"), $0.element.size, $0.element.byes, "vi", u) }.joined(separator: "; "))." : "",
            chosen != nil ? "Mỗi hạng một vòng loại: \(rankSeriesSizes(chosen!.sizes) != nil ? rankSeriesSizes(chosen!.sizes)!.enumerated().map { seriesLine(seriesName("series", $0.offset, "vi"), $0.element, QTSeedingV2.nextPowerOf2($0.element) - $0.element, "vi", u) }.joined(separator: "; ") + "." : "không tách được (một hạng cần ít nhất 2 đội).")" : "",
            "Xếp hạng toàn giải để chia vòng loại: mọi đội nhất bảng (so khác bảng bằng tỉ lệ thắng, rồi hiệu số trung bình mỗi trận, rồi điểm ghi trung bình mỗi trận), rồi mọi đội nhì, rồi hạng 3. Luật mặc định gộp nhất và nhì vào vòng đầu. \"Mỗi hạng một vòng loại\" thì nhất → Vòng loại 1, nhì → Vòng loại 2, ba → Vòng loại 3. Hạng chỉ còn 1 đội thì đội đó không đi tiếp. Vòng không chẵn 2/4/8/16/32 thì đội xếp cao được nghỉ vòng đầu.",
        ] as [String]).filter { !$0.isEmpty }.joined(separator: "\n")
    }

    /// Đúng logic bước Tạo của web create(): số nhánh hiệu lực + cỡ tuỳ chỉnh.
    static func createPlan(_ d: QTChatDraft) -> (seriesCount: Int, customSizes: [Int]?) {
        let custom = customSeries(d)
        if let custom { return (custom.count, custom) }
        return (min(d.series ?? 1, seriesCap(d)), nil)
    }

    /// Payload danh sách cho setupRoster (web buildRoster): nhãn "p1 & p2".
    static func buildRoster(_ d: QTChatDraft) -> [(name: String, p1: String, p2: String?, team: String?, seed: Int?)] {
        (d.entries ?? []).map { (name: $0.label, p1: $0.p1, p2: $0.p2, team: $0.team, seed: $0.seed) }
    }
}

extension QTChatEngine {
    /// Ghép các dòng tên lẻ thành đội (web pairEntries): sequential = 1+2,
    /// 3+4…; random = trộn rồi ghép; each_line = giữ nguyên (mỗi dòng 1 đội).
    static func pairEntries(_ entries: [QTChatEntry], mode: String) -> [QTChatEntry] {
        if mode == "each_line" { return entries }
        var list = entries
        if mode == "random" { list.shuffle() }
        var out: [QTChatEntry] = []
        var i = 0
        while i + 1 < list.count {
            let a = list[i]
            let b = list[i + 1]
            out.append(QTChatEntry(p1: a.p1, p2: b.p1,
                                   team: (a.team != nil && a.team == b.team) ? a.team : nil))
            i += 2
        }
        return out
    }

    /// Dòng mô tả vòng loại đang chọn (cho câu trả lời sau khi đổi cỡ nhánh —
    /// web QuickTableChat.send nối thêm khi series_sizes vừa đổi).
    static func seriesPlanLine(_ d: QTChatDraft, lang: String) -> String? {
        guard let plan = draftSeriesPlan(d) else { return nil }
        let style = d.seriesStyle ?? "series"
        let u = unit(d, lang)
        return plan.enumerated()
            .map { seriesLine(seriesName(style, $0.offset, lang), $0.element.size, $0.element.byes, lang, u) }
            .joined(separator: " · ")
    }

    /// Đơn vị đếm theo thể thức + ngôn ngữ (web copy unit()).
    static func unit(_ d: QTChatDraft, _ lang: String) -> String {
        if lang == "en" { return d.isDoubles == false ? "players" : "teams" }
        return d.isDoubles == false ? "người" : "đội"
    }
}

extension QTChatEngine {
    /// Câu "nháp chưa đổi" — một nguồn duy nhất (view model so khớp chuỗi này
    /// để nhận biết lượt không thay đổi nháp, như web).
    static func unchangedReply(_ lang: String) -> String {
        lang == "en" ? unchangedEN : unchangedVI
    }
}
