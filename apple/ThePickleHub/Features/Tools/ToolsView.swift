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
            Format(title: "Đấu đồng đội", subtitle: "Thể thức MLP", icon: "person.3", url: WebRoutes.toolsTeamMatch),
        ]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
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

    private var formatGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TẠO GIẢI ĐẤU")
                .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
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
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: format.icon)
                .font(.system(size: 22)).foregroundStyle(TLColor.accentText)
            Spacer(minLength: 8)
            Text(format.title).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
            Text(format.subtitle).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3).lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    @ViewBuilder
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("GIẢI GẦN ĐÂY")
                .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            switch model.phase {
            case .loading:
                ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 20)
            case .failed(let message):
                Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
            case .loaded where model.tables.isEmpty:
                Text("Chưa có giải nào.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            case .loaded:
                VStack(spacing: 0) {
                    ForEach(model.tables) { table in
                        Button { openURL = IdentifiedURL(url: WebRoutes.quickTable(shareID: table.shareID)) } label: {
                            tableRow(table)
                        }
                        .buttonStyle(.plain)
                        Rectangle().fill(TLColor.border).frame(height: 1)
                    }
                }
            }
        }
    }

    private func tableRow(_ table: QuickTableSummary) -> some View {
        HStack(spacing: 12) {
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
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
