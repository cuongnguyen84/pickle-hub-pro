import Testing
@testable import ThePickleHub

/// Test engine luật chấm điểm — xem `apple/docs/referee-live-scoring-spec.md`.
struct ScoringEngineTests {

    private func apply(_ s: ScoreState, _ winners: [ServeSide]) -> ScoreState {
        winners.reduce(s) { ScoringEngine.applyRally($0, winner: $1) }
    }

    // MARK: rally — mỗi pha = +1 cho bên thắng

    @Test func rallyEachWinScores() {
        var s = ScoreState.start(mode: .rally, isSingles: false, winTarget: 11)
        s = apply(s, [.a, .a, .b, .a])
        #expect(s.a == 3 && s.b == 1)
        #expect(s.serving == .a)           // người thắng pha cuối giao tiếp
        #expect(s.callout == "3-1")
    }

    @Test func rallyWinByTwo() {
        var s = ScoreState.start(mode: .rally, isSingles: false, winTarget: 11)
        s = apply(s, Array(repeating: .a, count: 10) + Array(repeating: .b, count: 10))
        #expect(s.a == 10 && s.b == 10)
        #expect(!s.isGameOver)             // 10-10 chưa xong
        s = apply(s, [.a])
        #expect(!s.isGameOver)             // 11-10 vẫn chưa (hơn 2)
        s = apply(s, [.a])
        #expect(s.isGameOver && s.winner == .a)   // 12-10
    }

    // MARK: side-out doubles — ngoại lệ 0-0-2

    @Test func sideOutStartsAtZeroZeroTwo() {
        let s = ScoreState.start(mode: .sideOut, isSingles: false, winTarget: 11, firstServer: .a)
        #expect(s.serverNumber == 2)
        #expect(s.callout == "0-0-2")
    }

    @Test func sideOutServerSequence() {
        var s = ScoreState.start(mode: .sideOut, isSingles: false, winTarget: 11, firstServer: .a)
        // A đang giao (server 2). A thắng → A 1 điểm, vẫn server 2.
        s = ScoringEngine.applyRally(s, winner: .a)
        #expect(s.a == 1 && s.serving == .a && s.serverNumber == 2)
        // A (server 2) thua pha → side-out sang B, server 1, không ai ghi điểm.
        s = ScoringEngine.applyRally(s, winner: .b)
        #expect(s.a == 1 && s.b == 0 && s.serving == .b && s.serverNumber == 1)
        // B (server 1) thua → sang server 2 cùng B, vẫn B giao.
        s = ScoringEngine.applyRally(s, winner: .a)
        #expect(s.serving == .b && s.serverNumber == 2 && s.a == 1)
        // B (server 2) thua → side-out về A, server 1.
        s = ScoringEngine.applyRally(s, winner: .a)
        #expect(s.serving == .a && s.serverNumber == 1)
    }

    @Test func sideOutOnlyServerScores() {
        var s = ScoreState.start(mode: .sideOut, isSingles: false, winTarget: 11, firstServer: .a)
        // B (đội nhận) thắng nhiều pha → không bao giờ ghi điểm khi không giao.
        s = ScoringEngine.applyRally(s, winner: .b)   // side-out → B giao
        #expect(s.a == 0 && s.b == 0 && s.serving == .b)
        // Giờ B giao và thắng → B mới có điểm.
        s = ScoringEngine.applyRally(s, winner: .b)
        #expect(s.b == 1)
    }

    // MARK: side-out singles — mất giao là side-out ngay

    @Test func singlesSideOutImmediate() {
        var s = ScoreState.start(mode: .sideOut, isSingles: true, winTarget: 11, firstServer: .a)
        #expect(s.serverNumber == 1)       // singles không có 0-0-2
        s = ScoringEngine.applyRally(s, winner: .b)   // A thua giao → side-out ngay
        #expect(s.serving == .b && s.a == 0 && s.b == 0)
        s = ScoringEngine.applyRally(s, winner: .b)   // B giao thắng → +1
        #expect(s.b == 1)
        #expect(s.callout == "1-0")        // singles không hô server#
    }

    // MARK: vị trí doubles — tình huống giao/đỡ kế tiếp

    @Test func doublesRotation() {
        // A=[A0,A1], B=[B0,B1]. A giao trước, người giao A0, người đỡ B0.
        var s = ScoreState.start(mode: .sideOut, isSingles: false, winTarget: 11,
                                 firstServer: .a, players: (a: ["A0", "A1"], b: ["B0", "B1"]),
                                 firstServerIdx: 0, firstReceiverIdx: 0)
        #expect(s.callout == "0-0-2")
        #expect(s.servingPlayer == "A0" && s.servingSideRight == true && s.receivingPlayer == "B0")

        // A thắng → A0 vẫn giao nhưng sang sân trái; người đỡ chéo giờ là B1.
        s = ScoringEngine.applyRally(s, winner: .a)
        #expect(s.callout == "1-0-2")
        #expect(s.servingPlayer == "A0" && s.servingSideRight == false && s.receivingPlayer == "B1")

        // B thắng → side-out (server 2). B giao, server 1 = B0 (sân phải, điểm chẵn 0).
        s = ScoringEngine.applyRally(s, winner: .b)
        #expect(s.callout == "0-1-1")
        #expect(s.servingPlayer == "B0" && s.servingSideRight == true)

        // B thắng → B0 vẫn giao sang trái.
        s = ScoringEngine.applyRally(s, winner: .b)
        #expect(s.callout == "1-1-1" && s.servingPlayer == "B0" && s.servingSideRight == false)

        // A thắng (đội đỡ) → B sang server 2 = B1, giao từ vị trí hiện tại (không theo chẵn/lẻ).
        s = ScoringEngine.applyRally(s, winner: .a)
        #expect(s.callout == "1-1-2" && s.servingPlayer == "B1")
    }

    // MARK: game khoá sau khi xong

    @Test func lockedAfterGameOver() {
        var s = ScoreState.start(mode: .rally, isSingles: false, winTarget: 11, winByTwo: false)
        s = apply(s, Array(repeating: .a, count: 11))
        #expect(s.isGameOver && s.a == 11)
        s = ScoringEngine.applyRally(s, winner: .b)   // không đổi nữa
        #expect(s.a == 11 && s.b == 0)
    }
}
