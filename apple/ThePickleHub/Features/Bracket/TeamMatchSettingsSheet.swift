import SwiftUI

/// Creator-only tournament management — port of web TeamMatchSettingsDialog +
/// useTeamMatch.updateTournamentStatus/delete + referee management. Rename,
/// start the tournament, add/remove referees, delete.
@Observable
final class TMSettingsModel {
    let detail: TMDetail
    var name: String
    var referees: [TMReferee] = []
    var newEmail = ""
    var busy = false
    var message: String?

    private let repo = TeamMatchRepository()
    private var tournamentID: UUID { detail.tournament.id }

    init(detail: TMDetail) {
        self.detail = detail
        self.name = detail.tournament.name
    }

    var canStart: Bool {
        detail.tournament.status == "setup" || detail.tournament.status == "registration"
    }

    @MainActor func loadReferees() async {
        referees = await repo.fetchReferees(tournamentID: tournamentID)
    }

    @MainActor func saveName() async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != detail.tournament.name else { return }
        busy = true; message = nil
        do { try await repo.rename(tournamentID: tournamentID, name: trimmed); message = "Đã lưu tên" }
        catch { message = error.localizedDescription }
        busy = false
    }

    @MainActor func start(onChanged: () -> Void) async {
        busy = true; message = nil
        do { try await repo.updateStatus(tournamentID: tournamentID, status: "ongoing"); onChanged() }
        catch { message = error.localizedDescription }
        busy = false
    }

    @MainActor func addReferee() async {
        let email = newEmail
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        busy = true; message = nil
        switch await repo.addReferee(tournamentID: tournamentID, email: email) {
        case .ok(let name): message = "Đã thêm trọng tài \(name ?? email)"; newEmail = ""; await loadReferees()
        case .notFound: message = "Không tìm thấy người dùng với email này"
        case .alreadyExists: message = "Người này đã là trọng tài"
        case .error: message = "Không thể thêm trọng tài"
        }
        busy = false
    }

    @MainActor func remove(_ ref: TMReferee) async {
        busy = true; message = nil
        do { try await repo.removeReferee(refereeID: ref.id); await loadReferees() }
        catch { message = error.localizedDescription }
        busy = false
    }

    @MainActor func delete() async -> Bool {
        busy = true; message = nil
        do { try await repo.deleteTournament(tournamentID: tournamentID); return true }
        catch { message = error.localizedDescription; busy = false; return false }
    }
}

struct TeamMatchSettingsSheet: View {
    let detail: TMDetail
    let onChanged: () -> Void   // reload parent
    let onDeleted: () -> Void   // pop the detail view

    @Environment(\.dismiss) private var dismiss
    @State private var model: TMSettingsModel
    @State private var confirmDelete = false

    init(detail: TMDetail, onChanged: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        self.detail = detail; self.onChanged = onChanged; self.onDeleted = onDeleted
        _model = State(initialValue: TMSettingsModel(detail: detail))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    nameSection
                    if model.canStart { startSection }
                    refereeSection
                    deleteSection
                    if let msg = model.message {
                        Text(msg).font(TLFont.sans(12)).foregroundStyle(TLColor.fg2)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Cài đặt giải")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Xong") { dismiss() }.foregroundStyle(TLColor.accentText) } }
            .task { await model.loadReferees() }
            .alert("Xóa giải đấu?", isPresented: $confirmDelete) {
                Button("Hủy", role: .cancel) {}
                Button("Xóa", role: .destructive) {
                    Task { if await model.delete() { onDeleted(); dismiss() } }
                }
            } message: {
                Text("\"\(detail.tournament.name)\" và toàn bộ dữ liệu liên quan sẽ bị xóa vĩnh viễn.")
            }
        }
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t.uppercased()).font(TLFont.mono(10.5, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
    }

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Tên giải")
            HStack(spacing: 10) {
                TextField("Tên giải", text: Binding(get: { model.name }, set: { model.name = $0 }))
                    .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                Button { Haptics.light(); Task { await model.saveName() } } label: {
                    Text("Lưu").font(TLFont.mono(11, .bold)).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 16).padding(.vertical, 11)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                }
                .buttonStyle(.plain).disabled(model.busy)
            }
        }
    }

    private var startSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Trạng thái")
            Button { Haptics.success(); Task { await model.start { onChanged() } } } label: {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill").font(.system(size: 12))
                    Text("Bắt đầu giải đấu").font(TLFont.sans(14, .semibold))
                }
                .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain).disabled(model.busy)
            Text("Chuyển sang “Đang diễn ra”; không thêm/xóa đội được nữa.")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
        }
    }

    private var refereeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Trọng tài")
            if model.referees.isEmpty {
                Text("Chưa có trọng tài.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
            } else {
                ForEach(model.referees) { ref in
                    HStack(spacing: 10) {
                        Image(systemName: "whistle").font(.system(size: 12)).foregroundStyle(TLColor.fg3)
                        Text(ref.displayName ?? ref.userID.uuidString.prefix(8).description)
                            .font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg).lineLimit(1)
                        Spacer()
                        Button { Haptics.light(); Task { await model.remove(ref) } } label: {
                            Image(systemName: "xmark.circle.fill").font(.system(size: 15)).foregroundStyle(TLColor.fg4)
                        }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                }
            }
            HStack(spacing: 10) {
                TextField("Email trọng tài", text: Binding(get: { model.newEmail }, set: { model.newEmail = $0 }))
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
                .buttonStyle(.plain).disabled(model.busy)
            }
            Text("Trọng tài có thể chấm điểm mọi trận. Người dùng phải đã có tài khoản.")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
        }
    }

    private var deleteSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Rectangle().fill(TLColor.border).frame(height: 1)
            Button(role: .destructive) { Haptics.light(); confirmDelete = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "trash").font(.system(size: 12))
                    Text("Xóa giải đấu").font(TLFont.sans(14, .semibold))
                }
                .foregroundStyle(TLColor.live).frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(TLColor.live.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain).disabled(model.busy)
        }
    }
}
