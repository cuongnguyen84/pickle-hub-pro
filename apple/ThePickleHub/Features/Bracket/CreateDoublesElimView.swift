import SwiftUI

/// Native Doubles Elimination create wizard — port of DoublesEliminationSetup
/// (3 steps: info → format → team list). Manual flow creates + seeds the bracket
/// immediately (status ongoing); DUPR flow opens registration. Hands back the new
/// share_id so the caller can push the native detail view.
@Observable
final class CreateDEModel {
    struct TeamRow: Identifiable { let id = UUID(); var name = ""; var p1 = ""; var p2 = ""; var seed = "" }

    var step = 1
    var name = ""
    var teamCount = 8
    var courtsText = ""
    var startTime = ""
    var ratingSource = "self"      // self | either | dupr
    var minDupr = ""
    var maxDupr = ""
    var earlyFormat = "bo1"        // bo1 | bo3 | bo5
    var semiSel = "inherit"        // inherit | bo3 | bo5
    var finalsSel = "inherit"
    var hasThirdPlace = false
    var teams: [TeamRow] = [TeamRow(), TeamRow()]
    var creating = false
    var error: String?

    private let repo = DoublesElimRepository()

    var isDupr: Bool { ratingSource == "dupr" }
    var lastStep: Int { isDupr ? 2 : 3 }
    private func resolved(_ sel: String) -> String { sel == "inherit" ? earlyFormat : sel }
    private func validTeam(_ t: TeamRow) -> Bool {
        !t.p1.trimmingCharacters(in: .whitespaces).isEmpty || !t.name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func canProceed() -> Bool {
        switch step {
        case 1: return name.trimmingCharacters(in: .whitespaces).count >= 3 && teamCount >= 2
        case 2: return true
        case 3: return teams.filter(validTeam).count >= 2
        default: return false
        }
    }

    @MainActor
    func create(onDone: (String) -> Void) async {
        creating = true; error = nil
        let courts = courtsText.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        let opts = DoublesElimRepository.DECreateOptions(
            name: name.trimmingCharacters(in: .whitespaces), teamCount: teamCount, courts: courts,
            startTime: startTime.trimmingCharacters(in: .whitespaces).nonEmpty,
            ratingSource: ratingSource, minDupr: Double(minDupr.replacingOccurrences(of: ",", with: ".")),
            maxDupr: Double(maxDupr.replacingOccurrences(of: ",", with: ".")),
            earlyFormat: earlyFormat, semiFormat: resolved(semiSel), finalsFormat: resolved(finalsSel),
            hasThirdPlace: hasThirdPlace)
        let inputs: [DoublesElimRepository.DETeamInput] = isDupr ? [] : teams.filter(validTeam).map {
            .init(teamName: $0.name.trimmingCharacters(in: .whitespaces),
                  p1: $0.p1.trimmingCharacters(in: .whitespaces), p2: $0.p2.trimmingCharacters(in: .whitespaces),
                  seed: Int($0.seed.trimmingCharacters(in: .whitespaces)))
        }
        do {
            let shareID = try await repo.createDoublesElim(opts, teams: inputs)
            onDone(shareID)
        } catch { self.error = error.localizedDescription }
        creating = false
    }
}

struct CreateDoublesElimView: View {
    let onCreated: (_ shareID: String, _ name: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model = CreateDEModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                stepBar
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        switch model.step {
                        case 1: infoStep
                        case 2: formatStep
                        default: teamsStep
                        }
                        if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                    }
                    .padding(16)
                }
                footer
            }
            .background(TLColor.bg)
            .navigationTitle("Tạo loại trực tiếp")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) } }
        }
    }

    private var stepBar: some View {
        HStack(spacing: 8) {
            ForEach(1...model.lastStep, id: \.self) { n in
                Text("\(n)").font(TLFont.mono(10, .bold))
                    .foregroundStyle(n <= model.step ? TLColor.accentInk : TLColor.fg3)
                    .frame(width: 20, height: 20)
                    .background(n <= model.step ? TLColor.accent : TLColor.surface2, in: Circle())
            }
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
    }

    // MARK: Step 1

    private var infoStep: some View {
        VStack(alignment: .leading, spacing: 18) {
            field("Tên giải đấu") {
                tf($model.name, "VD: Giải đôi mở rộng 2026")
            }
            field("Số đội") {
                VStack(alignment: .leading, spacing: 8) {
                    Stepper(value: Binding(get: { model.teamCount }, set: { model.teamCount = $0 }), in: 2...128) {
                        Text("\(model.teamCount) đội").font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                    HStack(spacing: 6) {
                        ForEach([8, 16, 32, 64], id: \.self) { n in
                            Button { Haptics.light(); model.teamCount = n } label: {
                                Text("\(n)").font(TLFont.mono(11, .medium))
                                    .foregroundStyle(model.teamCount == n ? TLColor.accentInk : TLColor.fg3)
                                    .padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(model.teamCount == n ? TLColor.accent : TLColor.surface, in: Capsule())
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }
            field("Sân đấu (cách nhau dấu phẩy)") { tf($model.courtsText, "VD: 1,2,3").keyboardType(.numbersAndPunctuation) }
            field("Giờ bắt đầu (tùy chọn)") { tf($model.startTime, "VD: 08:00").keyboardType(.numbersAndPunctuation) }
            field("Hệ trình độ") {
                Picker("", selection: Binding(get: { model.ratingSource }, set: { model.ratingSource = $0 })) {
                    Text("Tự khai").tag("self"); Text("Linh hoạt").tag("either"); Text("DUPR").tag("dupr")
                }.pickerStyle(.segmented)
            }
            if model.ratingSource != "self" {
                field("Khoảng DUPR (tùy chọn)") {
                    HStack(spacing: 10) {
                        tf($model.minDupr, "Min").keyboardType(.decimalPad)
                        tf($model.maxDupr, "Max").keyboardType(.decimalPad)
                    }
                }
            }
            if model.isDupr {
                Text("DUPR: tạo xong sẽ MỞ ĐĂNG KÝ; đội tự đăng ký rồi BTC chốt để sinh nhánh.")
                    .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }
        }
    }

    // MARK: Step 2

    private var formatStep: some View {
        VStack(alignment: .leading, spacing: 18) {
            field("Vòng ngoài (R1–R3)") { boPicker(Binding(get: { model.earlyFormat }, set: { model.earlyFormat = $0 }), includeInherit: false) }
            field("Bán kết") { boPicker(Binding(get: { model.semiSel }, set: { model.semiSel = $0 }), includeInherit: true) }
            field("Chung kết") { boPicker(Binding(get: { model.finalsSel }, set: { model.finalsSel = $0 }), includeInherit: true) }
            toggleRow("Trận tranh hạng 3", "Hai đội thua bán kết đấu thêm 1 trận",
                      Binding(get: { model.hasThirdPlace }, set: { model.hasThirdPlace = $0 }))
        }
    }

    private func boPicker(_ binding: Binding<String>, includeInherit: Bool) -> some View {
        Picker("", selection: binding) {
            if includeInherit { Text("Như vòng ngoài").tag("inherit") }
            Text("BO1").tag("bo1"); Text("BO3").tag("bo3"); Text("BO5").tag("bo5")
        }.pickerStyle(.segmented)
    }

    // MARK: Step 3

    private var teamsStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("DANH SÁCH ĐỘI (\(model.teams.count))").font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
            ForEach(model.teams.indices, id: \.self) { i in teamRow(i) }
            Button { Haptics.light(); model.teams.append(.init()) } label: {
                HStack(spacing: 6) { Image(systemName: "plus"); Text("Thêm đội") }
                    .font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
            }.buttonStyle(.plain)
        }
    }

    private func teamRow(_ i: Int) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Text("#\(i + 1)").font(TLFont.mono(11, .medium)).foregroundStyle(TLColor.fg3).frame(width: 28, alignment: .leading)
                tf(Binding(get: { model.teams[i].name }, set: { model.teams[i].name = $0 }), "Tên đội (auto từ 2 VĐV)")
                TextField("Seed", text: Binding(get: { model.teams[i].seed }, set: { model.teams[i].seed = $0 }))
                    .font(TLFont.mono(12)).keyboardType(.numberPad).frame(width: 46)
                    .padding(.vertical, 9).padding(.horizontal, 8)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
                if model.teams.count > 2 {
                    Button { Haptics.light(); model.teams.remove(at: i) } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 14)).foregroundStyle(TLColor.fg4)
                    }.buttonStyle(.plain)
                }
            }
            HStack(spacing: 8) {
                tf(Binding(get: { model.teams[i].p1 }, set: { model.teams[i].p1 = $0 }), "VĐV 1")
                tf(Binding(get: { model.teams[i].p2 }, set: { model.teams[i].p2 = $0 }), "VĐV 2")
            }
        }
        .padding(12)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
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
            if model.step < model.lastStep {
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
                        Text(model.creating ? "Đang tạo..." : (model.isDupr ? "Mở đăng ký" : "Tạo giải đấu")).font(TLFont.sans(14, .bold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(!model.canProceed() || model.creating).opacity(model.canProceed() ? 1 : 0.5)
            }
        }
        .padding(16)
    }

    private func field<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
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
    private func tf(_ binding: Binding<String>, _ placeholder: String) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 11).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
    }
}
