import Foundation
import Supabase

// ============================================================================
// SocialOrganizerRepository — tổ chức sự kiện giao lưu (BTC).
// Port từ web: useEventRegistrations + SocialEventRoster (patch actions),
// SocialEventMatchmaking (save/restore social_event_matches), useEventLive
// (start/submit-match-score), Create/EditSocialEvent (RPC + patch + cancel),
// useEventOwnership (creator / admin / club manager).
// ============================================================================

/// Một dòng event_registrations đầy đủ (organizer thấy mọi cột nhờ RLS).
struct EventRegistration: Decodable, Identifiable, Equatable {
    let id: UUID
    let eventID: UUID
    let profileID: UUID?
    let phone: String?
    let displayName: String
    let selfRatedLevel: Double?
    var status: String            // registered | checked_in | cancelled | no_show
    var paymentStatus: String     // unpaid | paid | refunded | pending_payment
    let paidAt: String?
    var notes: String?
    let registeredAt: String
    let registrationSource: String // self | proxy | manual
    let registeredByProfileID: UUID?
    let internalNotes: String?

    enum CodingKeys: String, CodingKey {
        case id, phone, status, notes
        case eventID = "event_id"
        case profileID = "profile_id"
        case displayName = "display_name"
        case selfRatedLevel = "self_rated_level"
        case paymentStatus = "payment_status"
        case paidAt = "paid_at"
        case registeredAt = "registered_at"
        case registrationSource = "registration_source"
        case registeredByProfileID = "registered_by_profile_id"
        case internalNotes = "internal_notes"
    }
}

/// payment_orders của một sự kiện (map theo registration_id).
struct EventPaymentOrder: Decodable, Identifiable, Equatable {
    let id: UUID
    let registrationID: UUID
    let amountVnd: Int?
    let referenceCode: String?
    let playerClaimedPaid: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case registrationID = "registration_id"
        case amountVnd = "amount_vnd"
        case referenceCode = "reference_code"
        case playerClaimedPaid = "player_claimed_paid"
    }
}

/// social_event_matches — lịch thi đấu live (khác với logged matches DUPR).
struct SocialLiveMatch: Decodable, Identifiable, Equatable {
    let id: UUID
    let eventID: UUID
    let round: Int
    let court: Int
    let teamAPlayer1ID: UUID?
    let teamAPlayer2ID: UUID?
    let teamBPlayer1ID: UUID?
    let teamBPlayer2ID: UUID?
    let teamAScore: Int?
    let teamBScore: Int?
    let status: String            // scheduled | in_progress | completed
    let confirmedByTeamA: Bool?
    let confirmedByTeamB: Bool?
    let winningTeam: String?      // a | b

    enum CodingKeys: String, CodingKey {
        case id, round, court, status
        case eventID = "event_id"
        case teamAPlayer1ID = "team_a_player1_id"
        case teamAPlayer2ID = "team_a_player2_id"
        case teamBPlayer1ID = "team_b_player1_id"
        case teamBPlayer2ID = "team_b_player2_id"
        case teamAScore = "team_a_score"
        case teamBScore = "team_b_score"
        case confirmedByTeamA = "confirmed_by_team_a"
        case confirmedByTeamB = "confirmed_by_team_b"
        case winningTeam = "winning_team"
    }

    func hasPlayer(_ profileID: UUID) -> Bool {
        [teamAPlayer1ID, teamAPlayer2ID, teamBPlayer1ID, teamBPlayer2ID].contains(profileID)
    }
}

/// event_payment_config (prefill màn sửa sự kiện trả phí).
struct EventPaymentConfig: Decodable, Equatable {
    let bankCode: String?
    let bankAccountNumber: String?
    let bankAccountName: String?

    enum CodingKeys: String, CodingKey {
        case bankCode = "bank_code"
        case bankAccountNumber = "bank_account_number"
        case bankAccountName = "bank_account_name"
    }
}

