import SwiftUI

/// Captain self-registration (registration-mode MLP). Creates a team owned by the
/// captain with status 'pending' + its roster; BTC approves later. Port of the
/// captain side of TeamRegistrationDialog (simplified — no master-team reuse).
@Observable
final class TMRegisterModel {
    struct PlayerRow: Identifiable {
        let id = UUID()
        var name = ""
        var female = false
        var captain = false
    }

    let tournamentID: UUID
    let rosterSize: Int
    let requireDupr: Bool
    let duprMaxMale: Double?
    let duprMaxFemale: Double?
    var teamName = ""
    var players: [PlayerRow]
    var myDupr: Double?        // captain's own DUPR (doubles ?? singles)
    var duprLoaded = false
    var prevName: String?      // most-recent team name for "reuse" prefill
    private var prevPlayers: [(name: String, gender: String, isCaptain: Bool)] = []
    var busy = false
    var error: String?

    private let repo = TeamMatchRepository()

    init(tournamentID: UUID, rosterSize: Int, requireDupr: Bool, duprMaxMale: Double?, duprMaxFemale: Double?) {
        self.tournamentID = tournamentID
        self.rosterSize = rosterSize
        self.requireDupr = requireDupr
        self.duprMaxMale = duprMaxMale
        self.duprMaxFemale = duprMaxFemale
        self.players = [PlayerRow(captain: true)]
    }

    @MainActor func loadMyDupr() async {
        if requireDupr {
            let p = try? await ProfileRepository().currentUserProfile()
            myDupr = p?.duprDoubles ?? p?.duprSingles
        }
        duprLoaded = true
        if let prev = await repo.previousCaptainTeam() {
            prevName = prev.name; prevPlayers = prev.players
        }
    }

    @MainActor func usePrevious() {
        guard let name = prevName, !prevPlayers.isEmpty else { return }
        teamName = name
        players = prevPlayers.prefix(rosterSize).map {
            PlayerRow(name: $0.name, female: $0.gender == "female", captain: $0.isCaptain)
        }
        prevName = nil   // hide the reuse button after applying
    }

    // Captain = the starred player (or the first). Web gates on the captain's DUPR.
    var captainGender: String {
        ((players.first { $0.captain }) ?? players.first)?.female == true ? "female" : "male"
    }
    var duprCap: Double? { requireDupr ? (captainGender == "female" ? duprMaxFemale : duprMaxMale) : nil }
    var duprEligible: Bool {
        guard requireDupr else { return true }
        guard let d = myDupr else { return false }
        return duprCap == nil || d <= duprCap!
    }

    var canSubmit: Bool {
        !teamName.trimmingCharacters(in: .whitespaces).isEmpty
            && players.contains { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }
            && duprEligible
    }

    @MainActor func submit(onDone: () -> Void) async {
        guard let uid = await repo.currentUserID() else { error = "Cần đăng nhập để đăng ký."; return }
        busy = true; error = nil
        do {
            let teamID = try await repo.addTeam(
                tournamentID: tournamentID, name: teamName.trimmingCharacters(in: .whitespaces),
                seed: 99, captainUserID: uid, status: "approved") // auto-approve (no BTC review)
            for p in players {
                let name = p.name.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { continue }
                try await repo.addRosterMember(teamID: teamID, name: name,
                                               gender: p.female ? "female" : "male", isCaptain: p.captain)
            }
            onDone()
        } catch { self.error = error.localizedDescription }
        busy = false
    }
}

struct TeamMatchRegisterSheet: View {
    let tournamentID: UUID
    let rosterSize: Int
    let onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model: TMRegisterModel

    init(tournamentID: UUID, rosterSize: Int, requireDupr: Bool = false,
         duprMaxMale: Double? = nil, duprMaxFemale: Double? = nil, onDone: @escaping () -> Void) {
        self.tournamentID = tournamentID; self.rosterSize = rosterSize; self.onDone = onDone
        _model = State(initialValue: TMRegisterModel(tournamentID: tournamentID, rosterSize: rosterSize,
            requireDupr: requireDupr, duprMaxMale: duprMaxMale, duprMaxFemale: duprMaxFemale))
    }

