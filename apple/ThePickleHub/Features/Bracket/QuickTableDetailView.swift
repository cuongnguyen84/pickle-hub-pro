import SwiftUI

@Observable
@MainActor
final class QuickTableViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(QuickTableDetail)
        case failed(String)
    }

    enum Tab: String, CaseIterable, Identifiable {
        case groups, playoff, courts
        var id: String { rawValue }
    }

    var phase: Phase = .loading
    var editable = false      // creator, admin hoặc referee
    var canManage = false     // creator hoặc admin; referee chỉ chấm điểm
    var tab: Tab = .groups
    var selectedGroupID: UUID?
    var scoringMatch: QTMatch?
    var scoreError: String?
    var scoreSaving = false

    // Registration
    var currentUID: UUID?
    var duprIdentity = TournamentService.DuprIdentity(connected: false, rating: nil)
    var registrations: [QTRegistration] = []
    var teams: [QTTeamRegistration] = []
    var myTeam: QTTeamRegistration?
    var teamInvitations: [QTPartnerInvitation] = []
    var incomingPairRequests: [QTPairRequest] = []
    var outgoingPairRequests: [QTPairRequest] = []
    var showTeams = false
    var showTeamRegister = false
    var teamBusy = false
    var teamError: String?
    var referees: [QTReferee] = []
    var showReferees = false
    var newRefEmail = ""
    var refBusy = false
    var refMessage: String?
    var myRegistration: QTRegistration?
    var showRegistrations = false
    var showSelfRegister = false
    var regBusy = false
    var regError: String?

    // Playoff generation
    var generatingPlayoff = false
    var playoffError: String?
    var showWildcard = false
    var wildcardNeed = 0
    var wildcardCandidates: [QTPlayer] = []
    private var pendingQualified: [(player: QTPlayer, seed: Int)] = []

    // V2: người dùng chọn cỡ bracket (vd 3 bảng → 4/8, 6 bảng → 8/16). BYE tự tính.
    struct BracketOption: Identifiable {
        let advancePerGroup: Int
        let bracketSize: Int
        let wildcards: Int
        let byes: Int
        var id: Int { advancePerGroup }
        var buttonLabel: String {
            var parts = ["\(bracketSize) người", advancePerGroup == 2 ? "top-2 mỗi bảng" : "nhất bảng"]
            if wildcards > 0 { parts.append("+\(wildcards) wildcard") }
            if byes > 0 { parts.append("+\(byes) BYE") }
            return parts.joined(separator: " · ")
        }
    }
    var showBracketChoice = false
    var bracketOptions: [BracketOption] = []

    // Courts + schedule (organizer)
    var showSchedule = false
    var scheduleBusy = false
    var scheduleError: String?

    private let repo = QuickTableRepository()
    private let refreshGate = TournamentRefreshGate()
    private var realtime: TournamentRealtimeSubscription?
    private var realtimeTableID: UUID?

    var detail: QuickTableDetail? { if case .loaded(let d) = phase { return d } ; return nil }

    func stop() async {
        let subscription = realtime
        realtime = nil
        realtimeTableID = nil
        await subscription?.stop()
    }

    /// Organizer: save courts + start time on the table, then (re)schedule every
    /// group match onto a court + time slot. Empty courts clears the schedule.
    @MainActor
    func saveSchedule(shareID: String, courtsText: String, startTime: String) async {
        guard let detail else { return }
        scheduleBusy = true; scheduleError = nil
        let courtsStrings = courtsText.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let courtInts = courtsStrings.compactMap { Int($0) }
        let time = startTime.trimmingCharacters(in: .whitespaces).nonEmpty
        do {
            try await repo.updateCourtSettings(tableID: detail.table.id, courts: courtsStrings, startTime: time)
            try await repo.reassignCourtsAndTimes(tableID: detail.table.id, courts: courtInts, startTime: time,
                                                  groups: detail.groups, matches: detail.matches)
            scheduleBusy = false
            showSchedule = false
            await load(shareID: shareID)
        } catch {
            scheduleError = error.localizedDescription
            scheduleBusy = false
        }
    }

    @MainActor
    func saveCourtName(matchID: UUID, name: String, shareID: String) async {
        scheduleBusy = true
        scheduleError = nil
        do {
            try await repo.updateCourtName(
                matchID: matchID,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            await load(shareID: shareID)
        } catch {
            scheduleError = error.localizedDescription
        }
        scheduleBusy = false
    }

    @MainActor
    func load(shareID: String) async {
        await refreshGate.perform { [weak self] in
            await self?.loadOnce(shareID: shareID)
        }
    }

    @MainActor
    func reloadDupr() async {
        duprIdentity = await TournamentService.shared.currentUserDupr()
    }

    private func loadOnce(shareID: String) async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let detail = try await repo.load(shareID: shareID)
            let uid = await TournamentService.shared.currentUserID()
            let isOwner = detail.table.creatorUserID != nil && detail.table.creatorUserID == uid
            let isAdmin = await TournamentService.shared.isCurrentUserAdmin()
            canManage = isOwner || isAdmin
            if canManage {
                editable = true
            } else if let uid {
                editable = await repo.isReferee(tableID: detail.table.id, userID: uid)
            } else {
                editable = false
            }
            currentUID = uid
            duprIdentity = await TournamentService.shared.currentUserDupr()
            if detail.table.requiresRegistration == true {
                if detail.table.isDoubles == true {
                    teams = canManage
                        ? await repo.fetchTeams(tableID: detail.table.id)
                        : await repo.fetchVisibleTeams(tableID: detail.table.id)
                    if let uid {
                        myTeam = await repo.userTeam(tableID: detail.table.id, userID: uid)
                        if let team = myTeam {
                            teamInvitations = await repo.invitations(teamID: team.id)
                            incomingPairRequests = await repo.incomingPairRequests(
                                tableID: detail.table.id,
                                userID: uid
                            )
                            outgoingPairRequests = await repo.outgoingPairRequests(
                                tableID: detail.table.id,
                                userID: uid
                            )
                        }
                    }
                } else {
                    if let uid { myRegistration = await repo.userRegistration(tableID: detail.table.id, userID: uid) }
                    registrations = canManage
                        ? await repo.fetchRegistrations(tableID: detail.table.id)
                        : await repo.fetchApprovedRegistrations(tableID: detail.table.id)
                }
                if canManage {
                    referees = await repo.fetchReferees(tableID: detail.table.id)
                }
            }
            if selectedGroupID == nil || !detail.groups.contains(where: { $0.id == selectedGroupID }) {
                selectedGroupID = detail.groups.first?.id
            }
            // Default to playoff tab once it exists and group stage is done.
            if detail.hasPlayoff && detail.table.isPlayoffStage && tab == .groups && detail.groups.isEmpty == false {
                // keep current tab; don't force-switch so the user can browse groups
            }
            phase = .loaded(detail)
            await ensureRealtime(detail.table.id, shareID: shareID)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func ensureRealtime(_ tableID: UUID, shareID: String) async {
        guard realtimeTableID != tableID else { return }
        let previous = realtime
        realtime = nil
        realtimeTableID = tableID
        await previous?.stop()
        realtime = TournamentService.shared.watchQuickTable(tableID: tableID) { [weak self] in
            guard let self else { return }
            await self.load(shareID: shareID)
        }
    }

    @MainActor
    func startPlayoff(shareID: String) async {
        guard let d = detail else { return }
        // V2 (native): cho người dùng chọn cỡ bracket (4/8, 8/16…). BYE tự tính.
        // Web/Android giữ nguyên; đây chỉ là app native /apple.
        if QTSeedingV2.enabled {
            let opts = bracketOptionsV2(d)
            if opts.isEmpty { playoffError = "Không đủ người để sinh playoff."; return }
            if opts.count == 1 {
                await runPlayoffV2(shareID: shareID, advancePerGroup: opts[0].advancePerGroup)
            } else {
                bracketOptions = opts
                showBracketChoice = true
            }
            return
        }
        let need = QTPlayoff.wildcardCount(groupCount: d.groups.count)
        let q = QTPlayoff.qualify(groups: d.groups, players: d.players, topPerGroup: d.table.topPerGroup ?? 2)
        pendingQualified = q.qualified
        if need > 0 {
            wildcardNeed = need
            wildcardCandidates = QTPlayoff.rankThirdPlace(q.thirdPlace)
            showWildcard = true
        } else {
            await runPlayoff(shareID: shareID, wildcards: [])
        }
    }

    @MainActor
    func confirmWildcards(shareID: String, selectedIDs: [UUID]) async {
        showWildcard = false
        // Preserve ranked candidate order (markQualified seeds 100+i by this order).
        let selected = wildcardCandidates.filter { selectedIDs.contains($0.id) }
        await runPlayoff(shareID: shareID, wildcards: selected)
    }

    @MainActor
    private func runPlayoff(shareID: String, wildcards: [QTPlayer]) async {
        guard let d = detail else { return }
        let bracket = QTPlayoff.bracket(groupCount: d.groups.count, qualified: pendingQualified,
                                        wildcards: wildcards, groups: d.groups)
        guard !bracket.isEmpty else {
            playoffError = "Số bảng (\(d.groups.count)) chưa hỗ trợ sinh playoff native."
            return
        }
        generatingPlayoff = true; playoffError = nil
        do {
            try await repo.createPlayoff(
                tableID: d.table.id,
                qualified: pendingQualified.map { ($0.player.id, $0.seed) },
                wildcards: wildcards.enumerated().map { ($0.element.id, 100 + $0.offset) },
                firstRound: bracket
            )
            await load(shareID: shareID)
            tab = .playoff
        } catch { playoffError = error.localizedDescription }
        generatingPlayoff = false
    }

    /// Cỡ bracket khả dĩ cho số bảng hiện tại: advancePerGroup ∈ {2,1} mà mọi bảng đủ người.
    /// Mỗi option kèm số wildcard + BYE (tự tính). 2 đứng trước (bracket lớn hơn).
    func bracketOptionsV2(_ d: QuickTableDetail) -> [BracketOption] {
        let G = d.groups.count
        let sizes = d.groups.map { g in d.players.filter { $0.groupID == g.id }.count }
        var opts: [BracketOption] = []
        for A in [2, 1] {
            guard G >= 2, sizes.allSatisfy({ $0 >= A }) else { continue }  // mỗi bảng đủ A người
            let plan = QTSeedingV2.computeSeedingPlan(groupCount: G, advancePerGroup: A)
            let candidates = sizes.filter { $0 > A }.count                  // bảng có hạng (A+1)
            let wild = min(plan.wildcardCount, candidates)
            let byes = plan.bracketSize - plan.directSpots - wild
            opts.append(BracketOption(advancePerGroup: A, bracketSize: plan.bracketSize,
                                      wildcards: wild, byes: byes))
        }
        return opts
    }

    @MainActor
    func chooseBracket(shareID: String, advancePerGroup: Int) async {
        showBracketChoice = false
        await runPlayoffV2(shareID: shareID, advancePerGroup: advancePerGroup)
    }

    /// V2: seeding tổng quát (QTSeedingV2) — auto chọn wildcard theo best (A+1)-place,
    /// pad BYE nếu thiếu, cặp đấu theo seed chuẩn + resolve trùng bảng. `advancePerGroup` do user chọn.
    @MainActor
    private func runPlayoffV2(shareID: String, advancePerGroup: Int) async {
        guard let d = detail else { return }
        generatingPlayoff = true; playoffError = nil
        do {
            let result = try QTSeedingV2.generateSeeding(
                groups: d.groups, players: d.players, matches: d.matches,
                advancePerGroup: advancePerGroup)
            let resolved = QTSeedingV2.resolveGroupConflicts(QTSeedingV2.pairings(result.seeded))
            let bracket = QTSeedingV2.toBracketMatches(resolved)
            let directs = result.seeded
                .filter { $0.tier == .winner || $0.tier == .runnerUp }
                .compactMap { s in s.playerID.map { (playerID: $0, seed: s.seed) } }
            let wildcards = result.seeded
                .filter { $0.tier == .wildcard }
                .compactMap { s in s.playerID.map { (playerID: $0, seed: s.seed) } }
            try await repo.createPlayoff(
                tableID: d.table.id,
                qualified: directs,
                wildcards: wildcards,
                firstRound: bracket
            )
            await load(shareID: shareID)
            tab = .playoff
        } catch let e as QTSeedingV2.SeedingError {
            playoffError = e.message
        } catch {
            playoffError = error.localizedDescription
        }
        generatingPlayoff = false
    }

    // MARK: Registration actions

    @MainActor func reloadRegistrations() async {
        guard let d = detail else { return }
        registrations = canManage
            ? await repo.fetchRegistrations(tableID: d.table.id)
            : await repo.fetchApprovedRegistrations(tableID: d.table.id)
        if let uid = currentUID { myRegistration = await repo.userRegistration(tableID: d.table.id, userID: uid) }
    }

    @MainActor func approve(_ id: UUID) async {
        regBusy = true; regError = nil
        do { try await repo.setRegistrationStatus(id: id, status: "approved"); await reloadRegistrations() }
        catch { regError = error.localizedDescription }
        regBusy = false
    }
    @MainActor func reject(_ id: UUID) async {
        regBusy = true; regError = nil
        do { try await repo.setRegistrationStatus(id: id, status: "rejected"); await reloadRegistrations() }
        catch { regError = error.localizedDescription }
        regBusy = false
    }
    @MainActor func bulkApprovePending() async {
        let pending = registrations.filter { $0.status == "pending" }.map { $0.id }
        await bulkApprove(ids: pending)
    }

    @MainActor func bulkApprove(ids: [UUID]) async {
        guard !ids.isEmpty else { return }
        regBusy = true; regError = nil
        do { try await repo.bulkApprove(ids: ids); await reloadRegistrations() }
        catch { regError = error.localizedDescription }
        regBusy = false
    }

    @MainActor func updateRegistrationBTC(_ registration: QTRegistration,
                                           overrideSkill: Double?, notes: String?) async {
        regBusy = true
        regError = nil
        do {
            try await repo.updateRegistrationBTC(
                id: registration.id,
                overrideSkill: overrideSkill,
                notes: notes
            )
            await reloadRegistrations()
        } catch {
            regError = error.localizedDescription
        }
        regBusy = false
    }

    @MainActor func saveSelfRegistration(displayName: String, team: String, ratingSystem: String,
                                         skillLevel: Double?, skillSystemName: String,
                                         skillDescription: String, profileLink: String) async {
        guard let d = detail else { return }
        regBusy = true; regError = nil
        if let registration = myRegistration, registration.status == "pending" {
            do {
                try await repo.updateRegistration(
                    id: registration.id,
                    displayName: displayName,
                    team: team,
                    ratingSystem: ratingSystem,
                    skillLevel: skillLevel,
                    skillSystemName: skillSystemName,
                    skillDescription: skillDescription,
                    profileLink: profileLink
                )
                showSelfRegister = false
                await reloadRegistrations()
            } catch {
                regError = error.localizedDescription
            }
            regBusy = false
            return
        }
        let result = await repo.submitRegistration(
            tableID: d.table.id, displayName: displayName, team: team,
            ratingSystem: ratingSystem, skillLevel: skillLevel,
            skillSystemName: skillSystemName, skillDescription: skillDescription,
            profileLink: profileLink)
        switch result {
        case .ok: showSelfRegister = false; await reloadRegistrations()
        case .duplicate: regError = "Bạn đã đăng ký giải này rồi."
        case .notAuthed: regError = "Cần đăng nhập để đăng ký."
        case .error(let m): regError = m
        }
        regBusy = false
    }

    @MainActor func cancelMyRegistration() async {
        guard let reg = myRegistration else { return }
        regBusy = true; regError = nil
        do { try await repo.cancelRegistration(id: reg.id); myRegistration = nil; await reloadRegistrations() }
        catch { regError = error.localizedDescription }
        regBusy = false
    }

    // MARK: Doubles registration actions

    @MainActor func reloadTeams() async {
        guard let d = detail else { return }
        teams = canManage
            ? await repo.fetchTeams(tableID: d.table.id)
            : await repo.fetchVisibleTeams(tableID: d.table.id)
        if let uid = currentUID {
            myTeam = await repo.userTeam(tableID: d.table.id, userID: uid)
            if let team = myTeam {
                teamInvitations = await repo.invitations(teamID: team.id)
                incomingPairRequests = await repo.incomingPairRequests(tableID: d.table.id, userID: uid)
                outgoingPairRequests = await repo.outgoingPairRequests(tableID: d.table.id, userID: uid)
            } else {
                teamInvitations = []
                incomingPairRequests = []
                outgoingPairRequests = []
            }
        }
    }

    @MainActor
    func createTeam(displayName: String, team: String, rating: String,
                    skill: Double?, link: String) async {
        guard let d = detail else { return }
        teamBusy = true
        teamError = nil
        do {
            try await repo.createTeam(
                tableID: d.table.id, displayName: displayName, team: team,
                ratingSystem: rating, skillLevel: skill, profileLink: link
            )
            showTeamRegister = false
            await reloadTeams()
        } catch { teamError = error.localizedDescription }
        teamBusy = false
    }

    @MainActor
    func createTeamInvitation() async {
        guard let d = detail, let team = myTeam else { return }
        teamBusy = true
        teamError = nil
        do {
            _ = try await repo.createInvitation(teamID: team.id, tableID: d.table.id)
            await reloadTeams()
        } catch { teamError = error.localizedDescription }
        teamBusy = false
    }

    @MainActor
    func cancelTeamInvitation(_ invitation: QTPartnerInvitation) async {
        teamBusy = true
        teamError = nil
        do {
            try await repo.cancelInvitation(id: invitation.id)
            await reloadTeams()
        } catch { teamError = error.localizedDescription }
        teamBusy = false
    }

    @MainActor
    func removePartner() async {
        guard let team = myTeam else { return }
        teamBusy = true
        teamError = nil
        do {
            try await repo.removePartner(teamID: team.id)
            await reloadTeams()
        } catch { teamError = error.localizedDescription }
        teamBusy = false
    }

    @MainActor
    func createPairRequest(to team: QTTeamRegistration) async {
        guard let d = detail else { return }
        teamBusy = true
        teamError = nil
        do {
            try await repo.createPairRequest(tableID: d.table.id, toTeamID: team.id)
            Haptics.success()
            await reloadTeams()
        } catch {
            teamError = error.localizedDescription
            Haptics.error()
        }
        teamBusy = false
    }

    @MainActor
    func respondPairRequest(_ request: QTPairRequest, accept: Bool) async {
        teamBusy = true
        teamError = nil
        do {
            try await repo.respondPairRequest(id: request.id, accept: accept)
            Haptics.success()
            await reloadTeams()
        } catch {
            teamError = error.localizedDescription
            Haptics.error()
        }
        teamBusy = false
    }

    @MainActor
    func cancelPairRequest(_ request: QTPairRequest) async {
        teamBusy = true
        teamError = nil
        do {
            try await repo.cancelPairRequest(id: request.id)
            await reloadTeams()
        } catch {
            teamError = error.localizedDescription
            Haptics.error()
        }
        teamBusy = false
    }

    @MainActor
    func manageTeam(_ team: QTTeamRegistration, action: String, notes: String? = nil) async {
        teamBusy = true
        teamError = nil
        do {
            try await repo.manageTeam(teamID: team.id, action: action, notes: notes)
            await reloadTeams()
        } catch { teamError = error.localizedDescription }
        teamBusy = false
    }

    @MainActor
    func manageTeams(ids: [UUID], action: String) async {
        guard !ids.isEmpty else { return }
        teamBusy = true
        teamError = nil
        do {
            for id in ids {
                try await repo.manageTeam(teamID: id, action: action)
            }
            await reloadTeams()
        } catch {
            teamError = error.localizedDescription
        }
        teamBusy = false
    }

    @MainActor
    func loadReferees() async {
        guard let id = detail?.table.id else { return }
        referees = await repo.fetchReferees(tableID: id)
    }

    func addReferee() async {
        guard let id = detail?.table.id else { return }
        guard !newRefEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        refBusy = true; refMessage = nil
        switch await repo.addReferee(tableID: id, email: newRefEmail) {
        case .ok(let n): refMessage = "Đã thêm trọng tài \(n ?? newRefEmail)"; newRefEmail = ""; await loadReferees()
        case .notFound: refMessage = "Không tìm thấy người dùng với email này"
        case .alreadyExists: refMessage = "Người này đã là trọng tài"
        case .error: refMessage = "Không thể thêm trọng tài"
        }
        refBusy = false
    }

    func removeReferee(_ ref: QTReferee) async {
        refBusy = true; refMessage = nil
        do { try await repo.removeReferee(refereeID: ref.id); await loadReferees() }
        catch { refMessage = error.localizedDescription }
        refBusy = false
    }

    func submitScore(match: QTMatch, score1: Int, score2: Int, shareID: String) async {
        guard !scoreSaving else { return }
        scoreSaving = true
        scoreError = nil
        defer { scoreSaving = false }
        do {
            try await repo.score(match: match, score1: score1, score2: score2)
            scoringMatch = nil
            await load(shareID: shareID)
        } catch {
            scoreError = UserFacingError.message(failure: "Không lưu được tỉ số.", error: error)
            Haptics.error()
        }
    }
}