struct SocialOrganizerRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    // MARK: Quyền tổ chức (web useEventOwnership: creator OR admin OR club manager)

    func canManage(event: SocialEvent) async -> Bool {
        guard let uid = await currentUserID() else { return false }
        if event.createdBy == uid { return true }
        struct RoleRow: Decodable { let role: String }
        let roles: [RoleRow] = (try? await client.from("user_roles")
            .select("role").eq("user_id", value: uid).execute().value) ?? []
        if roles.contains(where: { $0.role == "admin" }) { return true }
        guard let clubID = event.clubID else { return false }
        struct MgrRow: Decodable { let club_id: UUID }
        let mgr: [MgrRow] = (try? await client.from("club_managers")
            .select("club_id").eq("club_id", value: clubID)
            .eq("profile_id", value: uid).limit(1).execute().value) ?? []
        return !mgr.isEmpty
    }

    // MARK: Roster

    private static let regColumns = """
        id, event_id, profile_id, phone, display_name, self_rated_level, \
        status, payment_status, paid_at, notes, registered_at, \
        registration_source, registered_by_profile_id, internal_notes
        """

    /// Toàn bộ đăng ký chưa hủy, cũ nhất trước (khớp web useEventRegistrations).
    func registrations(eventID: UUID) async throws -> [EventRegistration] {
        try await client.from("event_registrations").select(Self.regColumns)
            .eq("event_id", value: eventID).neq("status", value: "cancelled")
            .order("registered_at", ascending: true).execute().value
    }

    func setRegistrationStatus(id: UUID, status: String) async throws {
        try await client.from("event_registrations")
            .update(["status": status]).eq("id", value: id).execute()
    }

    func setRegistrationPaid(id: UUID, paid: Bool) async throws {
        struct Patch: Encodable {
            let payment_status: String
            let paid_at: String?
        }
        let patch = Patch(payment_status: paid ? "paid" : "unpaid",
                          paid_at: paid ? ISO8601DateFormatter().string(from: Date()) : nil)
        try await client.from("event_registrations")
            .update(patch).eq("id", value: id).execute()
    }

    func setRegistrationNotes(id: UUID, notes: String?) async throws {
        struct Patch: Encodable { let notes: String? }
        try await client.from("event_registrations")
            .update(Patch(notes: notes)).eq("id", value: id).execute()
    }

    /// payment_orders của sự kiện (join server-side qua event_registrations).
    func paymentOrders(eventID: UUID) async -> [EventPaymentOrder] {
        (try? await client.from("payment_orders")
            .select("id, registration_id, amount_vnd, reference_code, player_claimed_paid, event_registrations!inner(event_id)")
            .eq("event_registrations.event_id", value: eventID)
            .execute().value) ?? []
    }

    /// BTC thêm người ngoài luồng OTP (edge fn add-registration-direct, mode=manual).
    /// Trả về link /dang-ky/<token> để chia sẻ.
    func manualAddRegistration(
        eventID: UUID, name: String, phone: String?,
        selfRating: Double?, initialPaymentStatus: String, internalNotes: String?
    ) async throws -> String {
        struct Body: Encodable {
            let event_id: String
            let guest_name: String
            let mode: String
            let organizer_auth_token: String
            let guest_phone: String?
            let guest_self_rating: Double?
            let initial_payment_status: String
            let internal_notes: String?
        }
        struct Resp: Decodable { let success: Bool?; let recovery_url: String? }
        let token = try await client.auth.session.accessToken
        let resp: Resp = try await client.functions.invoke(
            "add-registration-direct",
            options: FunctionInvokeOptions(body: Body(
                event_id: eventID.uuidString.lowercased(),
                guest_name: name, mode: "manual", organizer_auth_token: token,
                guest_phone: phone?.nonEmpty, guest_self_rating: selfRating,
                initial_payment_status: initialPaymentStatus,
                internal_notes: internalNotes?.nonEmpty
            ))
        )
        guard resp.success == true, let url = resp.recovery_url else {
            throw NSError(domain: "SocialOrganizer", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: String(localized: "Không thêm được đăng ký")])
        }
        return url
    }

    // MARK: Lịch thi đấu (social_event_matches)

    private static let matchColumns = """
        id, event_id, round, court, team_a_player1_id, team_a_player2_id, \
        team_b_player1_id, team_b_player2_id, team_a_score, team_b_score, \
        status, confirmed_by_team_a, confirmed_by_team_b, winning_team
        """

    func liveMatches(eventID: UUID) async throws -> [SocialLiveMatch] {
        try await client.from("social_event_matches").select(Self.matchColumns)
            .eq("event_id", value: eventID)
            .order("round", ascending: true).order("court", ascending: true)
            .execute().value
    }

    func matchCount(eventID: UUID) async -> Int {
        let resp = try? await client.from("social_event_matches")
            .select("id", head: true, count: .exact)
            .eq("event_id", value: eventID).execute()
        return resp?.count ?? 0
    }

    struct NewMatchRow: Encodable {
        let event_id: String
        let round: Int
        let court: Int
        let team_a_player1_id: String
        let team_a_player2_id: String
        let team_b_player1_id: String
        let team_b_player2_id: String
        let status: String
    }

    /// Ghi đè lịch: DELETE hết rồi INSERT (khớp web persistSchedule).
    func saveSchedule(eventID: UUID, rows: [NewMatchRow]) async throws {
        try await client.from("social_event_matches")
            .delete().eq("event_id", value: eventID).execute()
        guard !rows.isEmpty else { return }
        try await client.from("social_event_matches").insert(rows).execute()
    }

    /// scheduled → in_progress (idempotent nhờ guard eq status).
    func startMatch(id: UUID) async throws {
        try await client.from("social_event_matches")
            .update(["status": "in_progress"])
            .eq("id", value: id).eq("status", value: "scheduled").execute()
    }

    /// BTC chốt tỉ số một chiều qua edge fn submit-match-score (organizer_override).
    func submitScoreAsOrganizer(matchID: UUID, teamA: Int, teamB: Int) async throws {
        struct Body: Encodable {
            let match_id: String
            let team_a_score: Int
            let team_b_score: Int
            let organizer_override: Bool
        }
        struct Resp: Decodable { let ok: Bool?; let status: String? }
        let resp: Resp = try await client.functions.invoke(
            "submit-match-score",
            options: FunctionInvokeOptions(body: Body(
                match_id: matchID.uuidString.lowercased(),
                team_a_score: teamA, team_b_score: teamB, organizer_override: true
            ))
        )
        guard resp.ok == true else {
            throw NSError(domain: "SocialOrganizer", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: String(localized: "Không ghi được tỉ số")])
        }
    }

    /// DUPR đôi cho danh sách profile (ưu tiên hơn self_rated_level khi xếp cặp).
    func duprDoubles(profileIDs: [UUID]) async -> [UUID: Double] {
        guard !profileIDs.isEmpty else { return [:] }
        struct Row: Decodable { let id: UUID; let dupr_doubles: Double? }
        let rows: [Row] = (try? await client.from("profiles")
            .select("id, dupr_doubles")
            .in("id", values: profileIDs).execute().value) ?? []
        return Dictionary(rows.compactMap { r in r.dupr_doubles.map { (r.id, $0) } },
                          uniquingKeysWith: { a, _ in a })
    }

    // MARK: Tạo / sửa / hủy sự kiện

    struct EventPayload: Encodable {
        let club_id: String
        let slug: String
        let title_vi: String
        let description_vi: String?
        let start_at: String
        let end_at: String
        let location_text: String?
        let court_count: Int
        let max_players: Int
        let price_vnd: Int
        let zalo_group_url: String?
        let ball_type: String?
        let free_perks: [String]?
        let status: String            // published | draft
        let visibility: String        // public | club_only
        let requires_prepayment: Bool
        let prepayment_deadline_hours: Int?
        let slots: [String]           // ponytail: native chưa hỗ trợ nhóm đăng ký (slots) — luôn rỗng; thêm SlotManager khi cần
    }

    struct PaymentPayload: Encodable {
        let bank_code: String
        let bank_account_number: String
        let bank_account_name: String
    }

    /// RPC atomic của web PR51: social_events + event_payment_config trong 1 transaction.
    func createEvent(_ event: EventPayload, payment: PaymentPayload?) async throws {
        struct Params: Encodable {
            let p_event: EventPayload
            let p_payment: PaymentPayload?

            private enum CodingKeys: String, CodingKey {
                case p_event, p_payment
            }

            /// The production RPC always has two JSONB arguments. For a free
            /// event payment is nil, but the key must still be sent as JSON
            /// null or PostgREST tries to resolve a one-argument overload.
            func encode(to encoder: Encoder) throws {
                var container = encoder.container(keyedBy: CodingKeys.self)
                try container.encode(p_event, forKey: .p_event)
                if let p_payment {
                    try container.encode(p_payment, forKey: .p_payment)
                } else {
                    try container.encodeNil(forKey: .p_payment)
                }
            }
        }
        try await client.rpc("create_social_event_with_payment",
                             params: Params(p_event: event, p_payment: payment)).execute()
    }

    func slugTaken(_ slug: String) async -> Bool {
        struct Row: Decodable { let id: UUID }
        let rows: [Row] = (try? await client.from("social_events")
            .select("id").eq("slug", value: slug).limit(1).execute().value) ?? []
        return !rows.isEmpty
    }

    struct EventPatch: Encodable {
        let title_vi: String
        let description_vi: String?
        let start_at: String
        let end_at: String
        let location_text: String?
        let court_count: Int
        let max_players: Int
        let zalo_group_url: String?
        let ball_type: String?
        let visibility: String
        let price_vnd: Int
        let requires_prepayment: Bool
        let prepayment_deadline_hours: Int?
        let free_perks: [String]
        // KHÔNG có `slots` — web edit ghi lại slots nhưng native chưa có UI
        // slots, bỏ key để không xóa nhóm đăng ký hiện có.
        //
        // LUẬT (gate T4b, đo thật 28/07): Encodable bỏ key khi Optional nil
        // nhưng GỬI `[]` khi mảng rỗng → PostgREST ghi đè. Mọi field thêm vào
        // struct này BẮT BUỘC có dòng gán tương ứng trong
        // SocialEventFormModel.applyExisting(), và SocialEventFormGateTests
        // khoá danh sách key để ai thêm key mới phải đi qua luật này.
    }

    func updateEvent(id: UUID, patch: EventPatch, payment: PaymentPayload?) async throws {
        try await client.from("social_events").update(patch).eq("id", value: id).execute()
        if let payment {
            struct Upsert: Encodable {
                let event_id: String
                let bank_code: String
                let bank_account_number: String
                let bank_account_name: String
                let enabled: Bool
            }
            try await client.from("event_payment_config").upsert(Upsert(
                event_id: id.uuidString.lowercased(),
                bank_code: payment.bank_code,
                bank_account_number: payment.bank_account_number,
                bank_account_name: payment.bank_account_name,
                enabled: true
            )).execute()
        }
    }

    func paymentConfig(eventID: UUID) async -> EventPaymentConfig? {
        try? await client.from("event_payment_config")
            .select("bank_code, bank_account_number, bank_account_name")
            .eq("event_id", value: eventID).single().execute().value
    }

    /// Hủy sự kiện (RPC cascade sang registrations, khớp web).
    func cancelEvent(id: UUID, reason: String?) async throws {
        struct Params: Encodable { let p_event_id: String; let p_reason: String? }
        try await client.rpc("cancel_social_event", params: Params(
            p_event_id: id.uuidString.lowercased(), p_reason: reason?.nonEmpty
        )).execute()
    }

    /// Sự kiện của một CLB, mới nhất trước (bản nhẹ của web useClubEventsManage).
    func clubEvents(clubID: UUID, limit: Int = 50) async -> [SocialEvent] {
        (try? await client.from("social_events")
            .select("id, slug, title_vi, title_en, description_vi, start_at, end_at, location_text, court_count, max_players, level_min, level_max, price_vnd, zalo_group_url, ball_type, free_perks, status, created_by, club_id, visibility, requires_prepayment, prepayment_deadline_hours")
            .eq("club_id", value: clubID)
            .order("start_at", ascending: false).limit(limit).execute().value) ?? []
    }
}
