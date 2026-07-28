import Foundation

// ============================================================================
// Matchmaking — Mexicano + Round Robin cho sự kiện giao lưu.
// Port 1:1 từ web `src/lib/matchmaking/index.ts` (mulberry32 PRNG, zigzag
// Mexicano, greedy Round Robin, cân bằng DUPR khi coverage ≥75%).
// Pure — không đụng DB; MMPlayer.id = event_registrations.id.
// ============================================================================

struct MMPlayer: Identifiable, Equatable {
    let id: String
    let name: String
    /// DUPR/self-rated level dùng seed vòng 1 Mexicano + cân bằng cặp.
    let level: Double?
}

struct MMMatch: Equatable {
    let round: Int
    let court: Int
    let teamA: (MMPlayer, MMPlayer)
    let teamB: (MMPlayer, MMPlayer)

    static func == (lhs: MMMatch, rhs: MMMatch) -> Bool {
        lhs.round == rhs.round && lhs.court == rhs.court &&
        lhs.teamA == rhs.teamA && lhs.teamB == rhs.teamB
    }
}

struct MMRound {
    let round: Int
    let matches: [MMMatch]
    let sittingOut: [MMPlayer]
    /// Độ công bằng combined-DUPR của vòng (0..1); chỉ set khi balanced bật.
    var fairness: Double? = nil
}

struct MMSchedule {
    let rounds: [MMRound]
    let playerCount: Int
    let format: MMFormat
    var balancedPairingApplied: Bool = false
    var duprCoverage: Double = 0
}

enum MMFormat: String, CaseIterable {
    case mexicano
    case roundRobin = "round_robin"

    var label: String { self == .mexicano ? "Mexicano" : String(localized: "Vòng tròn") }
}

enum Matchmaking {

    // MARK: PRNG (mulberry32 — khớp web để cùng thuật toán, không cần cùng output)

    struct Rng {
        private var s: UInt32
        init(seed: UInt64) { s = UInt32(truncatingIfNeeded: seed) }
        mutating func next() -> Double {
            s = s &+ 0x6d2b79f5
            var t = UInt32(s)
            t = (t ^ (t >> 15)) &* (t | 1)
            t ^= t &+ (t ^ (t >> 7)) &* (t | 61)
            return Double((t ^ (t >> 14))) / 4294967296.0
        }
    }

    static func shuffle<T>(_ arr: [T], _ rng: inout Rng) -> [T] {
        var out = arr
        guard out.count > 1 else { return out }
        for i in stride(from: out.count - 1, through: 1, by: -1) {
            let j = Int(rng.next() * Double(i + 1))
            out.swapAt(i, min(j, i))
        }
        return out
    }

    private static func partnerKey(_ a: String, _ b: String) -> String {
        a < b ? "\(a)|\(b)" : "\(b)|\(a)"
    }

    // MARK: Mexicano

    private struct PairTrial {
        var teams: [(MMPlayer, MMPlayer)] = []
        var repeats = 0
        var totalDiff = 0.0
    }

    /// Ghép nhóm 4 theo zigzag, tránh lặp cặp; khi preferBalanced thì phá hoà
    /// bằng chênh lệch tổng level (score = repeats*100 + diff, khớp web).
    private static func pairAvoidingRepeats(
        _ seeded: [MMPlayer], _ prevPartners: Set<String>,
        _ rng: inout Rng, preferBalanced: Bool
    ) -> PairTrial {
        var trial = PairTrial()
        var i = 0
        while i + 4 <= seeded.count {
            let g = Array(seeded[i..<(i + 4)])
            let candidates: [[(MMPlayer, MMPlayer)]] = [
                [(g[0], g[3]), (g[1], g[2])],
                [(g[0], g[2]), (g[1], g[3])],
                [(g[0], g[1]), (g[2], g[3])],
            ]
            var best: (pair: [(MMPlayer, MMPlayer)], r: Int, diff: Double, score: Double)?
            for opt in shuffle(candidates, &rng) {
                let r = opt.reduce(0) { acc, team in
                    acc + (prevPartners.contains(partnerKey(team.0.id, team.1.id)) ? 1 : 0)
                }
                let sumA = (opt[0].0.level ?? 0) + (opt[0].1.level ?? 0)
                let sumB = (opt[1].0.level ?? 0) + (opt[1].1.level ?? 0)
                let diff = abs(sumA - sumB)
                let score = preferBalanced ? Double(r) * 100 + diff : Double(r)
                if best == nil || score < best!.score { best = (opt, r, diff, score) }
                if !preferBalanced && r == 0 { break }
            }
            if let best {
                trial.teams.append(best.pair[0])
                trial.teams.append(best.pair[1])
                trial.repeats += best.r
                trial.totalDiff += best.diff
            }
            i += 4
        }
        return trial
    }

