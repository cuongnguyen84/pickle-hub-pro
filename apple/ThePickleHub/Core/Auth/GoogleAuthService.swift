import UIKit
import GoogleSignIn

/// Thin wrapper over GoogleSignIn-iOS. Returns the OIDC tokens needed by
/// Supabase's `signInWithIdToken`. Client/server IDs come from Info.plist
/// (`GIDClientID` / `GIDServerClientID`), so no manual configuration here.
enum GoogleAuthService {
    struct Tokens {
        let idToken: String
        let accessToken: String
        let rawNonce: String
    }

    enum GoogleAuthError: LocalizedError {
        case noPresenter
        case missingIDToken

        var errorDescription: String? {
            switch self {
            case .noPresenter:   return String(localized: "Không tìm thấy màn hình để hiển thị Google Sign-In.")
            case .missingIDToken: return String(localized: "Google không trả về idToken.")
            }
        }
    }

    @MainActor
    static func signIn() async throws -> Tokens {
        guard let presenter = UIApplication.shared.topViewController else {
            throw GoogleAuthError.noPresenter
        }
        // GoTrue chỉ so sánh sha256(nonce gửi lên) với nonce trong id_token
        // (convention Apple). Google nhúng nonce NGUYÊN VĂN vào token → phải
        // đưa Google bản SHA-256, đưa Supabase bản raw — y hệt Apple Sign-In.
        // (Đo thật 28/07: token_nonce == giá trị truyền cho GIDSignIn.)
        let rawNonce = try AppleSignInNonce.generate()
        let result = try await GIDSignIn.sharedInstance.signIn(
            withPresenting: presenter, hint: nil, additionalScopes: nil,
            nonce: AppleSignInNonce.sha256(rawNonce)
        )
        guard let idToken = result.user.idToken?.tokenString else {
            throw GoogleAuthError.missingIDToken
        }
        return Tokens(idToken: idToken, accessToken: result.user.accessToken.tokenString, rawNonce: rawNonce)
    }

    static func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }
}

extension UIApplication {
    /// Top-most view controller from the active foreground window scene.
    var topViewController: UIViewController? {
        let scene = connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
