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
