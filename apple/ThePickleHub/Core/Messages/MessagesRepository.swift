import Foundation
import Supabase

/// In-app direct messages — mirror of web `Messages.tsx` (my_conversations /
/// messages / send_message / mark_conversation_read). Poll-based like web
/// (15s inbox, 4s open thread); no realtime channel needed for parity.
struct MessagesRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> String? {
        try? await client.auth.session.user.id.uuidString.lowercased()
    }

    func myConversations() async -> [DMConversation] {
        (try? await client.rpc("my_conversations").execute().value) ?? []
    }

    func messages(conversationID: String) async -> [DMMessage] {
        (try? await client.from("messages")
            .select("id, conversation_id, sender_id, body, created_at")
            .eq("conversation_id", value: conversationID)
            .order("created_at", ascending: true)
            .limit(500)
            .execute().value) ?? []
    }

    func sendMessage(conversationID: String, body: String) async throws {
        try await client.rpc("send_message",
                             params: ["p_conv": conversationID, "p_body": body]).execute()
    }

    func markRead(conversationID: String) async {
        _ = try? await client.rpc("mark_conversation_read", params: ["p_conv": conversationID]).execute()
    }
}