    static func generateMexicano(
        players: [MMPlayer], rounds: Int, courtCount: Int,
        seed: UInt64, preferBalanced: Bool = false
    ) -> MMSchedule {
        guard players.count >= 4 else {
            return MMSchedule(rounds: [], playerCount: players.count, format: .mexicano)
        }
        let withLevel = players.filter { $0.level != nil }.count
        let coverage = Double(withLevel) / Double(players.count)
        let useBalanced = preferBalanced && coverage >= 0.75

        // Seed vòng 1 theo level giảm dần (nil cuối), tie-break theo tên.
        let seeded = players.sorted {
            let la = $0.level ?? -.infinity, lb = $1.level ?? -.infinity
            if la != lb { return la > lb }
            return $0.name.localizedCompare($1.name) == .orderedAscending
        }

        var out: [MMRound] = []
        var partnerHistory = Set<String>()
        var rng = Rng(seed: seed)

        for r in 1...max(1, rounds) {
            let roster = r == 1 ? seeded : shuffle(seeded, &rng)
            var best: PairTrial?
            let attempts = r == 1 ? 1 : 30
            for i in 0..<attempts {
                let arrangement = i == 0 ? roster : shuffle(roster, &rng)
                let candidate = pairAvoidingRepeats(arrangement, partnerHistory, &rng, preferBalanced: useBalanced)
                if best == nil || candidate.repeats < best!.repeats {
                    best = candidate
                } else if useBalanced && candidate.repeats == best!.repeats && candidate.totalDiff < best!.totalDiff {
                    best = candidate
                }
                if !useBalanced && best!.repeats == 0 { break }
            }
            guard let picked = best else {
                out.append(MMRound(round: r, matches: [], sittingOut: []))
                continue
            }

            var matches: [MMMatch] = []
            var idx = 0
            while idx + 1 < picked.teams.count {
                let courtIdx = idx / 2
                if courtIdx >= courtCount { break }
                matches.append(MMMatch(round: r, court: courtIdx + 1,
                                       teamA: picked.teams[idx], teamB: picked.teams[idx + 1]))
                idx += 2
            }
            // Chỉ ghi lịch sử cặp từ trận THẬT SỰ diễn ra (sau cap courtCount).
            for m in matches {
                partnerHistory.insert(partnerKey(m.teamA.0.id, m.teamA.1.id))
                partnerHistory.insert(partnerKey(m.teamB.0.id, m.teamB.1.id))
            }
            let usedIds = Set(matches.flatMap { [$0.teamA.0.id, $0.teamA.1.id, $0.teamB.0.id, $0.teamB.1.id] })
            let sittingOut = roster.filter { !usedIds.contains($0.id) }

            var fairness: Double?
            if useBalanced && !matches.isEmpty {
                let diffs = matches.map { m -> Double in
                    let sumA = (m.teamA.0.level ?? 0) + (m.teamA.1.level ?? 0)
                    let sumB = (m.teamB.0.level ?? 0) + (m.teamB.1.level ?? 0)
                    return abs(sumA - sumB)
                }
                let avg = diffs.reduce(0, +) / Double(diffs.count)
                fairness = max(0, 1 - avg / 2)
            }
            out.append(MMRound(round: r, matches: matches, sittingOut: sittingOut, fairness: fairness))
        }
        return MMSchedule(rounds: out, playerCount: players.count, format: .mexicano,
                          balancedPairingApplied: useBalanced, duprCoverage: coverage)
    }

    // MARK: Round Robin

