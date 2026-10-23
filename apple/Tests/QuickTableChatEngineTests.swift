import Testing
import Foundation
@testable import ThePickleHub

/// Mirror của các ca trong src/lib/__tests__/quick-table-chat-edits.test.ts (web)
/// cho tầng chat tất định QTChatEngine, gồm ma trận vòng tròn 5/6/7 đội và
/// hạt giống vòng trực tiếp mà Cường chỉ định cho task 1 (PR web #920).
struct QuickTableChatEngineTests {
    private typealias E = QTChatEngine

    private func teams(_ n: Int) -> [QTChatEntry] {
        (1...n).map { QTChatEntry(p1: "Đội \($0)") }
    }

    // MARK: nhận diện thể thức

    @Test func detectsSingleGroupRoundRobinAsks() {
        for t in ["Không chia bảng mà đánh vòng tròn", "khong chia bang, danh vong tron",
                  "đánh vòng tròn 1 bảng thôi", "chỉ đánh vòng tròn, một bảng duy nhất",
                  "no groups, just round robin", "single group round robin please"] {
            #expect(E.wantsSingleGroupRoundRobin(t), "\(t)")
        }
        for t in ["chia 2 bảng, đánh vòng tròn lấy nhất nhì", "đánh vòng tròn 2 bảng",
                  "chia 2 bảng", "đánh vòng tròn"] {
            #expect(!E.wantsSingleGroupRoundRobin(t), "\(t)")
        }
    }

    @Test func factsPinGroupAndAdvance() {
        #expect(E.readUserFacts("Không chia bảng mà đánh vòng tròn").groupCount == 1)
        #expect(E.readUserFacts("đánh vòng tròn 2 bảng").groupCount == 2)
        #expect(E.readUserFacts("chia 2 bảng").groupCount == 2)
        #expect(E.readUserFacts("lấy 4 đội vào trực tiếp").advancePerGroup == 4)
        #expect(E.readUserFacts("top 2 vào bán kết").advancePerGroup == 2)
        #expect(E.readUserFacts("take 4 into the knockout").advancePerGroup == 4)
        #expect(E.readUserFacts("chọn 4 đội vào vòng tròn").advancePerGroup == nil)
    }

    @Test func openingSentenceParsesLikeWeb() {
        let text = "Giải TEST Grok 1, 6 người đánh đơn, 1 bảng, 2 sân, đánh vòng tròn"
        let bare = "giai TEST Grok 1, 6 nguoi danh don, 1 bang, 2 san, danh vong tron"
        for line in [text, bare] {
            let facts = E.readUserFacts(line)
            #expect(facts.name == "TEST Grok 1")
            #expect(facts.isDoubles == false)
            #expect(facts.playerCount == 6)
            #expect(facts.groupCount == 1)
            #expect(facts.courts == [1, 2])
            let next = E.applySpokenEdit(QTChatDraft(), line)
            #expect(next?.groupCount == 1)
            #expect(next?.name == "TEST Grok 1")
            #expect(next.map { E.nextSlot($0) } == .roster)
            let ack = E.factualAck(before: QTChatDraft(), after: next ?? QTChatDraft(), lang: "vi", request: line)
            #expect(ack.contains("Đã chia 1 bảng"))
            #expect(ack.contains("TEST Grok 1"))
            #expect(ack.contains("6 người"))
            #expect(!ack.contains("Không chia được"))
        }
    }

    @Test func groupCourtPinsParseLikeWeb910() {
        let facts = E.readUserFacts("bảng A sân 1, bảng B sân 2")
        #expect(facts.groupCourts?.count == 2)
        #expect(facts.groupCourts?[0] == 1)
        #expect(facts.groupCourts?[1] == 2)
        var draft = QTChatDraft()
        draft.groupCourts = facts.groupCourts
        #expect(E.groupCourtsLine(draft, lang: "vi") == "Bảng A → sân 1 · Bảng B → sân 2")
    }

    // MARK: câu trả lời bước groups

    @Test func roundRobinReplyNamesFormatAndPairings() {
        let entries = teams(8)
        let before = QTChatDraft(isDoubles: true, groupCount: 2, entries: entries)
        let after = QTChatDraft(isDoubles: true, groupCount: 1, entries: entries, advancePerGroup: 4)
        let ack = E.factualAck(before: before, after: after, lang: "vi",
                               request: "Không chia bảng mà đánh vòng tròn, lấy 4 đội vào trực tiếp")
        #expect(ack.contains("Đã chia 1 bảng"))
        #expect(ack.contains("vòng tròn"))
        #expect(ack.contains("xếp hạng theo điểm"))
        #expect(ack.contains("Bán kết: đội 1 gặp đội 4, đội 2 gặp đội 3"))
        #expect(!ack.contains("không có vòng loại trực tiếp"))
        let en = E.factualAck(before: before, after: after, lang: "en",
                              request: "no groups, just round robin, take 4 into the knockout")
        #expect(en.contains("round-robin group"))
        #expect(en.contains("seed 1 vs seed 4, seed 2 vs seed 3"))
    }