/// Native Quick Table view — standings, scoring, registration, roster/group
/// management and playoff generation all remain inside the app.
struct QuickTableDetailView: View {
    let shareID: String
    let fallbackName: String
    let initialScoringMatchID: UUID?

    @State private var model = QuickTableViewModel()
    @State private var openWeb = false
    @State private var showGroupManager = false
    @State private var courtNameMatch: QTMatch?
    @State private var didOpenInitialScore = false
    @ScaledMetric(relativeTo: .footnote) private var chevronSize: CGFloat = 11
    @Environment(\.dismiss) private var dismiss

    init(shareID: String, fallbackName: String, initialScoringMatchID: UUID? = nil) {
        self.shareID = shareID
        self.fallbackName = fallbackName
        self.initialScoringMatchID = initialScoringMatchID
    }

    var body: some View {
        managementPresentation
    }

    /// Keep the score surface separate from the management sheets. The split is
    /// intentional: a single modifier chain here is large enough to exceed the
    /// Swift type-checker's reasonable-time limit in debug builds.
    private var scorePresentation: some View {
        ScrollView {
            content.padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle(fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if model.canManage, let detail = model.detail,
                   !detail.table.isPlayoffStage, !detail.groups.isEmpty {
                    Button { showGroupManager = true } label: {
                        Image(systemName: "person.3.sequence")
                            .foregroundStyle(TLColor.accentText)
                    }
                    .accessibilityLabel("Quản lý vòng bảng")
                }
                TournamentShareButton(url: WebRoutes.quickTable(shareID: shareID))
                Button { openWeb = true } label: {
                    Image(systemName: "safari").foregroundStyle(TLColor.accentText)
                }
                .accessibilityLabel("Mở trên web")
            }
        }
        .tournamentDetailLifecycle(
            id: shareID,
            isPollingPaused: {
                model.scoringMatch != nil || model.showRegistrations || model.showSchedule || showGroupManager
            },
            load: { await model.load(shareID: shareID) },
            stop: { await model.stop() }
        )
        .onChange(of: model.detail, initial: true) { _, detail in
            guard !didOpenInitialScore,
                  let matchID = initialScoringMatchID,
                  model.editable,
                  let match = detail?.matches.first(where: { $0.id == matchID }),
                  match.hasBothPlayers else { return }
            didOpenInitialScore = true
            model.scoringMatch = match
        }
        .sheet(isPresented: $openWeb) {
            SafariView(url: WebRoutes.quickTable(shareID: shareID)).ignoresSafeArea()
        }
        .sheet(isPresented: $showGroupManager) {
            if let detail = model.detail {
                QuickTableGroupManagerView(
                    shareID: shareID,
                    initialDetail: detail,
                    onChanged: { Task { await model.load(shareID: shareID) } },
                    onDeleted: { dismiss() }
                )
                .presentationDetents([.large])
            }
        }
        .sheet(item: Binding(get: { model.scoringMatch }, set: { model.scoringMatch = $0 })) { match in
            if case .loaded(let detail) = model.phase {
                ScoreSheet(
                    detail: detail,
                    match: match,
                    saving: model.scoreSaving,
                    errorMessage: model.scoreError,
                    onError: { model.scoreError = $0 }
                ) { s1, s2 in
                    Task { await model.submitScore(match: match, score1: s1, score2: s2, shareID: shareID) }
                }
            }
        }
        .alert("Không thể lưu điểm", isPresented: Binding(
            get: { model.scoreError != nil },
            set: { if !$0 { model.scoreError = nil } }
        )) {
            Button("Đã hiểu", role: .cancel) { model.scoreError = nil }
        } message: {
            Text(model.scoreError ?? "Lỗi không xác định")
        }
    }