    @ViewBuilder private var duprBanner: some View {
        if model.requireDupr {
            let capText = model.duprCap.map { String(format: "≤ %.1f", $0) } ?? ""
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: model.duprEligible && model.myDupr != nil ? "checkmark.seal.fill" : "exclamationmark.shield.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(model.duprEligible && model.myDupr != nil ? TLColor.accent : TLColor.gold)
                VStack(alignment: .leading, spacing: 2) {
                    if let d = model.myDupr {
                        Text(model.duprEligible ? "Đủ điều kiện · DUPR \(String(format: "%.2f", d))"
                                                : "Không đủ điều kiện · DUPR \(String(format: "%.2f", d)) > \(capText)")
                            .font(TLFont.sans(13, .semibold))
                            .foregroundStyle(model.duprEligible ? TLColor.accentText : TLColor.live)
                    } else if model.duprLoaded {
                        Text("Giải yêu cầu DUPR \(capText). Bạn chưa kết nối DUPR.")
                            .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.live)
                    } else {
                        Text("Đang kiểm tra DUPR…").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    }
                    Text("Giải yêu cầu DUPR \(capText) (theo giới tính đội trưởng).")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
                Spacer()
            }
            .padding(12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(
                (model.duprEligible && model.myDupr != nil) ? TLColor.accent.opacity(0.4) : TLColor.gold.opacity(0.4), lineWidth: 1))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    duprBanner
                    if let prev = model.prevName {
                        Button { Haptics.light(); model.usePrevious() } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "arrow.uturn.backward.circle.fill").font(.system(size: 15))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("Dùng lại đội gần nhất: \(prev)")
                                        .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                                    Text("Điền sẵn tên đội + đội hình").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                                }
                                Spacer()
                            }
                            .foregroundStyle(TLColor.accentText)
                            .padding(12)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.accent.opacity(0.35), lineWidth: 1))
                        }.buttonStyle(.plain)
                    }
                    VStack(alignment: .leading, spacing: 7) {
                        Text("TÊN ĐỘI").font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
                        TextField("Tên đội của bạn", text: Binding(get: { model.teamName }, set: { model.teamName = $0 }))
                            .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                            .padding(.horizontal, 12).padding(.vertical, 11)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                    }

                    Text("THÀNH VIÊN (\(model.players.count)/\(rosterSize))")
                        .font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
                    ForEach(model.players.indices, id: \.self) { i in playerRow(i) }

                    if model.players.count < rosterSize {
                        Button { Haptics.light(); model.players.append(.init()) } label: {
                            HStack(spacing: 6) { Image(systemName: "plus"); Text("Thêm VĐV") }
                                .font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.accentText)
                                .frame(maxWidth: .infinity).padding(.vertical, 11)
                                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
                        }.buttonStyle(.plain)
                    }
                    if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                    Text("Đăng ký xong đội được duyệt ngay.")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .task { await model.loadMyDupr() }
            .navigationTitle("Đăng ký đội")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.success(); Task { await model.submit { onDone(); dismiss() } }
                    } label: {
                        if model.busy { ProgressView().tint(TLColor.accentText) }
                        else { Text("Gửi").font(TLFont.sans(15, .semibold)) }
                    }
                    .foregroundStyle(model.canSubmit ? TLColor.accentText : TLColor.fg4)
                    .disabled(!model.canSubmit || model.busy)
                }
            }
        }
    }

    private func playerRow(_ i: Int) -> some View {
        HStack(spacing: 8) {
            TextField("Tên VĐV", text: Binding(get: { model.players[i].name }, set: { model.players[i].name = $0 }))
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .padding(.horizontal, 10).padding(.vertical, 9)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
            Picker("", selection: Binding(get: { model.players[i].female }, set: { model.players[i].female = $0 })) {
                Text("Nam").tag(false); Text("Nữ").tag(true)
            }.pickerStyle(.segmented).frame(width: 110)
            Button { Haptics.light(); model.players[i].captain.toggle() } label: {
                Image(systemName: model.players[i].captain ? "star.fill" : "star")
                    .font(.system(size: 13)).foregroundStyle(model.players[i].captain ? TLColor.gold : TLColor.fg4)
            }.buttonStyle(.plain)
            if model.players.count > 1 {
                Button { Haptics.light(); model.players.remove(at: i) } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 14)).foregroundStyle(TLColor.fg4)
                }.buttonStyle(.plain)
            }
        }
    }
}
