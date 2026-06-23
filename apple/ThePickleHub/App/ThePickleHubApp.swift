import SwiftUI
import UIKit
import GoogleSignIn

@main
struct ThePickleHubApp: App {
    @State private var session = SessionStore()

    init() { Self.configureBarAppearance() }

    /// Geist on the nav/tab chrome (the web uses Geist for chrome; serif is
    /// reserved for editorial content), over The Line dark surfaces.
    private static func configureBarAppearance() {
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = UIColor(TLColor.bg)
        nav.shadowColor = .clear
        nav.titleTextAttributes = [
            .foregroundColor: UIColor(TLColor.fg),
            .font: TLFont.UIKitFont.sans(17, .semibold),
        ]
        nav.largeTitleTextAttributes = [
            .foregroundColor: UIColor(TLColor.fg),
            .font: TLFont.UIKitFont.sans(30, .bold),
        ]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav

        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = UIColor(TLColor.bg)
        for item in [tab.stackedLayoutAppearance, tab.inlineLayoutAppearance, tab.compactInlineLayoutAppearance] {
            item.normal.titleTextAttributes = [
                .font: TLFont.UIKitFont.sans(10, .medium),
                .foregroundColor: UIColor(TLColor.fg3),
            ]
            item.selected.titleTextAttributes = [
                .font: TLFont.UIKitFont.sans(10, .semibold),
                .foregroundColor: UIColor(TLColor.accent),
            ]
        }
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .preferredColorScheme(.dark)
                .tint(TLColor.accent)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
