import SwiftUI

/// Gold results ticker bar — a horizontally-scrollable strip of recent match
/// results (auto-scroll animation is a future polish).
struct HomeTicker: View {
    let items: [TickerItem]

    var body: some View {
        HStack(spacing: 12) {
            HStack(spacing: 5) {
                Circle().fill(TLColor.gold).frame(width: 5, height: 5)
                Text("KẾT QUẢ")
                    .font(TLFont.mono(10, .semibold)).tracking(0.6)
                    .foregroundStyle(TLColor.gold)
            }
            .fixedSize()

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 20) {
                    ForEach(items) { item in
                        HStack(spacing: 6) {
                            Text(item.body).foregroundStyle(TLColor.fg2)
                            if let trail = item.trail {
                                Text("· \(trail)").foregroundStyle(TLColor.fg4)
                            }
                        }
                        .lineLimit(1)
                    }
                }
                .font(TLFont.mono(11))
                .padding(.trailing, 16)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface)
        .overlay(Rectangle().fill(TLColor.border).frame(height: 1), alignment: .bottom)
    }
}
