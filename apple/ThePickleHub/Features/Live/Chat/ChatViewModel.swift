import Foundation
import Observation
import Supabase

/// Live-chat state + realtime, mirroring the web `useLiveChat`. Loads the last 50
/// messages, subscribes to `chat_messages` (INSERT/DELETE) and `chat_room_settings`
/// via Supabase realtime v2, and polls the leaderboard every 30s. Sends are
/// optimistic and reconciled against the realtime echo by `client_message_id`.
@MainActor
@Observable
final class ChatViewModel {
    let livestreamID: String
    private let repo = ChatRepository()
    private static let dec = JSONDecoder()

    var messages: [ChatMessage] = []
    var settings: ChatSettings
    var userMute: ChatMute?
    var isModerator = false
    var leaderboard: [ChatLeaderboardEntry] = []
    var isLoading = true
    var hasOlder = false

    private(set) var userID: String?
    private var displayName = "User"
    private var avatarURL: String?
    private var lastSentAt: Date?

    private var seenIDs = Set<String>()
    private var seenClientIDs = Set<String>()
    private var channel: RealtimeChannelV2?
    private var tasks: [Task<Void, Never>] = []

    init(livestreamID: String) {
        self.livestreamID = livestreamID
        self.settings = .defaultFor(livestreamID)
    }

    // MARK: Derived

    var isSignedIn: Bool { userID != nil }
    var isMuted: Bool { userMute?.isActive == true }
    var canSend: Bool { isSignedIn && settings.isChatEnabled && !isMuted }

    /// Seconds left before this user may send again under slow mode.
    var slowModeRemaining: Int {
        guard settings.slowModeSeconds > 0, let last = lastSentAt else { return 0 }
        return max(0, settings.slowModeSeconds - Int(Date().timeIntervalSince(last)))
    }

    func chatterRank(_ uid: String) -> Int? {
        leaderboard.first { $0.userID == uid && $0.rank <= 3 }?.rank
    }

    // MARK: Load

    func load() async {
        userID = await repo.currentUserID()

        async let recentTask = repo.recentMessages(livestreamID: livestreamID)
        async let settingsTask = repo.settings(livestreamID: livestreamID)
        let msgs = await recentTask
        settings = await settingsTask

        for m in msgs {
            seenIDs.insert(m.id)
            if let c = m.clientMessageID { seenClientIDs.insert(c) }
        }
        messages = msgs
        hasOlder = msgs.count >= ChatRepository.messagesLimit
        isLoading = false

        if let uid = userID {
            async let muteTask = repo.myMute(livestreamID: livestreamID, userID: uid)
            async let modTask = repo.canModerate(livestreamID: livestreamID, userID: uid)
            async let profTask = repo.profile(userID: uid)
            userMute = await muteTask
            isModerator = await modTask
            let p = await profTask
            displayName = p.displayName ?? "User"
            avatarURL = p.avatarURL
        }

        await refreshLeaderboard()
        startRealtime()
        startLeaderboardPolling()
    }

    func stop() {
        tasks.forEach { $0.cancel() }
        tasks = []
        if let ch = channel {
            Task { await SupabaseManager.shared.client.removeChannel(ch) }
        }
        channel = nil
    }

    // MARK: Realtime

    private func startRealtime() {
        let ch = SupabaseManager.shared.client.channel("chat:\(livestreamID)")
        channel = ch
        let filter = "livestream_id=eq.\(livestreamID)"
        let inserts = ch.postgresChange(InsertAction.self, schema: "public", table: "chat_messages", filter: filter)
        let deletes = ch.postgresChange(DeleteAction.self, schema: "public", table: "chat_messages", filter: filter)
        let settingsStream = ch.postgresChange(AnyAction.self, schema: "public", table: "chat_room_settings", filter: filter)

        tasks += [
            Task { [weak self] in
                for await change in inserts {
                    if let m = try? change.decodeRecord(as: ChatMessage.self, decoder: Self.dec) {
                        self?.handleInsert(m)
                    }
                }
            },
            Task { [weak self] in
                for await change in deletes {
                    if let id = change.oldRecord["id"]?.stringValue { self?.handleDelete(id) }
                }
            },
            Task { [weak self] in
                for await action in settingsStream { self?.handleSettings(action) }
            },
            Task { await ch.subscribe() },
        ]
    }