    private var managementPresentation: some View {
        scorePresentation
        .sheet(isPresented: Binding(get: { model.showWildcard }, set: { model.showWildcard = $0 })) {
            WildcardSelectionSheet(candidates: model.wildcardCandidates, need: model.wildcardNeed) { selected in
                Task { await model.confirmWildcards(shareID: shareID, selectedIDs: selected) }
            }
        }
        .confirmationDialog("Số người vào Playoff",
                            isPresented: Binding(get: { model.showBracketChoice }, set: { model.showBracketChoice = $0 }),
                            titleVisibility: .visible) {
            ForEach(model.bracketOptions) { opt in
                Button(opt.buttonLabel) {
                    Task { await model.chooseBracket(shareID: shareID, advancePerGroup: opt.advancePerGroup) }
                }
            }
            Button("Hủy", role: .cancel) {}
        }
        .sheet(isPresented: Binding(get: { model.showRegistrations }, set: { model.showRegistrations = $0 })) {
            QuickTableRegistrationsSheet(model: model) {
                Task { await model.load(shareID: shareID) }
            }
        }
        .sheet(isPresented: Binding(get: { model.showTeams }, set: { model.showTeams = $0 })) {
            QuickTableTeamManagerSheet(model: model) {
                Task { await model.load(shareID: shareID) }
            }
        }
        .sheet(isPresented: Binding(get: { model.showTeamRegister }, set: { model.showTeamRegister = $0 })) {
            QuickTableSelfRegisterSheet(
                isDoubles: true,
                busy: model.teamBusy,
                error: model.teamError,
                table: model.detail?.table,
                duprIdentity: model.duprIdentity,
                onDuprRefresh: { Task { await model.reloadDupr() } }
            ) { name, team, rating, skill, _, _, link in
                Task {
                    await model.createTeam(
                        displayName: name, team: team, rating: rating,
                        skill: skill, link: link
                    )
                }
            }
        }
        .sheet(isPresented: Binding(get: { model.showReferees }, set: { model.showReferees = $0 })) {
            QuickTableRefereesSheet(model: model)
        }
        .sheet(isPresented: Binding(get: { model.showSchedule }, set: { model.showSchedule = $0 })) {
            if let detail = model.detail {
                QuickTableScheduleSheet(
                    initialCourts: (detail.table.courts ?? []).joined(separator: ", "),
                    initialStartTime: detail.table.startTime ?? "",
                    busy: model.scheduleBusy, error: model.scheduleError
                ) { courtsText, startTime in
                    Task { await model.saveSchedule(shareID: shareID, courtsText: courtsText, startTime: startTime) }
                }
            }
        }
        .sheet(item: $courtNameMatch) { match in
            QuickTableCourtNameSheet(
                initialName: match.courtName ?? "",
                fallbackCourt: match.courtID.map { "Sân \($0)" },
                busy: model.scheduleBusy,
                error: model.scheduleError
            ) { name in
                Task {
                    await model.saveCourtName(matchID: match.id, name: name, shareID: shareID)
                    if model.scheduleError == nil { courtNameMatch = nil }
                }
            }
        }
        .sheet(isPresented: Binding(get: { model.showSelfRegister }, set: { model.showSelfRegister = $0 })) {
            QuickTableSelfRegisterSheet(
                isDoubles: model.detail?.table.isDoubles ?? false,
                busy: model.regBusy,
                error: model.regError,
                initial: model.myRegistration?.status == "pending" ? model.myRegistration : nil,
                table: model.detail?.table,
                duprIdentity: model.duprIdentity,
                onDuprRefresh: { Task { await model.reloadDupr() } }
            ) { name, team, rating, skill, skillSystem, skillDescription, link in
                Task {
                    await model.saveSelfRegistration(
                        displayName: name,
                        team: team,
                        ratingSystem: rating,
                        skillLevel: skill,
                        skillSystemName: skillSystem,
                        skillDescription: skillDescription,
                        profileLink: link
                    )
                }
            }
        }
    }

