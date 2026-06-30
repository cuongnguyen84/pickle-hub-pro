import Testing
@testable import ThePickleHub

/// Gợi ý số đội vào playoff (MLP wizard bước 4) — top-2 luỹ thừa của 2 ≤ teamCount.
struct TeamMatchWizardTests {

    private func options(_ teams: Int) -> [Int] {
        let m = CreateTeamMatchModel()
        m.teamCount = teams
        return m.playoffSizeOptions
    }

    @Test func suggestsTopTwoPowersOfTwo() {
        #expect(options(25) == [16, 8])   // ví dụ của user
        #expect(options(10) == [8, 4])
        #expect(options(8) == [8, 4])
        #expect(options(6) == [4, 2])
        #expect(options(4) == [4, 2])
        #expect(options(3) == [2])
        #expect(options(2) == [2])
        #expect(options(32) == [32, 16])
    }

    @Test func circlePairsRoundRobinCount() {
        func n(_ k: Int) -> Int { TeamMatchRepository.circlePairs((1...k).map { "t\($0)" }).count }
        #expect(n(2) == 1)
        #expect(n(4) == 6)    // 4·3/2
        #expect(n(5) == 10)   // 5·4/2 (lẻ → BYE bỏ qua)
        #expect(n(6) == 15)
    }

    @Test func circlePairsEachTeamMeetsAllOthers() {
        let ids = ["a", "b", "c", "d", "e"]
        let pairs = TeamMatchRepository.circlePairs(ids)
        for t in ids {
            let opp = Set(pairs.filter { $0.a == t || $0.b == t }.map { $0.a == t ? $0.b : $0.a })
            #expect(opp == Set(ids).subtracting([t]))   // gặp đúng 4 đội còn lại, không trùng
        }
    }

    @Test func groupPairingsSeparatesSameGroup() {
        // 4 bảng A–D, mỗi bảng nhất (X1) + nhì (X2).
        let w = ["A1", "B1", "C1", "D1"], r = ["A2", "B2", "C2", "D2"]
        let fr = TeamMatchRepository.groupPairings(winners: w, runnersUp: r)!
        #expect(fr.count == 4)
        // nhất bảng X gặp nhì bảng kề (Y) ở vòng 1
        #expect(fr[0].a == "A1" && fr[0].b == "B2")
        #expect(fr[2].a == "B1" && fr[2].b == "A2")   // nhì A ở nửa dưới
        // 2 đội cùng bảng phải ở HAI NỬA khác nhau (chỉ gặp lại ở chung kết)
        let half = fr.count / 2
        func matchIndex(_ t: String) -> Int { fr.firstIndex { $0.a == t || $0.b == t }! }
        for g in ["A", "B", "C", "D"] {
            let wi = matchIndex("\(g)1"), ri = matchIndex("\(g)2")
            #expect((wi < half) != (ri < half))   // một nửa trên, một nửa dưới
        }
    }

    @Test func groupPairingsRejectsOddGroups() {
        #expect(TeamMatchRepository.groupPairings(winners: ["A1", "B1", "C1"], runnersUp: ["A2", "B2", "C2"]) == nil)
    }

    @Test func normalizeClampsToValidOption() {
        let m = CreateTeamMatchModel()
        m.teamCount = 25
        m.playoffTeamCount = 4          // default cứng cũ, không hợp lệ cho 25 đội
        m.normalizePlayoffCount()
        #expect(m.playoffTeamCount == 16)   // kẹp về option lớn nhất
        m.playoffTeamCount = 8          // 8 hợp lệ → giữ nguyên
        m.normalizePlayoffCount()
        #expect(m.playoffTeamCount == 8)
    }
}
