import SwiftUI

/// Native creation wizard for a round-robin Quick Table (direct roster, no
/// registration). P2 of the Bracket Lab native port. On success it hands back
/// the new share_id so the caller can push the native detail view.
struct CreateQuickTableView: View {
    let onCreated: (_ shareID: String, _ name: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var isDoubles = true
    @State private var players: [PlayerField] = [PlayerField(), PlayerField(), PlayerField(), PlayerField()]
    @State private var groupCount = 1
    @State private var creating = false
    @State private var errorMessage: String?

    private let repo = QuickTableRepository()

    struct PlayerField: Identifiable, Equatable { let id = UUID(); var name = "" }

    private var filledNames: [String] {
        players.map { $0.name.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }
    private var canCreate: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty && filledNames.count >= 2 }
    private var maxGroups: Int { max(1, filledNames.count / 2) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    field(label: "TÊN GIẢI") {
                        TextField("VD: Giao hữu Quận 7", text: $name)
                            .font(TLFont.sans(16)).foregroundStyle(TLColor.fg)
                            .padding(12)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
                    }

                    field(label: "THỂ LOẠI") { formatToggle }

                    field(label: "NGƯỜI CHƠI · \(filledNames.count)") { rosterEditor }

                    field(label: "SỐ BẢNG · \(groupCount)") { groupStepper }

                    if let errorMessage {
                        Text(errorMessage).font(TLFont.sans(13)).foregroundStyle(TLColor.live)
                    }

                    createButton
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle("Bảng đấu nhanh")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
            }
            .onChange(of: filledNames.count) { _, _ in
                if groupCount > maxGroups { groupCount = maxGroups }
            }
        }
    }

    private var formatToggle: some View {
        HStack(spacing: 4) {
            ForEach([true, false], id: \.self) { doubles in
                let selected = isDoubles == doubles
                Button { isDoubles = doubles } label: {
                    Text(doubles ? "Đôi" : "Đơn")
                        .font(TLFont.sans(14, selected ? .semibold : .medium))
                        .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(selected ? TLColor.accent : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(TLColor.surface, in: Capsule())
        .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var rosterEditor: some View {
        VStack(spacing: 8) {
            ForEach($players) { $player in
                HStack(spacing: 10) {
                    TextField("Tên người chơi", text: $player.name)
                        .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                    if players.count > 2 {
                        Button {
                            players.removeAll { $0.id == player.id }
                        } label: {
                            Image(systemName: "minus.circle.fill").foregroundStyle(TLColor.fg4)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Xóa người chơi")
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            }
            Button { players.append(PlayerField()) } label: {
                Label("Thêm người chơi", systemImage: "plus")
                    .font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border2, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private var groupStepper: some View {
        HStack {
            Text(groupCount == 1 ? "Vòng tròn 1 bảng" : "\(groupCount) bảng")
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg2)
            Spacer()
            Stepper("", value: $groupCount, in: 1...maxGroups).labelsHidden()
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var createButton: some View {
        Button {
            Task { await create() }
        } label: {
            HStack(spacing: 8) {
                if creating { ProgressView().tint(TLColor.accentInk) }
                Text(creating ? "Đang tạo…" : "Tạo giải")
                    .font(TLFont.sans(16, .semibold))
            }
            .foregroundStyle(TLColor.accentInk)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        }
        .buttonStyle(.plain)
        .opacity(canCreate && !creating ? 1 : 0.4)
        .disabled(!canCreate || creating)
    }

    @MainActor
    private func create() async {
        creating = true
        errorMessage = nil
        do {
            let shareID = try await repo.create(
                name: name, isDoubles: isDoubles,
                playerNames: filledNames, groupCount: groupCount
            )
            Haptics.success()
            dismiss()
            onCreated(shareID, name.trimmingCharacters(in: .whitespaces))
        } catch {
            errorMessage = error.localizedDescription
        }
        creating = false
    }

    private func field<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(label).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            content()
        }
    }
}
