import SwiftUI

/// Player requests to join an approved team (pending → captain approves). Port of
/// the web TeamJoinPanel: DUPR is informational only — a player can join now and
/// connect DUPR later, so it never blocks the join.
struct TeamMatchJoinSheet: View {
    let teamName: String
    let requireDupr: Bool
    let duprMaxMale: Double?
    let duprMaxFemale: Double?
    let onJoin: (_ name: String, _ gender: String) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var female = false
    @State private var busy = false
    @State private var loadedName = false

    private var cap: Double? { female ? duprMaxFemale : duprMaxMale }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Gửi yêu cầu, đội trưởng sẽ duyệt bạn vào đội **\(teamName)**.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)

                    if requireDupr {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "info.circle.fill").font(.system(size: 14)).foregroundStyle(TLColor.gold)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Tham gia trước, kết nối DUPR sau")
                                    .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg)
                                Text("Giải yêu cầu DUPR\(cap.map { String(format: " ≤ %.1f", $0) } ?? ""). Bạn vẫn có thể tham gia ngay và kết nối DUPR sau.")
                                    .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                            }
                            Spacer()
                        }
                        .padding(12)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.gold.opacity(0.4), lineWidth: 1))
                    }

                    VStack(alignment: .leading, spacing: 7) {
                        Text("TÊN CỦA BẠN").font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
                        TextField("Tên của bạn", text: $name)
                            .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                            .padding(.horizontal, 12).padding(.vertical, 11)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                    VStack(alignment: .leading, spacing: 7) {
                        Text("GIỚI TÍNH").font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
                        Picker("", selection: $female) { Text("Nam").tag(false); Text("Nữ").tag(true) }
                            .pickerStyle(.segmented)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Tham gia đội")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                if !loadedName {
                    loadedName = true
                    if let p = try? await ProfileRepository().currentUserProfile() {
                        if name.isEmpty { name = p.displayName ?? "" }
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.success()
                        busy = true
                        Task {
                            let joinName = name.trimmingCharacters(in: .whitespaces).isEmpty ? "Người chơi"
                                : name.trimmingCharacters(in: .whitespaces)
                            _ = await onJoin(joinName, female ? "female" : "male")
                            busy = false
                        }
                    } label: {
                        if busy { ProgressView().tint(TLColor.accentText) }
                        else { Text("Tham gia").font(TLFont.sans(15, .semibold)) }
                    }
                    .foregroundStyle(TLColor.accentText).disabled(busy)
                }
            }
        }
    }
}
