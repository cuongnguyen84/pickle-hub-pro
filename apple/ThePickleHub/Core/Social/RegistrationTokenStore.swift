import Foundation
import Security

/// Keychain-backed storage for the bearer token returned by phone OTP.
/// Tokens never belong in UserDefaults because they authorize registration
/// cancellation, payment claims and guest score submission.
enum RegistrationTokenStore {
    private static let service = "net.thepicklehub.social-registration"

    static func save(_ token: String, eventID: UUID) throws {
        guard let data = token.data(using: .utf8), !token.isEmpty else {
            throw StoreError.invalidToken
        }
        let account = eventID.uuidString.lowercased()
        let identity: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let update = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
        if update == errSecSuccess { return }
        guard update == errSecItemNotFound else { throw StoreError.status(update) }

        var item = identity
        attributes.forEach { item[$0.key] = $0.value }
        let add = SecItemAdd(item as CFDictionary, nil)
        guard add == errSecSuccess else { throw StoreError.status(add) }
    }

    static func token(eventID: UUID) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: eventID.uuidString.lowercased(),
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            throw StoreError.status(status)
        }
        return token
    }

    static func remove(eventID: UUID) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: eventID.uuidString.lowercased(),
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw StoreError.status(status)
        }
    }

    enum StoreError: LocalizedError {
        case invalidToken
        case status(OSStatus)

        var errorDescription: String? {
            switch self {
            case .invalidToken: String(localized: "Token đăng ký không hợp lệ.")
            case .status: String(localized: "Không thể lưu đăng ký an toàn trên thiết bị.")
            }
        }
    }
}
