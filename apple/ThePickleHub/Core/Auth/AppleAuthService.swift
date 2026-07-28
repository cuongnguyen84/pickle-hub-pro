import AuthenticationServices
import CryptoKit
import Foundation
import Security

enum AppleSignInNonce {
    private static let characters = Array(
        "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._"
    )

    enum NonceError: LocalizedError {
        case randomGenerationFailed(OSStatus)

        var errorDescription: String? {
            switch self {
            case .randomGenerationFailed:
                return "Không thể tạo phiên đăng nhập Apple an toàn. Vui lòng thử lại."
            }
        }
    }

    static func generate(length: Int = 32) throws -> String {
        precondition(length > 0)
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw NonceError.randomGenerationFailed(status)
        }
        return String(bytes.map { characters[Int($0) % characters.count] })
    }

    static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

@MainActor
enum AppleAuthService {
    struct Credentials: Equatable {
        let idToken: String
        let rawNonce: String
        let displayName: String?
    }

    enum AppleAuthError: LocalizedError {
        case missingNonce
        case invalidCredential
        case missingIdentityToken
        case invalidIdentityToken

        var errorDescription: String? {
            switch self {
            case .missingNonce:
                return "Phiên đăng nhập Apple đã hết hạn. Vui lòng thử lại."
            case .invalidCredential:
                return "Apple không trả về thông tin đăng nhập hợp lệ."
            case .missingIdentityToken:
                return "Apple không trả về mã xác thực."
            case .invalidIdentityToken:
                return "Không thể đọc mã xác thực từ Apple."
            }
        }
    }

    /// Adds a SHA-256 nonce so Supabase can verify that the returned Apple token
    /// belongs to this exact sign-in request.
    static func prepare(_ request: ASAuthorizationAppleIDRequest) throws -> String {
        let rawNonce = try AppleSignInNonce.generate()
        request.requestedScopes = [.fullName, .email]
        request.nonce = AppleSignInNonce.sha256(rawNonce)
        return rawNonce
    }

    static func credentials(
        from authorization: ASAuthorization,
        rawNonce: String?
    ) throws -> Credentials {
        guard let rawNonce else { throw AppleAuthError.missingNonce }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            throw AppleAuthError.invalidCredential
        }
        guard let tokenData = credential.identityToken else {
            throw AppleAuthError.missingIdentityToken
        }
        guard let idToken = String(data: tokenData, encoding: .utf8), !idToken.isEmpty else {
            throw AppleAuthError.invalidIdentityToken
        }

        return Credentials(
            idToken: idToken,
            rawNonce: rawNonce,
            displayName: displayName(from: credential.fullName)
        )
    }

    static func isCancellation(_ error: Error) -> Bool {
        (error as? ASAuthorizationError)?.code == .canceled
    }

    private static func displayName(from components: PersonNameComponents?) -> String? {
        guard let components else { return nil }
        let value = PersonNameComponentsFormatter()
            .string(from: components)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : String(value.prefix(100))
    }
}
