import Foundation

/// Derived lifecycle state for a tournament the user manages, mapped to the
/// design's badge + CTA states.
enum TournamentState: Equatable, Hashable {
    case draft        // setup, no registration yet
    case open         // accepting registrations
    case full         // capacity reached
    case ongoing      // group stage / playoff
    case completed

    var label: String {
        switch self {
        case .draft: return "Nháp"
        case .open: return "Đang mở"
        case .full: return "Đã đầy"
        case .ongoing: return "Đang diễn ra"
        case .completed: return "Đã kết thúc"
        }
    }

    /// Lime (accent) badge vs muted/grey badge.
    var isAccent: Bool {
        switch self {
        case .open, .ongoing: return true
        case .draft, .full, .completed: return false
        }
    }

    /// Primary call-to-action label per state (status-driven actions).
    var primaryCTA: String {
        switch self {
        case .draft: return "Hoàn tất & mở đăng ký"
        case .open: return "Chia sẻ"
        case .full: return "Tạo bảng đấu"
        case .ongoing: return "Quản lý"
        case .completed: return "Xem kết quả"
        }
    }

    /// Whether the primary CTA is the native share sheet (vs opening the web).
    var primaryIsShare: Bool { self == .open }

    var matchesFilter: ToolsFilter {
        switch self {
        case .draft: return .draft
        case .open: return .open
        case .full, .ongoing: return .upcoming
        case .completed: return .completed
        }
    }
}

/// Filter chips for the "Giải gần đây" list.
enum ToolsFilter: String, CaseIterable, Identifiable {
    case all, open, upcoming, completed, draft
    var id: String { rawValue }
    var label: String {
        switch self {
        case .all: return "Tất cả"
        case .open: return "Đang mở"
        case .upcoming: return "Sắp diễn ra"
        case .completed: return "Đã kết thúc"
        case .draft: return "Nháp"
        }
    }
}

/// Which Bracket Lab format a managed tournament belongs to (drives routing +
/// share URL). Quick Tables and Doubles Elimination have native detail views;
/// the rest still open the web.
enum BracketFormat: String, Equatable, Hashable {
    case quickTable
    case doublesElim
    case teamMatch
    case flex

    /// Whether a native detail (view+score) screen exists; others open the web.
    var hasNativeView: Bool { self == .quickTable || self == .doublesElim }

    func webURL(shareID: String) -> URL {
        switch self {
        case .quickTable: return WebRoutes.quickTable(shareID: shareID)
        case .doublesElim: return WebRoutes.toolsDoublesEliminationView(shareID: shareID)
        case .teamMatch: return WebRoutes.toolsTeamMatchView(shareID: shareID)
        case .flex: return WebRoutes.toolsFlexView(shareID: shareID)
        }
    }
}

/// Raw `quick_tables` row owned by the current user.
struct QuickTableRow: Decodable, Equatable {
    let id: UUID
    let shareID: String
    let name: String?
    let isDoubles: Bool?
    let playerCount: Int?
    let status: String?
    let requiresRegistration: Bool?
    let startTime: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case shareID = "share_id"
        case isDoubles = "is_doubles"
        case playerCount = "player_count"
        case requiresRegistration = "requires_registration"
        case startTime = "start_time"
        case createdAt = "created_at"
    }
}

/// View-model for a managed tournament card (row + enriched registration count).
struct MyTournament: Identifiable, Equatable, Hashable {
    let id: UUID
    let shareID: String
    let name: String
    let isDoubles: Bool
    let capacity: Int
    let registered: Int
    let state: TournamentState
    let createdAt: Date?
    var format: BracketFormat = .quickTable

    var displayName: String { name.nonEmpty ?? "Giải đấu" }

    var metaLine: String {
        switch format {
        case .doublesElim:
            return capacity > 0 ? "Loại kép · \(capacity) đội" : "Loại kép"
        case .teamMatch:
            return "Đồng đội · MLP"
        case .flex:
            return "Giải linh hoạt"
        case .quickTable:
            let mode = isDoubles ? "Đôi" : "Đơn"
            return capacity > 0 ? "\(mode) · \(capacity) người" : mode
        }
    }

    var hasProgress: Bool { capacity > 0 && (state == .open || state == .full) }
    var fillFraction: Double { capacity > 0 ? min(1, Double(registered) / Double(capacity)) : 0 }
    var regCapText: String { "\(registered)/\(capacity)" }
    var slotsLeft: Int { max(0, capacity - registered) }

    /// "Sắp đầy — còn N suất" when ≥80% full; else "còn N suất".
    var urgencyText: String? {
        guard hasProgress else { return nil }
        if state == .full { return "Đã đầy" }
        if fillFraction >= 0.8 { return "Sắp đầy — còn \(slotsLeft) suất" }
        return "Còn \(slotsLeft) suất"
    }

    var isNearlyFull: Bool { fillFraction >= 0.8 && state != .full }

    var dateText: String {
        guard let createdAt else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "vi_VN")
        f.dateFormat = "dd.MM.yyyy"
        return "Tạo \(f.string(from: createdAt))"
    }
}