    private func scheduleManageButton(_ detail: QuickTableDetail) -> some View {
        let courtCount = detail.table.courts?.filter { !$0.isEmpty }.count ?? 0
        return Button { Haptics.light(); model.showSchedule = true } label: {
            HStack(spacing: 10) {
                Image(systemName: "sportscourt.fill").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                Text("Sân & giờ đấu").font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                Spacer()
                Text(courtCount > 0 ? "\(courtCount) sân" : "Chưa đặt")
                    .font(TLFont.mono(courtCount > 0 ? 11 : 10)).foregroundStyle(courtCount > 0 ? TLColor.fg3 : TLColor.fg4)
                Image(systemName: "chevron.right").font(.system(size: chevronSize, weight: .semibold)).foregroundStyle(TLColor.fg4)
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    private var refereeManageButton: some View {
        Button { Haptics.light(); model.showReferees = true } label: {
            HStack(spacing: 10) {
                Image(systemName: "whistle.fill").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                Text("Trọng tài").font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                Spacer()
                Text("\(model.referees.count)").font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                Image(systemName: "chevron.right").font(.system(size: chevronSize, weight: .semibold)).foregroundStyle(TLColor.fg4)
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    // MARK: Registration UI

    @ViewBuilder
    private func registrationSection(_ detail: QuickTableDetail) -> some View {
        if detail.table.isDoubles == true {
            doublesRegistrationSection(detail)
        } else if model.canManage {
            let pending = model.registrations.filter { $0.status == "pending" }.count
            Button { Haptics.light(); model.showRegistrations = true } label: {
                HStack(spacing: 10) {
                    Image(systemName: "person.crop.circle.badge.checkmark").font(.system(size: 16)).foregroundStyle(TLColor.accentText)
                    Text("Quản lý đăng ký").font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                    Spacer()
                    if pending > 0 {
                        Text("\(pending) chờ").font(TLFont.mono(10, .bold)).foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 8).padding(.vertical, 3).background(TLColor.accent, in: Capsule())
                    } else {
                        Text("\(model.registrations.count)").font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                    }
                    Image(systemName: "chevron.right").font(.system(size: chevronSize, weight: .semibold)).foregroundStyle(TLColor.fg4)
                }
                .padding(14)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            }.buttonStyle(.plain)
        } else if model.currentUID != nil {
            if let reg = model.myRegistration {
                myRegistrationBanner(reg)
            } else {
                Button { Haptics.light(); model.showSelfRegister = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.pencil").font(.system(size: 14))
                        Text("Đăng ký tham gia").font(TLFont.sans(14, .semibold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                }.buttonStyle(.plain)
            }
        } else {
            note("Đăng nhập để đăng ký tham gia.")
        }
        if !model.canManage {
            approvedParticipantsCard(
                title: "VĐV đã được duyệt",
                names: model.registrations
                    .filter { $0.status == "approved" }
                    .map { registration in
                        if let team = registration.team?.nonEmpty {
                            return "\(registration.displayName) · \(team)"
                        }
                        return registration.displayName
                    }
            )
        }
    }

    @ViewBuilder
    private func doublesRegistrationSection(_ detail: QuickTableDetail) -> some View {
        if model.canManage {
            let pending = model.teams.filter {
                !$0.isApproved && $0.teamStatus != "rejected" && $0.teamStatus != "removed"
            }.count
            Button { Haptics.light(); model.showTeams = true } label: {
                HStack(spacing: 10) {
                    Image(systemName: "person.2.badge.gearshape")
                        .font(.system(size: 16)).foregroundStyle(TLColor.accentText)
                    Text("Quản lý đội đăng ký")
                        .font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                    Spacer()
                    Text(pending > 0 ? "\(pending) chờ" : "\(model.teams.count)")
                        .font(TLFont.mono(10, pending > 0 ? .bold : .medium))
                        .foregroundStyle(pending > 0 ? TLColor.accentInk : TLColor.fg3)
                        .padding(.horizontal, pending > 0 ? 8 : 0)
                        .padding(.vertical, pending > 0 ? 3 : 0)
                        .background(pending > 0 ? TLColor.accent : .clear, in: Capsule())
                    Image(systemName: "chevron.right")
                        .font(.system(size: chevronSize, weight: .semibold))
                        .foregroundStyle(TLColor.fg4)
                }
                .padding(14)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
        } else if model.currentUID == nil {
            note("Đăng nhập để tạo đội và mời đồng đội.")
        } else if let team = model.myTeam {
            QuickTableMyTeamCard(
                table: detail.table,
                team: team,
                allTeams: model.teams,
                invitations: model.teamInvitations,
                incomingRequests: model.incomingPairRequests,
                outgoingRequests: model.outgoingPairRequests,
                currentUserID: model.currentUID,
                busy: model.teamBusy,
                error: model.teamError,
                onCreatePairRequest: { candidate in
                    Task { await model.createPairRequest(to: candidate) }
                },
                onRespondPairRequest: { request, accept in
                    Task { await model.respondPairRequest(request, accept: accept) }
                },
                onCancelPairRequest: { request in
                    Task { await model.cancelPairRequest(request) }
                },
                onCreateInvitation: { Task { await model.createTeamInvitation() } },
                onCancelInvitation: { invitation in
                    Task { await model.cancelTeamInvitation(invitation) }
                },
                onRemovePartner: { Task { await model.removePartner() } }
            )
        } else {
            Button { Haptics.light(); model.showTeamRegister = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: "person.2.badge.plus")
                    Text("Tạo đội và đăng ký")
                }
                .font(TLFont.sans(14, .semibold))
                .foregroundStyle(TLColor.accentInk)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm))
            }
            .buttonStyle(.plain)
        }
        if !model.canManage {
            approvedParticipantsCard(
                title: "Đội đã được duyệt",
                names: model.teams
                    .filter(\.isApproved)
                    .map(\.pairName)
            )
        }
    }

    @ViewBuilder
    private func approvedParticipantsCard(title: String, names: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(title, systemImage: "checkmark.seal.fill")
                    .font(TLFont.sans(13.5, .semibold))
                    .foregroundStyle(TLColor.fg)
                Spacer()
                Text("\(names.count)")
                    .font(TLFont.mono(11, .semibold))
                    .foregroundStyle(TLColor.accentText)
            }
            if names.isEmpty {
                Text("Chưa có \(title.lowercased()).")
                    .font(TLFont.sans(12.5))
                    .foregroundStyle(TLColor.fg3)
            } else {
                ForEach(Array(names.enumerated()), id: \.offset) { index, name in
                    HStack(alignment: .firstTextBaseline, spacing: 9) {
                        Text("\(index + 1)")
                            .font(TLFont.mono(10, .semibold))
                            .foregroundStyle(TLColor.fg4)
                            .frame(width: 20, alignment: .trailing)
                        Text(name)
                            .font(TLFont.sans(13))
                            .foregroundStyle(TLColor.fg2)
                    }
                }
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(TLColor.border, lineWidth: 1)
        )
    }

    private func myRegistrationBanner(_ reg: QTRegistration) -> some View {
        let (label, color): (String, Color) = {
            switch reg.status {
            case "approved": return ("Đã được duyệt", TLColor.accentText)
            case "rejected": return ("Bị từ chối", TLColor.live)
            default: return ("Đang chờ duyệt", TLColor.gold)
            }
        }()
        return HStack(spacing: 10) {
            Circle().fill(color).frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text("Đăng ký của bạn: \(label)").font(TLFont.sans(13.5, .semibold)).foregroundStyle(TLColor.fg)
                Text(reg.displayName).font(TLFont.mono(10.5)).foregroundStyle(TLColor.fg3)
            }
            Spacer()
            if reg.status == "pending" {
                HStack(spacing: 12) {
                    Button {
                        Haptics.light()
                        model.showSelfRegister = true
                    } label: {
                        Text("Sửa").font(TLFont.mono(10.5, .semibold)).foregroundStyle(TLColor.accentText)
                    }
                    .buttonStyle(.plain)
                    Button { Haptics.light(); Task { await model.cancelMyRegistration() } } label: {
                        Text("Hủy").font(TLFont.mono(10.5, .semibold)).foregroundStyle(TLColor.live)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(color.opacity(0.4), lineWidth: 1))
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 80)
        case .failed(let message):
            errorState(message)
        case .loaded(let detail):
            VStack(alignment: .leading, spacing: 18) {
                header(detail.table)
                if detail.table.requiresRegistration == true { registrationSection(detail) }
                if model.canManage { refereeManageButton }
                else if !model.editable {
                    RefereeJoinByPinView(format: .quickTable, parentID: detail.table.id,
                                         isSignedIn: model.currentUID != nil) {
                        await model.load(shareID: shareID)
                    }
                }
                if model.canManage && !detail.table.isPlayoffStage { scheduleManageButton(detail) }
                if model.canManage && detail.groupStageComplete && !detail.hasPlayoff && detail.table.status == "group_stage" {
                    advanceBanner
                }
                tabPicker(detail)
                switch model.tab {
                case .groups: groupsTab(detail)
                case .playoff: playoffTab(detail)
                case .courts: courtsTab(detail)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)
        }
    }

    // MARK: Header

    private func header(_ table: QTTable) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(table.displayName).font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Text(table.statusLabel.uppercased())
                    .font(TLFont.mono(9, .bold)).tracking(1)
                    .foregroundStyle(table.status == "completed" ? TLColor.fg3 : TLColor.accentText)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background((table.status == "completed" ? TLColor.surface : TLColor.accent.opacity(0.1)), in: Capsule())
                Text((table.isDoubles ?? true) ? "ĐÔI" : "ĐƠN")
                    .font(TLFont.mono(9, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            }
        }
    }

    private var advanceBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { Haptics.success(); Task { await model.startPlayoff(shareID: shareID) } } label: {
                HStack(spacing: 12) {
                    if model.generatingPlayoff { ProgressView().tint(TLColor.accentText) }
                    else { Image(systemName: "flag.checkered").font(.system(size: 18)).foregroundStyle(TLColor.accentText) }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Vòng bảng đã hoàn tất!").font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg)
                        Text("Sinh vòng Playoff").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2)
                    }
                    Spacer()
                    Image(systemName: "arrow.right.circle.fill").font(.system(size: 18)).foregroundStyle(TLColor.accentText)
                }
                .padding(14)
                .background(TLColor.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.accent.opacity(0.4), lineWidth: 1))
            }
            .buttonStyle(.plain).disabled(model.generatingPlayoff)
            if let err = model.playoffError {
                Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
            }
        }
    }

    @ViewBuilder
    private func tabPicker(_ detail: QuickTableDetail) -> some View {
        let hasCourts = detail.matches.contains { $0.status != "completed" }
        if detail.hasPlayoff || hasCourts {
            Picker("", selection: Binding(get: { model.tab }, set: { model.tab = $0 })) {
                Text("Vòng bảng").tag(QuickTableViewModel.Tab.groups)
                if detail.hasPlayoff { Text("Playoff").tag(QuickTableViewModel.Tab.playoff) }
                if hasCourts { Text("Sân").tag(QuickTableViewModel.Tab.courts) }
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: Groups tab

    @ViewBuilder
    private func groupsTab(_ detail: QuickTableDetail) -> some View {
        if detail.groups.isEmpty {
            note("Chưa chia bảng.")
        } else {
            VStack(alignment: .leading, spacing: 18) {
                groupPicker(detail.groups)
                if let gid = model.selectedGroupID {
                    standingsCard(detail, groupID: gid)
                    matchesSection(detail, groupID: gid)
                }
            }
        }
    }

    private func groupPicker(_ groups: [QTGroup]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(groups) { g in
                    let selected = g.id == model.selectedGroupID
                    Button { model.selectedGroupID = g.id } label: {
                        Text("Bảng \(g.name)")
                            .font(TLFont.mono(12, selected ? .semibold : .medium))
                            .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(selected ? TLColor.accent : TLColor.surface, in: Capsule())
                            .overlay(Capsule().strokeBorder(selected ? .clear : TLColor.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Standings

    private func standingsCard(_ detail: QuickTableDetail, groupID: UUID) -> some View {
        let rows = detail.standings(groupID: groupID)
        let topN = detail.table.topPerGroup ?? 2
        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("#").frame(width: 28, alignment: .leading)
                Text("VĐV").frame(maxWidth: .infinity, alignment: .leading)
                Text("T").frame(width: 30, alignment: .trailing)
                Text("TR").frame(width: 30, alignment: .trailing)
                Text("+/–").frame(width: 44, alignment: .trailing)
            }
            .font(TLFont.mono(9, .medium)).foregroundStyle(TLColor.fg4).tracking(0.5)
            .padding(.horizontal, 14).padding(.vertical, 9)

            ForEach(Array(rows.enumerated()), id: \.element.id) { index, p in
                Rectangle().fill(TLColor.border).frame(height: 1)
                let qualified = detail.hasPlayoff && index < topN
                HStack(spacing: 0) {
                    HStack(spacing: 3) {
                        Text("\(index + 1)").font(TLFont.mono(12, .semibold))
                            .foregroundStyle(qualified ? TLColor.accentText : TLColor.fg4)
                        if qualified { Image(systemName: "chevron.right").font(.system(size: 8, weight: .bold)).foregroundStyle(TLColor.accentText) }
                    }
                    .frame(width: 28, alignment: .leading)
                    HStack(spacing: 6) {
                        Text(p.name).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg).lineLimit(1)
                        if p.isWildcard == true {
                            Text("WC").font(TLFont.mono(8, .medium)).foregroundStyle(TLColor.fg3)
                                .padding(.horizontal, 4).padding(.vertical, 1)
                                .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 3))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(p.matchesWon)").font(TLFont.mono(13, .semibold)).foregroundStyle(TLColor.fg).frame(width: 30, alignment: .trailing)
                    Text("\(p.matchesPlayed)").font(TLFont.mono(13)).foregroundStyle(TLColor.fg3).frame(width: 30, alignment: .trailing)
                    Text(p.pointDiff >= 0 ? "+\(p.pointDiff)" : "\(p.pointDiff)")
                        .font(TLFont.mono(13))
                        .foregroundStyle(p.pointDiff > 0 ? TLColor.accentText : p.pointDiff < 0 ? TLColor.live : TLColor.fg2)
                        .frame(width: 44, alignment: .trailing)
                }
                .padding(.horizontal, 14).padding(.vertical, 11)
                .background(qualified ? TLColor.accent.opacity(0.05) : Color.clear)
            }
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Matches

    private func matchesSection(_ detail: QuickTableDetail, groupID: UUID) -> some View {
        let matches = detail.matches(groupID: groupID)
        return VStack(alignment: .leading, spacing: 10) {
            Text("TRẬN ĐẤU").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            if matches.isEmpty {
                Text("Chưa có trận.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            } else {
                ForEach(matches) { m in matchRow(detail, m) }
            }
        }
    }

    private func matchRow(_ detail: QuickTableDetail, _ m: QTMatch) -> some View {
        let canScore = model.editable && m.hasBothPlayers
        return Button {
            if canScore { Haptics.light(); model.scoringMatch = m }
        } label: {
            VStack(spacing: 6) {
                if m.courtLabel != nil || m.startAt?.nonEmpty != nil {
                    HStack(spacing: 10) {
                        if let court = m.courtLabel {
                            HStack(spacing: 3) {
                                Image(systemName: "mappin.and.ellipse").font(.system(size: 9)).foregroundStyle(TLColor.fg4)
                                Text(court).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                            }
                        }
                        if let time = m.startAt?.nonEmpty {
                            HStack(spacing: 3) {
                                Image(systemName: "clock").font(.system(size: 9)).foregroundStyle(TLColor.fg4)
                                Text(time).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                            }
                        }
                        Spacer()
                    }
                }
                HStack(spacing: 10) {
                    playerName(detail.name(for: m.player1ID), won: m.isCompleted && m.winnerID == m.player1ID)
                    scoreBlock(m)
                    playerName(detail.name(for: m.player2ID), won: m.isCompleted && m.winnerID == m.player2ID, trailing: true)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!canScore)
    }

    private func playerName(_ name: String, won: Bool, trailing: Bool = false) -> some View {
        Text(name)
            .font(TLFont.sans(14, won ? .semibold : .regular))
            .foregroundStyle(won ? TLColor.fg : TLColor.fg2)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: trailing ? .trailing : .leading)
            .multilineTextAlignment(trailing ? .trailing : .leading)
    }

    @ViewBuilder
    private func scoreBlock(_ m: QTMatch) -> some View {
        if m.isCompleted, let s1 = m.score1, let s2 = m.score2 {
            HStack(spacing: 5) {
                Text("\(s1)").foregroundStyle(s1 > s2 ? TLColor.accentText : TLColor.fg3)
                Text("–").foregroundStyle(TLColor.fg4)
                Text("\(s2)").foregroundStyle(s2 > s1 ? TLColor.accentText : TLColor.fg3)
            }
            .font(TLFont.mono(15, .semibold)).monospacedDigit()
        } else {
            Text(model.editable ? "Nhập" : "vs")
                .font(TLFont.mono(10, .medium)).foregroundStyle(model.editable ? TLColor.accentText : TLColor.fg4)
                .frame(minWidth: 40)
        }
    }

    // MARK: Playoff tab

    // Bracket geometry.
    private var cardW: CGFloat { 190 }
    private var cardH: CGFloat { 76 }
    private var gap0: CGFloat { 16 }
    private var pitch: CGFloat { cardH + gap0 }
    private var connW: CGFloat { 26 }
    private var headerBlock: CGFloat { 30 } // round header height + spacing

    @ViewBuilder
    private func playoffTab(_ detail: QuickTableDetail) -> some View {
        let rounds = detail.playoffByRound
        VStack(alignment: .leading, spacing: 18) {
            if let champID = detail.championID {
                championBanner(detail.name(for: champID))
            }
            if rounds.isEmpty {
                note("Chưa tạo nhánh playoff.")
            } else {
                bracket(detail, rounds)
            }
        }
    }

    /// Horizontal single-elimination bracket: one column per round, matches
    /// vertically centered between their feeders, elbow connectors between rounds.
    private func bracket(_ detail: QuickTableDetail, _ rounds: [(round: Int, matches: [QTMatch])]) -> some View {
        let firstCount = rounds.first?.matches.count ?? 1
        let totalH = headerBlock + CGFloat(firstCount) * pitch
        return ScrollView(.horizontal, showsIndicators: true) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(rounds.enumerated()), id: \.element.round) { r, round in
                    roundColumn(detail, round: round, index: r)
                    if r < rounds.count - 1 {
                        connector(leftCount: round.matches.count, index: r)
                    }
                }
            }
            .frame(height: totalH, alignment: .top)
            .padding(.horizontal, 16)
        }
        .frame(height: totalH)              // explicit height so the nested
        .padding(.horizontal, -16)          // h-scroll never collapses inside the v-scroll
    }

    private func roundColumn(_ detail: QuickTableDetail, round: (round: Int, matches: [QTMatch]), index r: Int) -> some View {
        let unit = pitch * p2(r)
        return VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text(roundLabel(round.matches.count).uppercased())
                    .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg2)
                Text("\(round.matches.filter { $0.isCompleted }.count)/\(round.matches.count)")
                    .font(TLFont.mono(9)).foregroundStyle(TLColor.fg4).monospacedDigit()
            }
            .frame(height: headerBlock, alignment: .center)

            VStack(spacing: unit - cardH) {
                ForEach(round.matches) { m in bracketCard(detail, m) }
            }
            .padding(.top, unit / 2 - cardH / 2)
            Spacer(minLength: 0)
        }
        .frame(width: cardW)
    }

    /// Elbow connectors linking each pair of feeder matches to the next round.
    private func connector(leftCount: Int, index r: Int) -> some View {
        let unit = pitch * p2(r)
        let pairs = max(0, leftCount / 2)
        return VStack(spacing: 0) {
            Color.clear.frame(height: headerBlock + unit * 0.5)
            ForEach(0..<pairs, id: \.self) { i in
                ZStack(alignment: .leading) {
                    Rectangle().fill(TLColor.border2).frame(width: 1.5)
                    Rectangle().fill(TLColor.border2).frame(height: 1.5)
                }
                .frame(width: connW, height: unit)
                if i < pairs - 1 { Color.clear.frame(height: unit) }
            }
            Spacer(minLength: 0)
        }
        .frame(width: connW)
    }

    private func bracketCard(_ detail: QuickTableDetail, _ m: QTMatch) -> some View {
        let canScore = model.editable && m.hasBothPlayers
        return Button {
            if canScore { Haptics.light(); model.scoringMatch = m }
        } label: {
            VStack(spacing: 0) {
                bracketRow(detail.name(for: m.player1ID), score: m.score1, won: m.isCompleted && m.winnerID == m.player1ID, completed: m.isCompleted)
                Rectangle().fill(TLColor.border).frame(height: 1)
                bracketRow(detail.name(for: m.player2ID), score: m.score2, won: m.isCompleted && m.winnerID == m.player2ID, completed: m.isCompleted)
            }
            .frame(width: cardW, height: cardH)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!canScore)
    }

    private func bracketRow(_ name: String, score: Int?, won: Bool, completed: Bool) -> some View {
        HStack(spacing: 8) {
            Rectangle().fill(won ? TLColor.accent : Color.clear).frame(width: 2)
            Text(name).font(TLFont.sans(13, won ? .semibold : .regular))
                .foregroundStyle(won ? TLColor.fg : TLColor.fg2).lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(completed ? "\(score ?? 0)" : "–")
                .font(TLFont.mono(13, .semibold)).monospacedDigit()
                .foregroundStyle(won ? TLColor.accentText : TLColor.fg4)
                .padding(.trailing, 10)
        }
        .frame(maxHeight: .infinity)
        .background(won ? TLColor.accent.opacity(0.08) : Color.clear)
    }

    private func p2(_ r: Int) -> CGFloat { pow(2, CGFloat(r)) }

    private func championBanner(_ name: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "trophy.fill").font(.system(size: 22)).foregroundStyle(TLColor.accentText)
            VStack(alignment: .leading, spacing: 3) {
                Text("NHÀ VÔ ĐỊCH").font(TLFont.mono(10, .bold)).tracking(1.5).foregroundStyle(TLColor.accentText)
                Text(name).font(TLFont.serif(24)).foregroundStyle(TLColor.fg)
            }
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [TLColor.accent.opacity(0.16), TLColor.surface], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.accent.opacity(0.35), lineWidth: 1))
    }

    private func roundLabel(_ count: Int) -> String {
        switch count {
        case 1: return "Chung kết"
        case 2: return "Bán kết"
        case 3...4: return "Tứ kết"
        case 5...8: return "Vòng 16"
        default: return "Vòng loại"
        }
    }

    // MARK: Courts (queue board — port of dashboard CourtData)

    @ViewBuilder
    private func courtsTab(_ detail: QuickTableDetail) -> some View {
        let upcoming = detail.matches
            .filter { $0.status != "completed" && $0.hasBothPlayers }
            .sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) }
        if upcoming.isEmpty {
            note("Không còn trận nào trong hàng đợi.")
        } else {
            let grouped = Dictionary(grouping: upcoming) { $0.courtLabel ?? "Chưa gán sân" }
            VStack(alignment: .leading, spacing: 14) {
                ForEach(grouped.keys.sorted(), id: \.self) { court in
                    courtColumn(detail, court: court, matches: grouped[court] ?? [])
                }
            }
        }
    }

    private func courtColumn(_ detail: QuickTableDetail, court: String, matches: [QTMatch]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "sportscourt").font(.system(size: 13)).foregroundStyle(TLColor.accentText)
                Text(court.uppercased()).font(TLFont.mono(11, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg)
                Spacer()
                Text("\(matches.count) trận").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }
            ForEach(Array(matches.enumerated()), id: \.element.id) { i, m in
                courtMatchRow(detail, m, next: i == 0)
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func courtMatchRow(_ detail: QuickTableDetail, _ m: QTMatch, next: Bool) -> some View {
        let canScore = model.editable && m.hasBothPlayers
        return HStack(spacing: 10) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(detail.name(for: m.player1ID)).font(TLFont.sans(13.5, next ? .semibold : .regular)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text(detail.name(for: m.player2ID)).font(TLFont.sans(13.5, next ? .semibold : .regular)).foregroundStyle(TLColor.fg2).lineLimit(1)
                }
                Spacer(minLength: 6)
                if let time = m.startAt?.nonEmpty {
                    HStack(spacing: 3) {
                        Image(systemName: "clock").font(.system(size: 9)).foregroundStyle(TLColor.fg4)
                        Text(time).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                    }
                }
                if next {
                    Text("TIẾP THEO").font(TLFont.mono(8.5, .bold)).tracking(0.5).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 7).padding(.vertical, 3).background(TLColor.accent, in: Capsule())
                } else {
                    Text("chờ").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9).padding(.horizontal, 12)
            .background(next ? TLColor.accent.opacity(0.06) : TLColor.bg, in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
            .onTapGesture {
                if canScore {
                    Haptics.light()
                    model.scoringMatch = m
                }
            }
            if model.editable {
                Button {
                    Haptics.light()
                    model.scheduleError = nil
                    courtNameMatch = m
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(TLColor.accentText)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Đổi tên sân cho trận này")
            }
        }
    }

    // MARK: Helpers

    private func note(_ text: LocalizedStringKey) -> some View {
        Text(text).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "tablecells").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được giải").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(shareID: shareID) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

private struct QuickTableCourtNameSheet: View {
    let initialName: String
    let fallbackCourt: String?
    let busy: Bool
    let error: String?
    let onSave: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Tên hiển thị") {
                    TextField(fallbackCourt ?? "VD: Sân trung tâm", text: $name)
                    Text("Để trống để quay lại tên sân tự động.")
                        .font(TLFont.sans(12))
                        .foregroundStyle(TLColor.fg3)
                }
                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(TLColor.live)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(TLColor.bg)
            .navigationTitle("Đổi tên sân")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hủy") { dismiss() }.disabled(busy)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Đang lưu…" : "Lưu") { onSave(name) }
                        .disabled(busy)
                }
            }
            .onAppear { name = initialName }
        }
        .presentationDetents([.medium])
    }
}

