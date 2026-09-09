import Foundation

struct ProTourEvent: Codable, Equatable, Identifiable, Sendable {
    let slug: String
    let namePattern: String
    let nameEN: String
    let nameVI: String
    let tier: String
    let tour: String
    let sponsor: String?
    let city: String
    let country: String
    let countryCode: String
    let venue: String?
    let startDate: String
    let endDate: String
    let officialURL: String
    let bracketsURL: String
    let prizeMoney: String?
    let logoURL: String?
    let brandBackground: String?

    var id: String { slug }

    var logoRemoteURL: URL? {
        guard let logoURL, !logoURL.isEmpty else { return nil }
        if let absolute = URL(string: logoURL), absolute.scheme != nil { return absolute }
        return URL(string: logoURL, relativeTo: URL(string: "https://www.thepicklehub.net"))?.absoluteURL
    }

    enum CodingKeys: String, CodingKey {
        case slug, tier, tour, sponsor, city, country, venue
        case namePattern = "name_pattern"
        case nameEN = "name_en"
        case nameVI = "name_vi"
        case countryCode = "country_code"
        case startDate = "start_date"
        case endDate = "end_date"
        case officialURL = "official_url"
        case bracketsURL = "brackets_url"
        case prizeMoney = "prize_money"
        case logoURL = "logo_url"
        case brandBackground = "brand_bg"
    }
}

enum ProTourEventPhase: Equatable, Sendable {
    case upcoming, live, finished
}

extension ProTourEvent {
    private static let eventTimeZone = TimeZone(secondsFromGMT: 8 * 3_600)!

    func window(calendar inputCalendar: Calendar = Calendar(identifier: .gregorian)) -> (start: Date, end: Date)? {
        var calendar = inputCalendar
        calendar.timeZone = Self.eventTimeZone
        guard let start = Self.date(startDate, hour: 0, minute: 0, second: 0, calendar: calendar),
              let end = Self.date(endDate, hour: 23, minute: 59, second: 59, calendar: calendar) else { return nil }
        return (start, end)
    }

    func phase(at now: Date = Date()) -> ProTourEventPhase {
        guard let window = window() else { return .finished }
        if now < window.start { return .upcoming }
        if now > window.end { return .finished }
        return .live
    }

    func shouldAppearOnLive(at now: Date = Date()) -> Bool {
        guard let window = window() else { return false }
        return now >= window.start.addingTimeInterval(-7 * 86_400)
            && now <= window.end.addingTimeInterval(14 * 86_400)
    }

    func formattedDates(language: String) -> String {
        guard let start = Self.parts(startDate), let end = Self.parts(endDate) else {
            return "\(startDate) – \(endDate)"
        }
        if language == "vi" {
            if start.month == end.month && start.year == end.year {
                return "\(start.day)–\(end.day)/\(start.month)/\(start.year)"
            }
            let startYear = start.year == end.year ? "" : "/\(start.year)"
            return "\(start.day)/\(start.month)\(startYear) – \(end.day)/\(end.month)/\(end.year)"
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")
        let month = formatter.monthSymbols[start.month - 1]
        if start.month == end.month && start.year == end.year {
            return "\(month) \(start.day)–\(end.day), \(start.year)"
        }
        let endMonth = formatter.monthSymbols[end.month - 1]
        let startYear = start.year == end.year ? "" : ", \(start.year)"
        return "\(month) \(start.day)\(startYear) – \(endMonth) \(end.day), \(end.year)"
    }

    private static func parts(_ value: String) -> (year: Int, month: Int, day: Int)? {
        let values = value.split(separator: "-").compactMap { Int($0) }
        guard values.count == 3 else { return nil }
        return (values[0], values[1], values[2])
    }

    private static func date(
        _ value: String,
        hour: Int,
        minute: Int,
        second: Int,
        calendar: Calendar
    ) -> Date? {
        guard let parts = parts(value) else { return nil }
        return calendar.date(from: DateComponents(
            timeZone: eventTimeZone,
            year: parts.year,
            month: parts.month,
            day: parts.day,
            hour: hour,
            minute: minute,
            second: second
        ))
    }
}

struct ProResultParticipant: Codable, Equatable, Sendable {
    struct Profile: Codable, Equatable, Sendable {
        let displayName: String?
        let username: String?

        enum CodingKeys: String, CodingKey {
            case displayName = "display_name"
            case username
        }
    }

