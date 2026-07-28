import Foundation

/// Typed error contract shared by the transactional tournament RPCs.
/// Keeping the mapping native means a conflict never collapses into a generic
/// PostgREST message or replaces the currently loaded tournament screen.
enum TournamentMutationError: Error, Equatable, LocalizedError {
    case authenticationRequired
    case notAuthorized
    case versionConflict
    case downstreamLocked
    case bracketConflict
    case participantsMissing
    case invalidScore
    case invalidGames
    case cannotReopenCompleted
    case matchNotFound
    case server(String)

    init(code: String?) {
        switch code {
        case "AUTH_REQUIRED": self = .authenticationRequired
        case "NOT_AUTHORIZED", "NOT_OWNER": self = .notAuthorized
        case "VERSION_REQUIRED", "VERSION_CONFLICT": self = .versionConflict
        case "DOWNSTREAM_LOCKED": self = .downstreamLocked
        case "BRACKET_CONFLICT", "BRACKET_ALREADY_EXISTS": self = .bracketConflict
        case "PARTICIPANTS_MISSING", "BYE_NOT_SCORABLE": self = .participantsMissing
        case "INVALID_SCORE": self = .invalidScore
        case "INVALID_GAMES": self = .invalidGames
        case "CANNOT_REOPEN_COMPLETED": self = .cannotReopenCompleted
        case "MATCH_NOT_FOUND", "TOURNAMENT_NOT_FOUND": self = .matchNotFound
        case .some(let code): self = .server(code)
        case .none: self = .server("UNKNOWN")
        }
    }

    var errorDescription: String? {
        switch self {
        case .authenticationRequired:
            return String(localized: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
        case .notAuthorized:
            return String(localized: "Bạn không có quyền chấm trận này.")
        case .versionConflict:
            return String(localized: "Điểm vừa được cập nhật trên thiết bị khác. Hãy tải lại trước khi lưu.")
        case .downstreamLocked:
            return String(localized: "Không thể sửa kết quả vì trận phụ thuộc đã bắt đầu.")
        case .bracketConflict:
            return String(localized: "Nhánh đấu đã thay đổi. Hãy tải lại trước khi tiếp tục.")
        case .participantsMissing:
            return String(localized: "Trận chưa đủ người chơi để ghi điểm.")
        case .invalidScore:
            return String(localized: "Tỷ số không hợp lệ. Hai bên phải có điểm khác nhau.")
        case .invalidGames:
            return String(localized: "Danh sách ván không hợp lệ với thể thức của trận.")
        case .cannotReopenCompleted:
            return String(localized: "Không thể đưa trận đã hoàn tất về trạng thái đang đấu.")
        case .matchNotFound:
            return String(localized: "Không tìm thấy trận đấu.")
        case .server(let code):
            return String(localized: "Không thể lưu thay đổi (\(code)).")
        }
    }
}

/// Common JSON envelope returned by all atomic score RPCs.
struct AtomicTournamentMutationResult: Decodable, Equatable {
    let success: Bool
    let error: String?
    let version: Int64?
    let currentVersion: Int64?
    let completed: Bool?

    enum CodingKeys: String, CodingKey {
        case success, error, version, completed
        case currentVersion = "current_version"
    }

    func requireSuccess() throws {
        guard success else { throw TournamentMutationError(code: error) }
    }
}
