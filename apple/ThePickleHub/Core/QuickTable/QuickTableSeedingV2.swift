import Foundation

/// Generalized playoff seeding for Quick Table — Swift port của web `quick-table-seeding-v2.ts`.
///
/// Hỗ trợ MỌI số bảng + 2 chế độ lấy suất:
///   advancePerGroup = 2 → top-2 mỗi bảng + best 3rd-place wildcards (tổng quát hoá QTPlayoff cũ)
///   advancePerGroup = 1 → nhất bảng + best runner-up (nhì xuất sắc nhất)
///
/// Pure — không DB, không side effect. Tách riêng, KHÔNG đụng `QTPlayoff` cũ (đường rollback +
/// các số bảng 2/4/8 vẫn chạy bảng cứng nếu tắt v2). Tái dùng `DEBracket.seedPositions`.
enum QTSeedingV2 {

    // Bật thuật toán seeding tổng quát (thay QTPlayoff bảng cứng). Số người vào playoff
    // (advancePerGroup = 1 hoặc 2 → cỡ bracket) do người dùng chọn lúc Start Playoff;
    // xem QuickTableViewModel.bracketOptionsV2 / .startPlayoff. BYE tự tính.
    static let enabled = true

    enum Tier: String { case winner, runnerUp = "runner_up", wildcard, bye }

    struct Seeded: Equatable {
        let playerID: UUID?      // nil = BYE
        let name: String
        let seed: Int
        let sourceGroupID: UUID?
        let wins: Int
        let pointDiff: Int
        let pointsFor: Int
        let tier: Tier
    }

    struct Plan: Equatable {
        let groupCount: Int
        let advancePerGroup: Int
        let directSpots: Int
        let bracketSize: Int
        let wildcardCount: Int
        let takeKthPlace: Int
        let feasible: Bool
        let note: String
    }

    struct SeedingError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static func nextPowerOf2(_ n: Int) -> Int {
        var p = 1
        while p < n { p *= 2 }
        return p
    }

    private static func ordinal(_ n: Int) -> String { n == 2 ? "2nd" : n == 3 ? "3rd" : "\(n)th" }

    /// Pure math — kế hoạch seeding không cần dữ liệu người chơi.
    static func computeSeedingPlan(groupCount: Int, advancePerGroup A: Int,
                                   bracketSizeOverride: Int? = nil) -> Plan {
        let direct = groupCount * A
        let bracket = bracketSizeOverride ?? nextPowerOf2(direct)
        let wildcard = max(0, bracket - direct)
        let feasible = wildcard <= groupCount
        let note: String
        if wildcard == 0 { note = "Clean bracket — no wildcards needed" }
        else if feasible { note = "Take \(wildcard) best \(ordinal(A + 1))-place" }
        else { note = "Infeasible: need \(wildcard) wildcards but only \(groupCount) candidates — padded with BYEs" }
        return Plan(groupCount: groupCount, advancePerGroup: A, directSpots: direct, bracketSize: bracket,
                    wildcardCount: wildcard, takeKthPlace: A + 1, feasible: feasible, note: note)
    }

    /// point_diff của người hạng (A+1) CHỈ tính các trận gặp top-A trong bảng (web computeBest3rdAdjustedStats).
    static func adjustedStats(player: QTPlayer, matches: [QTMatch], topIDs: Set<UUID>)
        -> (wins: Int, diff: Int, pf: Int) {
        var wins = 0, diff = 0, pf = 0
        for m in matches {
            guard let s1 = m.score1, let s2 = m.score2,
                  let p1 = m.player1ID, let p2 = m.player2ID else { continue }
            if p1 == player.id, topIDs.contains(p2) {
                diff += s1 - s2; pf += s1; if s1 > s2 { wins += 1 }
            } else if p2 == player.id, topIDs.contains(p1) {
                diff += s2 - s1; pf += s2; if s2 > s1 { wins += 1 }
            }
        }
        return (wins, diff, pf)
    }

    private static func byRecord(_ a: QTPlayer, _ b: QTPlayer) -> Bool {
        if a.matchesWon != b.matchesWon { return a.matchesWon > b.matchesWon }
        if a.pointDiff != b.pointDiff { return a.pointDiff > b.pointDiff }
        return a.pointsFor > b.pointsFor
    }

    private static func rankInGroup(_ players: [QTPlayer], groupID: UUID) -> [QTPlayer] {
        players.filter { $0.groupID == groupID }.sorted(by: byRecord)
    }

