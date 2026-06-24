import SwiftUI

/// Creator-only Flex management — visibility toggle, referee management, delete.
/// Port of the FlexTournamentView settings sheet.
@Observable
final class FlexSettingsModel {
    let tournament: FlexTournament
    var isPublic: Bool
    var referees: [FlexReferee] = []
    var newEmail = ""
    var busy = false
    var message: String?

    private let repo = FlexRepository()
    private var tournamentID: UUID { tournament.id }

    init(tournament: FlexTournament) {
        self.tournament = tournament
        self.isPublic = tournament.isPublic
    }

    @MainActor func loadReferees() async {
        referees = await repo.fetchReferees(tournamentID: tournamentID)
    }

    @MainActor func setVisibility(_ value: Bool) async {
        busy = true; message = nil
        do { try await repo.setVisibility(tournamentID: tournamentID, isPublic: value); isPublic = value }
        catch { message = error.localizedDescription; isPublic = !value }
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

    @MainActor func remove(_ ref: FlexReferee) async {
        busy = true; message = nil
        do { try await repo.removeReferee(refereeID: ref.id); await loadReferees() }
        catch { message = error.localizedDescription }
        busy = false
    }

    @MainActor func delete() async -> Bool {
        busy = true; message = nil
        do { try await repo.delete(tournamentID: tournamentID); return true }
        catch { message = error.localizedDescription; busy = false; return false }
    }
}

struct FlexSettingsSheet: View {
    let tournament: FlexTournament
    let onChanged: () -> Void
    let onDeleted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model: FlexSettingsModel
    @State private var confirmDelete = false

    init(tournament: FlexTournament, onChanged: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        self.tournament = tournament; self.onChanged = onChanged; self.onDeleted = onDeleted
        _model = State(initialValue: FlexSettingsModel(tournament: tournament))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    visibilitySection
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
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Xong") { onChanged(); dismiss() }.foregroundStyle(TLColor.accentText) } }
            .task { await model.loadReferees() }
            .alert("Xóa giải đấu?", isPresented: $confirmDelete) {
                Button("Hủy", role: .cancel) {}
                Button("Xóa", role: .destructive) {
                    Task { if await model.delete() { onDeleted(); dismiss() } }
                }
            } message: {
                Text("\"\(tournament.displayName)\" và toàn bộ dữ liệu liên quan sẽ bị xóa vĩnh viễn.")
            }
        }
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t.uppercased()).font(TLFont.mono(10.5, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
    }

    private var visibilitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Hiển thị")
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Công khai").font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                    Text("Cho phép mọi người xem giải qua link.")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
                Spacer()
                Toggle("", isOn: Binding(get: { model.isPublic }, set: { v in Task { await model.setVisibility(v) } }))
                    .labelsHidden().tint(TLColor.accent).disabled(model.busy)
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
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
