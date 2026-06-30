import SwiftUI

/// Social hub — segmented Sân / Xé vé / CLB, default Xé vé. Replaces the old
/// flat SocialListView as the `social` tab. Each sub-tab is plain content; the
/// hub owns the NavigationStack + editorial header + segmented control.
struct SocialHubView: View {
    enum SubTab: String, CaseIterable, Identifiable {
        case courts, tickets, clubs
        var id: String { rawValue }
        var label: String {
            switch self {
            case .courts: return "Sân"
            case .tickets: return "Xé vé"
            case .clubs: return "CLB"
            }
        }
    }

    @State private var tab: SubTab = .tickets

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                segmented.padding(.horizontal, 18).padding(.bottom, 10)
                Group {
                    switch tab {
                    case .courts: VenuesListView()
                    case .tickets: SocialEventsTab(goToCourts: { tab = .courts })
                    case .clubs: ClubsListView()
                    }
                }
            }
            .background(TLColor.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("/ CỘNG ĐỒNG").font(TLFont.mono(11, .semibold)).tracking(2).foregroundStyle(TLColor.accentText)
            HStack(alignment: .firstTextBaseline) {
                Text("Social").font(TLFont.sans(32, .bold)).foregroundStyle(TLColor.fg)
                Spacer()
                Text("TP.HCM").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
            }
        }
        .padding(.horizontal, 18).padding(.top, 8).padding(.bottom, 12)
    }

    private var segmented: some View {
        TLSegmented(options: SubTab.allCases, selection: $tab, label: { $0.label })
    }
}