    /// Seeding tổng quát cho N bảng, A người/bảng. Trả mảng dài đúng bracketSize (đã pad BYE).
    static func generateSeeding(groups: [QTGroup], players: [QTPlayer], matches: [QTMatch],
                                advancePerGroup A: Int) throws -> (seeded: [Seeded], plan: Plan) {
        let G = groups.count
        guard G >= 2 else { throw SeedingError(message: "Cần ≥ 2 bảng, có \(G)") }

        let plan = computeSeedingPlan(groupCount: G, advancePerGroup: A)
        let ranked = groups.map { rankInGroup(players, groupID: $0.id) }
        for (i, r) in ranked.enumerated() where r.count < A {
            throw SeedingError(message: "Bảng \(groups[i].name) có ít hơn \(A) người")
        }

        let groupMatches = matches.filter { !$0.isPlayoff }
        var seeded: [Seeded] = []
        var seed = 1
        func push(_ p: QTPlayer, _ gid: UUID, _ tier: Tier) {
            seeded.append(Seeded(playerID: p.id, name: p.name, seed: seed, sourceGroupID: gid,
                                 wins: p.matchesWon, pointDiff: p.pointDiff, pointsFor: p.pointsFor, tier: tier))
            seed += 1
        }

        // 1) Suất trực tiếp: tầng theo vị trí 0..A-1 (nhất → nhì), mỗi tầng sort riêng.
        for pos in 0..<A {
            let tier: Tier = pos == 0 ? .winner : .runnerUp
            let tierPlayers = ranked.enumerated().compactMap { gi, r -> (p: QTPlayer, gid: UUID)? in
                guard pos < r.count else { return nil }
                return (r[pos], groups[gi].id)
            }.sorted { byRecord($0.p, $1.p) }
            for tp in tierPlayers { push(tp.p, tp.gid, tier) }
        }

        // 2) Wildcard pool = người ở vị trí A ((A+1)-th) của mỗi bảng.
        if plan.wildcardCount > 0 {
            struct WC { let p: QTPlayer; let gid: UUID; let w: Int; let d: Int; let f: Int }
            let pool: [WC] = ranked.enumerated().compactMap { gi, r in
                guard A < r.count else { return nil }
                let p = r[A]
                let gid = groups[gi].id
                if A == 2 {
                    // chuẩn hoá "chỉ tính trận gặp top-2" (giống generateGlobalSeeding cũ)
                    let topIDs = Set(r.prefix(A).map { $0.id })
                    let adj = adjustedStats(player: p, matches: groupMatches, topIDs: topIDs)
                    return WC(p: p, gid: gid, w: adj.wins, d: adj.diff, f: adj.pf)
                }
                // A == 1: runner-up đã đá đủ vòng bảng → dùng full record
                return WC(p: p, gid: gid, w: p.matchesWon, d: p.pointDiff, f: p.pointsFor)
            }.sorted { a, b in
                if a.w != b.w { return a.w > b.w }
                if a.d != b.d { return a.d > b.d }
                return a.f > b.f
            }
            for wc in pool.prefix(plan.wildcardCount) { push(wc.p, wc.gid, .wildcard) }
        }

        // 3) Pad BYE tới bracketSize (vd 5 bảng + A=2: 15 ứng viên → 1 BYE).
        while seeded.count < plan.bracketSize {
            seeded.append(Seeded(playerID: nil, name: "BYE", seed: seed, sourceGroupID: nil,
                                 wins: 0, pointDiff: Int.min, pointsFor: 0, tier: .bye))
            seed += 1
        }
        return (seeded, plan)
    }

    /// Cặp đấu vòng 1 theo VỊ TRÍ SEED CHUẨN (seed 1 & 2 chỉ gặp ở chung kết).
    static func pairings(_ seeded: [Seeded]) -> [(p1: Seeded, p2: Seeded, matchNumber: Int)] {
        let size = seeded.count
        let order = DEBracket.seedPositions(size)   // order[slot] = seedIndex (0-based)
        let slots = order.map { seeded[$0] }
        var out: [(p1: Seeded, p2: Seeded, matchNumber: Int)] = []
        for i in 0..<(size / 2) {
            out.append((slots[2 * i], slots[2 * i + 1], i + 1))
        }
        return out
    }

    /// Tránh hai người CÙNG BẢNG gặp nhau ngay vòng 1 — port web resolveGroupConflicts
    /// (đổi chỗ player2 giữa các cặp; BYE/sourceGroupID nil không bao giờ xung đột; đệ quy tối đa 3).
    static func resolveGroupConflicts(_ pairings: [(p1: Seeded, p2: Seeded, matchNumber: Int)],
                                      depth: Int = 3) -> [(p1: Seeded, p2: Seeded, matchNumber: Int)] {
        if depth <= 0 { return pairings }
        func conflict(_ a: Seeded, _ b: Seeded) -> Bool {
            guard let ga = a.sourceGroupID, let gb = b.sourceGroupID else { return false }
            return ga == gb
        }
        var resolved = pairings
        let conflicts = resolved.indices.filter { conflict(resolved[$0].p1, resolved[$0].p2) }
        if conflicts.isEmpty { return resolved }

        for ci in conflicts {
            if !conflict(resolved[ci].p1, resolved[ci].p2) { continue }
            let lower = resolved[ci].p2
            var best: Int? = nil
            var bestDist = Int.max
            for j in resolved.indices where j != ci {
                let cand = resolved[j].p2
                let here = cand.sourceGroupID != nil && cand.sourceGroupID == resolved[ci].p1.sourceGroupID
                let there = lower.sourceGroupID != nil && lower.sourceGroupID == resolved[j].p1.sourceGroupID
                if !here && !there {
                    let dist = abs(ci - j)
                    if dist < bestDist { best = j; bestDist = dist }
                }
            }
            if let b = best {
                let tmp = resolved[ci].p2
                resolved[ci].p2 = resolved[b].p2
                resolved[b].p2 = tmp
            }
        }
        return resolveGroupConflicts(resolved, depth: depth - 1)
    }

