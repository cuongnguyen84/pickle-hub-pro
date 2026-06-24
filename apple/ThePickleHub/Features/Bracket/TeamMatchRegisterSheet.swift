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
    var teamName = ""
    var players: [PlayerRow]
    var busy = false
    var error: String?

    private let repo = TeamMatchRepository()

    init(tournamentID: UUID, rosterSize: Int) {
        self.tournamentID = tournamentID
        self.rosterSize = rosterSize
        self.players = [PlayerRow(captain: true)]
    }

    var canSubmit: Bool {
        !teamName.trimmingCharacters(in: .whitespaces).isEmpty
            && players.contains { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    @MainActor func submit(onDone: () -> Void) async {
        guard let uid = await repo.currentUserID() else { error = "Cần đăng nhập để đăng ký."; return }
        busy = true; error = nil
        do {
            let teamID = try await repo.addTeam(
                tournamentID: tournamentID, name: teamName.trimmingCharacters(in: .whitespaces),
                seed: 99, captainUserID: uid, status: "pending")
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

    init(tournamentID: UUID, rosterSize: Int, onDone: @escaping () -> Void) {
        self.tournamentID = tournamentID; self.rosterSize = rosterSize; self.onDone = onDone
        _model = State(initialValue: TMRegisterModel(tournamentID: tournamentID, rosterSize: rosterSize))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
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
                    Text("Đội sẽ ở trạng thái “Chờ duyệt” đến khi BTC duyệt.")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
                .padding(16)
            }
            .background(TLColor.bg)
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
