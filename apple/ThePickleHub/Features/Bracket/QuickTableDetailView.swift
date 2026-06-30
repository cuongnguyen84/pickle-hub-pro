import SwiftUI

@Observable
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
    var editable = false      // can SCORE (creator hoặc referee) — khớp web canEditScores
    var canManage = false     // can MANAGE: start playoff, duyệt đăng ký (chỉ creator) — khớp web canManageTable
    var tab: Tab = .groups
    var selectedGroupID: UUID?
    var scoringMatch: QTMatch?

    // Registration
    var currentUID: UUID?
    var registrations: [QTRegistration] = []
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

    private let repo = QuickTableRepository()

    var detail: QuickTableDetail? { if case .loaded(let d) = phase { return d } ; return nil }

    @MainActor
    func load(shareID: String) async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let detail = try await repo.load(shareID: shareID)
            let uid = await repo.currentUserID()
            let isOwner = detail.table.creatorUserID != nil && detail.table.creatorUserID == uid
            canManage = isOwner   // quản lý = chỉ chủ bảng (web canManageTable); referee KHÔNG được
            if isOwner {
                editable = true
            } else if let uid {
                editable = await repo.isReferee(tableID: detail.table.id, userID: uid)
            } else {
                editable = false
            }
            currentUID = uid
            if detail.table.requiresRegistration == true {
                if let uid { myRegistration = await repo.userRegistration(tableID: detail.table.id, userID: uid) }
                if canManage {
                    registrations = await repo.fetchRegistrations(tableID: detail.table.id)
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
        } catch {
            phase = .failed(error.localizedDescription)
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
            try await repo.markPlayersQualified(
                qualified: pendingQualified.map { ($0.player.id, $0.seed) },
                wildcards: wildcards.map { $0.id })
            try await repo.createPlayoff(tableID: d.table.id, firstRound: bracket)
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
            let wildcards = result.seeded.filter { $0.tier == .wildcard }.compactMap { $0.playerID }
            try await repo.markPlayersQualified(qualified: directs, wildcards: wildcards)
            try await repo.createPlayoff(tableID: d.table.id, firstRound: bracket)
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
        registrations = await repo.fetchRegistrations(tableID: d.table.id)
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
        guard !pending.isEmpty else { return }
        regBusy = true; regError = nil
        do { try await repo.bulkApprove(ids: pending); await reloadRegistrations() }
        catch { regError = error.localizedDescription }
        regBusy = false
    }

    @MainActor func submitSelfRegistration(displayName: String, team: String, ratingSystem: String,
                                           skillLevel: Double?, profileLink: String) async {
        guard let d = detail else { return }
        regBusy = true; regError = nil
        let result = await repo.submitRegistration(
            tableID: d.table.id, displayName: displayName, team: team,
            ratingSystem: ratingSystem, skillLevel: skillLevel, profileLink: profileLink)
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

    func submitScore(tableID: UUID, match: QTMatch, score1: Int, score2: Int, shareID: String) async {
        do {
            try await repo.score(tableID: tableID, match: match, score1: score1, score2: score2)
            scoringMatch = nil
            await load(shareID: shareID)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Native Quick Table view — group standings + matches, playoff bracket with
/// champion, inline score entry (creator only). Mirrors web QuickTableView read
/// surfaces; roster/registration management + playoff generation stay on web.
struct QuickTableDetailView: View {
    let shareID: String
    let fallbackName: String

    @State private var model = QuickTableViewModel()
    @State private var openWeb = false

    var body: some View {
        ScrollView {
            content.padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle(fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { openWeb = true } label: {
                    Image(systemName: "safari").foregroundStyle(TLColor.accentText)
                }
                .accessibilityLabel("Mở trên web")
            }
        }
        .task { await model.load(shareID: shareID) }
        .task(id: shareID) {
            // Live polling (web parity: refetchInterval 15s). Skip while the
            // score sheet is open so the list can't shift under the user.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                if Task.isCancelled { break }
                if model.scoringMatch == nil { await model.load(shareID: shareID) }
            }
        }
        .refreshable { await model.load(shareID: shareID) }
        .sheet(isPresented: $openWeb) {
            SafariView(url: WebRoutes.quickTable(shareID: shareID)).ignoresSafeArea()
        }
        .sheet(item: Binding(get: { model.scoringMatch }, set: { model.scoringMatch = $0 })) { match in
            if case .loaded(let detail) = model.phase {
                ScoreSheet(detail: detail, match: match) { s1, s2 in
                    Task { await model.submitScore(tableID: detail.table.id, match: match, score1: s1, score2: s2, shareID: shareID) }
                }
            }
        }
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
            Button("Huỷ", role: .cancel) {}
        }
        .sheet(isPresented: Binding(get: { model.showRegistrations }, set: { model.showRegistrations = $0 })) {
            QuickTableRegistrationsSheet(model: model)
        }
        .sheet(isPresented: Binding(get: { model.showReferees }, set: { model.showReferees = $0 })) {
            QuickTableRefereesSheet(model: model)
        }
        .sheet(isPresented: Binding(get: { model.showSelfRegister }, set: { model.showSelfRegister = $0 })) {
            QuickTableSelfRegisterSheet(isDoubles: model.detail?.table.isDoubles ?? false, busy: model.regBusy, error: model.regError) {
                name, team, rating, skill, link in
                Task { await model.submitSelfRegistration(displayName: name, team: team, ratingSystem: rating, skillLevel: skill, profileLink: link) }
            }
        }
    }

    private var refereeManageButton: some View {
        Button { Haptics.light(); model.showReferees = true } label: {
            HStack(spacing: 10) {
                Image(systemName: "whistle.fill").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                Text("Trọng tài").font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                Spacer()
                Text("\(model.referees.count)").font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(TLColor.fg4)
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    // MARK: Registration UI

    @ViewBuilder
    private func registrationSection(_ detail: QuickTableDetail) -> some View {
        if model.canManage {
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
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(TLColor.fg4)
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
                Button { Haptics.light(); Task { await model.cancelMyRegistration() } } label: {
                    Text("Hủy").font(TLFont.mono(10.5, .semibold)).foregroundStyle(TLColor.live)
                }.buttonStyle(.plain)
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
                if let court = m.courtName?.nonEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 9)).foregroundStyle(TLColor.fg4)
                        Text(court).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
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
            let grouped = Dictionary(grouping: upcoming) { $0.courtName?.nonEmpty ?? "Chưa gán sân" }
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
        return Button {
            if canScore { Haptics.light(); model.scoringMatch = m }
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(detail.name(for: m.player1ID)).font(TLFont.sans(13.5, next ? .semibold : .regular)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text(detail.name(for: m.player2ID)).font(TLFont.sans(13.5, next ? .semibold : .regular)).foregroundStyle(TLColor.fg2).lineLimit(1)
                }
                Spacer(minLength: 6)
                if next {
                    Text("TIẾP THEO").font(TLFont.mono(8.5, .bold)).tracking(0.5).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 7).padding(.vertical, 3).background(TLColor.accent, in: Capsule())
                } else {
                    Text("chờ").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                }
                if canScore {
                    Image(systemName: "square.and.pencil").font(.system(size: 12)).foregroundStyle(TLColor.accentText)
                }
            }
            .padding(.vertical, 9).padding(.horizontal, 12)
            .background(next ? TLColor.accent.opacity(0.06) : TLColor.bg, in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain).disabled(!canScore)
    }

    // MARK: Helpers

    private func note(_ text: String) -> some View {
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

/// Two-field score entry for a single match.
private struct ScoreSheet: View {
    let detail: QuickTableDetail
    let match: QTMatch
    let onSave: (Int, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var s1: String
    @State private var s2: String
    @State private var refMode: ScoringMode = .rally
    @State private var refTarget = 11
    @State private var refSingles = false
    @State private var refereeing = false

    init(detail: QuickTableDetail, match: QTMatch, onSave: @escaping (Int, Int) -> Void) {
        self.detail = detail
        self.match = match
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
                    Button("Lưu") {
                        if let a = v1, let b = v2 { Haptics.light(); onSave(a, b) }
                    }
                    .foregroundStyle(valid ? TLColor.accentText : TLColor.fg4)
                    .disabled(!valid)
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
                Text("Trực tiếp").tag(ScoringMode.rally)
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
                    onLiveScore: { a, b in Task { try? await QuickTableRepository().updateLiveScore(matchID: match.id, score1: a, score2: b) } },
                    onClaimLive: { Task { try? await QuickTableRepository().claimLive(matchID: match.id) } }) { a, b, note in
                    Haptics.light(); onSave(a, b)
                    if let note { Task { try? await QuickTableRepository().updateRefereeNote(matchID: match.id, note: note) } }
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

/// Quản lý trọng tài cho 1 bảng — thêm/xoá bằng email (parity với TeamMatchSettingsSheet).
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
