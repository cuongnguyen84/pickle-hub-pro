import SwiftUI

/// Keeps public screens available to guests and asks for authentication only
/// when they enter a screen backed by the current user's account.
struct AuthenticationRequiredView<Content: View>: View {
    @Environment(SessionStore.self) private var session
    @ViewBuilder let content: () -> Content

    var body: some View {
        switch session.state {
        case .unknown:
            ProgressView()
                .tint(TLColor.accentText)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(TLColor.bg)
        case .signedOut:
            LoginView()
        case .signedIn:
            content()
        }
    }
}
