import SwiftUI

/// Primary tab shell mirroring the web `BottomNav` (Home, Live, Social, Feed,
/// Tools). Profile is reached from the Home toolbar, like the web header —
/// it is not a bottom tab. Non-Home tabs are Phase 2+ placeholders.
struct AppTabView: View {
    enum Tab: String, Hashable {
        case home, live, social, feed, tools
    }

    @State private var selection: Tab = Self.launchTab

    var body: some View {
        TabView(selection: $selection) {
            homeTab
                .tag(Tab.home)
                .tabItem { Label("Trang chủ", systemImage: "house.fill") }

            PlaceholderTab(title: "Trực tiếp", phase: "Phase 6", systemImage: "dot.radiowaves.up.forward")
                .tag(Tab.live)
                .tabItem { Label("Trực tiếp", systemImage: "dot.radiowaves.up.forward") }

            PlaceholderTab(title: "Social", phase: "Phase 5", systemImage: "calendar.badge.plus")
                .tag(Tab.social)
                .tabItem { Label("Social", systemImage: "calendar.badge.plus") }

            NavigationStack { FeedView() }
                .tag(Tab.feed)
                .tabItem { Label("Bảng tin", systemImage: "newspaper.fill") }

            PlaceholderTab(title: "Công cụ", phase: "Phase 4", systemImage: "wrench.adjustable.fill")
                .tag(Tab.tools)
                .tabItem { Label("Công cụ", systemImage: "wrench.adjustable.fill") }
        }
        .tint(TLColor.accent)
    }

    /// Initial tab, overridable via the `-startTab <tab>` launch argument
    /// (lands in the UserDefaults argument domain). Foundation for deep links.
    private static var launchTab: Tab {
        UserDefaults.standard.string(forKey: "startTab").flatMap(Tab.init) ?? .home
    }

    private var homeTab: some View {
        NavigationStack {
            HomeHub()
                .navigationTitle("ThePickleHub")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink {
                            ProfileView()
                        } label: {
                            Image(systemName: "person.crop.circle")
                                .foregroundStyle(TLColor.accentText)
                        }
                    }
                }
        }
    }
}

struct PlaceholderTab: View {
    let title: String
    let phase: String
    let systemImage: String

    var body: some View {
        ZStack {
            TLColor.bg.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 44, weight: .regular))
                    .foregroundStyle(TLColor.fg3)
                Text(title).font(.title2.weight(.bold)).foregroundStyle(TLColor.fg)
                Text("\(phase) · sắp ra mắt")
                    .font(.footnote.weight(.medium))
                    .tracking(1)
                    .foregroundStyle(TLColor.accentText)
            }
        }
    }
}