    let team: String?
    let position: Int?
    let profile: Profile?
}

struct ProResultRow: Codable, Equatable, Sendable {
    let id: String
    let slug: String
    let tournamentName: String?
    let tournamentEvent: String?
    let roundName: String?
    let teamAScore: [Int]?
    let teamBScore: [Int]?
    let winningTeam: String?
    let playedAt: String?
    let courtNumber: String?
    let notes: String?
    let matchParticipants: [ProResultParticipant]?

    enum CodingKeys: String, CodingKey {
        case id, slug, notes
        case tournamentName = "tournament_name"
        case tournamentEvent = "tournament_event"
        case roundName = "round_name"
        case teamAScore = "team_a_score"
        case teamBScore = "team_b_score"
        case winningTeam = "winning_team"
        case playedAt = "played_at"
        case courtNumber = "court_number"
        case matchParticipants = "match_participants"
    }
}

struct ProResultPlayer: Equatable, Sendable {
    let name: String
    let username: String?
    let isVietnamese: Bool
}

struct ProResultGame: Equatable, Sendable {
    let a: Int
    let b: Int
}

struct ProResultMatch: Equatable, Identifiable, Sendable {
    let id: String
    let slug: String
    let round: String
    let teamA: [ProResultPlayer]
    let teamB: [ProResultPlayer]
    let games: [ProResultGame]
    let winner: String?
    let courtNumber: String?
    let playedAt: String?
    let isLive: Bool
    let hasVietnamesePlayer: Bool

    var scoreLine: String { games.map { "\($0.a)-\($0.b)" }.joined(separator: ", ") }
}

struct ProResultRound: Equatable, Identifiable, Sendable {
    let code: String
    let labelEN: String
    let labelVI: String
    let matches: [ProResultMatch]
    var id: String { code }
}

enum ProEventKey: String, Equatable, Sendable {
    case mensSingles, womensSingles, mensDoubles, womensDoubles, mixedDoubles, other
}

struct ProResultEvent: Equatable, Identifiable, Sendable {
    let key: ProEventKey
    let name: String
    let labelEN: String
    let labelVI: String
    let rounds: [ProResultRound]
    let matchCount: Int
    let champion: [ProResultPlayer]?
    var id: String { name }
}

struct ProResults: Equatable, Sendable {
    let events: [ProResultEvent]
    let total: Int
    let vietnamCount: Int

    static let empty = ProResults(events: [], total: 0, vietnamCount: 0)
}

struct ProLiveMatch: Equatable, Identifiable, Sendable {
    let match: ProResultMatch
    let eventLabel: String
    var id: String { match.id }
}

enum ProResultsLogic {
    private struct RoundInfo { let rank: Int; let en: String; let vi: String }
    private struct EventInfo { let rank: Int; let en: String; let vi: String }

    private static let roundInfo: [String: RoundInfo] = [
        "F": .init(rank: 0, en: "Final", vi: "Chung kết"),
        "3P": .init(rank: 1, en: "Bronze medal match", vi: "Tranh hạng 3"),
        "SF": .init(rank: 2, en: "Semifinals", vi: "Bán kết"),
        "QF": .init(rank: 3, en: "Quarterfinals", vi: "Tứ kết"),
        "R16": .init(rank: 4, en: "Round of 16", vi: "Vòng 16"),
        "R32": .init(rank: 5, en: "Round of 32", vi: "Vòng 32"),
        "R64": .init(rank: 6, en: "Round of 64", vi: "Vòng 64"),
        "W": .init(rank: 7, en: "Early rounds", vi: "Vòng đầu"),
        "L": .init(rank: 8, en: "Consolation bracket", vi: "Nhánh thua"),
        "GS": .init(rank: 9, en: "Group stage", vi: "Vòng bảng"),
    ]
    private static let eventInfo: [ProEventKey: EventInfo] = [
        .mensSingles: .init(rank: 0, en: "Men's Singles", vi: "Đơn nam"),
        .womensSingles: .init(rank: 1, en: "Women's Singles", vi: "Đơn nữ"),
        .mensDoubles: .init(rank: 2, en: "Men's Doubles", vi: "Đôi nam"),
        .womensDoubles: .init(rank: 3, en: "Women's Doubles", vi: "Đôi nữ"),
        .mixedDoubles: .init(rank: 4, en: "Mixed Doubles", vi: "Đôi nam nữ"),
        .other: .init(rank: 5, en: "Other", vi: "Khác"),
    ]

