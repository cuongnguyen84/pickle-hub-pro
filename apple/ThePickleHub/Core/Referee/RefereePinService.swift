import Foundation
import Supabase

/// Referee-PIN self-enrollment — native port of web `referee-helpers.ts`
/// (migration 20260722110000). The PIN lives in `referee_pins` with NO client
/// grants; every read/write goes through a SECURITY DEFINER RPC. Shared by all
/// 4 formats (quick_table, doubles_elimination, flex_tournament, team_match).
enum RefereePinFormat: String {
    case quickTable = "quick_table"
    case doublesElimination = "doubles_elimination"
    case flexTournament = "flex_tournament"
    case teamMatch = "team_match"
}

/// Status strings returned by `redeem_referee_pin`, mapped to UI copy.
enum RedeemPinResult: String {
    case ok
    case alreadyReferee = "already_referee"
    case invalid
    case expired
    case rateLimited = "rate_limited"
    case unknown
}

struct RefereePinService {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    /// Digits only, capped at 6 — mirrors web `normalizePinInput`.
    static func normalize(_ raw: String) -> String {
        String(raw.filter(\.isNumber).prefix(6))
    }

    struct PinRow: Decodable { let pin: String; let isActive: Bool
        enum CodingKeys: String, CodingKey { case pin; case isActive = "is_active" } }

    private func params(_ format: RefereePinFormat, _ parentID: UUID, pin: String? = nil) -> [String: String] {
        var p = ["p_format": format.rawValue, "p_parent_id": parentID.uuidString.lowercased()]
        if let pin { p["p_pin"] = pin }
        return p
    }

    // Scalar RPCs return a bare JSON string (e.g. "123456", "ok"); PostgREST
    // gives us the raw bytes — strip the JSON quoting rather than rely on
    // top-level-fragment decoding.
    private func scalar(_ data: Data) -> String {
        (String(data: data, encoding: .utf8) ?? "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "\"\n \t"))
    }

    /// Creator-only reveal. nil = no PIN (or caller isn't creator).
    func get(format: RefereePinFormat, parentID: UUID) async throws -> PinRow? {
        let rows: [PinRow] = try await client
            .rpc("get_referee_pin", params: params(format, parentID))
            .execute().value
        return rows.first
    }

    /// Enable or rotate — generates a fresh 6-digit PIN server-side and returns it.
    func set(format: RefereePinFormat, parentID: UUID) async throws -> String {
        let resp = try await client.rpc("set_referee_pin", params: params(format, parentID)).execute()
        return scalar(resp.data)
    }

    /// Disable the PIN (existing referees keep access).
    func clear(format: RefereePinFormat, parentID: UUID) async throws {
        try await client.rpc("clear_referee_pin", params: params(format, parentID)).execute()
    }

    /// Redeem as the signed-in user; server rate-limits and expiry-checks.
    func redeem(format: RefereePinFormat, parentID: UUID, pin: String) async throws -> RedeemPinResult {
        let resp = try await client.rpc("redeem_referee_pin", params: params(format, parentID, pin: pin)).execute()
        return RedeemPinResult(rawValue: scalar(resp.data)) ?? .unknown
    }
}
