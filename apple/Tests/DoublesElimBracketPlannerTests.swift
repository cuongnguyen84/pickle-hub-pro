import Foundation
import Testing
@testable import ThePickleHub

struct DoublesElimBracketPlannerTests {
    @Test func everyTeamCountFrom2Through128ProducesAValidGraph() throws {
        for teamCount in 2...128 {
            let teamIDs = ids(teamCount)
            let plan = try DEInitialBracketPlanner.make(teamIDs: teamIDs)

            try plan.validate()
            #expect(plan.teamIDs == teamIDs)
            #expect(plan.entryTeamIDs.sorted(by: uuidLessThan) == teamIDs.sorted(by: uuidLessThan))
            #expect(Set(plan.entryTeamIDs).count == teamCount)
            #expect(plan.entryTeamIDs.count == teamCount)
            #expect(plan.directPlayoffCount + plan.r3ParticipantCount == plan.preliminaryCandidateSources.count)
            #expect(plan.directPlayoffCount + plan.r3Matches.count == plan.playoffSize)
            #expect(plan.playoffSize.isPowerOfTwo)
        }
    }

    @Test func edgeCountsHaveExpectedRoundAndByeShapes() throws {
        let cases: [(n: Int, r1: Int, r2: Int, r3: Int, playoff: Int, byes: Int)] = [
            (2, 1, 1, 0, 2, 1),
            (3, 2, 1, 1, 2, 2),
            (4, 2, 1, 1, 2, 0),
            (5, 3, 1, 0, 4, 1),
            (6, 3, 2, 1, 4, 1),
            (7, 4, 2, 2, 4, 2),
            (8, 4, 2, 2, 4, 0),
            (9, 5, 2, 3, 4, 1),
            (15, 8, 4, 4, 8, 2),
            (16, 8, 4, 4, 8, 0),
            (17, 9, 4, 5, 8, 1),
            (31, 16, 8, 8, 16, 2),
            (32, 16, 8, 8, 16, 0),
            (63, 32, 16, 16, 32, 2),
            (64, 32, 16, 16, 32, 0),
            (127, 64, 32, 32, 64, 2),
            (128, 64, 32, 32, 64, 0),
        ]

        for c in cases {
            let plan = try DEInitialBracketPlanner.make(teamIDs: ids(c.n))
            #expect(plan.r1Matches.count == c.r1)
            #expect(plan.r2Matches.count == c.r2)
            #expect(plan.r3Matches.count == c.r3)
            #expect(plan.playoffSize == c.playoff)
            #expect(plan.matches.count(where: \.isBye) == c.byes)
        }
    }

    @Test func everyPlayableR1LoserHasExactlyOneR2Path() throws {
        for teamCount in 2...128 {
            let plan = try DEInitialBracketPlanner.make(teamIDs: ids(teamCount))
            let playableR1Keys = Set(plan.r1Matches.filter { !$0.isBye }.map(\.key))
            let loserSources = plan.r2Matches.flatMap { [$0.sourceA, $0.sourceB] }.compactMap { source -> DEBracketMatchKey? in
                guard case .loserOf(let key) = source else { return nil }
                return key
            }

            #expect(Set(loserSources) == playableR1Keys)
            #expect(loserSources.count == playableR1Keys.count)
        }
    }

    @Test func everyWinnerAndLoserReferencePointsToAnExistingSource() throws {
        for teamCount in 2...128 {
            let plan = try DEInitialBracketPlanner.make(teamIDs: ids(teamCount))
            let keys = Set(plan.matches.map(\.key))
            for source in plan.matches.flatMap({ [$0.sourceA, $0.sourceB] }) + plan.preliminaryCandidateSources {
                switch source {
                case .winnerOf(let key), .loserOf(let key):
                    #expect(keys.contains(key))
                case .team, .bye, .rankedPool:
                    break
                }
            }
        }
    }

