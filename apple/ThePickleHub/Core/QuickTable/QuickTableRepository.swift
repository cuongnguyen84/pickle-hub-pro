import Foundation
import Supabase

/// Loads a quick table (groups/players/matches) and writes match scores.
/// Scoring + group-stat recompute + playoff advancement mirror the web
/// `useQuickTableMutations` exactly so native and web stay consistent.
struct QuickTableRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? {
        try? await client.auth.session.user.id
    }

    /// True when the user is a referee on this table — they may enter scores
    /// (web parity: canEditScores = isCreator || isReferee). Non-throwing.
    func isReferee(tableID: UUID, userID: UUID) async -> Bool {
        struct R: Decodable { let id: UUID }
        let rows: [R]? = try? await client
            .from("quick_table_referees")
            .select("id")
            .eq("table_id", value: tableID)
            .eq("user_id", value: userID)
            .limit(1)
            .execute().value
        return rows?.isEmpty == false
    }

    // MARK: Referees (parity với TeamMatch — bảng quick_table_referees, FK table_id)

    func fetchReferees(tableID: UUID) async -> [QTReferee] {
        struct Row: Decodable { let id: UUID; let userID: UUID
            enum CodingKeys: String, CodingKey { case id; case userID = "user_id" } }
        guard let rows: [Row] = try? await client
            .from("quick_table_referees").select("id, user_id")
            .eq("table_id", value: tableID).execute().value, !rows.isEmpty else { return [] }
        let names = await refereeDisplayNames(ids: Set(rows.map { $0.userID.uuidString.lowercased() }))
        return rows.map { QTReferee(id: $0.id, userID: $0.userID,
                                    displayName: names[$0.userID.uuidString.lowercased()]) }
    }

    enum AddRefereeOutcome: Equatable { case ok(String?), notFound, alreadyExists, error }

    /// lookup_user_by_email RPC → existence check → insert. Mirror referee-helpers.
    func addReferee(tableID: UUID, email: String) async -> AddRefereeOutcome {
        struct LookupRow: Decodable { let id: UUID; let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" } }
        let trimmed = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .error }
        do {
            let rows: [LookupRow] = try await client
                .rpc("lookup_user_by_email", params: ["lookup_email": trimmed])
                .execute().value
            guard let profile = rows.first else { return .notFound }
            struct R: Decodable { let id: UUID }
            let existing: [R] = try await client
                .from("quick_table_referees").select("id")
                .eq("table_id", value: tableID).eq("user_id", value: profile.id)
                .limit(1).execute().value
            if !existing.isEmpty { return .alreadyExists }
            struct Ins: Encodable { let table_id: String; let user_id: String }
            try await client.from("quick_table_referees")
                .insert(Ins(table_id: tableID.uuidString.lowercased(),
                            user_id: profile.id.uuidString.lowercased())).execute()
            return .ok(profile.displayName)
        } catch { return .error }
    }

    func removeReferee(refereeID: UUID) async throws {
        try await client.from("quick_table_referees").delete().eq("id", value: refereeID).execute()
    }

    /// Ghi chú trọng tài cho 1 trận (referee_note). Best-effort.
    func updateRefereeNote(matchID: UUID, note: String) async throws {
        struct N: Encodable { let referee_note: String }
        try await client.from("quick_table_matches")
            .update(N(referee_note: note)).eq("id", value: matchID).execute()
    }

    /// Đẩy điểm hiện tại (chưa completed) để người xem thấy realtime.
    func updateLiveScore(matchID: UUID, score1: Int, score2: Int) async throws {
        struct U: Encodable { let score1: Int; let score2: Int }
        try await client.from("quick_table_matches")
            .update(U(score1: score1, score2: score2)).eq("id", value: matchID).execute()
    }

    /// Claim trận làm LIVE (live_referee_id = user hiện tại) để hiện badge.
    func claimLive(matchID: UUID) async throws {
        guard let uid = await currentUserID() else { return }
        struct U: Encodable { let live_referee_id: String }
        try await client.from("quick_table_matches")
            .update(U(live_referee_id: uid.uuidString.lowercased())).eq("id", value: matchID).execute()
    }

    private func refereeDisplayNames(ids: Set<String>) async -> [String: String] {
        guard !ids.isEmpty else { return [:] }
        struct P: Decodable { let id: String; let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" } }
        guard let rows: [P] = try? await client
            .from("public_profiles").select("id, display_name")
            .in("id", values: Array(ids)).execute().value else { return [:] }
        var map: [String: String] = [:]
        for r in rows { if let n = r.displayName, !n.isEmpty { map[r.id.lowercased()] = n } }
        return map
    }

    // MARK: Load

    /// Deep link `/join/:code` — lời mời ghép đôi cũ, giờ chỉ trỏ về giải
    /// (khớp web JoinTeam.tsx: luồng ghép đôi làm trực tiếp trong trang giải).
    func tableForInvite(code: String) async -> (shareID: String, name: String)? {
        struct Invite: Decodable { let table_id: UUID }
        struct Table: Decodable { let share_id: String; let name: String }
        guard let invite: Invite = try? await client
            .from("quick_table_partner_invitations").select("table_id")
            .eq("invite_code", value: code).single().execute().value,
        let table: Table = try? await client
            .from("quick_tables").select("share_id, name")
            .eq("id", value: invite.table_id).single().execute().value
        else { return nil }
        return (table.share_id, table.name)
    }

    func load(shareID: String) async throws -> QuickTableDetail {
        let table: QTTable = try await client
            .from("quick_tables")
            .select("id, share_id, name, status, format, is_doubles, creator_user_id, top_per_group, requires_registration, courts, start_time")
            .eq("share_id", value: shareID)
            .single()
            .execute()
            .value

        async let groups: [QTGroup] = client
            .from("quick_table_groups")
            .select("id, name, display_order")
            .eq("table_id", value: table.id)
            .order("display_order", ascending: true)
            .execute().value
        async let players: [QTPlayer] = client
            .from("quick_table_players")
            .select("id, group_id, name, player1_name, player2_name, team, seed, matches_played, matches_won, points_for, points_against, point_diff, is_qualified, is_wildcard, playoff_seed")
            .eq("table_id", value: table.id)
            .execute().value
        async let matches: [QTMatch] = client
            .from("quick_table_matches")
            .select("id, group_id, is_playoff, playoff_round, playoff_match_number, player1_id, player2_id, score1, score2, winner_id, status, court_name, court_id, start_at, display_order, score_version")
            .eq("table_id", value: table.id)
            .execute().value

        return QuickTableDetail(table: table, groups: try await groups,
                                players: try await players, matches: try await matches)
    }

    // MARK: Create (faithful port of the web 3-step wizard + setup)

    /// All wizard inputs. Mirrors `create_quick_table_with_quota` params +
    /// the post-create PATCH (default_sets / rating_source / DUPR range).
    struct CreateOptions {
        var name: String
        var playerCount: Int
        var format: String            // round_robin | large_playoff
        var groupCount: Int?          // round_robin only
        var requiresRegistration: Bool
        var isDoubles: Bool
        var defaultSets: Int          // 1 | 3 | 5
        var requiresSkillLevel: Bool
        var ratingSource: String      // self | dupr | either
        var minDupr: Double?
        var maxDupr: Double?
        var autoApprove: Bool
        var registrationMessage: String?
    }

    private struct CreateParams: Encodable {
        let _name: String
        let _player_count: Int
        let _format: String
        let _group_count: Int?
        let _requires_registration: Bool
        let _requires_skill_level: Bool
        let _auto_approve_registrations: Bool
        let _registration_message: String?
        let _is_doubles: Bool
    }
    private struct CreateResult: Decodable {
        let success: Bool
        let error: String?
        let table: QTTable?
    }
    private struct PostCreatePatch: Encodable {
        let default_sets: Int?
        let rating_source: String?
        let min_skill_level: Double?
        let max_skill_level: Double?
    }
    private struct CourtSettingsUpdate: Encodable { let courts: [String]; let start_time: String? }

    /// Step 1–3 of the wizard: creates the `quick_tables` row via the quota RPC
    /// (status stays `setup`). Roster is entered separately (web parity).
    /// Returns the created table (need id + share_id + requires_registration).
    func createTable(_ o: CreateOptions) async throws -> QTTable {
        let result: CreateResult = try await client
            .rpc("create_quick_table_with_quota", params: CreateParams(
                _name: String(o.name.prefix(100)),
                _player_count: max(2, min(200, o.playerCount)),
                _format: o.format,
                _group_count: o.format == "round_robin" ? o.groupCount : nil,
                _requires_registration: o.requiresRegistration,
                _requires_skill_level: o.requiresRegistration ? (o.requiresSkillLevel || o.ratingSource != "self") : false,
                _auto_approve_registrations: o.requiresRegistration ? o.autoApprove : false,
                _registration_message: o.requiresRegistration ? o.registrationMessage?.nonEmpty : nil,
                _is_doubles: o.isDoubles
            ))
            .execute().value
        guard result.success, let table = result.table else {
            throw NSError(domain: "quicktable", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMessage(result.error)])
        }
        // Post-create PATCH for fields the RPC doesn't know (web Sprint B1.3).
        let wantsDupr = o.requiresRegistration && o.requiresSkillLevel && o.ratingSource != "self"
        if o.defaultSets > 1 || wantsDupr {
            try await client.from("quick_tables").update(PostCreatePatch(
                default_sets: o.defaultSets > 1 ? o.defaultSets : nil,
                rating_source: wantsDupr ? o.ratingSource : nil,
                min_skill_level: wantsDupr ? o.minDupr : nil,
                max_skill_level: wantsDupr ? o.maxDupr : nil
            )).eq("id", value: table.id).execute()
        }
        return table
    }

    struct RosterEntry {
        let name: String                 // nhãn gộp ("A & B" cho đôi, tên cho đơn)
        var player1Name: String? = nil
        var player2Name: String? = nil
        let team: String?
        let seed: Int?
    }

    private struct AtomicRosterEntry: Encodable {
        let name: String
        let player1_name: String?
        let player2_name: String?
        let team: String?
        let seed: Int?
    }
    private struct AtomicRosterParams: Encodable {
        let p_table_id: String
        let p_roster: [AtomicRosterEntry]
        let p_group_assignments: [Int]
        let p_courts: [Int]
        let p_start_time: String?
    }
    private struct AtomicLifecycleResult: Decodable {
        let success: Bool
        let error: String?
        let detail: String?
    }

    /// The setup plan is computed locally for UI parity, then the database
    /// validates and commits roster, groups, all RR matches, court schedule and
    /// lifecycle status in one transaction.
    func setupRoster(tableID: UUID, players: [RosterEntry], groupCount: Int,
                     courts: [String], startTime: String?) async throws {
        let roster = players
            .map { RosterEntry(name: $0.name.trimmingCharacters(in: .whitespacesAndNewlines),
                               player1Name: $0.player1Name?.nonEmpty, player2Name: $0.player2Name?.nonEmpty,
                               team: $0.team?.nonEmpty, seed: $0.seed) }
            .filter { !$0.name.isEmpty }
        let groups = max(1, groupCount)
        let identities = roster.enumerated().map { index, entry in
            (id: UUID(), index: index, team: entry.team, seed: entry.seed)
        }
        let buckets = Self.distribute(
            identities.map { (id: $0.id, team: $0.team, seed: $0.seed) },
            groupCount: groups
        )
        let indexByID = Dictionary(uniqueKeysWithValues: identities.map { ($0.id, $0.index) })
        var assignments = Array(repeating: -1, count: roster.count)
        for (groupIndex, ids) in buckets.enumerated() {
            for id in ids {
                if let index = indexByID[id] { assignments[index] = groupIndex }
            }
        }

        let result: AtomicLifecycleResult = try await client
            .rpc("setup_quick_table_roster_atomic", params: AtomicRosterParams(
                p_table_id: tableID.uuidString.lowercased(),
                p_roster: roster.map { AtomicRosterEntry(
                    name: $0.name, player1_name: $0.player1Name,
                    player2_name: $0.player2Name, team: $0.team, seed: $0.seed
                ) },
                p_group_assignments: assignments,
                p_courts: courts.compactMap { Int($0.trimmingCharacters(in: .whitespaces)) },
                p_start_time: startTime?.nonEmpty
            ))
            .execute().value
        guard result.success else {
            throw NSError(
                domain: "quicktable", code: 2,
                userInfo: [NSLocalizedDescriptionKey: result.detail ?? result.error ?? "Không thể tạo bảng đấu."]
            )
        }
    }

    /// Snake-draft distribution (seed-aware + team-spread). Port of web
    /// distributePlayersToGroups: seeded players snake across groups avoiding
    /// teammates; unseeded fill by most-room, also team-spread.
    static func distribute(_ players: [(id: UUID, team: String?, seed: Int?)], groupCount k: Int) -> [[UUID]] {
        guard k > 0 else { return [] }
        let total = players.count
        let base = total / k
        let rem = total % k
        let targetSizes = (0..<k).map { base + ($0 < rem ? 1 : 0) }

        var groups: [[(id: UUID, team: String?, seed: Int?)]] = Array(repeating: [], count: k)
        func teamCount(_ g: Int, _ team: String?) -> Int {
            guard let team else { return 0 }
            return groups[g].filter { $0.team == team }.count
        }
        func isFull(_ g: Int) -> Bool { groups[g].count >= targetSizes[g] }
        func bestGroup(team: String?, preferred: [Int]?) -> Int {
            let available = (0..<k).filter { !isFull($0) }
            if available.isEmpty { return 0 }
            let pref = preferred?.filter { !isFull($0) } ?? available
            let cands = pref.isEmpty ? available : pref
            guard let team else { return cands[0] }
            let noMate = cands.filter { teamCount($0, team) == 0 }
            if !noMate.isEmpty { return noMate[0] }
            return cands.sorted { teamCount($0, team) < teamCount($1, team) }[0]
        }

        let seeded = players.filter { ($0.seed ?? 0) > 0 }.sorted { ($0.seed ?? 0) < ($1.seed ?? 0) }
        let unseeded = players.filter { ($0.seed ?? 0) <= 0 }

        var dir = 1, idx = 0
        for p in seeded {
            var pref: [Int] = []
            if dir == 1 {
                pref.append(contentsOf: idx..<k)
                if idx - 1 >= 0 { pref.append(contentsOf: stride(from: idx - 1, through: 0, by: -1)) }
            } else {
                pref.append(contentsOf: stride(from: idx, through: 0, by: -1))
                if idx + 1 < k { pref.append(contentsOf: (idx + 1)..<k) }
            }
            groups[bestGroup(team: p.team, preferred: pref)].append(p)
            idx += dir
            if idx >= k { idx = k - 1; dir = -1 } else if idx < 0 { idx = 0; dir = 1 }
        }

        var freq: [String: Int] = [:]
        for p in unseeded { if let t = p.team { freq[t, default: 0] += 1 } }
        let sortedUnseeded = unseeded.sorted { (freq[$0.team ?? ""] ?? 0) > (freq[$1.team ?? ""] ?? 0) }
        for p in sortedUnseeded {
            let byRoom = (0..<k).filter { !isFull($0) }
                .sorted { (targetSizes[$0] - groups[$0].count) > (targetSizes[$1] - groups[$1].count) }
            groups[bestGroup(team: p.team, preferred: byRoom.isEmpty ? nil : byRoom)].append(p)
        }

        return groups.map { $0.map(\.id) }
    }

    private func errorMessage(_ code: String?) -> String {
        switch code {
        case "LIMIT_REACHED": return "Bạn đã đạt giới hạn số giải. Hãy xóa bớt giải cũ."
        case "AUTH_REQUIRED": return "Cần đăng nhập để tạo giải."
        default: return code ?? "Không tạo được giải."
        }
    }

    /// Circle-method (Berger) round-robin pairings. Port of web round-robin.ts.
    struct RRPair { let p1: UUID; let p2: UUID; let round: Int; let index: Int }
    static func circleMethod(_ playerIDs: [UUID]) -> [RRPair] {
        guard playerIDs.count >= 2 else { return [] }
        var players = playerIDs.map { Optional($0) }
        if players.count % 2 == 1 { players.append(nil) } // BYE
        let n = players.count
        let rounds = n - 1
        let perRound = n / 2
        var rotating = Array(players[1...])
        var pairs: [RRPair] = []
        for round in 0..<rounds {
            let order = [players[0]] + rotating
            var indexInRound = 0
            for i in 0..<perRound {
                let a = order[i]
                let b = order[n - 1 - i]
                if let a, let b {
                    pairs.append(RRPair(p1: a, p2: b, round: round + 1, index: indexInRound))
                    indexInRound += 1
                }
            }
            rotating.insert(rotating.removeLast(), at: 0)
        }
        return pairs
    }

    // MARK: Court + time scheduling (port of round-robin.ts scheduleMatches + reassignCourtsAndTimes)

    struct SchedulableMatch { let matchID: UUID; let player1: UUID?; let player2: UUID?; let groupIndex: Int }
    struct ScheduledMatch { let matchID: UUID; let court: Int; let startAt: String?; let displayOrder: Int }

    private struct ScheduleUpdate: Encodable { let court_id: Int; let start_at: String?; let display_order: Int }
    private struct ClearScheduleUpdate: Encodable { let court_id: Int?; let start_at: String? }

    /// Assign group-stage matches to courts + time slots. 1:1 port of web
    /// `scheduleMatches`: reconstructs RR rounds (circle method) so play spreads
    /// across rounds, greedily places matches earliest-slot / least-loaded court,
    /// never double-books a player in a slot nor lets a pair run 3 in a row.
    static func scheduleMatches(_ matches: [SchedulableMatch], courts: [Int], numGroups: Int,
                                startTime: String?, matchDurationMinutes: Int = 20) -> [ScheduledMatch] {
        guard !courts.isEmpty, !matches.isEmpty else { return [] }

        func pairKey(_ a: UUID, _ b: UUID) -> String {
            let sa = a.uuidString, sb = b.uuidString
            return sa < sb ? "\(sa)|\(sb)" : "\(sb)|\(sa)"
        }
        var playersByGroup: [Int: Set<UUID>] = [:]
        for m in matches {
            var set = playersByGroup[m.groupIndex] ?? []
            if let p = m.player1 { set.insert(p) }
            if let p = m.player2 { set.insert(p) }
            playersByGroup[m.groupIndex] = set
        }
        var roundOf: [UUID: Int] = [:]
        for (gi, set) in playersByGroup {
            let circ = circleMethod(set.sorted { $0.uuidString < $1.uuidString })
            var byPair: [String: Int] = [:]
            for c in circ { byPair[pairKey(c.p1, c.p2)] = c.round }
            for m in matches where m.groupIndex == gi {
                if let p1 = m.player1, let p2 = m.player2 {
                    roundOf[m.matchID] = byPair[pairKey(p1, p2)] ?? 999
                }
            }
        }
        let roundOrdered = matches.sorted {
            let ra = roundOf[$0.matchID] ?? 999, rb = roundOf[$1.matchID] ?? 999
            return ra != rb ? ra < rb : $0.groupIndex < $1.groupIndex
        }

        let homeCount = min(numGroups, courts.count)
        var homeCourtByGroup: [Int: Int] = [:]
        for i in 0..<homeCount { homeCourtByGroup[i] = courts[i] }
        let spareCourts = Array(courts[homeCount...])

        var courtSlotBusy: Set<String> = []
        var playerSlots: [UUID: Set<Int>] = [:]
        var load: [Int: Int] = [:]
        for c in courts { load[c] = 0 }

        func wouldRun3(_ p: UUID?, _ s: Int) -> Bool {
            guard let p, let set = playerSlots[p] else { return false }
            func h(_ x: Int) -> Bool { set.contains(x) }
            return (h(s - 1) && h(s - 2)) || (h(s - 1) && h(s + 1)) || (h(s + 1) && h(s + 2))
        }
        func slotOk(_ court: Int, _ slot: Int, _ p1: UUID?, _ p2: UUID?) -> Bool {
            if courtSlotBusy.contains("\(court):\(slot)") { return false }
            if let p1, playerSlots[p1]?.contains(slot) == true { return false }
            if let p2, playerSlots[p2]?.contains(slot) == true { return false }
            return !wouldRun3(p1, slot) && !wouldRun3(p2, slot)
        }

        var picked: [UUID: (court: Int, slot: Int)] = [:]
        for m in roundOrdered {
            let candidates = homeCourtByGroup[m.groupIndex].map { [$0] + spareCourts } ?? courts
            var best: (court: Int, slot: Int)?
            for court in candidates {
                var slot = 0
                while !slotOk(court, slot, m.player1, m.player2) { slot += 1 }
                if best == nil || slot < best!.slot ||
                    (slot == best!.slot && (load[court] ?? 0) < (load[best!.court] ?? 0)) {
                    best = (court, slot)
                }
            }
            let chosen = best!
            picked[m.matchID] = chosen
            courtSlotBusy.insert("\(chosen.court):\(chosen.slot)")
            for p in [m.player1, m.player2].compactMap({ $0 }) {
                var set = playerSlots[p] ?? []
                set.insert(chosen.slot)
                playerSlots[p] = set
            }
            load[chosen.court] = (load[chosen.court] ?? 0) + 1
        }

        var startMins: Int?
        if let startTime {
            let parts = startTime.split(separator: ":").compactMap { Int($0) }
            if parts.count == 2 { startMins = parts[0] * 60 + parts[1] }
        }
        func slotToTime(_ slot: Int) -> String? {
            guard let startMins else { return nil }
            let t = startMins + slot * matchDurationMinutes
            return String(format: "%02d:%02d", (t / 60) % 24, t % 60)
        }

        let ordered = matches.sorted {
            let pa = picked[$0.matchID]!, pb = picked[$1.matchID]!
            return pa.slot != pb.slot ? pa.slot < pb.slot : pa.court < pb.court
        }
        var displayOrderByMatch: [UUID: Int] = [:]
        for (i, m) in ordered.enumerated() { displayOrderByMatch[m.matchID] = i }

        return matches.map { m in
            let p = picked[m.matchID]!
            return ScheduledMatch(matchID: m.matchID, court: p.court,
                                  startAt: slotToTime(p.slot), displayOrder: displayOrderByMatch[m.matchID]!)
        }
    }

    /// Save courts + start time on the table row (web `updateTableCourtSettings`).
    func updateCourtSettings(tableID: UUID, courts: [String], startTime: String?) async throws {
        try await client.from("quick_tables")
            .update(CourtSettingsUpdate(courts: courts, start_time: startTime?.nonEmpty))
            .eq("id", value: tableID).execute()
    }

    /// Schedule group-stage matches onto courts + times and rewrite display_order
    /// (web `reassignCourtsAndTimes`). Empty courts → clear court_id/start_at.
    func reassignCourtsAndTimes(tableID: UUID, courts: [Int], startTime: String?,
                                groups: [QTGroup], matches: [QTMatch]) async throws {
        let groupMatches = matches.filter { !$0.isPlayoff && $0.groupID != nil }
        if courts.isEmpty {
            let ids = groupMatches.map { $0.id.uuidString.lowercased() }
            guard !ids.isEmpty else { return }
            try await client.from("quick_table_matches")
                .update(ClearScheduleUpdate(court_id: nil, start_at: nil))
                .in("id", values: ids).execute()
            return
        }
        let groupIndex = Dictionary(uniqueKeysWithValues: groups.enumerated().map { ($1.id, $0) })
        let schedulable = groupMatches.map {
            SchedulableMatch(matchID: $0.id, player1: $0.player1ID, player2: $0.player2ID,
                             groupIndex: $0.groupID.flatMap { groupIndex[$0] } ?? 0)
        }
        let scheduled = Self.scheduleMatches(schedulable, courts: courts, numGroups: groups.count, startTime: startTime?.nonEmpty)
        for s in scheduled {
            try await client.from("quick_table_matches")
                .update(ScheduleUpdate(court_id: s.court, start_at: s.startAt, display_order: s.displayOrder))
                .eq("id", value: s.matchID).execute()
        }
    }

    // MARK: Registration (port of useRegistration)

    /// All registrations for a table (BTC view), oldest first.
    func fetchRegistrations(tableID: UUID) async -> [QTRegistration] {
        (try? await client.from("quick_table_registrations")
            .select("id, user_id, display_name, team, rating_system, skill_level, profile_link, status, created_at")
            .eq("table_id", value: tableID).order("created_at", ascending: true)
            .execute().value) ?? []
    }

    /// The signed-in user's own registration, if any.
    func userRegistration(tableID: UUID, userID: UUID) async -> QTRegistration? {
        let rows: [QTRegistration]? = try? await client.from("quick_table_registrations")
            .select("id, user_id, display_name, team, rating_system, skill_level, profile_link, status, created_at")
            .eq("table_id", value: tableID).eq("user_id", value: userID).limit(1)
            .execute().value
        return rows?.first
    }

    enum SubmitRegistrationResult: Equatable { case ok, duplicate, notAuthed, error(String) }

    private struct RegistrationInsert: Encodable {
        let table_id: String; let user_id: String; let display_name: String
        let team: String?; let rating_system: String; let skill_level: Double?; let profile_link: String?
    }
    func submitRegistration(tableID: UUID, displayName: String, team: String?,
                            ratingSystem: String, skillLevel: Double?, profileLink: String?) async -> SubmitRegistrationResult {
        guard let uid = await currentUserID() else { return .notAuthed }
        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return .error("Tên không được để trống") }
        do {
            try await client.from("quick_table_registrations").insert(RegistrationInsert(
                table_id: tableID.uuidString.lowercased(), user_id: uid.uuidString.lowercased(),
                display_name: name, team: team?.nonEmpty, rating_system: ratingSystem,
                skill_level: skillLevel, profile_link: profileLink?.nonEmpty)).execute()
            return .ok
        } catch {
            // Postgres unique_violation (already registered).
            if "\(error)".contains("23505") { return .duplicate }
            return .error(error.localizedDescription)
        }
    }

    func cancelRegistration(id: UUID) async throws {
        try await client.from("quick_table_registrations").delete().eq("id", value: id).execute()
    }

    private struct RegStatusUpdate: Encodable { let status: String }
    func setRegistrationStatus(id: UUID, status: String) async throws {
        try await client.from("quick_table_registrations").update(RegStatusUpdate(status: status)).eq("id", value: id).execute()
    }
    func bulkApprove(ids: [UUID]) async throws {
        guard !ids.isEmpty else { return }
        try await client.from("quick_table_registrations")
            .update(RegStatusUpdate(status: "approved"))
            .in("id", values: ids.map { $0.uuidString.lowercased() }).execute()
    }

    // MARK: Playoff generation

    private struct AtomicQualifier: Encodable {
        let player_id: String
        let playoff_seed: Int
        let is_wildcard: Bool
    }
    private struct AtomicFirstRoundMatch: Encodable {
        let player1_id: String?
        let player2_id: String?
        let bracket_position: String
        let match_number: Int
    }
    private struct AtomicPlayoffParams: Encodable {
        let p_table_id: String
        let p_qualifiers: [AtomicQualifier]
        let p_first_round: [AtomicFirstRoundMatch]
    }

    /// Marks qualifiers, validates the confirmed first round, pre-creates all
    /// downstream rounds (including BYE propagation), and changes table status
    /// in one database transaction.
    func createPlayoff(
        tableID: UUID,
        qualified: [(playerID: UUID, seed: Int)],
        wildcards: [(playerID: UUID, seed: Int)],
        firstRound: [QTBracketMatch]
    ) async throws {
        let qualifiers = qualified.map {
            AtomicQualifier(player_id: $0.playerID.uuidString.lowercased(),
                            playoff_seed: $0.seed, is_wildcard: false)
        } + wildcards.map {
            AtomicQualifier(player_id: $0.playerID.uuidString.lowercased(),
                            playoff_seed: $0.seed, is_wildcard: true)
        }
        let result: AtomicLifecycleResult = try await client
            .rpc("create_quick_table_playoff_atomic", params: AtomicPlayoffParams(
                p_table_id: tableID.uuidString.lowercased(),
                p_qualifiers: qualifiers,
                p_first_round: firstRound.map {
                    AtomicFirstRoundMatch(
                        player1_id: $0.player1?.uuidString.lowercased(),
                        player2_id: $0.player2?.uuidString.lowercased(),
                        bracket_position: $0.position,
                        match_number: $0.matchNumber
                    )
                }
            ))
            .execute().value
        guard result.success else {
            throw NSError(
                domain: "quicktable", code: 3,
                userInfo: [NSLocalizedDescriptionKey: result.detail ?? result.error ?? "Không thể tạo playoff."]
            )
        }
    }

    // MARK: Score

    // MARK: Result rules (ARCH-04 pre-work)

    /// Web twin: src/lib/quickTableResult.ts — keep the rules identical;
    /// mirror tests in apple/Tests/QuickTableResultTests.swift. Known
    /// divergence: web saves a tie as completed with a null winner, Swift
    /// score() refuses to save a tie at all.
    struct GroupStat: Equatable {
        var played = 0
        var won = 0
        var pf = 0
        var pa = 0
    }

    /// Single-elimination playoff advancement: winner at `position` within
    /// its round seats into next-round match position/2, slot 1 for even
    /// positions. Web twin: playoffAdvanceTarget.
    static func advanceTarget(position: Int) -> (nextMatchIndex: Int, slot1: Bool) {
        (position / 2, position % 2 == 0)
    }

    /// Group-stage standings accumulation. Matches with a missing player or
    /// score are skipped; players outside `playerIDs` are ignored; a tie
    /// counts as played for both, won by neither. Web twin: accumulateGroupStats.
    static func accumulateGroupStats(
        matches: [(p1: UUID?, p2: UUID?, s1: Int?, s2: Int?)],
        playerIDs: [UUID]
    ) -> [UUID: GroupStat] {
        var stats: [UUID: GroupStat] = [:]
        for id in playerIDs { stats[id] = GroupStat() }
        for m in matches {
            guard let p1 = m.p1, let p2 = m.p2, let s1 = m.s1, let s2 = m.s2 else { continue }
            if stats[p1] != nil {
                stats[p1]!.played += 1; stats[p1]!.pf += s1; stats[p1]!.pa += s2
                if s1 > s2 { stats[p1]!.won += 1 }
            }
            if stats[p2] != nil {
                stats[p2]!.played += 1; stats[p2]!.pf += s2; stats[p2]!.pa += s1
                if s2 > s1 { stats[p2]!.won += 1 }
            }
        }
        return stats
    }

    private struct AtomicScoreParams: Encodable {
        let p_match_id: String
        let p_score1: Int
        let p_score2: Int
        let p_expected_version: Int64
    }

    /// Score, group-stat recompute, and playoff propagation commit together.
    func score(match: QTMatch, score1: Int, score2: Int) async throws {
        let result: AtomicTournamentMutationResult = try await client
            .rpc("score_quick_table_match_atomic", params: AtomicScoreParams(
                p_match_id: match.id.uuidString.lowercased(),
                p_score1: score1,
                p_score2: score2,
                p_expected_version: match.scoreVersion
            ))
            .execute().value
        try result.requireSuccess()
    }
}
