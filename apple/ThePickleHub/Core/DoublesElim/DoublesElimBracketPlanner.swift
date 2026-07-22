import Foundation

/// Stable, zero-based address for a match inside the preliminary graph.
struct DEBracketMatchKey: Hashable, Sendable {
    let round: Int
    let index: Int
}

/// A participant source is explicit even when it is a BYE or a slot selected
/// later from the ranked preliminary pool. This keeps the planner independent
/// of Supabase and makes dangling graph edges testable before any insert.
enum DEBracketPlanSource: Equatable, Hashable, Sendable {
    case team(UUID)
    case winnerOf(DEBracketMatchKey)
    case loserOf(DEBracketMatchKey)
    case bye
    case rankedPool(Int)

    var referencedMatch: DEBracketMatchKey? {
        switch self {
        case .winnerOf(let key), .loserOf(let key): return key
        case .team, .bye, .rankedPool: return nil
        }
    }
}

struct DEPlannedMatch: Equatable, Sendable {
    let key: DEBracketMatchKey
    let roundType: String
    let bracketType: String
    let sourceA: DEBracketPlanSource
    let sourceB: DEBracketPlanSource
    let isBye: Bool

    var initialTeamAID: UUID? {
        guard case .team(let id) = sourceA else { return nil }
        return id
    }

    var initialTeamBID: UUID? {
        guard case .team(let id) = sourceB else { return nil }
        return id
    }

    /// A team-seeded R1 BYE can be completed at insert time. An R2 BYE waits
    /// for its `loser_of` source to resolve, then auto-completes in propagation.
    var initialWinnerTeamID: UUID? {
        guard isBye else { return nil }
        return initialTeamAID ?? initialTeamBID
    }
}

struct DEInitialBracketPlan: Equatable, Sendable {
    let teamIDs: [UUID]
    let matches: [DEPlannedMatch]
    let preliminaryCandidateSources: [DEBracketPlanSource]
    let playoffSize: Int
    let directPlayoffCount: Int
    let r3ParticipantCount: Int

    var r1Matches: [DEPlannedMatch] { matches.filter { $0.key.round == 1 } }
    var r2Matches: [DEPlannedMatch] { matches.filter { $0.key.round == 2 } }
    var r3Matches: [DEPlannedMatch] { matches.filter { $0.key.round == 3 } }

    var entryTeamIDs: [UUID] {
        matches.flatMap { [$0.sourceA, $0.sourceB] }.compactMap { source in
            guard case .team(let id) = source else { return nil }
            return id
        }
    }

    func validate() throws {
        guard teamIDs.count >= 2 else { throw DEBracketPlanError.notEnoughTeams }
        guard Set(teamIDs).count == teamIDs.count else { throw DEBracketPlanError.duplicateTeams }
        guard Set(matches.map(\.key)).count == matches.count else { throw DEBracketPlanError.duplicateMatchKey }

        let entryCounts = Dictionary(grouping: entryTeamIDs, by: { $0 }).mapValues(\.count)
        guard Set(entryCounts.keys) == Set(teamIDs), entryCounts.values.allSatisfy({ $0 == 1 }) else {
            throw DEBracketPlanError.invalidEntryCoverage
        }

        let keys = Set(matches.map(\.key))
        let matchesByKey = Dictionary(uniqueKeysWithValues: matches.map { ($0.key, $0) })
        for source in matches.flatMap({ [$0.sourceA, $0.sourceB] }) + preliminaryCandidateSources {
            guard let referenced = source.referencedMatch else { continue }
            guard keys.contains(referenced) else { throw DEBracketPlanError.danglingSource }
            if case .loserOf = source, matchesByKey[referenced]?.isBye == true {
                throw DEBracketPlanError.byeHasNoLoser
            }
        }

        for round in 1...3 {
            let indices = matches.filter { $0.key.round == round }.map { $0.key.index }.sorted()
            guard indices == Array(0..<indices.count) else { throw DEBracketPlanError.nonContiguousRound }
        }

        let playableR1Count = teamIDs.count / 2
        let expectedR1Count = playableR1Count + teamIDs.count % 2
        let expectedR2Count = (playableR1Count + 1) / 2
        guard r1Matches.count == expectedR1Count, r2Matches.count == expectedR2Count else {
            throw DEBracketPlanError.invalidRoundShape
        }

        let expectedLoserKeys = Set(r1Matches.filter { !$0.isBye }.map(\.key))
        let loserKeys = r2Matches.flatMap { [$0.sourceA, $0.sourceB] }.compactMap { source -> DEBracketMatchKey? in
            guard case .loserOf(let key) = source else { return nil }
            return key
        }
        guard loserKeys.count == expectedLoserKeys.count, Set(loserKeys) == expectedLoserKeys else {
            throw DEBracketPlanError.invalidLoserCoverage
        }

        let expectedCandidates = (r1Matches + r2Matches).map { DEBracketPlanSource.winnerOf($0.key) }
        guard preliminaryCandidateSources == expectedCandidates else {
            throw DEBracketPlanError.invalidCandidateCoverage
        }

        let expectedPlayoffSize = Self.floorPowerOfTwo(preliminaryCandidateSources.count)
        let expectedR3Count = preliminaryCandidateSources.count - expectedPlayoffSize
        guard playoffSize == expectedPlayoffSize,
              playoffSize >= 2,
              Self.isPowerOfTwo(playoffSize),
              r3Matches.count == expectedR3Count,
              r3ParticipantCount == r3Matches.count * 2,
              directPlayoffCount == playoffSize - r3Matches.count,
              directPlayoffCount + r3ParticipantCount == preliminaryCandidateSources.count,
              directPlayoffCount + r3Matches.count == playoffSize else {
            throw DEBracketPlanError.invalidAdvancementCount
        }

        let rankedPositions = r3Matches.flatMap { [$0.sourceA, $0.sourceB] }.compactMap { source -> Int? in
            guard case .rankedPool(let position) = source else { return nil }
            return position
        }.sorted()
        guard rankedPositions == Array(0..<r3ParticipantCount) else {
            throw DEBracketPlanError.invalidRankedPool
        }

        let expectedByeCount = teamIDs.count % 2 + playableR1Count % 2
        guard matches.count(where: \.isBye) == expectedByeCount else {
            throw DEBracketPlanError.invalidByeCount
        }

        for match in matches {
            switch match.key.round {
            case 1:
                guard case .team = match.sourceA else { throw DEBracketPlanError.invalidRoundSource }
                if match.isBye {
                    guard case .bye = match.sourceB else { throw DEBracketPlanError.invalidRoundSource }
                } else {
                    guard case .team = match.sourceB else { throw DEBracketPlanError.invalidRoundSource }
                }
            case 2:
                guard case .loserOf = match.sourceA else { throw DEBracketPlanError.invalidRoundSource }
                if match.isBye {
                    guard case .bye = match.sourceB else { throw DEBracketPlanError.invalidRoundSource }
                } else {
                    guard case .loserOf = match.sourceB else { throw DEBracketPlanError.invalidRoundSource }
                }
            case 3:
                guard case .rankedPool = match.sourceA, case .rankedPool = match.sourceB else {
                    throw DEBracketPlanError.invalidRoundSource
                }
            default:
                throw DEBracketPlanError.invalidRoundShape
            }
        }
    }

