import SwiftUI

@Observable
final class ToolsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var tables: [QuickTableSummary] = []
    private let repo = ToolsRepository()
    private var loaded = false

    @MainActor
    func load() async {
        if loaded { return }
        phase = .loading
        do {
            tables = try await repo.recentTables()
            loaded = true
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func reload() async { loaded = false; await load() }
}

/// Tools tab — Bracket Lab hub. The four tournament formats + a recent-tables
/// feed. Creating/scoring brackets is rich + interactive, so those open on the
/// web; this surfaces and links into them.
struct ToolsView: View {
    @State private var model = ToolsViewModel()
    @State private var openURL: IdentifiedURL?

    private struct Format: Identifiable {
        let id = UUID()
        let title: String
        let subtitle: String
        let icon: String
        let url: URL
    }

    private var formats: [Format] {
        [
            Format(title: "Bảng đấu nhanh", subtitle: "Vòng tròn → playoff", icon: "tablecells", url: WebRoutes.toolsQuickTables),
            Format(title: "Loại trực tiếp", subtitle: "Nhánh đơn / đôi", icon: "arrow.triangle.branch", url: WebRoutes.toolsDoublesElimination),
            Format(title: "Giải linh hoạt", subtitle: "Tùy biến hoàn toàn", icon: "slider.horizontal.3", url: WebRoutes.toolsFlexTournament),
            Format(title: "Đấu đồng đội", subtitle: "Thể thức MLP", icon: "person.3.fill", url: WebRoutes.toolsTeamMatch),
        ]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    intro
                    formatGrid
                    recentSection
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle("Công cụ")
            .navigationBarTitleDisplayMode(.large)
            .task { await model.load() }
            .refreshable { await model.reload() }
            .sheet(item: $openURL) { SafariView(url: $0.url).ignoresSafeArea() }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("BRACKET LAB")
                .font(TLFont.mono(10, .semibold)).tracking(1.2).foregroundStyle(TLColor.accentText)
            (Text("Tạo giải đấu ") + Text("trong vài phút.").foregroundColor(TLColor.accentText).italic())
                .font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var formatGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(num: "01", title: "Thể thức")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(formats) { format in
                    Button { openURL = IdentifiedURL(url: format.url) } label: {
                        formatCard(format)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func formatCard(_ format: Format) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // top accent rule
            LinearGradient(colors: [TLColor.accent, TLColor.accentDim], startPoint: .leading, endPoint: .trailing)
                .frame(height: 3)

            VStack(alignment: .leading, spacing: 12) {
                ZStack {
                    Circle().fill(TLColor.accent.opacity(0.12)).frame(width: 40, height: 40)
                    Image(systemName: format.icon).font(.system(size: 17, weight: .medium)).foregroundStyle(TLColor.accentText)
                }
                Spacer(minLength: 6)
                Text(format.title).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                HStack(spacing: 4) {
                    Text(format.subtitle).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3).lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.up.right").font(.system(size: 10, weight: .bold)).foregroundStyle(TLColor.fg4)
                }
            }
            .padding(14)
        }
        .frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
        .background(TLColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    @ViewBuilder
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(num: "02", title: "Giải gần đây")
            switch model.phase {
            case .loading:
                ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 20)
            case .failed(let message):
                Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
            case .loaded where model.tables.isEmpty:
                Text("Chưa có giải nào.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            case .loaded:
                VStack(spacing: 0) {
                    ForEach(Array(model.tables.enumerated()), id: \.element.id) { index, table in
                        Button { openURL = IdentifiedURL(url: WebRoutes.quickTable(shareID: table.shareID)) } label: {
                            tableRow(index: index, table: table)
                        }
                        .buttonStyle(.plain)
                        if index < model.tables.count - 1 {
                            Rectangle().fill(TLColor.border).frame(height: 1).padding(.leading, 40)
                        }
                    }
                }
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            }
        }
    }

    private func tableRow(index: Int, table: QuickTableSummary) -> some View {
        HStack(spacing: 12) {
            Text(String(format: "%02d", index + 1))
                .font(TLFont.mono(12, .semibold)).foregroundStyle(TLColor.fg4)
                .frame(width: 28, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Text(table.displayName).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                Text(table.subtitle).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
            }
            Spacer(minLength: 8)
            Text(table.statusLabel)
                .font(TLFont.mono(9, .semibold)).tracking(0.4).textCase(.uppercase)
                .foregroundStyle(table.isOngoing ? TLColor.accentText : TLColor.fg3)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background((table.isOngoing ? TLColor.accent : TLColor.fg3).opacity(0.12), in: Capsule())
        }
        .padding(.horizontal, 14).padding(.vertical, 13)
        .contentShape(Rectangle())
    }

    private func sectionHeader(num: String, title: String) -> some View {
        HStack(spacing: 8) {
            Text("/ \(num)").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText)
            Text(title.uppercased()).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
        }
    }
}