/// Organizer sheet to set courts + start time, then auto-schedule every group
/// match (calls updateCourtSettings + reassignCourtsAndTimes on save).
private struct QuickTableScheduleSheet: View {
    let initialCourts: String
    let initialStartTime: String
    let busy: Bool
    let error: String?
    let onSave: (_ courts: String, _ startTime: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var courts = ""
    @State private var startTime = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Nhập số sân (cách nhau dấu phẩy) và giờ bắt đầu. App tự xếp từng trận theo vòng — tránh trùng người và dồn sân đều.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
                        .fixedSize(horizontal: false, vertical: true)

                    field("Sân đấu") { tf($courts, "VD: 1, 2, 3").keyboardType(.numbersAndPunctuation) }
                    field("Giờ bắt đầu (tùy chọn)") { tf($startTime, "VD: 08:00").keyboardType(.numbersAndPunctuation) }

                    if let error { Text(error).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }

                    Button {
                        Haptics.success(); onSave(courts, startTime)
                    } label: {
                        HStack(spacing: 6) {
                            if busy { ProgressView().tint(TLColor.accentInk) }
                            Text(busy ? "Đang xếp lịch..." : "Xếp lịch").font(TLFont.sans(14, .bold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain).disabled(busy)

                    Text("Để trống ô sân rồi Xếp lịch để xóa phân sân/giờ.")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle("Sân & giờ đấu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Đóng") { dismiss() }.foregroundStyle(TLColor.fg3) } }
            .onAppear { courts = initialCourts; startTime = initialStartTime }
        }
    }

