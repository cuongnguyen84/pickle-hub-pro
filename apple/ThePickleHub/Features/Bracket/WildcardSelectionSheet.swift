import SwiftUI

/// Wildcard picker for Quick Table playoff (3 groups → 2, 6 groups → 4). Port of
/// the web wildcard dialog: 3rd-placers ranked by wins → point diff, pick exactly
/// `need`, first is recommended, confirm disabled until the count matches.
struct WildcardSelectionSheet: View {
    let candidates: [QTPlayer]
    let need: Int
    let onConfirm: ([UUID]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selected: Set<UUID> = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Chọn \(need) đội từ các hạng 3 để vào playoff.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    ForEach(Array(candidates.enumerated()), id: \.element.id) { idx, p in
                        row(p, recommended: idx == 0)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Chọn Wildcard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Xác nhận (\(selected.count)/\(need))") {
                        Haptics.success(); onConfirm(Array(selected)); dismiss()
                    }
                    .font(TLFont.sans(15, .semibold))
                    .foregroundStyle(selected.count == need ? TLColor.accentText : TLColor.fg4)
                    .disabled(selected.count != need)
                }
            }
        }
    }

    private func row(_ p: QTPlayer, recommended: Bool) -> some View {
        let isOn = selected.contains(p.id)
        return Button {
            Haptics.light()
            if isOn { selected.remove(p.id) }
            else if selected.count < need { selected.insert(p.id) }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 18)).foregroundStyle(isOn ? TLColor.accent : TLColor.fg4)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(p.name).font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                        if recommended {
                            Text("ĐỀ XUẤT").font(TLFont.mono(8, .bold)).tracking(0.5)
                                .foregroundStyle(TLColor.accentInk)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(TLColor.accent, in: Capsule())
                        }
                    }
                    Text("Thắng \(p.matchesWon) · HS \(p.pointDiff >= 0 ? "+" : "")\(p.pointDiff)")
                        .font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                }
                Spacer()
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(isOn ? TLColor.accent.opacity(0.5) : TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