    static func generateRoundRobin(
        players: [MMPlayer], rounds: Int, courtCount: Int, seed: UInt64
    ) -> MMSchedule {
        guard players.count >= 4 else {
            return MMSchedule(rounds: [], playerCount: players.count, format: .roundRobin)
        }
        var rng = Rng(seed: seed)
        var partnerCount: [String: Int] = [:]
        var opponentCount: [String: Int] = [:]
        func bump(_ map: inout [String: Int], _ a: String, _ b: String) {
            map[partnerKey(a, b), default: 0] += 1
        }
        func count(_ map: [String: Int], _ a: String, _ b: String) -> Int {
            map[partnerKey(a, b)] ?? 0
        }

        var out: [MMRound] = []
        for r in 1...max(1, rounds) {
            var matches: [MMMatch] = []
            var remaining = shuffle(players, &rng)
            var courtIdx = 0

            while remaining.count >= 4 && courtIdx < courtCount {
                let p1 = remaining.removeFirst()
                // Partner = người ghép cùng ít nhất.
                var bestIdx = 0, bestScore = Int.max
                for (i, p) in remaining.enumerated() {
                    let s = count(partnerCount, p1.id, p.id)
                    if s < bestScore { bestScore = s; bestIdx = i }
                }
                let p2 = remaining.remove(at: bestIdx)

                var p3Idx = 0, p3Score = Int.max
                for (i, p) in remaining.enumerated() {
                    let s = count(opponentCount, p1.id, p.id) + count(opponentCount, p2.id, p.id)
                    if s < p3Score { p3Score = s; p3Idx = i }
                }
                let p3 = remaining.remove(at: p3Idx)

                var p4Idx = 0, p4Score = Int.max
                for (i, p) in remaining.enumerated() {
                    let s = count(opponentCount, p1.id, p.id) + count(opponentCount, p2.id, p.id)
                        + count(partnerCount, p3.id, p.id)
                    if s < p4Score { p4Score = s; p4Idx = i }
                }
                let p4 = remaining.remove(at: p4Idx)

                matches.append(MMMatch(round: r, court: courtIdx + 1, teamA: (p1, p2), teamB: (p3, p4)))
                bump(&partnerCount, p1.id, p2.id)
                bump(&partnerCount, p3.id, p4.id)
                bump(&opponentCount, p1.id, p3.id)
                bump(&opponentCount, p1.id, p4.id)
                bump(&opponentCount, p2.id, p3.id)
                bump(&opponentCount, p2.id, p4.id)
                courtIdx += 1
            }
            out.append(MMRound(round: r, matches: matches, sittingOut: remaining))
        }
        return MMSchedule(rounds: out, playerCount: players.count, format: .roundRobin)
    }

    // MARK: Convenience

    static func generate(
        format: MMFormat, players: [MMPlayer], rounds: Int, courtCount: Int,
        seed: UInt64, preferBalanced: Bool = false
    ) -> MMSchedule {
        format == .mexicano
            ? generateMexicano(players: players, rounds: rounds, courtCount: courtCount,
                               seed: seed, preferBalanced: preferBalanced)
            : generateRoundRobin(players: players, rounds: rounds, courtCount: courtCount, seed: seed)
    }

    /// Text thuần để copy vào Zalo (port `scheduleToText`, tiếng Việt).
    // Xuất lịch cho Zalo — GIỮ tiếng Việt cố định, ngôn ngữ người nhận ≠ ngôn ngữ UI (proposal native-bilingual inc.2)
    static func scheduleToText(_ schedule: MMSchedule) -> String {
        var lines: [String] = []
        for r in schedule.rounds {
            lines.append("Vòng \(r.round)")
            if r.matches.isEmpty { lines.append("  (chưa có trận)") }
            for m in r.matches {
                let a = "\(m.teamA.0.name) & \(m.teamA.1.name)"
                let b = "\(m.teamB.0.name) & \(m.teamB.1.name)"
                lines.append("  Sân \(m.court): \(a)  vs  \(b)")
            }
            if !r.sittingOut.isEmpty {
                lines.append("  Ngồi ngoài: \(r.sittingOut.map(\.name).joined(separator: ", "))")
            }
            lines.append("")
        }
        return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
