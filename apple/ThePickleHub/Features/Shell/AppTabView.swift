import SwiftUI

/// Primary tab shell mirroring the production Shop launch: five slots with a
/// fixed Shop entry. Rankings, Tournaments and Profile are reached from the Home toolbar,
/// like the web header — they are first-class, not behind a hamburger menu.
struct AppTabView: View {
    enum Tab: String, Hashable {
        case home, live, shop, feed, tools
    }

    @State private var selection: Tab = Self.launchTab

    var body: some View {
        TabView(selection: $selection) {
            homeTab
                .tag(Tab.home)
                .tabItem { Label("Trang chủ", systemImage: "house.fill") }

            LiveView()
                .tag(Tab.live)
                .tabItem { Label("Trực tiếp", systemImage: "dot.radiowaves.up.forward") }

            NavigationStack { ShopHomeView() }
                .tag(Tab.shop)
                .tabItem { Label("Chợ", systemImage: "storefront.fill") }

            NavigationStack { FeedView() }
                .tag(Tab.feed)
                .tabItem { Label("Bảng tin", systemImage: "newspaper.fill") }

            ToolsView()
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

    @State private var homePath = Self.launchHomePath
    @State private var unreadCount = 0
    @State private var avatarURL: String?
    @State private var dupr: ProfileRepository.DuprChip?
    @State private var duprLoaded = false

    private var homeTab: some View {
        NavigationStack(path: $homePath) {
            HomeView {
                homePath = NavigationPath()
                selection = .live
            }
                .navigationTitle("ThePickleHub")
                .navigationDestination(for: HomeRoute.self) { route in
                    switch route {
                    case .shop: ShopHomeView()
                    case .tournaments: TournamentsView()
                    case .rankings: RankingsView()
                    case .notifications: AuthenticationRequiredView { NotificationsView() }
                    case .search: SearchView()
                    case .profile: AuthenticationRequiredView { ProfileView() }
                    }
                }
                // Single full-width principal bar. Using one toolbar zone (not
                // leading + principal + trailing) is what stops the three groups
                // overlapping on narrow iPhones — SwiftUI's `.principal` floats
                // centre and reserves no space for the side groups.
                .toolbar {
                    ToolbarItem(placement: .principal) { homeTopBar }
                }
                .task {
                    unreadCount = await NotificationRepository().unreadCount()
                    avatarURL = try? await ProfileRepository().currentUserProfile().avatarURL
                    dupr = await ProfileRepository().duprChip()
                    duprLoaded = true
                }
        }
    }

    /// UI-review launch hook: `-startShop YES` opens the fixture-backed Shop
    /// sample without automating taps. It lives in the argument domain only.
    private static var launchHomePath: NavigationPath {
        var path = NavigationPath()
        guard ShopFeatureGate.isEnabled else { return path }
        if UserDefaults.standard.bool(forKey: "startShop") || UserDefaults.standard.bool(forKey: "startShopSearch") {
            path.append(HomeRoute.shop)
        }
        if UserDefaults.standard.bool(forKey: "startShopSearch") { path.append(ShopRoute.search) }
        if UserDefaults.standard.bool(forKey: "startShopCategory") {
            path.append(HomeRoute.shop)
            path.append(ShopRoute.category(.paddles))
        }
        if UserDefaults.standard.bool(forKey: "startShopProduct") || UserDefaults.standard.bool(forKey: "startShopVariant") {
            path.append(HomeRoute.shop)
            path.append(ShopRoute.product(ShopFixtures.products[1].slug))
        }
        if UserDefaults.standard.bool(forKey: "startShopStore") {
            path.append(HomeRoute.shop)
            path.append(ShopRoute.store(ShopFixtures.gearSeller.slug))
        }
        return path
    }

    /// Full-width Home header: prominent lime "cup" (tournaments) on the left,
    /// compact DUPR chip in the middle, smaller search / bell / avatar on the
    /// right. All in one HStack so the layout is deterministic — no overlap.
    private var homeTopBar: some View {
        HStack(spacing: 10) {
            // Cup — the hero action. Solid lime capsule so it clearly outranks
            // the secondary icon actions around it.
            Button { homePath.append(HomeRoute.tournaments) } label: {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(TLColor.accentInk)
                    .frame(width: 36, height: 32)
                    .background(TLColor.accent, in: Capsule())
            }
            .accessibilityLabel("Giải đấu")

            secondaryIcon("chart.bar.fill", label: String(localized: "Bảng xếp hạng")) {
                homePath.append(HomeRoute.rankings)
            }

            Spacer(minLength: 6)

            // N6: only the rated chip is tappable (DuprHeaderChip renders
            // unlinked as a static label) — the web /dupr hop was a dead end.
            DuprHeaderChip(state: duprState) {
                homePath.append(HomeRoute.profile)
            }
            .layoutPriority(-1)          // yields width first if the row gets tight

            Spacer(minLength: 6)

            secondaryIcon("magnifyingglass", label: "Tìm kiếm") {
                homePath.append(HomeRoute.search)
            }
            secondaryIcon("bell.fill", label: "Thông báo") {
                homePath.append(HomeRoute.notifications)
            }
            .overlay(alignment: .topTrailing) {
                if unreadCount > 0 {
                    Circle().fill(TLColor.live).frame(width: 7, height: 7).offset(x: -7, y: 7)
                }
            }
            .accessibilityValue(unreadCount > 0 ? "Có thông báo mới" : "")

            NavigationLink { AuthenticationRequiredView { ProfileView() } } label: { toolbarAvatar }
                .accessibilityLabel("Hồ sơ")
        }
        .frame(maxWidth: .infinity)
    }

    /// Secondary toolbar action — smaller, lower-emphasis than the cup.
    private func secondaryIcon(_ system: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(TLColor.accentText)
                .frame(width: 44, height: 44)   // ≥44pt hit target; glyph stays 15pt
                .contentShape(Rectangle())
        }
        .accessibilityLabel(label)
    }

    private var duprState: DuprHeaderChip.State {
        guard duprLoaded else { return .loading }
        guard let dupr else { return .unlinked }
        return .rated(rating: dupr.rating, delta: dupr.delta)
    }

    /// User's own avatar in the toolbar; falls back to the SF Symbol until the
    /// profile loads (or if they have no picture). Lime ring keeps it on-brand.
    private var toolbarAvatar: some View {
        Group {
            if let s = avatarURL, let url = URL(string: s) {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "person.crop.circle").foregroundStyle(TLColor.accentText)
                }
                .frame(width: 26, height: 26)
                .clipShape(Circle())
                .overlay(Circle().stroke(TLColor.accent, lineWidth: 1.5))
            } else {
                Image(systemName: "person.crop.circle.fill").foregroundStyle(TLColor.accentText)
            }
        }
    }
}
