import SwiftUI

/// WPR tab of native Rankings — mirrors web `/rankings/ppa-tour`: board chips,
/// top-25 board, Vietnam / Viet-origin highlights (collapsed to 8), attribution.
struct WprRankingsView: View {
    @State private var board: WprBoard = .men
    @State private var showAllViet = false

    private let vietVisibleDefault = 8

    var body: some View {
        VStack(spacing: 24) {
            boardChips.padding(.horizontal, 16)
            boardPanel
            vietPanel
            aboutPanel
        }
        .padding(.horizontal, 16)
    }

    private var rows: [WprEntry] { WprSnapshot.board(board) }
    private var viet: [WprVietHighlight] { WprSnapshot.vietHighlights }

    // MARK: Board chips (Nam 25 / Nữ 25)

    private var boardChips: some View {
        HStack(spacing: 8) {
            ForEach(WprBoard.allCases) { b in
                let selected = b == board
                Button { Haptics.light(); board = b } label: {
                    HStack(spacing: 6) {
                        Text(b.labelVi)
                        Text("\(WprSnapshot.board(b).count)").foregroundStyle(selected ? TLColor.accentText.opacity(0.7) : TLColor.fg4)
                    }
                    .font(TLFont.mono(11, selected ? .bold : .medium)).tracking(0.4)
                    .foregroundStyle(selected ? TLColor.accentText : TLColor.fg3)
                    .frame(maxWidth: .infinity).padding(.vertical, 8)
                    .background((selected ? TLColor.accent.opacity(0.12) : .clear), in: Capsule())
                    .overlay(Capsule().strokeBorder(selected ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Top-25 board

    private var boardPanel: some View {
        panel(title: "PPA Tour · \(board.labelVi) · Top \(rows.count)", meta: String(localized: "Nguồn: PPA Tour · WPR")) {
            ForEach(rows) { p in
                HStack(spacing: 12) {
                    Text(p.rankText)
                        .font(TLFont.mono(15, .semibold)).monospacedDigit()
                        .foregroundStyle(p.rank == 1 ? TLColor.gold : p.rank <= 3 ? TLColor.fg : TLColor.fg3)
                        .frame(width: 34, alignment: .trailing)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(WprSnapshot.flag(p.countryCode)) \(p.name)")
                            .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                        Text(WprSnapshot.countryName(p.countryCode, fallback: p.country))
                            .font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Text(WprSnapshot.points(p.points))
                        .font(TLFont.mono(16, .semibold)).monospacedDigit()
                        .foregroundStyle(TLColor.accentText)
                }
                .padding(.horizontal, 16).padding(.vertical, 11)
                divider
            }
        }
    }

    // MARK: Vietnam & Viet-origin

    private var vietPanel: some View {
        let head = Array(viet.prefix(vietVisibleDefault))
        let tail = Array(viet.dropFirst(vietVisibleDefault))
        return panel(title: String(localized: "Việt Nam & gốc Việt trên bảng WPR"),
                     meta: String(localized: "\(viet.count) VĐV")) {
            ForEach(head) { vietRow($0) }
            if !tail.isEmpty {
                if showAllViet {
                    ForEach(tail) { vietRow($0) }
                } else {
                    Button {
                        Haptics.light()
                        withAnimation(.easeInOut(duration: 0.2)) { showAllViet = true }
                    } label: {
                        Text(String(localized: "→ Xem tất cả \(viet.count) VĐV Việt / gốc Việt"))
                            .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16).padding(.vertical, 12)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    divider
                }
            }
            Text(String(localized: "Quy tắc chọn: mọi VĐV mang cờ Việt Nam trên bảng WPR + 3 VĐV Mỹ gốc Việt nổi bật · Số liệu lấy ngày \(WprSnapshot.fetchedLabel())"))
                .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 16).padding(.vertical, 12)
        }
    }

    private func vietRow(_ h: WprVietHighlight) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(h.rankText)
                    .font(TLFont.mono(15, .semibold)).monospacedDigit()
                    .foregroundStyle(TLColor.fg3)
                    .frame(width: 34, alignment: .trailing)
                Text(h.countryCode == "vn" ? "\(h.name) 🇻🇳" : h.name)
                    .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                Spacer(minLength: 8)
                Text(h.board.labelVi.uppercased())
                    .font(TLFont.mono(10, .medium)).tracking(0.6).foregroundStyle(TLColor.fg3)
                Text(WprSnapshot.points(h.points))
                    .font(TLFont.mono(15, .semibold)).monospacedDigit()
                    .foregroundStyle(TLColor.accentText)
                    .frame(minWidth: 64, alignment: .trailing)
            }
            .padding(.horizontal, 16).padding(.vertical, 11)
            divider
        }
    }

    // MARK: About / attribution

    private var aboutPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ " + String(localized: "Về dữ liệu này"))
                .font(TLFont.mono(11, .medium)).tracking(0.5).foregroundStyle(TLColor.fg2)
            Text(String(localized: "WPR là bảng tổng hợp: đôi 50%, đôi nam nữ 35%, đơn 15%, tính trên điểm 52 tuần gần nhất — mỗi VĐV một hạng duy nhất. ThePickleHub trích top 25 mỗi bảng + các VĐV Việt làm tư liệu tham khảo (số liệu lấy ngày \(WprSnapshot.fetchedLabel())) và không phải kênh chính thức hay đối tác của PPA Tour. Xem bảng đầy đủ hơn 2.000 VĐV tại trang gốc."))
                .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                .fixedSize(horizontal: false, vertical: true)
            Link(destination: WprSnapshot.sourceURL) {
                Text("ppatour.com/rankings ↗")
                    .font(TLFont.sans(12, .semibold)).foregroundStyle(TLColor.accentText)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Chrome

    private var divider: some View {
        Rectangle().fill(TLColor.border).frame(height: 1).padding(.leading, 16)
    }

    private func panel<Content: View>(title: String, meta: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                Spacer(minLength: 8)
                Text(meta).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            Rectangle().fill(TLColor.border).frame(height: 1)
            content()
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
    }
}