    private func field<C: View>(_ label: LocalizedStringKey, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).textCase(.uppercase).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            content()
        }
    }
    private func tf(_ binding: Binding<String>, _ placeholder: LocalizedStringKey) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 11).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
    }
}

/// Two-field score entry for a single match.
private struct ScoreSheet: View {
    let detail: QuickTableDetail
    let match: QTMatch
    let saving: Bool
    let errorMessage: String?
    let onError: (String) -> Void
    let onSave: (Int, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var s1: String
    @State private var s2: String
    @State private var refMode: ScoringMode = .rally
    @State private var refTarget = 11
    @State private var refSingles = false
    @State private var refereeing = false

    init(
        detail: QuickTableDetail,
        match: QTMatch,
        saving: Bool,
        errorMessage: String?,
        onError: @escaping (String) -> Void,
        onSave: @escaping (Int, Int) -> Void
    ) {
        self.detail = detail
        self.match = match
        self.saving = saving
        self.errorMessage = errorMessage
        self.onError = onError
        self.onSave = onSave
        _s1 = State(initialValue: match.score1.map(String.init) ?? "")
        _s2 = State(initialValue: match.score2.map(String.init) ?? "")
    }

    private var v1: Int? { Int(s1) }
    private var v2: Int? { Int(s2) }
    private var valid: Bool { if let a = v1, let b = v2 { return a != b } ; return false }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                row(name: detail.name(for: match.player1ID), text: $s1)
                Text("–").font(TLFont.serif(24)).foregroundStyle(TLColor.fg4)
                row(name: detail.name(for: match.player2ID), text: $s2)

                if let errorMessage {
                    TournamentScoreRetryMessage(message: errorMessage)
                }
                refereeSection
                Spacer()
            }
            .padding(20)
            .frame(maxWidth: .infinity)
            .background(TLColor.bg)
            .navigationTitle("Nhập tỉ số")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        if let a = v1, let b = v2 { Haptics.light(); onSave(a, b) }
                    } label: {
                        if saving { ProgressView().tint(TLColor.accentText) }
                        else { Text(errorMessage == nil ? "Lưu" : "Thử lại") }
                    }
                    .foregroundStyle(valid ? TLColor.accentText : TLColor.fg4)
                    .disabled(!valid || saving)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // Chấm trực tiếp cho trọng tài — chọn thể thức + điểm thắng rồi tap 2 vùng lớn.
    private var refereeSection: some View {
        VStack(spacing: 12) {
            Rectangle().fill(TLColor.border).frame(height: 1).padding(.vertical, 4)
            Picker("", selection: $refMode) {
                // symbolic key: "Trực tiếp" nghĩa Rally ở đây, khác nghĩa Live (round2/ui-ux-critic B1)
                Text(LocalizedStringResource("scoring.mode.rally", defaultValue: "Trực tiếp")).tag(ScoringMode.rally)
                Text("Giao bóng").tag(ScoringMode.sideOut)
            }.pickerStyle(.segmented)
            HStack(spacing: 14) {
                Picker("", selection: $refTarget) {
                    ForEach([11, 15, 21], id: \.self) { Text("Tới \($0)").tag($0) }
                }.pickerStyle(.segmented)
                if refMode == .sideOut {
                    Toggle("Đơn", isOn: $refSingles).font(TLFont.mono(11)).fixedSize()
                }
            }
            Button {
                Haptics.light(); refereeing = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "play.circle.fill").font(.system(size: 14, weight: .bold))
                    Text("CHẤM TRỰC TIẾP").font(TLFont.mono(12, .bold)).tracking(0.5)
                }
                .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)
            .fullScreenCover(isPresented: $refereeing) {
                RefereeScoringView(
                    teamAName: detail.name(for: match.player1ID),
                    teamBName: detail.name(for: match.player2ID),
                    playersA: detail.pairNames(for: match.player1ID),
                    playersB: detail.pairNames(for: match.player2ID),
                    mode: refMode,
                    isSingles: detail.table.isDoubles == true ? false : refSingles,
                    winTarget: refTarget,
                    onLiveScore: { a, b in
                        Task {
                            do { try await QuickTableRepository().updateLiveScore(matchID: match.id, score1: a, score2: b) }
                            catch { onError(UserFacingError.message(failure: "Không cập nhật được điểm trực tiếp.", error: error)) }
                        }
                    },
                    onClaimLive: {
                        Task {
                            do { try await QuickTableRepository().claimLive(matchID: match.id) }
                            catch { onError(UserFacingError.message(failure: "Không nhận được quyền chấm trận.", error: error)) }
                        }
                    }) { a, b, note in
                    Haptics.light(); onSave(a, b)
                    if let note {
                        Task {
                            do { try await QuickTableRepository().updateRefereeNote(matchID: match.id, note: note) }
                            catch { onError(UserFacingError.message(failure: "Không lưu được ghi chú trọng tài.", error: error)) }
                        }
                    }
                }
            }
        }
    }

    private func row(name: String, text: Binding<String>) -> some View {
        HStack(spacing: 14) {
            Text(name).font(TLFont.sans(16, .medium)).foregroundStyle(TLColor.fg)
                .frame(maxWidth: .infinity, alignment: .leading).lineLimit(1)
            TextField("0", text: text)
                .keyboardType(.numberPad).multilineTextAlignment(.center)
                .font(TLFont.mono(22, .semibold)).monospacedDigit().foregroundStyle(TLColor.fg)
                .frame(width: 72, height: 52)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }
}

