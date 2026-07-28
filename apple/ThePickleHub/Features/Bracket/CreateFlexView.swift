import SwiftUI

/// Native Flex (custom-format) create flow — port of the web create dialog
/// (`useFlexTournament.createMutation`): name + visibility + optional player list.
/// Creates the tournament with a starter group and matches, then hands back the
/// share_id so the caller can open the full native workspace.
@Observable
final class CreateFlexModel {
    var name = ""
    var playersText = ""
    var isPublic = false
    var creating = false
    var error: String?

    private let repo = FlexRepository()

    private var playerNames: [String] {
        playersText.split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    var playerCount: Int { playerNames.count }

    func canProceed() -> Bool {
        name.trimmingCharacters(in: .whitespaces).count >= 1
    }

    // ── UX-04 autosave snapshot (parity web draft:flex:new) ──────────────
    struct Draft: Codable, Equatable {
        var name: String
        var playersText: String
        var isPublic: Bool
    }

    var draftSnapshot: Draft { .init(name: name, playersText: playersText, isPublic: isPublic) }

    func apply(_ d: Draft) {
        name = d.name
        playersText = d.playersText
        isPublic = d.isPublic
    }

    func resetForm() {
        name = ""; playersText = ""; isPublic = false; error = nil
    }

    @MainActor
    func create(onDone: (String) -> Void) async {
        creating = true; error = nil
        do {
            let t = try await repo.createFlex(
                name: name.trimmingCharacters(in: .whitespaces),
                playerNames: playerNames, isPublic: isPublic)
            onDone(t.shareID)
        } catch { self.error = error.localizedDescription }
        creating = false
    }
}

struct CreateFlexView: View {
    let onCreated: (_ shareID: String, _ name: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var model = CreateFlexModel()
    @State private var draft = DraftStore<CreateFlexModel.Draft>(flow: "flex")
    @State private var restoredDraft = false
    @State private var restoreApplied = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if restoredDraft {
                            DraftRestoredBanner {
                                model.resetForm()
                                draft.clear(current: model.draftSnapshot)
                            }
                        }
                        field("Tên giải đấu") { tf($model.name, "VD: Giải linh hoạt 2026") }

                        toggleRow("Công khai", model.isPublic ? "Ai có link đều xem được" : "Chỉ bạn quản lý",
                                  Binding(get: { model.isPublic }, set: { model.isPublic = $0 }))

                        field("Người chơi (tùy chọn)") {
                            VStack(alignment: .leading, spacing: 6) {
                                ZStack(alignment: .topLeading) {
                                    if model.playersText.isEmpty {
                                        Text("Mỗi tên một dòng")
                                            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg4)
                                            .padding(.horizontal, 15).padding(.vertical, 18)
                                    }
                                    TextEditor(text: $model.playersText)
                                        .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                                        .scrollContentBackground(.hidden)
                                        .frame(minHeight: 130)
                                        .padding(.horizontal, 11).padding(.vertical, 10)
                                }
                                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                                Text("\(model.playerCount) người · tối đa 200")
                                    .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                            }
                        }

                        Text("Sẽ tạo sẵn 1 bảng + 1 trận đơn + 1 trận đôi. Sau đó có thể xếp bảng, thêm người và thêm trận ngay trong app.")
                            .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                            .fixedSize(horizontal: false, vertical: true)

                        if let err = model.error {
                            Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                        }
                    }
                    .padding(16)
                }
                footer
            }
            .background(TLColor.bg)
            .navigationTitle("Tạo giải linh hoạt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) } }
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
    }

    private var footerButton: some View {
        Button {
            Haptics.success()
            Task { await model.create { shareID in
                draft.clear(current: model.draftSnapshot)
                onCreated(shareID, model.name.trimmingCharacters(in: .whitespaces)); dismiss()
            } }
        } label: {
            HStack(spacing: 6) {
                if model.creating { ProgressView().tint(TLColor.accentInk) }
                Text(model.creating ? "Đang tạo..." : "Tạo giải đấu").font(TLFont.sans(14, .bold))
            }
            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(!model.canProceed() || model.creating)
        .opacity(model.canProceed() ? 1 : 0.5)
    }

    private var footer: some View {
        VStack(spacing: 6) {
            DraftSaveStatusLine(savedAt: draft.lastSavedAt)
            footerButton
        }
        .padding(16)
    }

    private func field<C: View>(_ label: LocalizedStringKey, @ViewBuilder _ content: () -> C) -> some View {
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
    private func tf(_ binding: Binding<String>, _ placeholder: LocalizedStringKey) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 11).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
    }
}
