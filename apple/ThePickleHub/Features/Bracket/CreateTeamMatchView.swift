import SwiftUI

/// Native Team Match (MLP) create wizard — faithful port of web TeamMatchSetup.tsx
/// (4 steps: Basic info → Game templates → DreamBreaker → Format). Creates via
/// create_team_match_atomic commits metadata + game templates, then hands the new
/// share_id back so the caller can push the native detail view.
@Observable
final class CreateTeamMatchModel {
    struct Template: Identifiable, Equatable {
        let id = UUID()
        var gameType: String      // WD | MD | MX | WS | MS
        var displayName: String
        var scoringType: String   // rally21 | sideout11
    }

    struct DiscountTier: Identifiable, Equatable {
        let id = UUID()
        var slots: Int
        var percent: Int
    }

    var step = 1
    var name = ""
    // Ngày tổ chức (bật/tắt) + địa điểm.
    var hasEventDate = false
    var eventDate = Date()
    var location = ""
    var rosterSize = 4
    var teamCount = 4
    var requireRegistration = false
    // DUPR khi yêu cầu đăng ký — điểm DUPR tối đa theo giới tính.
    var useDupr = false
    var duprMaxMale: Double = 5.0
    var duprMaxFemale: Double = 4.5
    // Chế độ tính theo TỔNG điểm: mỗi game con đấu tới `pointsPerGame`; hết các game, bên nào TỔNG điểm cao hơn thắng (KHÔNG phải đạt mốc cố định).
    var totalScoreMode = false
    var pointsPerGame = 7
    var requireMinGames = false
    // Bước 5 — Thể lệ & Lệ phí. QR VietQR dựng từ 3 trường bank khi phí > 0.
    var rulesSummary = ""
    var entryFeeVnd = 0
    var entryFeeTeamVnd = 0
    var bankCode = ""
    var bankAccountNumber = ""
    var bankAccountName = ""
    // Bậc giảm giá slot đăng ký sớm — BTC tự nhập, cộng dồn theo thứ tự.
    var discountTiers: [DiscountTier] = []
    var validTiers: [DiscountTier] { discountTiers.filter { $0.slots > 0 && $0.percent > 0 && $0.percent <= 100 } }
    var templates: [Template] = CreateTeamMatchModel.defaultTemplates(4)
    var hasDreambreaker = false
    var format = "round_robin"
    var playoffTeamCount = 4
    // rr_playoff: bật nhánh Tái sinh — hạng 3,4 mỗi bảng đá bracket phụ (cùng logic playoff).
    var hasRepechage = false

    /// Gợi ý số đội vào playoff theo số đội tham gia: 2 luỹ thừa-của-2 lớn nhất ≤ teamCount.
    /// Vd 25 → [16, 8], 10 → [8, 4], 6 → [4, 2], ≤3 → [2]. Không fix cứng 2/4/8.
    var playoffSizeOptions: [Int] {
        var p = 1
        while p * 2 <= teamCount { p *= 2 }   // p = luỹ thừa 2 lớn nhất ≤ teamCount
        if p < 2 { p = 2 }
        return p > 2 ? [p, p / 2] : [2]
    }
    /// Kẹp playoffTeamCount về 1 option hợp lệ (gọi khi vào bước 4 / đổi số đội).
    func normalizePlayoffCount() {
        if !playoffSizeOptions.contains(playoffTeamCount) { playoffTeamCount = playoffSizeOptions.first ?? 2 }
    }
    var hasThirdPlaceMatch = false

    var creating = false
    var error: String?

    private let repo = TeamMatchRepository()