/// Quản lý trọng tài cho 1 bảng — thêm/xóa bằng email (parity với TeamMatchSettingsSheet).
private struct QuickTableRefereesSheet: View {
    @Bindable var model: QuickTableViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if model.referees.isEmpty {
                        Text("Chưa có trọng tài.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
                    } else {
                        ForEach(model.referees) { ref in
                            HStack(spacing: 10) {
                                Image(systemName: "whistle").font(.system(size: 12)).foregroundStyle(TLColor.fg3)
                                Text(ref.displayName ?? ref.userID.uuidString.prefix(8).description)
                                    .font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg).lineLimit(1)
                                Spacer()
                                Button { Haptics.light(); Task { await model.removeReferee(ref) } } label: {
                                    Image(systemName: "xmark.circle.fill").font(.system(size: 15)).foregroundStyle(TLColor.fg4)
                                }.buttonStyle(.plain)
                            }
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        }
                    }
                    HStack(spacing: 10) {
                        TextField("Email trọng tài", text: Binding(get: { model.newRefEmail }, set: { model.newRefEmail = $0 }))
                            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                            .textInputAutocapitalization(.never).keyboardType(.emailAddress).autocorrectionDisabled()
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                        Button { Haptics.light(); Task { await model.addReferee() } } label: {
                            Text("Thêm").font(TLFont.mono(11, .bold)).foregroundStyle(TLColor.accentInk)
                                .padding(.horizontal, 14).padding(.vertical, 11)
                                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                        }
                        .buttonStyle(.plain).disabled(model.refBusy)
                    }
                    Text("Trọng tài có thể chấm điểm mọi trận của bảng. Người dùng phải đã có tài khoản.")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    if let tableID = model.detail?.table.id {
                        RefereePinSettingsView(format: .quickTable, parentID: tableID)
                    }
                    if let msg = model.refMessage {
                        Text(msg).font(TLFont.sans(12)).foregroundStyle(TLColor.fg2)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Trọng tài")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Xong") { dismiss() }.foregroundStyle(TLColor.accentText) } }
            .task { await model.loadReferees() }
        }
    }
}
