import SwiftUI

/// Native Flex (custom-format) create flow — port of the web create dialog
/// (`useFlexTournament.createMutation`): name + visibility + optional player list.
/// Creates the tournament with a preset group + singles/doubles match; roster and
/// group editing still happen on web. Hands back the new share_id so the caller can
/// push the native detail view.
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
    @State private var model = CreateFlexModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
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

                        Text("Sẽ tạo sẵn 1 bảng + 1 trận đơn + 1 trận đôi. Xếp bảng và thêm trận trên web.")
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
        }
    }

    private var footer: some View {
        Button {
            Haptics.success()
            Task { await model.create { shareID in
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
