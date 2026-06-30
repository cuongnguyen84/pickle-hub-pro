import Foundation

/// Engine luật chấm điểm pickleball — thuần, không side effect, không Supabase.
/// Trọng tài chỉ trả lời "đội nào THẮNG pha bóng?" (tap 1 trong 2 vùng);
/// engine tự lo điểm, số server, side-out, đổi giao, hết game, và (doubles side-out)
/// vị trí giao/đỡ từng người để hiển thị "tình huống kế tiếp". Xem
/// `apple/docs/referee-live-scoring-spec.md`.

enum ServeSide: Equatable {
    case a, b
    var other: ServeSide { self == .a ? .b : .a }
}

/// 2 thể thức tính điểm pickleball (chỉ có 2).
enum ScoringMode: Equatable {
    case rally    // mỗi pha bóng = 1 điểm cho bên thắng
    case sideOut  // chỉ đội giao mới ghi điểm (traditional)
}

/// Vị trí sân doubles side-out — để hiện rõ ai giao (sân nào) / ai đỡ ở pha kế.
/// Chỉ dùng khi có tên 2 người mỗi đội (TeamMatch doubles). `serverIdx` là người
/// ĐANG giao trong đội đang giao; `*RightIdx` = ai đang đứng sân phải (sân chẵn).
struct ServeRotation: Equatable {
    let aPlayers: [String]   // [người 0, người 1]
    let bPlayers: [String]
    var aRightIdx: Int
    var bRightIdx: Int
    var serverIdx: Int

    func players(_ s: ServeSide) -> [String] { s == .a ? aPlayers : bPlayers }
    func rightIdx(_ s: ServeSide) -> Int { s == .a ? aRightIdx : bRightIdx }
    func leftIdx(_ s: ServeSide) -> Int { rightIdx(s) == 0 ? 1 : 0 }
    mutating func swapRight(_ s: ServeSide) {
        if s == .a { aRightIdx = aRightIdx == 0 ? 1 : 0 } else { bRightIdx = bRightIdx == 0 ? 1 : 0 }
    }
}

/// Trạng thái 1 game tại một thời điểm. Bất biến qua `applyRally` (trả state mới).
struct ScoreState: Equatable {
    var a: Int
    var b: Int
    var serving: ServeSide
    var serverNumber: Int      // 1|2 — chỉ doubles side-out; rally/singles bỏ qua
    let mode: ScoringMode
    let isSingles: Bool
    let winTarget: Int
    let winByTwo: Bool
    var rotation: ServeRotation?   // nil trừ doubles side-out có tên người

    /// Khởi tạo 1 game. Doubles side-out bắt đầu **0-0-2** (ngoại lệ đầu game:
    /// đội giao đầu chỉ có 1 lượt server rồi side-out) → serverNumber = 2.
    /// Cấp `players` + `firstServerIdx`/`firstReceiverIdx` để bật lớp vị trí:
    /// người giao đầu đứng sân phải (chẵn), người đỡ đầu đứng chéo (sân phải đội kia).
    static func start(mode: ScoringMode,
                      isSingles: Bool,
                      winTarget: Int,
                      winByTwo: Bool = true,
                      firstServer: ServeSide = .a,
                      players: (a: [String], b: [String])? = nil,
                      firstServerIdx: Int = 0,
                      firstReceiverIdx: Int = 0) -> ScoreState {
        var rotation: ServeRotation?
        if let players, mode == .sideOut, !isSingles,
           players.a.count == 2, players.b.count == 2 {
            let aRight = firstServer == .a ? firstServerIdx : firstReceiverIdx
            let bRight = firstServer == .b ? firstServerIdx : firstReceiverIdx
            rotation = ServeRotation(aPlayers: players.a, bPlayers: players.b,
                                     aRightIdx: aRight, bRightIdx: bRight, serverIdx: firstServerIdx)
        }
        return ScoreState(a: 0, b: 0,
                          serving: firstServer,
                          serverNumber: (mode == .sideOut && !isSingles) ? 2 : 1,
                          mode: mode, isSingles: isSingles,
                          winTarget: winTarget, winByTwo: winByTwo, rotation: rotation)
    }

    func score(of side: ServeSide) -> Int { side == .a ? a : b }

    // ponytail: không cap điểm trần (vd 15 ở game tới 11). Pickleball mặc định
    // không cap trừ khi BTC quy định — thêm `pointCap: Int?` nếu cần sau.
    var isGameOver: Bool {
        guard a >= winTarget || b >= winTarget else { return false }
        return winByTwo ? abs(a - b) >= 2 : true
    }

    var winner: ServeSide? {
        guard isGameOver else { return nil }
        return a > b ? .a : .b
    }

    /// Chuỗi để trọng tài hô. Side-out hô theo người giao trước (doubles thêm server#);
    /// rally hô thẳng "a-b".
    var callout: String {
        switch mode {
        case .rally:
            return "\(a)-\(b)"
        case .sideOut:
            let base = "\(score(of: serving))-\(score(of: serving.other))"
            return isSingles ? base : base + "-\(serverNumber)"
        }
    }

    // MARK: Tình huống kế tiếp (doubles side-out có tên người)

    /// true = người giao đang ở sân phải (sân chẵn).
    var servingSideRight: Bool? {
        guard let r = rotation else { return nil }
        return r.serverIdx == r.rightIdx(serving)
    }
    var servingPlayer: String? {
        guard let r = rotation else { return nil }
        return r.players(serving)[r.serverIdx]
    }
    var receivingPlayer: String? {
        guard let r = rotation, let right = servingSideRight else { return nil }
        let recv = serving.other
        return r.players(recv)[right ? r.rightIdx(recv) : r.leftIdx(recv)]
    }
}

enum ScoringEngine {
    /// Áp 1 pha bóng. `winner` = đội THẮNG pha (KHÔNG nhất thiết là đội giao).
    /// Game đã xong thì khoá, trả nguyên trạng.
    static func applyRally(_ state: ScoreState, winner: ServeSide) -> ScoreState {
        var s = state
        guard !s.isGameOver else { return s }

        switch s.mode {
        case .rally:
            if winner == .a { s.a += 1 } else { s.b += 1 }
            s.serving = winner            // người thắng pha giao tiếp (chỉ hiển thị)

        case .sideOut:
            if winner == s.serving {
                if winner == .a { s.a += 1 } else { s.b += 1 }   // đội giao thắng → +1
                s.rotation?.swapRight(s.serving)                 // 2 người đội giao đổi sân
            } else if s.isSingles || s.serverNumber == 2 {
                s.serving = s.serving.other                      // side-out
                s.serverNumber = 1
                if var r = s.rotation {
                    // server 1 đội mới = người ở sân khớp chẵn/lẻ điểm hiện tại của đội đó.
                    let sc = s.score(of: s.serving)
                    r.serverIdx = (sc % 2 == 0) ? r.rightIdx(s.serving) : r.leftIdx(s.serving)
                    s.rotation = r
                }
            } else {
                s.serverNumber = 2                               // sang server #2 cùng đội
                if var r = s.rotation {
                    r.serverIdx = r.serverIdx == 0 ? 1 : 0       // đồng đội giao, giữ nguyên vị trí
                    s.rotation = r
                }
            }
        }
        return s
    }
}
