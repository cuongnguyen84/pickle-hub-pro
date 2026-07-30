import SwiftUI

struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        ZStack {
            TLColor.bg.ignoresSafeArea()

            switch session.state {
            case .unknown:
                ProgressView().tint(TLColor.accentText)
            case .signedOut, .signedIn:
                AppTabView()
            }
        }
        .task { await session.bootstrap() }
    }
}
