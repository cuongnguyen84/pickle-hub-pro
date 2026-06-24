import Foundation
import Supabase

/// Fetches + mutates the unified notifications inbox. Port of
/// `useUnifiedNotifications` — both tables are user-scoped via RLS, so no
/// explicit user filter is needed for reads beyond what RLS enforces, but we
/// pass it anyway to match the web queries.
struct NotificationRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }
    private static let listLimit = 30

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    /// Merge both tables, newest first.
    func fetch() async throws -> [AppNotification] {
        guard let uid = await currentUserID() else { return [] }

        async let legacy: [LegacyNotificationRow] = client
            .from("notifications")
            .select("id, type, title, message, related_id, is_read, created_at")
            .eq("user_id", value: uid)
            .order("created_at", ascending: false)
            .limit(Self.listLimit).execute().value
        async let social: [SocialNotificationRow] = client
            .from("social_notifications")
            .select("id, type, title, body, link_url, is_read, created_at")
            .eq("user_id", value: uid)
            .order("created_at", ascending: false)
            .limit(Self.listLimit).execute().value

        let merged = (try await legacy).map { $0.unified() } + (try await social).map { $0.unified() }
        return merged.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    /// Unread count across both tables.
    func unreadCount() async -> Int {
        guard let uid = await currentUserID() else { return 0 }
        async let legacy = count(table: "notifications", uid: uid)
        async let social = count(table: "social_notifications", uid: uid)
        return await legacy + social
    }

    private func count(table: String, uid: UUID) async -> Int {
        (try? await client.from(table).select("id", head: true, count: .exact)
            .eq("user_id", value: uid).eq("is_read", value: false).execute().count) ?? 0
    }

    private struct ReadUpdate: Encodable { let is_read = true }

    func markRead(_ notification: AppNotification) async {
        let table = notification.source == .legacy ? "notifications" : "social_notifications"
        try? await client.from(table).update(ReadUpdate()).eq("id", value: notification.id).execute()
    }

    func markAllRead() async {
        guard let uid = await currentUserID() else { return }
        try? await client.from("notifications").update(ReadUpdate())
            .eq("user_id", value: uid).eq("is_read", value: false).execute()
        try? await client.from("social_notifications").update(ReadUpdate())
            .eq("user_id", value: uid).eq("is_read", value: false).execute()
    }
}
