import SwiftUI
import UIKit
@preconcurrency import UserNotifications
import GoogleSignIn

/// Orientation lock — app is portrait by default; the referee scoring screen
/// forces landscape. The delegate returns `orientationLock`; `OrientationLock`
/// flips it + requests a geometry update (iOS 16+).
/// Also the `UNUserNotificationCenter` delegate: shows local notifications in
/// the foreground and routes a tap into the deep-link sheet (live reminders).
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, @preconcurrency UNUserNotificationCenterDelegate {
    static var orientationLock: UIInterfaceOrientationMask = .portrait

    /// Set by `ThePickleHubApp` on appear. A tap that arrives before SwiftUI is
    /// up (cold launch) is buffered in `pendingDeepLink` and replayed on set.
    static var routeDeepLink: ((DeepLink) -> Void)? {
        didSet {
            if let link = pendingDeepLink, let route = routeDeepLink {
                pendingDeepLink = nil
                route(link)
            }
        }
    }
    private static var pendingDeepLink: DeepLink?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        RemotePushService.shared.start(application: application)
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        RemotePushService.shared.setAPNSToken(deviceToken)
    }

    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        AppDelegate.orientationLock
    }

    // Foreground: still show the banner (default is to swallow it).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    // Tap: route both local reminder and FCM data payloads.
    @MainActor
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        guard let link = RemoteNotificationRoute.deepLink(
            from: response.notification.request.content.userInfo
        ) else { return }
        if let route = Self.routeDeepLink { route(link) } else { Self.pendingDeepLink = link }
    }
}

@MainActor
enum OrientationLock {
    // Pin to ONE orientation. `.landscape` (both left+right) leaves iOS to pick
    // from the accelerometer, which oscillates when the phone is held portrait
    // or flat — the "screen keeps rotating" bug. A single mask rotates once and
    // stays put.
    static func lockLandscape() { apply(.landscapeRight) }
    /// Let media fullscreen follow the device orientation while keeping the
    /// rest of the app portrait-only.
    static func allowMediaRotation() { apply(.allButUpsideDown) }
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
    @State private var theme = ThemeStore()
    @State private var deepLink: DeepLink?
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        AppLanguage.bootstrap()
        // pre-mortem #1: log ngôn ngữ resolve lúc khởi động để chẩn đoán nhanh
        print("locale:", Bundle.main.preferredLocalizations, Locale.current.identifier)
        Self.configureBarAppearance()
    }

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
                .environment(theme)
                .preferredColorScheme(theme.mode.colorScheme)
                .tint(TLColor.accent)
                .onOpenURL { url in
                    if SessionStore.isAuthCallbackURL(url) {
                        Task { await session.handleAuthCallback(url) }
                    } else if let link = DeepLink.parse(url) {
                        deepLink = link
                    } else {
                        GIDSignIn.sharedInstance.handle(url)
                    }
                }
                .onChange(of: session.state, initial: true) { _, state in
                    switch state {
                    case .signedIn(let identity):
                        RemotePushService.shared.setAuthenticatedUserID(identity.id)
                    case .unknown, .signedOut:
                        RemotePushService.shared.setAuthenticatedUserID(nil)
                    }
                }
                .onAppear { AppDelegate.routeDeepLink = { deepLink = $0 } }
                .sheet(item: $deepLink) { link in
                    DeepLinkDestinationView(link: link)
                        .environment(session)
                        .environment(theme)
                        .preferredColorScheme(theme.mode.colorScheme)
                }
        }
    }
}