    static func dateString(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    static func defaultTemplates(_ roster: Int) -> [Template] {
        switch roster {
        case 6:
            return [.init(gameType: "WD", displayName: "WD", scoringType: "rally21"),
                    .init(gameType: "MD", displayName: "MD", scoringType: "rally21"),
                    .init(gameType: "MX", displayName: "MX 1", scoringType: "rally21"),
                    .init(gameType: "MX", displayName: "MX 2", scoringType: "rally21")]
        case 8:
            return [.init(gameType: "WD", displayName: "WD 1", scoringType: "rally21"),
                    .init(gameType: "WD", displayName: "WD 2", scoringType: "rally21"),
                    .init(gameType: "MD", displayName: "MD 1", scoringType: "rally21"),
                    .init(gameType: "MD", displayName: "MD 2", scoringType: "rally21"),
                    .init(gameType: "MX", displayName: "MX 1", scoringType: "rally21"),
                    .init(gameType: "MX", displayName: "MX 2", scoringType: "rally21")]
        default: // 4
            return [.init(gameType: "MX", displayName: "MX 1", scoringType: "rally21"),
                    .init(gameType: "MX", displayName: "MX 2", scoringType: "rally21"),
                    .init(gameType: "MD", displayName: "MD", scoringType: "rally21"),
                    .init(gameType: "WD", displayName: "WD", scoringType: "rally21")]
        }
    }

    var isEvenGames: Bool { templates.count % 2 == 0 }
    var effectiveDreambreaker: Bool { isEvenGames && hasDreambreaker }
    static func isPowerOfTwo(_ n: Int) -> Bool { n > 0 && (n & (n - 1)) == 0 }
    var isValidSECount: Bool { Self.isPowerOfTwo(teamCount) && teamCount >= 4 }

    func setRosterSize(_ size: Int) {
        rosterSize = size
        templates = Self.defaultTemplates(size)   // reset to default for the size (web parity)
    }

    var hasAnyFee: Bool { entryFeeVnd > 0 || entryFeeTeamVnd > 0 }
    /// Phí > 0 buộc nhập đủ 3 trường tài khoản để dựng QR; miễn phí thì bỏ qua.
    var feeStepValid: Bool {
        if !hasAnyFee { return true }
        return !bankCode.isEmpty
            && !bankAccountNumber.trimmingCharacters(in: .whitespaces).isEmpty
            && !bankAccountName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func canProceed() -> Bool {
        switch step {
        case 1: return name.trimmingCharacters(in: .whitespaces).count >= 3 && teamCount >= 2
        case 2: return templates.count >= 1
        case 3: return true
        case 4: return format == "single_elimination" ? isValidSECount : true
        case 5: return feeStepValid
        default: return false
        }
    }

    // ── UX-04 autosave snapshot (parity web draft:teammatch:new) ─────────
    // Ranh giới D3/CodeQL: bankCode / bankAccountNumber / bankAccountName
    // KHÔNG có trong snapshot — nhập lại sau khi khôi phục, giống web.
    struct Draft: Codable, Equatable {
        struct Template: Codable, Equatable { var gameType: String; var displayName: String; var scoringType: String }
        struct Tier: Codable, Equatable { var slots: Int; var percent: Int }
        var step: Int
        var name: String
        var hasEventDate: Bool
        var eventDate: Date
        var location: String
        var rosterSize: Int
        var teamCount: Int
        var requireRegistration: Bool
        var useDupr: Bool
        var duprMaxMale: Double
        var duprMaxFemale: Double
        var totalScoreMode: Bool
        var pointsPerGame: Int
        var requireMinGames: Bool
        var rulesSummary: String
        var entryFeeVnd: Int
        var entryFeeTeamVnd: Int
        var discountTiers: [Tier]
        var templates: [Template]
        var hasDreambreaker: Bool
        var format: String
        var playoffTeamCount: Int
        var hasRepechage: Bool
        var hasThirdPlaceMatch: Bool
    }

    var draftSnapshot: Draft {
        .init(step: step, name: name, hasEventDate: hasEventDate, eventDate: eventDate,
              location: location, rosterSize: rosterSize, teamCount: teamCount,
              requireRegistration: requireRegistration, useDupr: useDupr,
              duprMaxMale: duprMaxMale, duprMaxFemale: duprMaxFemale,
              totalScoreMode: totalScoreMode, pointsPerGame: pointsPerGame,
              requireMinGames: requireMinGames, rulesSummary: rulesSummary,
              entryFeeVnd: entryFeeVnd, entryFeeTeamVnd: entryFeeTeamVnd,
              discountTiers: discountTiers.map { .init(slots: $0.slots, percent: $0.percent) },
              templates: templates.map { .init(gameType: $0.gameType, displayName: $0.displayName, scoringType: $0.scoringType) },
              hasDreambreaker: hasDreambreaker, format: format,
              playoffTeamCount: playoffTeamCount, hasRepechage: hasRepechage,
              hasThirdPlaceMatch: hasThirdPlaceMatch)
    }

    func apply(_ d: Draft) {
        name = d.name
        hasEventDate = d.hasEventDate
        eventDate = d.eventDate
        location = d.location
        if [4, 6, 8].contains(d.rosterSize) { rosterSize = d.rosterSize }
        teamCount = min(max(2, d.teamCount), 32)
        requireRegistration = d.requireRegistration
        useDupr = d.useDupr
        duprMaxMale = d.duprMaxMale
        duprMaxFemale = d.duprMaxFemale
        totalScoreMode = d.totalScoreMode
        pointsPerGame = min(max(1, d.pointsPerGame), 50)
        requireMinGames = d.requireMinGames
        rulesSummary = d.rulesSummary
        entryFeeVnd = max(0, d.entryFeeVnd)
        entryFeeTeamVnd = max(0, d.entryFeeTeamVnd)
        discountTiers = d.discountTiers.map { DiscountTier(slots: $0.slots, percent: $0.percent) }
        if !d.templates.isEmpty {
            templates = d.templates.map {
                Template(gameType: $0.gameType, displayName: $0.displayName, scoringType: $0.scoringType)
            }
        }
        hasDreambreaker = d.hasDreambreaker
        if ["round_robin", "single_elimination", "rr_playoff"].contains(d.format) { format = d.format }
        playoffTeamCount = d.playoffTeamCount
        normalizePlayoffCount()
        hasRepechage = d.hasRepechage
        hasThirdPlaceMatch = d.hasThirdPlaceMatch
        step = min(max(1, d.step), 5)
    }

    func resetForm() {
        step = 1; name = ""; hasEventDate = false; eventDate = Date(); location = ""
        rosterSize = 4; teamCount = 4; requireRegistration = false
        useDupr = false; duprMaxMale = 5.0; duprMaxFemale = 4.5
        totalScoreMode = false; pointsPerGame = 7; requireMinGames = false
        rulesSummary = ""; entryFeeVnd = 0; entryFeeTeamVnd = 0
        bankCode = ""; bankAccountNumber = ""; bankAccountName = ""
        discountTiers = []; templates = Self.defaultTemplates(4)
        hasDreambreaker = false; format = "round_robin"; playoffTeamCount = 4
        hasRepechage = false; hasThirdPlaceMatch = false; error = nil
    }

    @MainActor
    func create(onCreated: (String) -> Void) async {
        creating = true; error = nil
        let opts = TeamMatchRepository.CreateOptions(
            name: name.trimmingCharacters(in: .whitespaces),
            rosterSize: rosterSize, teamCount: teamCount, format: format,
            playoffTeamCount: playoffTeamCount,
            hasRepechage: format == "rr_playoff" && hasRepechage,
            requireRegistration: requireRegistration,
            hasDreambreaker: effectiveDreambreaker, requireMinGames: requireMinGames,
            hasThirdPlaceMatch: hasThirdPlaceMatch,
            useDupr: requireRegistration && useDupr, duprMaxMale: duprMaxMale, duprMaxFemale: duprMaxFemale,
            totalScoreMode: totalScoreMode, pointsPerGame: pointsPerGame,
            rulesSummary: rulesSummary, entryFeeVnd: entryFeeVnd, entryFeeTeamVnd: entryFeeTeamVnd,
            bankCode: bankCode, bankAccountNumber: bankAccountNumber, bankAccountName: bankAccountName,
            eventDate: hasEventDate ? Self.dateString(eventDate) : nil,
            location: location,
            discountTiers: validTiers.map { .init(slots: $0.slots, percent: $0.percent) },
            templates: templates.enumerated().map {
                .init(gameType: $1.gameType, scoringType: $1.scoringType,
                      displayName: $1.displayName, orderIndex: $0)
            })
        do {
            let shareID = try await repo.createTournament(opts)
            onCreated(shareID)
        } catch {
            self.error = error.localizedDescription
        }
        creating = false
    }
}

struct CreateTeamMatchView: View {
    let onCreated: (_ shareID: String, _ name: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var model = CreateTeamMatchModel()
    @State private var confirmDiscard = false
    @State private var draft = DraftStore<CreateTeamMatchModel.Draft>(flow: "teammatch")
    @State private var restoredDraft = false
    @State private var restoreApplied = false

    private let steps = ["Thông tin", "Game", "DreamBreaker", "Thể thức", "Lệ phí"]

    private var hasEdits: Bool {
        !model.name.isEmpty || !model.location.isEmpty || model.step > 1
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                stepBar
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if restoredDraft {
                            DraftRestoredBanner {
                                model.resetForm()
                                draft.clear(current: model.draftSnapshot)
                            }
                        }
                        switch model.step {
                        case 1: basicInfo
                        case 2: gameTemplates
                        case 3: dreambreaker
                        case 4: formatStep
                        default: feeStep
                        }
                        if let err = model.error {
                            Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                        }
                    }
                    .padding(16)
                }
                DraftSaveStatusLine(savedAt: draft.lastSavedAt).padding(.horizontal, 16)
                footer
            }
            .background(TLColor.bg)
            .navigationTitle("Tạo giải đồng đội")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") {
                        if hasEdits { confirmDiscard = true } else { dismiss() }
                    }.foregroundStyle(TLColor.fg3)
                }
            }
            .confirmationDialog("Bỏ thay đổi?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                // ponytail: đóng sheet KHÔNG xóa draft — autosave giữ lại,
                // mở lại sẽ có banner khôi phục + "Bắt đầu lại" để xóa hẳn.
                Button("Bỏ thay đổi", role: .destructive) { dismiss() }
                Button("Tiếp tục nhập", role: .cancel) {}
            }
            .onAppear {
                guard !restoreApplied else { return }
                restoreApplied = true
                if let d = draft.restore() {
                    model.apply(d)
                    restoredDraft = true
                }
            }
            .onChange(of: model.draftSnapshot) { _, snap in draft.save(snap) }
            .onChange(of: scenePhase) { _, phase in
                if phase == .background { draft.flush(model.draftSnapshot) }
            }
        }
        .interactiveDismissDisabled(hasEdits)
    }

    private var stepBar: some View {
        HStack(spacing: 8) {
            ForEach(Array(steps.enumerated()), id: \.offset) { i, title in
                let n = i + 1
                HStack(spacing: 5) {
                    Text("\(n)").font(TLFont.mono(10, .bold))
                        .foregroundStyle(n <= model.step ? TLColor.accentInk : TLColor.fg3)
                        .frame(width: 20, height: 20)
                        .background(n <= model.step ? TLColor.accent : TLColor.surface2, in: Circle())
                    if n == model.step {
                        Text(title).font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg2)
                    }
                }
            }
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(TLColor.bg)
    }

    // MARK: Step 1

    private var basicInfo: some View {
        VStack(alignment: .leading, spacing: 18) {
            field("Tên giải đấu") {
                TextField("VD: MLP Mùa Xuân 2026", text: Binding(get: { model.name }, set: { model.name = $0 }))
                    .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }
            toggleRow("Ngày tổ chức", "Hiển thị ở màn hình tổng quan giải",
                      Binding(get: { model.hasEventDate }, set: { model.hasEventDate = $0 }))
            if model.hasEventDate {
                DatePicker("", selection: Binding(get: { model.eventDate }, set: { model.eventDate = $0 }), displayedComponents: .date)
                    .datePickerStyle(.compact).labelsHidden().tint(TLColor.accent)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }
            field("Địa điểm") {
                TextField("VD: Sân ABC, Q.7", text: Binding(get: { model.location }, set: { model.location = $0 }))
                    .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }
            field("Số VĐV mỗi đội") {
                HStack(spacing: 10) {
                    ForEach([4, 6, 8], id: \.self) { size in
                        let sel = model.rosterSize == size
                        Button { Haptics.light(); model.setRosterSize(size) } label: {
                            VStack(spacing: 2) {
                                Text("\(size)").font(TLFont.serif(28)).italic()
                                Text("VĐV").font(TLFont.mono(9, .medium)).tracking(0.5)
                            }
                            .foregroundStyle(sel ? TLColor.accentText : TLColor.fg2)
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(sel ? TLColor.accent.opacity(0.12) : TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(sel ? TLColor.accent.opacity(0.5) : TLColor.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            field("Số đội") {
                Stepper(value: Binding(get: { model.teamCount }, set: { model.teamCount = $0 }), in: 2...32) {
                    Text("\(model.teamCount) đội").font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }
            toggleRow("Yêu cầu đăng ký trước", "Đội trưởng tạo đội và mời thành viên",
                      Binding(get: { model.requireRegistration }, set: { model.requireRegistration = $0 }))
            if model.requireRegistration {
                toggleRow("Sử dụng DUPR", "Giới hạn điểm DUPR tối đa khi đăng ký",
                          Binding(get: { model.useDupr }, set: { model.useDupr = $0 }))
                if model.useDupr {
                    ratingField("DUPR tối đa — Nam", Binding(get: { model.duprMaxMale }, set: { model.duprMaxMale = $0 }))
                    ratingField("DUPR tối đa — Nữ", Binding(get: { model.duprMaxFemale }, set: { model.duprMaxFemale = $0 }))
                }
            }
            toggleRow("Mỗi VĐV ít nhất 1 game", "Bắt buộc lineup dùng tất cả thành viên",
                      Binding(get: { model.requireMinGames }, set: { model.requireMinGames = $0 }))
        }
    }

    private func ratingField(_ title: LocalizedStringKey, _ value: Binding<Double>) -> some View {
        field(title) {
            Stepper(value: value, in: 2.0...8.0, step: 0.25) {
                Text(String(format: "%.2f", value.wrappedValue)).font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    // MARK: Step 2

    private var gameTemplates: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("CÁC GAME TRONG TRẬN").font(TLFont.mono(10.5, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
                Spacer()
                Button { Haptics.light(); model.templates = CreateTeamMatchModel.defaultTemplates(model.rosterSize) } label: {
                    Text("Reset").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText)
                }.buttonStyle(.plain)
            }
            Text("\(model.templates.count) game\(model.isEvenGames ? " · số chẵn → có thể cần DreamBreaker" : " · số lẻ → ván cuối quyết định")")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)

            toggleRow("Tính theo tổng điểm", "Cộng dồn điểm các game; bên nào tổng cao hơn thắng, thay vì thắng/thua từng game",
                      Binding(get: { model.totalScoreMode }, set: { model.totalScoreMode = $0 }))
            if model.totalScoreMode {
                field("Điểm mỗi game con") {
                    Stepper(value: Binding(get: { model.pointsPerGame }, set: { model.pointsPerGame = $0 }), in: 1...50) {
                        Text("\(model.pointsPerGame) điểm").font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                }
                infoCard(gold: false, "Mỗi cặp thi đấu tới \(model.pointsPerGame) điểm. Hết \(model.templates.count) cặp, bên nào tổng số điểm lớn hơn là thắng.")
            }

            ForEach(Array(model.templates.enumerated()), id: \.element.id) { idx, tpl in
                templateRow(idx: idx, tpl: tpl)
            }

            Button { Haptics.light(); model.templates.append(.init(gameType: "MX", displayName: "Game \(model.templates.count + 1)", scoringType: "rally21")) } label: {
                HStack(spacing: 6) { Image(systemName: "plus"); Text("Thêm game") }
                    .font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
            }.buttonStyle(.plain)
        }
    }

    private func templateRow(idx: Int, tpl: CreateTeamMatchModel.Template) -> some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Text("\(idx + 1).").font(TLFont.mono(12, .bold)).foregroundStyle(TLColor.fg3)
                Menu {
                    ForEach(["WD", "MD", "MX", "WS", "MS"], id: \.self) { gt in
                        Button(gameTypeLabel(gt)) { model.templates[idx].gameType = gt }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(gameTypeLabel(tpl.gameType)).font(TLFont.sans(13, .medium))
                        Image(systemName: "chevron.up.chevron.down").font(.system(size: 9))
                    }.foregroundStyle(TLColor.fg)
                }
                Spacer()
                Button { if idx > 0 { model.templates.swapAt(idx, idx - 1) } } label: {
                    Image(systemName: "arrow.up").font(.system(size: 11, weight: .bold))
                        .foregroundStyle(idx > 0 ? TLColor.fg3 : TLColor.fg4)
                }.buttonStyle(.plain).disabled(idx == 0)
                Button { if idx < model.templates.count - 1 { model.templates.swapAt(idx, idx + 1) } } label: {
                    Image(systemName: "arrow.down").font(.system(size: 11, weight: .bold))
                        .foregroundStyle(idx < model.templates.count - 1 ? TLColor.fg3 : TLColor.fg4)
                }.buttonStyle(.plain).disabled(idx == model.templates.count - 1)
                Button { if model.templates.count > 1 { model.templates.remove(at: idx) } } label: {
                    Image(systemName: "trash").font(.system(size: 11)).foregroundStyle(model.templates.count > 1 ? TLColor.live : TLColor.fg4)
                }.buttonStyle(.plain).disabled(model.templates.count <= 1)
            }
            HStack(spacing: 8) {
                TextField("Tên hiển thị", text: Binding(get: { model.templates[idx].displayName }, set: { model.templates[idx].displayName = $0 }))
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 8))
                Picker("", selection: Binding(get: { model.templates[idx].scoringType }, set: { model.templates[idx].scoringType = $0 })) {
                    // Total mode overrides each game's target with pointsPerGame.
                    Text("Rally \(model.totalScoreMode ? model.pointsPerGame : 21)").tag("rally21")
                    Text("Sideout \(model.totalScoreMode ? model.pointsPerGame : 11)").tag("sideout11")
                }.pickerStyle(.menu).tint(TLColor.accentText)
            }
        }
        .padding(12)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Step 3

    @ViewBuilder
    private var dreambreaker: some View {
        if model.isEvenGames {
            VStack(alignment: .leading, spacing: 14) {
                infoCard(gold: true, "Số game chẵn (\(model.templates.count)). Khi 2 đội thắng số game bằng nhau, cần DreamBreaker để phân định.")
                toggleRow("Bật DreamBreaker", "Thêm ván quyết định khi 2 đội hòa số game",
                          Binding(get: { model.hasDreambreaker }, set: { model.hasDreambreaker = $0 }))
                if model.hasDreambreaker {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("VÁN DREAMBREAKER (VÁN CUỐI)").font(TLFont.mono(10, .bold)).tracking(0.6).foregroundStyle(TLColor.accentText)
                        Text("Theo chuẩn MLP: 4 VĐV thi đấu đơn, rally scoring. Đội trưởng chọn 4 VĐV bất kỳ (không phân biệt giới tính) khi lineup.")
                            .font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3).lineSpacing(2)
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(TLColor.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        } else {
            infoCard(gold: false, "Số game lẻ (\(model.templates.count)). Không cần DreamBreaker vì đã có ván quyết định (ván cuối).")
        }
    }

    // MARK: Step 4

    private var formatStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            formatOption("round_robin", "Vòng tròn (Round Robin)", "Tất cả các đội đấu với nhau")
            formatOption("single_elimination", "Loại trực tiếp", "Thua 1 trận là bị loại")
            formatOption("rr_playoff", "Vòng bảng + Playoff", "Vòng tròn theo bảng, sau đó playoff")

            if model.format == "rr_playoff" {
                field("Số đội vào Playoff") {
                    Picker("", selection: Binding(get: { model.playoffTeamCount }, set: { model.playoffTeamCount = $0 })) {
                        ForEach(model.playoffSizeOptions, id: \.self) { n in
                            Text("\(n) đội").tag(n)
                        }
                    }.pickerStyle(.segmented)
                }
                .onAppear { model.normalizePlayoffCount() }
                infoCard(gold: false, "Gợi ý theo \(model.teamCount) đội tham gia — \(model.playoffTeamCount) đội mạnh nhất vào nhánh loại trực tiếp (\(roundName(model.playoffTeamCount))).")
                repechageRow
            }
            if model.format == "single_elimination" {
                if model.isValidSECount {
                    infoCard(gold: false, "\(model.teamCount) đội — hợp lệ cho loại trực tiếp.")
                } else {
                    infoCard(gold: true, "Số đội phải là 4, 8, 16 hoặc 32 cho loại trực tiếp (hiện \(model.teamCount)). Quay lại Bước 1 để sửa.")
                }
                toggleRow("Có trận tranh hạng 3", "Trận giữa 2 đội thua bán kết",
                          Binding(get: { model.hasThirdPlaceMatch }, set: { model.hasThirdPlaceMatch = $0 }))
                infoCard(gold: false, "Sau khi tạo, BTC chọn cách ghép đội: bốc thăm ngẫu nhiên hoặc xếp thủ công ngay trong app.")
            }
        }
    }

    private func roundName(_ n: Int) -> String {
        switch n {
        case 2: return "Chung kết"
        case 4: return "Bán kết"
        case 8: return "Tứ kết"
        case 16: return "Vòng 1/16"
        case 32: return "Vòng 1/32"
        default: return "\(n) đội"
        }
    }

    // Nhánh Tái sinh: hạng 3,4 mỗi bảng đá bracket phụ (cùng cách phân nhánh/xếp cặp
    // như playoff, chỉ khác playoff lấy hạng 1,2). BTC sinh nhánh này cùng lúc bấm
    // "Sinh vòng Playoff" khi vòng bảng xong.
    @ViewBuilder
    private var repechageRow: some View {
        toggleRow("Vòng Tái sinh", "Hạng 3,4 mỗi bảng đá thêm nhánh phụ (như playoff cho hạng 1,2)",
                  Binding(get: { model.hasRepechage }, set: { model.hasRepechage = $0 }))
        if model.hasRepechage {
            infoCard(gold: false, "Sau vòng bảng, hạng 3 & 4 mỗi bảng vào nhánh Tái sinh — xếp cặp theo bảng giống playoff (hạng 3 bảng X gặp hạng 4 bảng Y).")
        }
    }

    private func formatOption(_ value: String, _ title: String, _ desc: String) -> some View {
        let sel = model.format == value
        return Button { Haptics.light(); model.format = value } label: {
            HStack(spacing: 12) {
                Image(systemName: sel ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(sel ? TLColor.accentText : TLColor.fg4)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg)
                    Text(desc).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                }
                Spacer()
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(sel ? TLColor.accent.opacity(0.5) : TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    // MARK: Step 5 — Thể lệ & Lệ phí

    private var feeStep: some View {
        VStack(alignment: .leading, spacing: 18) {
            field("Tóm tắt thể lệ giải") {
                TextField("VD: Thi đấu MLP, mỗi trận 4 game + DreamBreaker. Check-in trước 15 phút…",
                          text: Binding(get: { model.rulesSummary }, set: { model.rulesSummary = $0 }),
                          axis: .vertical)
                    .lineLimit(3...8)
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }

            field("Lệ phí mỗi VĐV (VND)") {
                TextField("0 = miễn phí",
                          value: Binding(get: { model.entryFeeVnd }, set: { model.entryFeeVnd = max(0, $0) }),
                          format: .number)
                    .keyboardType(.numberPad)
                    .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }

            field("Lệ phí mỗi đội (VND)") {
                TextField("0 = miễn phí",
                          value: Binding(get: { model.entryFeeTeamVnd }, set: { model.entryFeeTeamVnd = max(0, $0) }),
                          format: .number)
                    .keyboardType(.numberPad)
                    .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }

            if model.hasAnyFee {
                discountTiersEditor
                Text("TÀI KHOẢN NHẬN — TẠO MÃ QR")
                    .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.accentText)

                field("Ngân hàng") {
                    Menu {
                        ForEach(VNBank.all) { b in
                            Button("\(b.shortName) (\(b.code))") { model.bankCode = b.code }
                        }
                    } label: {
                        HStack {
                            Text(bankLabel).font(TLFont.sans(15)).foregroundStyle(model.bankCode.isEmpty ? TLColor.fg3 : TLColor.fg)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.system(size: 11)).foregroundStyle(TLColor.fg3)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 11)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                }
                field("Số tài khoản") {
                    TextField("VD: 0123456789",
                              text: Binding(get: { model.bankAccountNumber }, set: { model.bankAccountNumber = $0 }))
                        .keyboardType(.numberPad).autocorrectionDisabled()
                        .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                        .padding(.horizontal, 12).padding(.vertical, 11)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                }
                field("Tên chủ tài khoản") {
                    TextField("VD: NGUYEN VAN A",
                              text: Binding(get: { model.bankAccountName }, set: { model.bankAccountName = $0.uppercased() }))
                        .autocorrectionDisabled().textInputAutocapitalization(.characters)
                        .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                        .padding(.horizontal, 12).padding(.vertical, 11)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                }

                qrPreview
            } else {
                infoCard(gold: false, "Miễn phí — không cần tài khoản nhận. Bật lệ phí > 0 để tạo mã QR chuyển khoản cho VĐV.")
            }
        }
    }

    // Bậc giảm giá slot đăng ký sớm: mỗi hàng = số slot + % giảm, cộng dồn.
    private var discountTiersEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("GIẢM GIÁ SLOT ĐĂNG KÝ SỚM")
                .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.accentText)
            Text("VD: 10 slot đầu giảm 20%, 5 slot tiếp giảm 15%. Slot tính theo thứ tự đăng ký đội; QR tự áp dụng số tiền sau giảm.")
                .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).lineSpacing(2)

            ForEach(Array(model.discountTiers.enumerated()), id: \.element.id) { idx, tier in
                let from = model.discountTiers.prefix(idx).reduce(0) { $0 + $1.slots } + 1
                HStack(spacing: 8) {
                    Text("Slot \(from)+").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3)
                        .frame(width: 56, alignment: .leading)
                    TextField("Số slot", value: Binding(
                        get: { model.discountTiers[idx].slots },
                        set: { model.discountTiers[idx].slots = max(0, $0) }), format: .number)
                        .keyboardType(.numberPad)
                        .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                        .padding(.horizontal, 10).padding(.vertical, 9)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(TLColor.border, lineWidth: 1))
                    TextField("% giảm", value: Binding(
                        get: { model.discountTiers[idx].percent },
                        set: { model.discountTiers[idx].percent = min(100, max(0, $0)) }), format: .number)
                        .keyboardType(.numberPad)
                        .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                        .padding(.horizontal, 10).padding(.vertical, 9)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(TLColor.border, lineWidth: 1))
                    Button { Haptics.light(); model.discountTiers.remove(at: idx) } label: {
                        Image(systemName: "trash").font(.system(size: 12)).foregroundStyle(TLColor.live)
                    }.buttonStyle(.plain)
                }
            }

            Button { Haptics.light(); model.discountTiers.append(.init(slots: 0, percent: 0)) } label: {
                HStack(spacing: 6) { Image(systemName: "plus"); Text("Thêm bậc giảm giá") }
                    .font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
            }.buttonStyle(.plain)

            if !model.validTiers.isEmpty && previewAmount > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(model.validTiers.enumerated()), id: \.element.id) { idx, tier in
                        let from = model.validTiers.prefix(idx).reduce(0) { $0 + $1.slots } + 1
                        let to = from + tier.slots - 1
                        let amount = previewAmount * (100 - tier.percent) / 100
                        Text("Slot \(from)–\(to): \(amount.formatted()) đ (−\(tier.percent)%)")
                    }
                    Text("Slot còn lại: \(previewAmount.formatted()) đ (giá gốc)")
                }
                .font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2).lineSpacing(2)
                .frame(maxWidth: .infinity, alignment: .leading).padding(12)
                .background(TLColor.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
            }
        }
    }

    private var bankLabel: String {
        guard let b = VNBank.all.first(where: { $0.code == model.bankCode }) else { return "Chọn ngân hàng" }
        return "\(b.shortName) (\(b.code))"
    }

    // Preview dùng phí đội nếu có, không thì phí VĐV.
    private var previewAmount: Int { model.entryFeeTeamVnd > 0 ? model.entryFeeTeamVnd : model.entryFeeVnd }

    @ViewBuilder
    private var qrPreview: some View {
        if let url = VietQR.imageURL(
            bankCode: model.bankCode,
            accountNumber: model.bankAccountNumber,
            accountName: model.bankAccountName,
            amountVnd: previewAmount,
            memo: qrMemo) {
            VStack(spacing: 10) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    case .failure: Image(systemName: "qrcode").font(.system(size: 40)).foregroundStyle(TLColor.fg4)
                    default: ProgressView().tint(TLColor.accentText)
                    }
                }
                .frame(width: 220, height: 260)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                Text("Quét mã để chuyển \(previewAmount.formatted()) đ")
                    .font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 4)
        } else {
            infoCard(gold: true, "Nhập đủ ngân hàng + số tài khoản để xem trước mã QR.")
        }
    }

    /// Nội dung chuyển khoản (addInfo). Ngắn gọn, VietQR tự URL-encode diacritics.
    private var qrMemo: String {
        let n = model.name.trimmingCharacters(in: .whitespaces)
        return n.isEmpty ? "Le phi giai" : "Le phi \(n)"
    }

    // MARK: Footer / shared

    private var footer: some View {
        HStack(spacing: 12) {
            if model.step > 1 {
                Button { Haptics.light(); model.step -= 1 } label: {
                    Text("Quay lại").font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg2)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
                }.buttonStyle(.plain)
            }
            if model.step < 5 {
                Button { Haptics.light(); model.step += 1 } label: {
                    Text("Tiếp tục").font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(!model.canProceed()).opacity(model.canProceed() ? 1 : 0.5)
            } else {
                Button {
                    Haptics.light()
                    Task {
                        await model.create { shareID in
                            draft.clear(current: model.draftSnapshot)
                            onCreated(shareID, model.name.trimmingCharacters(in: .whitespaces)); dismiss()
                        }
                        if model.error == nil { Haptics.success() } else { Haptics.error() }
                    }
                } label: {
                    HStack(spacing: 6) {
                        if model.creating { ProgressView().tint(TLColor.accentInk) }
                        Text(model.creating ? "Đang tạo..." : "Tạo giải đấu").font(TLFont.sans(14, .bold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(!model.canProceed() || model.creating).opacity(model.canProceed() ? 1 : 0.5)
            }
        }
        .padding(16)
        .background(TLColor.bg)
    }

    private func field<Content: View>(_ label: LocalizedStringKey, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).textCase(.uppercase).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            content()
        }
    }

    private func toggleRow(_ title: LocalizedStringKey, _ desc: LocalizedStringKey, _ binding: Binding<Bool>) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                Text(desc).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
            }
            Spacer()
            Toggle("", isOn: binding).labelsHidden().tint(TLColor.accent)
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func infoCard(gold: Bool, _ text: String) -> some View {
        Text(text).font(TLFont.sans(12.5)).foregroundStyle(gold ? TLColor.gold : TLColor.fg3).lineSpacing(2)
            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
            .background((gold ? TLColor.gold.opacity(0.1) : TLColor.surface), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(gold ? TLColor.gold.opacity(0.4) : TLColor.border, lineWidth: 1))
    }

    private func gameTypeLabel(_ gt: String) -> String {
        switch gt {
        case "WD": return "Đôi Nữ (WD)"
        case "MD": return "Đôi Nam (MD)"
        case "MX": return "Đôi Nam Nữ (MX)"
        case "WS": return "Đơn Nữ (WS)"
        case "MS": return "Đơn Nam (MS)"
        default: return gt
        }
    }
}