    private func handleInsert(_ m: ChatMessage) {
        // Reconcile with our own optimistic row, if any.
        if let cid = m.clientMessageID,
           let i = messages.firstIndex(where: { $0.clientMessageID == cid && $0.id.hasPrefix("pending-") }) {
            messages[i] = m
            seenIDs.insert(m.id)
            return
        }
        guard !seenIDs.contains(m.id) else { return }
        if let cid = m.clientMessageID, seenClientIDs.contains(cid),
           messages.contains(where: { $0.clientMessageID == cid }) { return }
        seenIDs.insert(m.id)
        if let cid = m.clientMessageID { seenClientIDs.insert(cid) }
        messages.append(m)
    }

    private func handleDelete(_ id: String) {
        seenIDs.remove(id)
        messages.removeAll { $0.id == id }
    }

    private func handleSettings(_ action: AnyAction) {
        switch action {
        case .insert(let a):
            if let s = try? a.decodeRecord(as: ChatSettings.self, decoder: Self.dec) { settings = s }
        case .update(let a):
            if let s = try? a.decodeRecord(as: ChatSettings.self, decoder: Self.dec) { settings = s }
        default:
            break
        }
    }

    // MARK: Leaderboard

    private func startLeaderboardPolling() {
        tasks.append(Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                if Task.isCancelled { return }
                await self?.refreshLeaderboard()
            }
        })
    }

    func refreshLeaderboard() async {
        leaderboard = await repo.leaderboard(livestreamID: livestreamID)
    }

    // MARK: Send

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let uid = userID, !trimmed.isEmpty, trimmed.count <= 500, canSend, slowModeRemaining == 0 else { return }

        let cid = "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(8))"
        let tempID = "pending-\(cid)"
        seenClientIDs.insert(cid)
        messages.append(ChatMessage(
            id: tempID, livestreamID: livestreamID, userID: uid, displayName: displayName,
            avatarURL: avatarURL, message: trimmed,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            clientMessageID: cid, pending: true, failed: false
        ))
        lastSentAt = Date()

        do {
            try await repo.send(livestreamID: livestreamID, userID: uid, displayName: displayName,
                                 avatarURL: avatarURL, message: trimmed, clientMessageID: cid)
            if let i = messages.firstIndex(where: { $0.id == tempID }) { messages[i].pending = false }
        } catch {
            if let i = messages.firstIndex(where: { $0.id == tempID }) {
                messages[i].pending = false
                messages[i].failed = true
            }
            seenClientIDs.remove(cid)
            lastSentAt = nil
        }
    }

    func retry(_ m: ChatMessage) async {
        messages.removeAll { $0.id == m.id }
        if let c = m.clientMessageID { seenClientIDs.remove(c) }
        await send(m.message)
    }

    func loadOlder() async {
        guard let oldest = messages.first else { return }
        let older = await repo.olderMessages(livestreamID: livestreamID, before: oldest.createdAt)
        let fresh = older.filter { !seenIDs.contains($0.id) }
        fresh.forEach { seenIDs.insert($0.id); if let c = $0.clientMessageID { seenClientIDs.insert(c) } }
        messages.insert(contentsOf: fresh, at: 0)
        hasOlder = older.count >= ChatRepository.messagesLimit
    }

    // MARK: Moderation

    func delete(_ m: ChatMessage) async {
        if await repo.delete(messageID: m.id) { handleDelete(m.id) }
    }

    func mute(userID uid: String, minutes: Int) async {
        _ = await repo.mute(livestreamID: livestreamID, userID: uid, minutes: minutes, reason: nil)
    }

    func toggleChatEnabled() async {
        let target = !settings.isChatEnabled
        if await repo.updateSettings(livestreamID: livestreamID, isChatEnabled: target, slowModeSeconds: settings.slowModeSeconds) {
            settings.isChatEnabled = target
        }
    }

    func setSlowMode(_ seconds: Int) async {
        if await repo.updateSettings(livestreamID: livestreamID, isChatEnabled: settings.isChatEnabled, slowModeSeconds: seconds) {
            settings.slowModeSeconds = seconds
        }
    }
}