    private static func floorPowerOfTwo(_ value: Int) -> Int {
        var power = 1
        while power <= value / 2 { power *= 2 }
        return power
    }

    private static func isPowerOfTwo(_ value: Int) -> Bool {
        value > 0 && (value & (value - 1)) == 0
    }
}

enum DEBracketPlanError: Error, Equatable, LocalizedError {
    case notEnoughTeams
    case duplicateTeams
    case invalidLoserOrder
    case duplicateMatchKey
    case invalidEntryCoverage
    case danglingSource
    case byeHasNoLoser
    case nonContiguousRound
    case invalidRoundShape
    case invalidLoserCoverage
    case invalidCandidateCoverage
    case invalidAdvancementCount
    case invalidRankedPool
    case invalidByeCount
    case invalidRoundSource

    var errorDescription: String? {
        "Sơ đồ nhánh đấu không hợp lệ (\(String(describing: self)))."
    }
}

enum DEInitialBracketPlanner {
    static func make(
        teamIDs: [UUID],
        r2LoserOrder: [Int]? = nil
    ) throws -> DEInitialBracketPlan {
        guard teamIDs.count >= 2 else { throw DEBracketPlanError.notEnoughTeams }
        guard Set(teamIDs).count == teamIDs.count else { throw DEBracketPlanError.duplicateTeams }

        let playableR1Count = teamIDs.count / 2
        let loserOrder = r2LoserOrder ?? Array(0..<playableR1Count)
        guard loserOrder.count == playableR1Count,
              Set(loserOrder) == Set(0..<playableR1Count) else {
            throw DEBracketPlanError.invalidLoserOrder
        }

        var matches: [DEPlannedMatch] = []

        for index in 0..<playableR1Count {
            matches.append(DEPlannedMatch(
                key: .init(round: 1, index: index),
                roundType: "winner_r1",
                bracketType: "winner",
                sourceA: .team(teamIDs[index * 2]),
                sourceB: .team(teamIDs[index * 2 + 1]),
                isBye: false
            ))
        }
        if teamIDs.count.isMultiple(of: 2) == false {
            matches.append(DEPlannedMatch(
                key: .init(round: 1, index: playableR1Count),
                roundType: "winner_r1",
                bracketType: "winner",
                sourceA: .team(teamIDs[teamIDs.count - 1]),
                sourceB: .bye,
                isBye: true
            ))
        }

        for pairStart in stride(from: 0, to: loserOrder.count, by: 2) {
            let index = pairStart / 2
            let sourceA = DEBracketPlanSource.loserOf(
                .init(round: 1, index: loserOrder[pairStart])
            )
            let hasSecondLoser = pairStart + 1 < loserOrder.count
            let sourceB: DEBracketPlanSource = hasSecondLoser
                ? .loserOf(.init(round: 1, index: loserOrder[pairStart + 1]))
                : .bye
            matches.append(DEPlannedMatch(
                key: .init(round: 2, index: index),
                roundType: "loser_r2",
                bracketType: "loser",
                sourceA: sourceA,
                sourceB: sourceB,
                isBye: !hasSecondLoser
            ))
        }

        let preliminary = matches
            .filter { $0.key.round == 1 || $0.key.round == 2 }
            .map { DEBracketPlanSource.winnerOf($0.key) }
        let playoffSize = floorPowerOfTwo(preliminary.count)
        let r3Count = preliminary.count - playoffSize
        for index in 0..<r3Count {
            matches.append(DEPlannedMatch(
                key: .init(round: 3, index: index),
                roundType: "merge_r3",
                bracketType: "merged",
                sourceA: .rankedPool(index * 2),
                sourceB: .rankedPool(index * 2 + 1),
                isBye: false
            ))
        }

        let plan = DEInitialBracketPlan(
            teamIDs: teamIDs,
            matches: matches,
            preliminaryCandidateSources: preliminary,
            playoffSize: playoffSize,
            directPlayoffCount: playoffSize - r3Count,
            r3ParticipantCount: r3Count * 2
        )
        try plan.validate()
        return plan
    }

    private static func floorPowerOfTwo(_ value: Int) -> Int {
        var power = 1
        while power <= value / 2 { power *= 2 }
        return power
    }
}
