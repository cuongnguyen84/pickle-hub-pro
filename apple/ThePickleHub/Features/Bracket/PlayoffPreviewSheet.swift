import SwiftUI

/// Xem trước vòng 1 playoff trước khi tạo — port web PlayoffPreviewDialog.
/// Chạm 2 ô ở 2 trận khác nhau để đổi chỗ; cặp cùng bảng bị đánh dấu đỏ và chặn xác nhận.
struct PlayoffPreviewSheet: View {
    let detail: QuickTableDetail
    let initial: [QTBracketMatch]
    let onConfirm: ([QTBracketMatch]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var bracket: [QTBracketMatch]
    @State private var selected: (match: Int, slot: Int)?

    init(detail: QuickTableDetail, initial: [QTBracketMatch], onConfirm: @escaping ([QTBracketMatch]) -> Void) {
        self.detail = detail
        self.initial = initial
        self.onConfirm = onConfirm
        _bracket = State(initialValue: initial)
    }

    private func groupID(_ pid: UUID?) -> UUID? {
        guard let pid else { return nil }
        return detail.players.first { $0.id == pid }?.groupID
    }

    private func groupName(_ pid: UUID?) -> String? {
        guard let gid = groupID(pid) else { return nil }
        return detail.groups.first { $0.id == gid }?.name
    }

    private func conflict(_ m: QTBracketMatch) -> Bool {
        guard let a = groupID(m.player1), let b = groupID(m.player2) else { return false }
        return a == b
    }

    private var hasConflict: Bool { bracket.contains(where: conflict) }
    private var teamCount: Int { bracket.reduce(0) { $0 + ($1.player1 == nil ? 0 : 1) + ($1.player2 == nil ? 0 : 1) } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("\(teamCount) đội vào playoff — kiểm tra, chạm 2 đội để đổi chỗ trước khi xác nhận.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    if hasConflict {
                        Text("Có cặp đấu cùng bảng — đổi chỗ trước khi xác nhận.")
                            .font(TLFont.sans(12.5, .semibold)).foregroundStyle(TLColor.live)
                    }
                    ForEach(Array(bracket.enumerated()), id: \.element.matchNumber) { idx, m in
                        card(idx, m)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Xem trước nhánh")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Xác nhận") { Haptics.success(); onConfirm(bracket); dismiss() }
                        .font(TLFont.sans(15, .semibold))
                        .foregroundStyle(hasConflict ? TLColor.fg4 : TLColor.accentText)
                        .disabled(hasConflict)
                }
            }
        }
    }

    private func tap(_ idx: Int, _ slot: Int) {
        Haptics.light()
        guard let sel = selected else { selected = (idx, slot); return }
        if sel.match == idx {
            selected = (sel.slot == slot) ? nil : (idx, slot)
            return
        }
        bracket = QTSeedingV2.swapSlots(bracket, sel, (idx, slot))
        selected = nil
    }

    private func card(_ idx: Int, _ m: QTBracketMatch) -> some View {
        let bad = conflict(m)
        return VStack(spacing: 0) {
            Text("TRẬN \(m.matchNumber)")
                .font(TLFont.mono(9, .semibold)).tracking(0.8).foregroundStyle(bad ? TLColor.live : TLColor.fg3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 4)
            row(idx, slot: 1, pid: m.player1)
            Rectangle().fill(TLColor.border).frame(height: 1)
            row(idx, slot: 2, pid: m.player2)
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
            .strokeBorder(bad ? TLColor.live.opacity(0.6) : TLColor.border, lineWidth: 1))
    }

    private func row(_ idx: Int, slot: Int, pid: UUID?) -> some View {
        let isSel = selected?.match == idx && selected?.slot == slot
        return Button { if pid != nil { tap(idx, slot) } } label: {
            HStack(spacing: 10) {
                Image(systemName: isSel ? "checkmark.circle.fill" : "arrow.left.arrow.right")
                    .font(.system(size: 12)).foregroundStyle(isSel ? TLColor.accentText : TLColor.fg4)
                Text(pid == nil ? "BYE" : detail.name(for: pid))
                    .font(TLFont.sans(14, isSel ? .semibold : .regular))
                    .foregroundStyle(pid == nil ? TLColor.fg4 : TLColor.fg).lineLimit(1)
                    .italic(pid == nil)
                Spacer()
                if let g = groupName(pid) {
                    Text(String(localized: "Bảng \(g)")).font(TLFont.mono(9.5, .medium)).tracking(0.6).foregroundStyle(TLColor.fg3)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(isSel ? TLColor.accent.opacity(0.18) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(pid == nil)
    }
}