    @Test func everyTeamEndsEitherEliminatedOrInPlayoffWithoutDisappearing() throws {
        for teamCount in 2...128 {
            let plan = try DEInitialBracketPlanner.make(teamIDs: ids(teamCount))
            var winners: [DEBracketMatchKey: UUID] = [:]
            var losers: [DEBracketMatchKey: UUID] = [:]
            var eliminated = Set<UUID>()

            for match in plan.r1Matches {
                let teamA = try #require(match.initialTeamAID)
                winners[match.key] = teamA
                if let teamB = match.initialTeamBID { losers[match.key] = teamB }
            }
            for match in plan.r2Matches {
                let teamA = try #require(resolve(match.sourceA, winners: winners, losers: losers))
                winners[match.key] = teamA
                if !match.isBye {
                    let teamB = try #require(resolve(match.sourceB, winners: winners, losers: losers))
                    losers[match.key] = teamB
                    eliminated.insert(teamB)
                }
            }

            let candidates = try plan.preliminaryCandidateSources.map {
                try #require(resolve($0, winners: winners, losers: losers))
            }
            #expect(Set(candidates).count == candidates.count)

            var playoff = Array(candidates.prefix(plan.directPlayoffCount))
            let r3Teams = Array(candidates.dropFirst(plan.directPlayoffCount))
            #expect(r3Teams.count == plan.r3ParticipantCount)
            for pairStart in stride(from: 0, to: r3Teams.count, by: 2) {
                playoff.append(r3Teams[pairStart])
                eliminated.insert(r3Teams[pairStart + 1])
            }

            #expect(playoff.count == plan.playoffSize)
            #expect(Set(playoff).isDisjoint(with: eliminated))
            #expect(Set(playoff).union(eliminated) == Set(plan.teamIDs))
        }
    }

    @Test func invalidLoserPermutationAndDuplicateTeamsAreRejected() {
        #expect(throws: DEBracketPlanError.self) {
            try DEInitialBracketPlanner.make(teamIDs: ids(6), r2LoserOrder: [0, 0, 1])
        }
        let duplicated = [ids(2)[0], ids(2)[0]]
        #expect(throws: DEBracketPlanError.self) {
            try DEInitialBracketPlanner.make(teamIDs: duplicated)
        }
    }

    @Test func nativeCreationRangeMatchesCurrentWebAndDatabaseContract() {
        #expect(DoublesElimRepository.supportedCreationTeamCounts.contains(40))
        #expect(DoublesElimRepository.supportedCreationTeamCounts.contains(128))
        #expect(!DoublesElimRepository.supportedCreationTeamCounts.contains(39))
        #expect(!DoublesElimRepository.supportedCreationTeamCounts.contains(129))
        #expect(throws: Never.self) {
            try DoublesElimRepository.validateCreationInputs(declaredTeamCount: 40, actualTeamCount: 40)
        }
        #expect(throws: DoublesElimRepository.DECreateError.self) {
            try DoublesElimRepository.validateCreationInputs(declaredTeamCount: 40, actualTeamCount: 39)
        }
    }

    private func ids(_ count: Int) -> [UUID] {
        (1...count).map { value in
            UUID(uuidString: String(format: "00000000-0000-4000-8000-%012d", value))!
        }
    }

    private func uuidLessThan(_ lhs: UUID, _ rhs: UUID) -> Bool {
        lhs.uuidString < rhs.uuidString
    }

    private func resolve(
        _ source: DEBracketPlanSource,
        winners: [DEBracketMatchKey: UUID],
        losers: [DEBracketMatchKey: UUID]
    ) -> UUID? {
        switch source {
        case .team(let id): return id
        case .winnerOf(let key): return winners[key]
        case .loserOf(let key): return losers[key]
        case .bye, .rankedPool: return nil
        }
    }
}

private extension Int {
    var isPowerOfTwo: Bool { self > 0 && (self & (self - 1)) == 0 }
}
