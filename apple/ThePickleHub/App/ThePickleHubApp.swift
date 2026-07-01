import SwiftUI
import UIKit
import GoogleSignIn

/// Orientation lock — app is portrait by default; the referee scoring screen
/// forces landscape. The delegate returns `orientationLock`; `OrientationLock`
/// flips it + requests a geometry update (iOS 16+).
final class AppDelegate: NSObject, UIApplicationDelegate {
    static var orientationLock: UIInterfaceOrientationMask = .portrait
    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        AppDelegate.orientationLock
    }
}

enum OrientationLock {
    // Pin to ONE orientation. `.landscape` (both left+right) leaves iOS to pick
    // from the accelerometer, which oscillates when the phone is held portrait
    // or flat — the "screen keeps rotating" bug. A single mask rotates once and
    // stays put.
    static func lockLandscape() { apply(.landscapeRight) }
    static func unlock() { apply(.portrait) }
    private static func apply(_ mask: UIInterfaceOrientationMask) {
        AppDelegate.orientationLock = mask
        guard let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return }
        // Tell the TOP-MOST presented controller (the referee fullScreenCover,
        // which sits above the score .sheet), not the portrait root. Updating the
        // root makes iOS keep evaluating the portrait root and fight the requested
        // landscape — the screen rotates back and forth forever.
        var top = scene.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        top?.setNeedsUpdateOfSupportedInterfaceOrientations()
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: mask)) { _ in }
    }
}

@main
struct ThePickleHubApp: App {
    @State private var session = SessionStore()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() { Self.configureBarAppearance() }

    /// Geist on the nav/tab chrome (the web uses Geist for chrome; serif is
    /// reserved for editorial content), over The Line dark surfaces.
    private static func configureBarAppearance() {
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = TLColor.uiBg
        nav.shadowColor = .clear
        nav.titleTextAttributes = [
            .foregroundColor: TLColor.uiFg,
            .font: TLFont.UIKitFont.sans(17, .semibold),
        ]
        nav.largeTitleTextAttributes = [
            .foregroundColor: TLColor.uiFg,
            .font: TLFont.UIKitFont.sans(30, .bold),
        ]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav

        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = TLColor.uiBg
        for item in [tab.stackedLayoutAppearance, tab.inlineLayoutAppearance, tab.compactInlineLayoutAppearance] {
            item.normal.titleTextAttributes = [
                .font: TLFont.UIKitFont.sans(10, .medium),
                .foregroundColor: TLColor.uiFg3,
            ]
            item.selected.titleTextAttributes = [
                .font: TLFont.UIKitFont.sans(10, .semibold),
                .foregroundColor: TLColor.uiAccent,
            ]
        }
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .tint(TLColor.accent)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
