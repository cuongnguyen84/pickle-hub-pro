import SwiftUI

/// Organizer team + roster management — port of useTeamMatchTeams (simplified
/// organizer path: teams are created already-approved with captain_user_id null).
/// Add teams, add/remove roster members (name + gender + captain), delete teams.
@Observable
final class TMManageTeamsModel {
    let tournamentID: UUID
    let tournamentName: String
    var teams: [TMTeam] = []
    var roster: [TMRosterPlayer] = []
    var newTeamName = ""
    var inviteEmail = ""
    var inviteMsg: String?
    var busy = false
    var error: String?

    // Inline add-member state (per team).
    var addingTo: UUID?
    var memberName = ""
    var memberFemale = false
    var memberCaptain = false

    private let repo = TeamMatchRepository()

    init(detail: TMDetail) {
        tournamentID = detail.tournament.id
        tournamentName = detail.tournament.name
        teams = detail.teamsBySeed
        roster = detail.roster
    }

    func members(_ teamID: UUID) -> [TMRosterPlayer] {
        let list = roster.filter { $0.teamID == teamID }
        return list.sorted { ($0.isCaptain == true ? 0 : 1) < ($1.isCaptain == true ? 0 : 1) }
    }

    @MainActor func refresh() async {
        if let r = try? await repo.loadTeamsRoster(tournamentID: tournamentID) {
            teams = r.teams.sorted { ($0.seed ?? Int.max) < ($1.seed ?? Int.max) }
            roster = r.roster
        }
    }

    @MainActor func addTeam() async {
        let name = newTeamName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        busy = true; error = nil
        do {
            _ = try await repo.addTeam(tournamentID: tournamentID, name: name, seed: teams.count + 1)
            newTeamName = ""
            await refresh()
        } catch { self.error = error.localizedDescription }
        busy = false
    }

    @MainActor func beginAdd(_ teamID: UUID) {
        addingTo = teamID
        memberName = ""; memberFemale = false
        memberCaptain = members(teamID).isEmpty   // first member defaults to captain
    }

    @MainActor func addMember() async {
        guard let teamID = addingTo else { return }
        let name = memberName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        busy = true; error = nil
        do {
            try await repo.addRosterMember(teamID: teamID, name: name,
                                           gender: memberFemale ? "female" : "male", isCaptain: memberCaptain)
            memberName = ""; memberCaptain = false
            await refresh()
        } catch { self.error = error.localizedDescription }
        busy = false
    }

    @MainActor func removeMember(_ id: UUID) async {
        busy = true; error = nil
        do { try await repo.removeRosterMember(id: id); await refresh() }
        catch { self.error = error.localizedDescription }
        busy = false
    }

    @MainActor func deleteTeam(_ id: UUID) async {
        busy = true; error = nil
        do { try await repo.deleteTeam(id: id); await refresh() }
        catch { self.error = error.localizedDescription }
        busy = false
    }

    @MainActor func setStatus(_ id: UUID, _ status: String) async {
        busy = true; error = nil
        do { try await repo.updateTeamStatus(teamID: id, status: status); await refresh() }
        catch { self.error = error.localizedDescription }
        busy = false
    }

    @MainActor func invite() async {
        let email = inviteEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty else { return }
        busy = true; error = nil; inviteMsg = nil
        switch await repo.inviteTeamByEmail(tournamentID: tournamentID, tournamentName: tournamentName, email: email) {
        case .ok(let m): inviteMsg = m; inviteEmail = ""; await refresh()
        case .failed(let m): error = m
        }
        busy = false
    }
}

struct TeamMatchManageTeamsView: View {
    let detail: TMDetail
    let rosterSize: Int
    let onChanged: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model: TMManageTeamsModel