    @Test func plainOneGroupSplitNamesFormatToo() {
        let after = QTChatDraft(isDoubles: true, groupCount: 1, entries: teams(8))
        let ack = E.factualAck(before: QTChatDraft(), after: after, lang: "vi", request: "1 bảng")
        #expect(ack.contains("Đã chia 1 bảng"))
        #expect(ack.contains("Một bảng vòng tròn"))
        let two = QTChatDraft(isDoubles: true, groupCount: 2, entries: teams(8))
        let ack2 = E.factualAck(before: QTChatDraft(), after: two, lang: "vi", request: "chia 2 bảng")
        #expect(ack2.contains("Đã chia 2 bảng"))
        #expect(!ack2.contains("vòng tròn"))
    }

    @Test func playoffSummaryPairings() {
        var d = QTChatDraft(isDoubles: true, groupCount: 1, entries: teams(6))
        #expect(E.playoffSummary(d, lang: "vi") == "Một bảng vòng tròn")
        d.advancePerGroup = 4
        #expect(E.playoffSummary(d, lang: "vi")?.contains("Bán kết: đội 1 gặp đội 4, đội 2 gặp đội 3") == true)
        #expect(E.playoffSummary(d, lang: "en")?.contains("seed 1 vs seed 4, seed 2 vs seed 3") == true)
        d.advancePerGroup = 2
        #expect(E.playoffSummary(d, lang: "vi")?.contains("Chung kết: đội 1 gặp đội 2") == true)
    }

    @Test func repliesAreNeverEmpty() {
        let d = QTChatDraft(isDoubles: true, groupCount: 1, entries: teams(6))
        #expect(!E.replyFromDraft(before: d, after: d, llmReply: "", lang: "vi", request: "gì đó").isEmpty)
        #expect(!E.fallbackReply(intent: "unsupported", unmet: nil, lang: "vi").isEmpty)
        #expect(!E.fallbackReply(intent: "unsupported", unmet: "đánh đôi nam nữ", lang: "en").isEmpty)
    }

    @Test func singleGroupPlayoffPlansMirrorWeb() {
        #expect(E.singleGroupPlayoffPlans(8) == [[4], [2]])
        #expect(E.singleGroupPlayoffPlans(4) == [[4], [2]])
        #expect(E.singleGroupPlayoffPlans(3) == [[2]])
        #expect(E.singleGroupPlayoffPlans(2) == [])
        var d = QTChatDraft(isDoubles: true, playerCount: 6, groupCount: 1, advancePerGroup: 4)
        d = E.lockAdvance(d)
        #expect(d.seriesSizes == [4])
        #expect(d.series == 1)
    }

    // MARK: ma trận vòng tròn 5/6/7 đội (engine sẵn có của app) + hạt giống

    @Test func roundRobinMatrix567() {
        for (n, total) in [(5, 10), (6, 15), (7, 21)] {
            let ids = (0..<n).map { _ in UUID() }
            let games = QuickTableRepository.circleMethod(ids)
            #expect(games.count == total, "\(n) đội phải có \(total) trận")
            let pairKeys = Set(games.map { [String($0.p1.uuidString), String($0.p2.uuidString)].sorted().joined(separator: "|") })
            #expect(pairKeys.count == total, "\(n) đội: mỗi cặp gặp đúng 1 lần")
            for id in ids {
                #expect(games.filter { $0.p1 == id || $0.p2 == id }.count == n - 1)
            }
            // Bye: số đội lẻ → mỗi vòng đúng 1 đội nghỉ, mỗi đội nghỉ đúng 1 vòng.
            let rounds = Dictionary(grouping: games, by: { $0.round })
            if n % 2 == 1 {
                #expect(rounds.count == n)
                var rests: [UUID: Int] = [:]
                for (_, gs) in rounds {
                    let playing = Set(gs.flatMap { [$0.p1, $0.p2] })
                    let resting = ids.filter { !playing.contains($0) }
                    #expect(resting.count == 1)
                    if let r = resting.first { rests[r, default: 0] += 1 }
                }
                for id in ids { #expect(rests[id] == 1) }
            } else {
                #expect(rounds.count == n - 1)
            }
            // Hạt giống từ BXH (hạng 1..4 của chính bảng này): 1v4, 2v3 / 1v2.
            let gid = UUID()
            func seeded(_ seed: Int) -> QTSeedingV2.Seeded {
                QTSeedingV2.Seeded(playerID: ids[seed - 1], name: "T\(seed)", seed: seed,
                                   sourceGroupID: gid, wins: n - seed, pointDiff: 0, pointsFor: 0, tier: .winner)
            }
            let top4 = QTSeedingV2.pairings((1...4).map(seeded))
            let pairSeeds = Set(top4.map { [String($0.p1.seed), String($0.p2.seed)].sorted().joined(separator: "v") })
            #expect(pairSeeds == ["1v4", "2v3"], "\(n) đội: bán kết phải là 1v4 và 2v3, được \(pairSeeds)")
            let top2 = QTSeedingV2.pairings((1...2).map(seeded))
            #expect(top2.count == 1 && top2[0].p1.seed == 1 && top2[0].p2.seed == 2)
            // Câu trả lời chat cho đúng cỡ đội này.
            let entries = teams(n)
            let before = QTChatDraft(isDoubles: true, groupCount: 2, entries: entries)
            let after = QTChatDraft(isDoubles: true, groupCount: 1, entries: entries, advancePerGroup: 4)
            let ack = E.factualAck(before: before, after: after, lang: "vi",
                                   request: "Không chia bảng mà đánh vòng tròn, lấy 4 đội vào trực tiếp")
            #expect(ack.contains("Bán kết: đội 1 gặp đội 4, đội 2 gặp đội 3"), "\(n) đội: \(ack)")
        }
    }
}
