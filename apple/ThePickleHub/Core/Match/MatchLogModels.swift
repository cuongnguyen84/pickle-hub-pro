import Foundation

/// Singles vs doubles. DUPR/match-proposal uses uppercase tokens.
enum MatchFormat: String, CaseIterable, Identifiable, Equatable {
    case singles = "SINGLES"
    case doubles = "DOUBLES"

    var id: String { rawValue }
    var label: String { self == .singles ? "Đơn" : "Đôi" }
    /// Players required per side.
    var slotsPerSide: Int { self == .singles ? 1 : 2 }
}

/// A chosen player in the wizard. Either a real ThePickleHub user (`userID` set)
/// or an unregistered opponent invited by name (`inviteName` set → becomes a
/// ghost slot + shareable confirm link).
struct PickedPlayer: Identifiable, Equatable {
    let id: UUID
    var userID: String?
    var name: String
    var username: String?
    var inviteName: String?

    init(id: UUID = UUID(), userID: String? = nil, name: String, username: String? = nil, inviteName: String? = nil) {
        self.id = id
        self.userID = userID
        self.name = name
        self.username = username
        self.inviteName = inviteName
    }

    var isInvite: Bool { userID == nil }

    static func from(hit: OpponentHit) -> PickedPlayer {
        PickedPlayer(userID: hit.userID, name: hit.fullName, username: hit.username)
    }

    static func invite(name: String) -> PickedPlayer {
        PickedPlayer(name: name, inviteName: name)
    }
}

/// One result row from the `dupr-user-search` edge function.
struct OpponentHit: Decodable, Identifiable, Equatable {
    let source: String          // "dupr" | "internal" | "both"
    let duprID: String?
    let fullName: String
    let singlesRating: Double?
    let doublesRating: Double?
    let userID: String?         // nil for DUPR-only hits (no app account)
    let username: String?

    var id: String { userID ?? duprID ?? fullName }
    /// Only app users can be added as real players; DUPR-only hits must be
    /// invited by name instead.
    var isAppUser: Bool { userID != nil }

    enum CodingKeys: String, CodingKey {
        case source
        case duprID = "dupr_id"
        case fullName = "full_name"
        case singlesRating = "singles_rating"
        case doublesRating = "doubles_rating"
        case userID = "user_id"
        case username
    }
}

struct OpponentSearchResponse: Decodable {
    let hits: [OpponentHit]
}

/// Result of `match-proposal` action=create.
struct CreateMatchResult: Decodable, Equatable {
    let proposalID: String
    let status: String
    let invites: [MatchInvite]

    enum CodingKeys: String, CodingKey {
        case proposalID = "proposal_id"
        case status
        case invites
    }
}

/// A row from `match_proposals` (RLS returns only rows the caller is involved in).
/// Mirrors the web `ProposalRow` used by `/match` pending + history tabs.
struct MatchProposalRow: Decodable, Identifiable, Equatable {
    let id: String
    let format: String
    let matchDate: String?
    let teamAPlayerIDs: [String]
    let teamBPlayerIDs: [String]
    let teamAScores: [Int]
    let teamBScores: [Int]
    let status: String
    let duprMatchCode: String?
    let createdAt: String?

    var isDoubles: Bool { format == "DOUBLES" }

    enum CodingKeys: String, CodingKey {
        case id, format, status
        case matchDate = "match_date"
        case teamAPlayerIDs = "team_a_player_ids"
        case teamBPlayerIDs = "team_b_player_ids"
        case teamAScores = "team_a_scores"
        case teamBScores = "team_b_scores"
        case duprMatchCode = "dupr_match_code"
        case createdAt = "created_at"
    }
}

/// Vietnamese status pill labels + colour intent for a proposal status.
enum MatchProposalStatus {
    static func label(_ s: String) -> String {
        switch s {
        case "pending_verify": return "CHỜ XÁC NHẬN"
        case "verified": return "ĐÃ XÁC NHẬN"
        case "approved": return "ĐÃ DUYỆT"
        case "submitted": return "ĐÃ GỬI DUPR"
        case "disputed": return "TRANH CHẤP"
        case "rejected": return "BỊ TỪ CHỐI"
        default: return s.uppercased()
        }
    }
    static func isAccent(_ s: String) -> Bool { ["verified", "approved", "submitted"].contains(s) }
    static func isWarn(_ s: String) -> Bool { ["disputed", "rejected"].contains(s) }
}

/// A shareable confirm link minted for each ghost (invited) opponent.
struct MatchInvite: Decodable, Identifiable, Equatable {
    let code: String
    let side: String
    let displayName: String

    var id: String { code }

    enum CodingKeys: String, CodingKey {
        case code
        case side
        case displayName = "display_name"
    }

    var confirmURL: URL {
        WebRoutes.base.appending(path: "match/confirm/\(code)")
    }
}