    static func classifyEvent(_ name: String?) -> ProEventKey {
        let value = (name ?? "").lowercased()
        if matches(value, #"mixed|mx\b|xd\b"#) { return .mixedDoubles }
        let women = matches(value, #"women|ladies|female|\bwd\b|\bws\b"#)
        let men = matches(value, #"\bmen|male|\bmd\b|\bms\b"#) && !women
        let singles = matches(value, #"singles?|\bms\b|\bws\b"#)
        let doubles = matches(value, #"doubles?|\bmd\b|\bwd\b"#)
        if women && singles { return .womensSingles }
        if women && doubles { return .womensDoubles }
        if men && singles { return .mensSingles }
        if men && doubles { return .mensDoubles }
        return .other
    }

    static func roundLabel(_ code: String, language: String) -> String {
        guard let info = roundInfo[code] else { return code }
        return language == "vi" ? info.vi : info.en
    }

    static func group(_ input: [ProResultRow]) -> ProResults {
        let proRows = input.filter { matches($0.tournamentEvent ?? "", #"\bpro\b"#, caseInsensitive: true) }
        let rows = proRows.isEmpty ? input : proRows
        let grouped = Dictionary(grouping: rows) { row in
            let name = row.tournamentEvent?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return name.isEmpty ? "Pro" : name
        }

        var vietnamCount = 0
        var events: [ProResultEvent] = grouped.map { name, rows in
            let key = classifyEvent(name)
            var rounds: [String: [ProResultMatch]] = [:]
            for row in rows {
                let teamA = players(row.matchParticipants, team: "a")
                let teamB = players(row.matchParticipants, team: "b")
                guard !teamA.isEmpty || !teamB.isEmpty else { continue }
                let round = row.roundName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "UNKNOWN"
                let hasVietnam = (teamA + teamB).contains(where: \.isVietnamese)
                if hasVietnam { vietnamCount += 1 }
                let winner = ["a", "b"].contains(row.winningTeam ?? "") ? row.winningTeam : nil
                let match = ProResultMatch(
                    id: row.id,
                    slug: row.slug,
                    round: round,
                    teamA: teamA,
                    teamB: teamB,
                    games: games(row.teamAScore, row.teamBScore),
                    winner: winner,
                    courtNumber: row.courtNumber,
                    playedAt: row.playedAt,
                    isLive: row.winningTeam == nil && matches(row.notes ?? "", #"\"live\"\s*:\s*true"#),
                    hasVietnamesePlayer: hasVietnam
                )
                rounds[round, default: []].append(match)
            }

            let finalMatches = rounds["F"] ?? []
            let champion: [ProResultPlayer]? = if finalMatches.count == 1, let winner = finalMatches[0].winner {
                winner == "a" ? finalMatches[0].teamA : finalMatches[0].teamB
            } else { nil }
            let resultRounds = rounds.map { code, matches in
                ProResultRound(
                    code: code,
                    labelEN: roundLabel(code, language: "en"),
                    labelVI: roundLabel(code, language: "vi"),
                    matches: matches.sorted(by: matchOrder)
                )
            }.sorted { (roundInfo[$0.code]?.rank ?? 99) < (roundInfo[$1.code]?.rank ?? 99) }
            let info = eventInfo[key]!
            let qualifier = matches(name, "qualif", caseInsensitive: true)
            return ProResultEvent(
                key: key,
                name: name,
                labelEN: info.en + (qualifier ? " — Qualifier" : ""),
                labelVI: info.vi + (qualifier ? " — Vòng loại" : ""),
                rounds: resultRounds,
                matchCount: resultRounds.reduce(0) { $0 + $1.matches.count },
                champion: champion
            )
        }
        events.sort {
            let lhs = eventInfo[$0.key]!.rank
            let rhs = eventInfo[$1.key]!.rank
            return lhs == rhs ? $0.name.localizedCompare($1.name) == .orderedAscending : lhs < rhs
        }
        return ProResults(
            events: events,
            total: events.reduce(0) { $0 + $1.matchCount },
            vietnamCount: vietnamCount
        )
    }

    static func filter(_ results: ProResults, query: String) -> ProResults {
        let needle = fold(query)
        guard !needle.isEmpty else { return results }
        let events: [ProResultEvent] = results.events.compactMap { event in
            let rounds = event.rounds.compactMap { round -> ProResultRound? in
                let matches = round.matches.filter { match in
                    (match.teamA + match.teamB).contains { fold($0.name).contains(needle) }
                }
                return matches.isEmpty ? nil : ProResultRound(
                    code: round.code,
                    labelEN: round.labelEN,
                    labelVI: round.labelVI,
                    matches: matches
                )
            }
            guard !rounds.isEmpty else { return nil }
            return ProResultEvent(
                key: event.key,
                name: event.name,
                labelEN: event.labelEN,
                labelVI: event.labelVI,
                rounds: rounds,
                matchCount: rounds.reduce(0) { $0 + $1.matches.count },
                champion: event.champion
            )
        }
        return ProResults(
            events: events,
            total: events.reduce(0) { $0 + $1.matchCount },
            vietnamCount: events.flatMap(\.rounds).flatMap(\.matches).filter(\.hasVietnamesePlayer).count
        )
    }

    static func liveMatches(_ results: ProResults, language: String) -> [ProLiveMatch] {
        results.events.flatMap { event in
            event.rounds.flatMap { round in
                round.matches.filter(\.isLive).map {
                    ProLiveMatch(match: $0, eventLabel: language == "vi" ? event.labelVI : event.labelEN)
                }
            }
        }.sorted {
            ($0.match.playedAt ?? "", $0.match.slug) < ($1.match.playedAt ?? "", $1.match.slug)
        }
    }

    static func playersLine(_ players: [ProResultPlayer]) -> String {
        players.isEmpty ? "—" : players.map(\.name).joined(separator: " / ")
    }

    private static func players(_ participants: [ProResultParticipant]?, team: String) -> [ProResultPlayer] {
        (participants ?? [])
            .filter { ($0.team ?? "").lowercased() == team }
            .sorted { ($0.position ?? 0) < ($1.position ?? 0) }
            .map {
                let name = $0.profile?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "—"
                return ProResultPlayer(
                    name: name,
                    username: $0.profile?.username,
                    isVietnamese: isVietnameseName(name)
                )
            }
    }

    private static func games(_ a: [Int]?, _ b: [Int]?) -> [ProResultGame] {
        let count = max(a?.count ?? 0, b?.count ?? 0)
        var output: [ProResultGame] = []
        for index in 0..<count {
            let game = ProResultGame(a: a?[safe: index] ?? 0, b: b?[safe: index] ?? 0)
            if game.a == 0 && game.b == 0 && index == count - 1 && !output.isEmpty { continue }
            output.append(game)
        }
        return output
    }

    private static func matchOrder(_ lhs: ProResultMatch, _ rhs: ProResultMatch) -> Bool {
        if lhs.isLive != rhs.isLive { return lhs.isLive }
        if lhs.playedAt != rhs.playedAt { return (lhs.playedAt ?? "") < (rhs.playedAt ?? "") }
        return lhs.slug < rhs.slug
    }

    private static func fold(_ value: String) -> String {
        value.replacingOccurrences(of: "\u{0111}", with: "d")
            .replacingOccurrences(of: "\u{0110}", with: "D")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "vi_VN"))
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func isVietnameseName(_ name: String) -> Bool {
        if name.unicodeScalars.contains(where: { $0.value == 0x0111 || $0.value == 0x0110 }) { return true }
        let decomposed = name.decomposedStringWithCanonicalMapping
        if decomposed.unicodeScalars.contains(where: { [0x031B, 0x0323, 0x0309].contains(Int($0.value)) }) {
            return true
        }
        let surnames: Set<String> = [
            "nguyen", "tran", "le", "pham", "hoang", "huynh", "phan", "vu", "vo", "dang",
            "bui", "do", "ho", "ngo", "duong", "ly", "dao", "dinh", "trinh", "cao", "doan",
            "ha", "luong", "luu", "mai", "truong", "chau", "quach", "ton", "thai", "dam",
            "khuc", "kieu", "lam", "lai", "ma", "nghiem", "ong", "ta", "ung",
        ]
        let tokens = fold(name).split { !$0.isLetter }.map(String.init)
        return !surnames.isDisjoint(with: tokens)
    }

    private static func matches(
        _ value: String,
        _ pattern: String,
        caseInsensitive: Bool = false
    ) -> Bool {
        var options: String.CompareOptions = .regularExpression
        if caseInsensitive { options.insert(.caseInsensitive) }
        return value.range(of: pattern, options: options) != nil
    }
}

private extension String {
    var nilIfBlank: String? { isEmpty ? nil : self }
}

private extension Collection {
    subscript(safe index: Index) -> Element? { indices.contains(index) ? self[index] : nil }
}