    init(detail: TMDetail, onChanged: @escaping () -> Void) {
        self.detail = detail
        self.rosterSize = detail.tournament.teamRosterSize ?? 4
        self.onChanged = onChanged
        _model = State(initialValue: TMManageTeamsModel(detail: detail))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    addTeamRow
                    inviteRow
                    if let msg = model.inviteMsg {
                        Text(msg).font(TLFont.sans(12)).foregroundStyle(TLColor.accentText)
                    }
                    if let err = model.error {
                        Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                    }
                    ForEach(model.teams) { team in teamCard(team) }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Quản lý đội")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Xong") { onChanged(); dismiss() }.foregroundStyle(TLColor.accentText)
                }
            }
        }
    }

    private var addTeamRow: some View {
        HStack(spacing: 10) {
            TextField("Tên đội mới", text: Binding(get: { model.newTeamName }, set: { model.newTeamName = $0 }))
                .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            Button { Haptics.light(); Task { await model.addTeam() } } label: {
                Text("Thêm đội").font(TLFont.mono(11, .bold)).foregroundStyle(TLColor.accentInk)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
            }.buttonStyle(.plain).disabled(model.busy)
        }
    }

    private var inviteRow: some View {
        HStack(spacing: 10) {
            TextField("Mời đội qua email captain", text: Binding(get: { model.inviteEmail }, set: { model.inviteEmail = $0 }))
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .textInputAutocapitalization(.never).keyboardType(.emailAddress).autocorrectionDisabled()
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            Button { Haptics.light(); Task { await model.invite() } } label: {
                Text("Mời").font(TLFont.mono(11, .bold)).foregroundStyle(TLColor.accentInk)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
            }.buttonStyle(.plain).disabled(model.busy)
        }
    }

    private func statusBadge(_ status: String?) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case "approved": return ("DUYỆT", TLColor.accentText)
            case "rejected": return ("TỪ CHỐI", TLColor.live)
            case "pending": return ("CHỜ", TLColor.gold)
            default: return (status?.uppercased() ?? "—", TLColor.fg3)
            }
        }()
        return Text(label).font(TLFont.mono(8.5, .bold)).tracking(0.5).foregroundStyle(color)
            .padding(.horizontal, 6).padding(.vertical, 3)
            .background(color.opacity(0.12), in: Capsule())
    }

    private func teamCard(_ team: TMTeam) -> some View {
        let members = model.members(team.id)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text("#\(team.seed.map(String.init) ?? "—")").font(TLFont.mono(11, .medium)).foregroundStyle(TLColor.fg3)
                Text(team.teamName).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                statusBadge(team.status)
                Spacer()
                Text("\(members.count)/\(rosterSize)").font(TLFont.mono(10.5)).foregroundStyle(TLColor.fg3)
                Button { Haptics.light(); Task { await model.deleteTeam(team.id) } } label: {
                    Image(systemName: "trash").font(.system(size: 12)).foregroundStyle(TLColor.live)
                }.buttonStyle(.plain)
            }
            if team.status == "pending" {
                HStack(spacing: 8) {
                    Button { Haptics.success(); Task { await model.setStatus(team.id, "approved") } } label: {
                        Text("Duyệt").font(TLFont.mono(10.5, .bold)).foregroundStyle(TLColor.accentInk)
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 9))
                    }.buttonStyle(.plain)
                    Button { Haptics.light(); Task { await model.setStatus(team.id, "rejected") } } label: {
                        Text("Từ chối").font(TLFont.mono(10.5, .semibold)).foregroundStyle(TLColor.live)
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 9))
                    }.buttonStyle(.plain)
                }
                .disabled(model.busy)
            }
            ForEach(members) { m in
                HStack(spacing: 8) {
                    Circle().fill(m.isFemale ? TLColor.live.opacity(0.6) : TLColor.accent.opacity(0.6)).frame(width: 6, height: 6)
                    Text(m.playerName).font(TLFont.sans(13)).foregroundStyle(TLColor.fg2).lineLimit(1)
                    if m.isCaptain == true {
                        Image(systemName: "star.fill").font(.system(size: 8)).foregroundStyle(TLColor.gold)
                    }
                    Spacer()
                    Text(m.genderLabel).font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                    Button { Haptics.light(); Task { await model.removeMember(m.id) } } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 13)).foregroundStyle(TLColor.fg4)
                    }.buttonStyle(.plain)
                }
                .padding(.vertical, 3)
            }
            if model.addingTo == team.id {
                addMemberForm
            } else {
                Button { Haptics.light(); model.beginAdd(team.id) } label: {
                    HStack(spacing: 5) { Image(systemName: "plus"); Text("Thêm VĐV") }
                        .font(TLFont.mono(10.5, .semibold)).foregroundStyle(TLColor.accentText)
                }.buttonStyle(.plain).padding(.top, 2)
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var addMemberForm: some View {
        VStack(spacing: 10) {
            TextField("Tên VĐV", text: Binding(get: { model.memberName }, set: { model.memberName = $0 }))
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .padding(.horizontal, 10).padding(.vertical, 8)
                .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 9))
            HStack(spacing: 10) {
                Picker("", selection: Binding(get: { model.memberFemale }, set: { model.memberFemale = $0 })) {
                    Text("Nam").tag(false); Text("Nữ").tag(true)
                }.pickerStyle(.segmented).frame(maxWidth: 140)
                Toggle(isOn: Binding(get: { model.memberCaptain }, set: { model.memberCaptain = $0 })) {
                    Text("Đội trưởng").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                }.tint(TLColor.accent).fixedSize()
                Spacer()
                Button { Haptics.light(); Task { await model.addMember() } } label: {
                    Text("Lưu").font(TLFont.mono(10.5, .bold)).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 9))
                }.buttonStyle(.plain).disabled(model.busy)
            }
        }
        .padding(10)
        .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 10))
    }
}
