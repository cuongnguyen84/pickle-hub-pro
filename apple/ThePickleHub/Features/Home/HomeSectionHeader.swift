import SwiftUI

/// Editorial section header: a serif title with an optional trailing link,
/// matching the web `.tl-section` heads ("Tin mới.", "Sân đấu.", …).
struct HomeSectionHeader<Trailing: View>: View {
    let title: String
    var emphasis: String?            // serif-italic accent appended (e.g. "N°26")
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Group {
                if let emphasis {
                    Text(title) + Text(" \(emphasis)").italic()
                } else {
                    Text(title)
                }
            }
            .font(TLFont.serif(26))
            .foregroundStyle(TLColor.fg)

            Spacer(minLength: 8)
            trailing
        }
    }
}

extension HomeSectionHeader where Trailing == EmptyView {
    init(title: String, emphasis: String? = nil) {
        self.init(title: title, emphasis: emphasis) { EmptyView() }
    }
}

/// A "Xem tất cả →" style link used in section headers.
struct HomeMoreLink: View {
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Text(label)
            Image(systemName: "arrow.right").font(.system(size: 10, weight: .bold))
        }
        .font(TLFont.mono(10, .semibold))
        .textCase(.uppercase)
        .tracking(0.6)
        .foregroundStyle(TLColor.accentText)
    }
}
