import SwiftUI

/// Captain-side roster management for their own team — port of the web
/// TeamRosterDisplay + TeamRosterManager: see members (with DUPR), add/remove
/// members, and approve/reject pending join requests. RLS lets the captain
/// insert/update/delete rows on their team.
@Observable
final class TMTeamRosterModel {
    let teamID: UUID
    var roster: [TMRosterPlayer] = []
    var dupr: [UUID: Double] = [:]
    var newName = ""
    var newFemale = false
    var busy = false
    var error: String?

    private let repo = TeamMatchRepository()
    init(teamID: UUID) { self.teamID = teamID }

    @MainActor func load() async {
        roster = (try? await repo.teamRoster(teamID: teamID)) ?? []
        let ids = Array(Set(roster.compactMap { $0.userID }))
        dupr = (try? await repo.duprByUser(ids)) ?? [:]
    }

    @MainActor func add() async {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        busy = true; error = nil
        do {
            try await repo.addRosterMember(teamID: teamID, name: name, gender: newFemale ? "female" : "male", isCaptain: false)
            newName = ""; newFemale = false; await load()
        } catch { self.error = error.localizedDescription }
        busy = false
    }

    @MainActor func remove(_ id: UUID) async {
        busy = true; error = nil
        do { try await repo.removeRosterMember(id: id); await load() } catch { self.error = error.localizedDescription }
        busy = false
    }

    @MainActor func approve(_ id: UUID) async {
        busy = true; error = nil
        do { try await repo.updateRosterStatus(id: id, status: "approved"); await load() } catch { self.error = error.localizedDescription }
        busy = false
    }
}

struct TeamMatchTeamRosterSheet: View {
    let teamName: String
    let rosterSize: Int
    let onChanged: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model: TMTeamRosterModel

    init(teamID: UUID, teamName: String, rosterSize: Int, onChanged: @escaping () -> Void) {
        self.teamName = teamName; self.rosterSize = rosterSize; self.onChanged = onChanged
        _model = State(initialValue: TMTeamRosterModel(teamID: teamID))
    }

    private var approvedCount: Int { model.roster.filter { $0.status != "pending" }.count }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text(teamName).font(TLFont.serif(20)).foregroundStyle(TLColor.fg)
                        Spacer()
                        Text("\(approvedCount)/\(rosterSize)").font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                    }
                    if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }

                    ForEach(model.roster) { m in memberRow(m) }

                    if approvedCount < rosterSize {
                        addForm
                    } else {
                        Text("Đội đã đủ \(rosterSize) người.").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Đội hình")
            .navigationBarTitleDisplayMode(.inline)
            .task { await model.load() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Xong") { onChanged(); dismiss() }.foregroundStyle(TLColor.accentText)
                }
            }
        }
    }

    private func memberRow(_ m: TMRosterPlayer) -> some View {
        HStack(spacing: 8) {
            Circle().fill(m.isFemale ? TLColor.live.opacity(0.6) : TLColor.accent.opacity(0.6)).frame(width: 6, height: 6)
            Text(m.playerName).font(TLFont.sans(14)).foregroundStyle(TLColor.fg).lineLimit(1)
            if m.isCaptain == true { Image(systemName: "star.fill").font(.system(size: 8)).foregroundStyle(TLColor.gold) }
            Spacer()
            if let uid = m.userID, let d = model.dupr[uid] {
                Text("DUPR \(String(format: "%.2f", d))").font(TLFont.mono(9, .medium)).foregroundStyle(TLColor.accentText)
                    .padding(.horizontal, 6).padding(.vertical, 2).background(TLColor.accent.opacity(0.12), in: Capsule())
            }
            Text(m.genderLabel).font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
            if m.status == "pending" {
                Text("CHỜ").font(TLFont.mono(8, .bold)).foregroundStyle(TLColor.gold)
                    .padding(.horizontal, 5).padding(.vertical, 2).background(TLColor.gold.opacity(0.12), in: Capsule())
                Button { Haptics.success(); Task { await model.approve(m.id) } } label: {
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 15)).foregroundStyle(TLColor.accent)
                }.buttonStyle(.plain)
            }
            if m.isCaptain != true {
                Button { Haptics.light(); Task { await model.remove(m.id) } } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 14)).foregroundStyle(TLColor.fg4)
                }.buttonStyle(.plain)
            }
        }
        .disabled(model.busy)
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
    }

    private var addForm: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                TextField("Tên VĐV", text: Binding(get: { model.newName }, set: { model.newName = $0 }))
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 10).padding(.vertical, 9)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
                Picker("", selection: Binding(get: { model.newFemale }, set: { model.newFemale = $0 })) {
                    Text("Nam").tag(false); Text("Nữ").tag(true)
                }.pickerStyle(.segmented).frame(width: 110)
                Button { Haptics.light(); Task { await model.add() } } label: {
                    Text("Thêm").font(TLFont.mono(10.5, .bold)).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 9))
                }.buttonStyle(.plain).disabled(model.busy)
            }
        }
    }
}
