import SwiftUI

/// Native Team Match (MLP) create wizard — faithful port of web TeamMatchSetup.tsx
/// (4 steps: Basic info → Game templates → DreamBreaker → Format). Creates via
/// create_team_match_with_quota + inserts game templates, then hands the new
/// share_id back so the caller can push the native detail view.
@Observable
final class CreateTeamMatchModel {
    struct Template: Identifiable, Equatable {
        let id = UUID()
        var gameType: String      // WD | MD | MX | WS | MS
        var displayName: String
        var scoringType: String   // rally21 | sideout11
    }

    var step = 1
    var name = ""
    var rosterSize = 4
    var teamCount = 4
    var requireRegistration = false
    var requireMinGames = false
    var templates: [Template] = CreateTeamMatchModel.defaultTemplates(4)
    var hasDreambreaker = false
    var format = "round_robin"
    var playoffTeamCount = 4
    var hasThirdPlaceMatch = false

    var creating = false
    var error: String?

    private let repo = TeamMatchRepository()

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

    func canProceed() -> Bool {
        switch step {
        case 1: return name.trimmingCharacters(in: .whitespaces).count >= 3 && teamCount >= 2
        case 2: return templates.count >= 1
        case 3: return true
        case 4: return format == "single_elimination" ? isValidSECount : true
        default: return false
        }
    }

    @MainActor
    func create(onCreated: (String) -> Void) async {
        creating = true; error = nil
        let opts = TeamMatchRepository.CreateOptions(
            name: name.trimmingCharacters(in: .whitespaces),
            rosterSize: rosterSize, teamCount: teamCount, format: format,
            playoffTeamCount: playoffTeamCount, requireRegistration: requireRegistration,
            hasDreambreaker: effectiveDreambreaker, requireMinGames: requireMinGames,
            hasThirdPlaceMatch: hasThirdPlaceMatch,
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
    @State private var model = CreateTeamMatchModel()

    private let steps = ["Thông tin", "Game", "DreamBreaker", "Thể thức"]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                stepBar
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        switch model.step {
                        case 1: basicInfo
                        case 2: gameTemplates
                        case 3: dreambreaker
                        default: formatStep
                        }
                        if let err = model.error {
                            Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                        }
                    }
                    .padding(16)
                }
                footer
            }
            .background(TLColor.bg)
            .navigationTitle("Tạo giải đồng đội")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) } }
        }
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
            toggleRow("Mỗi VĐV ít nhất 1 game", "Bắt buộc lineup dùng tất cả thành viên",
                      Binding(get: { model.requireMinGames }, set: { model.requireMinGames = $0 }))
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
                    Text("Rally 21").tag("rally21"); Text("Sideout 11").tag("sideout11")
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
                        Text("2 đội (Chung kết)").tag(2)
                        Text("4 đội (Bán kết)").tag(4)
                        Text("8 đội (Tứ kết)").tag(8)
                    }.pickerStyle(.segmented)
                }
            }
            if model.format == "single_elimination" {
                if model.isValidSECount {
                    infoCard(gold: false, "\(model.teamCount) đội — hợp lệ cho loại trực tiếp.")
                } else {
                    infoCard(gold: true, "Số đội phải là 4, 8, 16 hoặc 32 cho loại trực tiếp (hiện \(model.teamCount)). Quay lại Bước 1 để sửa.")
                }
                toggleRow("Có trận tranh hạng 3", "Trận giữa 2 đội thua bán kết",
                          Binding(get: { model.hasThirdPlaceMatch }, set: { model.hasThirdPlaceMatch = $0 }))
                infoCard(gold: false, "Sau khi tạo, BTC chọn cách ghép đội: bốc thăm ngẫu nhiên hoặc xếp thủ công (trên web).")
            }
        }
    }

    private func formatOption(_ value: String, _ title: String, _ desc: String) -> some View {
        let sel = model.format == value
        return Button { Haptics.light(); model.format = value } label: {
            HStack(spacing: 12) {
                Image(systemName: sel ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(sel ? TLColor.accent : TLColor.fg4)
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
            if model.step < 4 {
                Button { Haptics.light(); model.step += 1 } label: {
                    Text("Tiếp tục").font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(!model.canProceed()).opacity(model.canProceed() ? 1 : 0.5)
            } else {
                Button {
                    Haptics.success()
                    Task { await model.create { shareID in onCreated(shareID, model.name.trimmingCharacters(in: .whitespaces)); dismiss() } }
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

    private func field<Content: View>(_ label: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased()).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            content()
        }
    }

    private func toggleRow(_ title: String, _ desc: String, _ binding: Binding<Bool>) -> some View {
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