    /// Map pairings → `[QTBracketMatch]` cho `createPlayoff`. BYE → player nil.
    /// position: nửa đầu match = "upper", nửa sau = "lower" (chỉ để hiển thị; advance dựa theo thứ tự).
    static func toBracketMatches(_ pairings: [(p1: Seeded, p2: Seeded, matchNumber: Int)]) -> [QTBracketMatch] {
        let n = pairings.count
        return pairings.map { pr in
            let pos = pr.matchNumber <= n / 2 ? "upper" : "lower"
            return QTBracketMatch(player1: pr.p1.playerID, player2: pr.p2.playerID,
                                  position: pos, matchNumber: pr.matchNumber)
        }
    }

    /// Một ô trong cây bracket sau khi resolve BYE. roundIndex 0 = vòng đầu.
    struct ResolvedNode: Equatable {
        let roundIndex: Int
        let position: Int
        let roundCount: Int   // số match trong vòng này (để tính "upper"/"lower"/"final")
        let p1: UUID?
        let p2: UUID?
        let winner: UUID?
        let done: Bool        // true = walkover (BYE) đã quyết, đánh dấu completed
    }

    /// Dựng cây bracket từ vòng đầu rồi RESOLVE BYE: match có đúng 1 người thật (đối thủ nil)
    /// thành walkover — winner tự đẩy lên slot tương ứng ở vòng sau, đệ quy nhiều tầng nếu cần.
    /// Vòng đầu sort theo matchNumber để vị trí khớp `advancePlayoff` (position/2 → match cha).
    /// firstRound phải có số match là luỹ thừa của 2 (hoặc 1). Pure — dùng để test.
    static func resolveBracketTree(firstRound: [(p1: UUID?, p2: UUID?, matchNumber: Int)]) -> [ResolvedNode] {
        // `live` = match sẽ sinh ra người đi tiếp (walkover đã quyết HOẶC match thật chưa đá).
        // Phân biệt slot rỗng-vĩnh-viễn (BYE) với slot sẽ-được-lấp-sau (con là match thật).
        struct Slot { var p1: UUID?; var p2: UUID?; var winner: UUID?; var done: Bool; var live: Bool }
        let sorted = firstRound.sorted { $0.matchNumber < $1.matchNumber }

        // Vòng đầu: 2 người = match thật; 1 người = walkover; 0 = ô rỗng.
        var rounds: [[Slot]] = [sorted.map { fr in
            let reals = [fr.p1, fr.p2].compactMap { $0 }
            if reals.count == 2 { return Slot(p1: fr.p1, p2: fr.p2, winner: nil, done: false, live: true) }
            if reals.count == 1 { return Slot(p1: fr.p1, p2: fr.p2, winner: reals[0], done: true, live: true) }
            return Slot(p1: nil, p2: nil, winner: nil, done: false, live: false)
        }]

        var count = sorted.count
        while count > 1 {
            count /= 2
            let prev = rounds[rounds.count - 1]
            var cur: [Slot] = []
            for p in 0..<count {
                let c0 = prev[2 * p], c1 = prev[2 * p + 1]
                let s1 = c0.done ? c0.winner : nil   // walkover winner lấp sẵn; match thật → nil (advance sau)
                let s2 = c1.done ? c1.winner : nil
                let liveCount = (c0.live ? 1 : 0) + (c1.live ? 1 : 0)
                if liveCount == 2 {
                    cur.append(Slot(p1: s1, p2: s2, winner: nil, done: false, live: true))  // match thật
                } else if liveCount == 1 {
                    let liveChild = c0.live ? c0 : c1
                    if liveChild.done {
                        cur.append(Slot(p1: s1, p2: s2, winner: liveChild.winner, done: true, live: true))  // walkover cascade
                    } else {
                        cur.append(Slot(p1: s1, p2: s2, winner: nil, done: false, live: true))  // passthrough (cần double-bye, hiếm)
                    }
                } else {
                    cur.append(Slot(p1: nil, p2: nil, winner: nil, done: false, live: false))  // rỗng
                }
            }
            rounds.append(cur)
        }

        var out: [ResolvedNode] = []
        for r in rounds.indices {
            let cnt = rounds[r].count
            for p in rounds[r].indices {
                let s = rounds[r][p]
                out.append(ResolvedNode(roundIndex: r, position: p, roundCount: cnt,
                                        p1: s.p1, p2: s.p2, winner: s.winner, done: s.done))
            }
        }
        return out
    }
}
