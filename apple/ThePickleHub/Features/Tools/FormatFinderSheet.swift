import SwiftUI

/// "Không chắc chọn loại nào?" — a 2-question helper that recommends a format
/// and opens its (web) creation flow. (Prompt §4 — format finder.)
struct FormatFinderSheet: View {
    let onStart: (URL) -> Void
    @Environment(\.dismiss) private var dismiss

    enum Size: String, CaseIterable, Identifiable {
        case small, medium, large
        var id: String { rawValue }
        var label: String {
            switch self {
            case .small: return "Dưới 16"
            case .medium: return "16–32"
            case .large: return "Trên 32"
            }
        }
    }

    @State private var size: Size?
    @State private var timeLimited: Bool?

    private var recommendation: (title: String, reason: String, url: URL)? {
        guard let size, let timeLimited else { return nil }
        switch size {
        case .large:
            return ("Loại trực tiếp",
                    "Nhiều đội + cần kết thúc nhanh → nhánh loại trực tiếp.",
                    WebRoutes.toolsDoublesElimination)
        case .medium where timeLimited:
            return ("Loại trực tiếp",
                    "Cỡ vừa và giới hạn thời gian → loại trực tiếp gọn hơn.",
                    WebRoutes.toolsDoublesElimination)
        default:
            return ("Bảng đấu nhanh",
                    "Ai cũng được đánh nhiều trận → vòng tròn rồi playoff.",
                    WebRoutes.toolsQuickTables)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    question(title: "Dự kiến bao nhiêu người?") {
                        segmented(Size.allCases, selected: size, label: \.label) { size = $0; Haptics.light() }
                    }
                    question(title: "Có giới hạn thời gian không?") {
                        HStack(spacing: 8) {
                            choice("Có", selected: timeLimited == true) { timeLimited = true; Haptics.light() }
                            choice("Không", selected: timeLimited == false) { timeLimited = false; Haptics.light() }
                        }
                    }

                    if let rec = recommendation {
                        recommendationCard(rec)
                    }
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle("Gợi ý thể thức")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Đóng") { dismiss() }.foregroundStyle(TLColor.accentText)
                }
            }
        }
    }

    private func question<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            content()
        }
    }

    private func segmented<T: Identifiable>(_ items: [T], selected: T?, label: KeyPath<T, String>, pick: @escaping (T) -> Void) -> some View {
        HStack(spacing: 8) {
            ForEach(items) { item in
                choice(item[keyPath: label], selected: selected?.id == item.id) { pick(item) }
            }
        }
    }

    private func choice(_ text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(TLFont.sans(14, selected ? .semibold : .medium))
                .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                .frame(maxWidth: .infinity).padding(.vertical, 11)
                .background(selected ? TLColor.accent : TLColor.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(selected ? .clear : TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func recommendationCard(_ rec: (title: String, reason: String, url: URL)) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("GỢI Ý").font(TLFont.mono(9, .bold)).tracking(1.6).foregroundStyle(TLColor.accentText)
            Text(rec.title).font(TLFont.serif(24)).italic().foregroundStyle(TLColor.fg)
            Text(rec.reason).font(TLFont.sans(14)).foregroundStyle(TLColor.fg2).lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
            Button { onStart(rec.url); dismiss() } label: {
                HStack(spacing: 6) {
                    Text("Bắt đầu").font(TLFont.sans(14, .bold))
                    Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(TLColor.accentInk)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(
            LinearGradient(colors: [TLColor.accent.opacity(0.16), TLColor.surface], startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
    }
}
