import Foundation
import Supabase

/// Reads public social events. Mirrors web `useUpcomingSocialEvents` /
/// `useSocialEvent`.
struct SocialRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }
    static let nativeRegistrationSettingKey = "native_event_registration_enabled"

    struct BooleanSettingRow: Decodable, Equatable {
        let value: Bool
    }

    struct OTPResponse: Decodable, Equatable {
        let ok: Bool?
        let code: String?
        let error: String?
        let channel: String?
        let registrationID: String?
        let profileID: String?
        let magicToken: String?
        let registeredAt: String?
        let expiresAt: String?
        enum CodingKeys: String, CodingKey {
            case ok, code, error, channel
            case registrationID = "registration_id"
            case profileID = "profile_id"
            case magicToken = "magic_token"
            case registeredAt = "registered_at"
            case expiresAt = "expires_at"
        }
    }

    struct SendOTPBody: Encodable, Equatable {
        let phone: String
        let email: String
        let eventID: String
        let turnstileToken: String

        enum CodingKeys: String, CodingKey {
            case phone, email
            case eventID = "event_id"
            case turnstileToken = "turnstile_token"
        }
    }

    struct VerifyOTPBody: Encodable, Equatable {
        let phone: String
        let eventID: String
        let code: String
        let displayName: String
        let selfRatedLevel: Double?
        let slotID: String?

        enum CodingKeys: String, CodingKey {
            case phone, code
            case eventID = "event_id"
            case displayName = "display_name"
            case selfRatedLevel = "self_rated_level"
            case slotID = "slot_id"
        }
    }

    struct PaymentOrderResponse: Decodable, Equatable {
        struct Bank: Decodable, Equatable {
            let code: String
            let accountNumber: String
            let accountName: String

            enum CodingKeys: String, CodingKey {
                case code
                case accountNumber = "account_number"
                case accountName = "account_name"
            }
        }

        let ok: Bool?
        let code: String?
        let orderID: String?
        let referenceCode: String?
        let amountVnd: Int?
        let bank: Bank?

        enum CodingKeys: String, CodingKey {
            case ok, code, bank
            case orderID = "order_id"
            case referenceCode = "reference_code"
            case amountVnd = "amount_vnd"
        }
    }

    func sendRegistrationOTP(phone: String, email: String, eventID: UUID,
                             turnstileToken: String) async throws -> OTPResponse {
        let body = SendOTPBody(phone: phone, email: email,
                               eventID: eventID.uuidString.lowercased(),
                               turnstileToken: turnstileToken)
        let response: OTPResponse = try await invoke("phone-otp-send", body: body)
        try validate(response)
        return response
    }

    func verifyRegistrationOTP(phone: String, eventID: UUID, code: String,
                               displayName: String, level: Double? = nil,
                               slotID: String? = nil) async throws -> OTPResponse {
        let body = VerifyOTPBody(phone: phone, eventID: eventID.uuidString.lowercased(),
                                 code: code, displayName: displayName,
                                 selfRatedLevel: level, slotID: slotID)
        let response: OTPResponse = try await invoke("phone-otp-verify", body: body)
        try validate(response)
        guard response.registrationID != nil, response.magicToken != nil else {
            throw SocialFlowError(code: "invalid_server_response")
        }
        return response
    }

    func createPaymentOrder(registrationID: String, magicToken: String) async throws -> PaymentOrderResponse {
        struct Body: Encodable { let registration_id: String; let magic_token: String }
        let response: PaymentOrderResponse = try await invoke(
            "create-payment-order",
            body: Body(registration_id: registrationID, magic_token: magicToken))
        if let code = response.code, code != "payment_not_enabled" {
            throw SocialFlowError(code: code)
        }
        return response
    }

    func registrationSlotCounts(eventID: UUID) async throws -> [String: Int] {
        struct Params: Encodable { let p_event_id: String }
        struct Row: Decodable { let slot_id: String; let registered_count: Int }
        let rows: [Row] = try await client.rpc(
            "get_event_slot_counts",
            params: Params(p_event_id: eventID.uuidString.lowercased())).execute().value
        return rows.reduce(into: [:]) { $0[$1.slot_id] = $1.registered_count }
    }

    /// Production kill switch. A missing row, malformed JSON or network/RLS
    /// failure all fail closed to the Safari registration flow.
    func nativeRegistrationRemotelyEnabled() async -> Bool {
        guard AppConfig.nativeEventRegistrationEnabled else { return false }
        let rows: [BooleanSettingRow]? = try? await client
            .from("system_settings")
            .select("value")
            .eq("key", value: Self.nativeRegistrationSettingKey)
            .limit(1)
            .execute()
            .value
        return rows?.first?.value == true
    }

    private func validate(_ response: OTPResponse) throws {
        if let code = response.code { throw SocialFlowError(code: code) }
        guard response.ok == true else { throw SocialFlowError(code: "invalid_server_response") }
    }

    /// Supabase throws before decoding non-2xx function responses. Preserve the
    /// backend's stable `code` so the UI can show an actionable Vietnamese error.
    static func functionErrorCode(_ error: Error) -> String? {
        guard case let FunctionsError.httpError(_, data) = error else { return nil }
        struct Payload: Decodable { let code: String?; let error: String? }
        guard let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
        return payload.code ?? payload.error
    }

    private func invoke<Response: Decodable, Body: Encodable>(
        _ name: String, body: Body
    ) async throws -> Response {
        // Supabase occasionally loses an active edge function's code blob and
        // returns a short-lived 404 NOT_FOUND_FUNCTION_BLOB. Web production
        // retries only that infrastructure fault; keep native at parity.
        for attempt in 0...3 {
            do {
                return try await client.functions.invoke(
                    name, options: FunctionInvokeOptions(body: body))
            } catch {
                let code = Self.functionErrorCode(error)
                if code == "NOT_FOUND_FUNCTION_BLOB", attempt < 3 {
                    try await Task.sleep(for: .milliseconds(800 * (attempt + 1)))
                    continue
                }
                if let code { throw SocialFlowError(code: code) }
                throw error
            }
        }
        // The loop either returns or throws. This keeps the generic return
        // contract exhaustive if its attempt range is changed later.
        throw SocialFlowError(code: "invalid_server_response")
    }

    private static let columns =
        "id, slug, title_vi, title_en, description_vi, start_at, end_at, location_text, court_count, max_players, level_min, level_max, price_vnd, zalo_group_url, ball_type, free_perks, status, allow_guests, slots, created_by, club_id, visibility, requires_prepayment, prepayment_deadline_hours"

    /// Published, public events that haven't ended yet, soonest first.
    func upcomingEvents(limit: Int = 30) async throws -> [SocialEvent] {
        let nowISO = ISO8601DateFormatter().string(from: Date())
        return try await client
            .from("social_events")
            .select(Self.columns)
            .eq("status", value: "published")
            .eq("visibility", value: "public")
            .gte("end_at", value: nowISO)
            .order("start_at", ascending: true)
            .limit(limit)
            .execute()
            .value
    }

    /// A single event by slug (used when drilling in from a club page).
    func event(slug: String) async throws -> SocialEvent {
        try await client.from("social_events").select(Self.columns)
            .eq("slug", value: slug).single().execute().value
    }

    /// Active (non-cancelled) registration count for an event.
    func registrationCount(eventID: UUID) async throws -> Int {
        let response = try await client
            .from("event_registrations")
            .select("id", head: true, count: .exact)
            .eq("event_id", value: eventID)
            .neq("status", value: "cancelled")
            .execute()
        return response.count ?? 0
    }

    /// Logged matches within a session (shares the ClubMatch shape — same RPC
    /// columns). Mirrors web `list_social_event_matches`.
    func matches(eventID: UUID, limit: Int = 50) async -> [ClubMatch] {
        struct Params: Encodable { let p_event_id: String; let p_limit: Int }
        return (try? await client.rpc("list_social_event_matches",
            params: Params(p_event_id: eventID.uuidString.lowercased(), p_limit: limit)).execute().value) ?? []
    }

    /// Public roster (active registrations), newest first.
    func roster(eventID: UUID, limit: Int = 50) async -> [SocialRosterEntry] {
        (try? await client.from("event_registrations")
            .select("id, display_name, self_rated_level")
            .eq("event_id", value: eventID).neq("status", value: "cancelled")
            .order("registered_at", ascending: true).limit(limit).execute().value) ?? []
    }

    // MARK: Người chơi tự quản lý đăng ký (magic token — web /dang-ky/:token)

    /// RPC read-only `get_registration_by_token` — join event + payment vào 1 dòng.
    func registrationByToken(_ token: String) async throws -> PlayerRegistrationInfo? {
        struct Params: Encodable { let p_magic_token: String }
        let rows: [PlayerRegistrationInfo] = try await client
            .rpc("get_registration_by_token", params: Params(p_magic_token: token))
            .execute().value
        return rows.first
    }

    /// Edge fn `cancel-registration` (bearer = magic token).
    func cancelRegistration(token: String, reason: String?) async throws {
        struct Body: Encodable { let magic_token: String; let reason: String? }
        struct Resp: Decodable { let ok: Bool?; let code: String? }
        let resp: Resp = try await client.functions.invoke(
            "cancel-registration",
            options: FunctionInvokeOptions(body: Body(magic_token: token, reason: reason)))
        if let code = resp.code { throw SocialFlowError(code: code) }
    }

    /// Edge fn `reactivate-registration` — đăng ký lại khi còn chỗ.
    func reactivateRegistration(token: String) async throws {
        struct Body: Encodable { let magic_token: String }
        struct Resp: Decodable { let ok: Bool?; let code: String? }
        let resp: Resp = try await client.functions.invoke(
            "reactivate-registration",
            options: FunctionInvokeOptions(body: Body(magic_token: token)))
        if let code = resp.code { throw SocialFlowError(code: code) }
    }

    /// Edge fn `mark-payment-claimed` — người chơi báo đã chuyển khoản.
    func markPaymentClaimed(orderID: UUID, token: String) async throws {
        struct Body: Encodable { let order_id: String; let magic_token: String }
        struct Resp: Decodable { let ok: Bool?; let code: String? }
        let resp: Resp = try await invoke(
            "mark-payment-claimed",
            body: Body(order_id: orderID.uuidString.lowercased(), magic_token: token))
        if let code = resp.code { throw SocialFlowError(code: code) }
        guard resp.ok == true else { throw SocialFlowError(code: "invalid_server_response") }
    }

    /// Registration counts for several events at once (parallel head-counts).
    func registrationCounts(eventIDs: [UUID]) async -> [UUID: Int] {
        await withTaskGroup(of: (UUID, Int).self) { group in
            for id in eventIDs {
                group.addTask { (id, (try? await self.registrationCount(eventID: id)) ?? 0) }
            }
            var out: [UUID: Int] = [:]
            for await (id, count) in group { out[id] = count }
            return out
        }
    }
}
