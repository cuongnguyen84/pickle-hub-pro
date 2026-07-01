import Foundation
import Supabase

/// REST + RPC layer for live chat, mirroring the web `useLiveChat` hooks. Realtime
/// subscription lives in `ChatViewModel`; this type does the one-shot reads/writes.
struct ChatRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    static let messagesLimit = 50

    func currentUserID() async -> String? {
        try? await client.auth.session.user.id.uuidString.lowercased()
    }

    // MARK: Reads

    /// Newest `limit` messages, returned oldest→newest for display.
    func recentMessages(livestreamID: String, limit: Int = messagesLimit) async -> [ChatMessage] {
        do {
            let rows: [ChatMessage] = try await client
                .from("chat_messages")
                .select()
                .eq("livestream_id", value: livestreamID)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.reversed()
        } catch { return [] }
    }

    /// Messages strictly older than `before` (created_at), oldest→newest.
    func olderMessages(livestreamID: String, before: String, limit: Int = messagesLimit) async -> [ChatMessage] {
        do {
            let rows: [ChatMessage] = try await client
                .from("chat_messages")
                .select()
                .eq("livestream_id", value: livestreamID)
                .lt("created_at", value: before)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.reversed()
        } catch { return [] }
    }

    func settings(livestreamID: String) async -> ChatSettings {
        do {
            let rows: [ChatSettings] = try await client
                .from("chat_room_settings")
                .select()
                .eq("livestream_id", value: livestreamID)
                .limit(1)
                .execute().value
            return rows.first ?? .defaultFor(livestreamID)
        } catch { return .defaultFor(livestreamID) }
    }

    func myMute(livestreamID: String, userID: String) async -> ChatMute? {
        do {
            let rows: [ChatMute] = try await client
                .from("chat_mutes")
                .select()
                .eq("livestream_id", value: livestreamID)
                .eq("user_id", value: userID)
                .limit(1)
                .execute().value
            let row = rows.first
            return (row?.isActive == true) ? row : nil
        } catch { return nil }
    }

    func canModerate(livestreamID: String, userID: String) async -> Bool {
        struct Params: Encodable { let _livestream_id: String; let _user_id: String }
        do {
            let ok: Bool = try await client
                .rpc("can_moderate_chat", params: Params(_livestream_id: livestreamID, _user_id: userID))
                .execute().value
            return ok
        } catch { return false }
    }

    func leaderboard(livestreamID: String, limit: Int = 10) async -> [ChatLeaderboardEntry] {
        struct Params: Encodable { let _livestream_id: String; let _limit: Int }
        do {
            return try await client
                .rpc("get_chat_leaderboard", params: Params(_livestream_id: livestreamID, _limit: limit))
                .execute().value
        } catch { return [] }
    }

    func profile(userID: String) async -> (displayName: String?, avatarURL: String?) {
        struct Row: Decodable { let display_name: String?; let avatar_url: String? }
        do {
            let rows: [Row] = try await client
                .from("profiles")
                .select("display_name, avatar_url")
                .eq("id", value: userID)
                .limit(1)
                .execute().value
            return (rows.first?.display_name, rows.first?.avatar_url)
        } catch { return (nil, nil) }
    }

    // MARK: Writes

    /// Insert a message. Slow-mode / mute are enforced server-side (RLS); a thrown
    /// error is surfaced so the UI can flag the optimistic row as failed.
    func send(livestreamID: String, userID: String, displayName: String,
              avatarURL: String?, message: String, clientMessageID: String) async throws {
        struct Payload: Encodable {
            let livestream_id: String
            let user_id: String
            let display_name: String
            let avatar_url: String?
            let message: String
            let client_message_id: String
        }
        try await client.from("chat_messages").insert(Payload(
            livestream_id: livestreamID, user_id: userID, display_name: displayName,
            avatar_url: avatarURL, message: message, client_message_id: clientMessageID
        )).execute()
    }

    func delete(messageID: String) async -> Bool {
        do { try await client.from("chat_messages").delete().eq("id", value: messageID).execute(); return true }
        catch { return false }
    }

    func updateSettings(livestreamID: String, isChatEnabled: Bool, slowModeSeconds: Int) async -> Bool {
        struct Payload: Encodable {
            let livestream_id: String
            let is_chat_enabled: Bool
            let slow_mode_seconds: Int
        }
        do {
            try await client.from("chat_room_settings").upsert(Payload(
                livestream_id: livestreamID, is_chat_enabled: isChatEnabled, slow_mode_seconds: slowModeSeconds
            )).execute()
            return true
        } catch { return false }
    }

    func mute(livestreamID: String, userID: String, minutes: Int, reason: String?) async -> Bool {
        struct Payload: Encodable {
            let livestream_id: String
            let user_id: String
            let muted_until: String
            let reason: String?
        }
        let until = ISO8601DateFormatter().string(from: Date().addingTimeInterval(TimeInterval(minutes * 60)))
        do {
            try await client.from("chat_mutes").upsert(Payload(
                livestream_id: livestreamID, user_id: userID, muted_until: until, reason: reason
            )).execute()
            return true
        } catch { return false }
    }
}
