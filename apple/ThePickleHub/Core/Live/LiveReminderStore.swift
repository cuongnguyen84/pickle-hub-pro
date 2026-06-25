import Foundation
import UserNotifications

/// Local "Nhắc tôi" reminders for upcoming livestreams. Schedules a local
/// notification ~10 min before start (or at start if sooner) and tracks which
/// streams are reminded in UserDefaults. Permission is requested lazily on the
/// first opt-in (not at app launch), per the design brief.
@MainActor
@Observable
final class LiveReminderStore {
    static let shared = LiveReminderStore()

    private let key = "live_reminders_v1"
    private let leadTime: TimeInterval = 10 * 60
    private(set) var remindedIDs: Set<String>

    private init() {
        let saved = UserDefaults.standard.stringArray(forKey: key) ?? []
        remindedIDs = Set(saved)
    }

    func isSet(_ id: UUID) -> Bool { remindedIDs.contains(id.uuidString.lowercased()) }

    /// Toggle a reminder. Returns the new state (true = reminder set). On
    /// permission denial returns false.
    @discardableResult
    func toggle(id: UUID, title: String, startAt: Date) async -> Bool {
        let key = id.uuidString.lowercased()
        if remindedIDs.contains(key) {
            cancel(key)
            return false
        }
        guard await ensureAuthorized() else { return false }
        let fireAt = max(Date().addingTimeInterval(2), startAt.addingTimeInterval(-leadTime))
        let content = UNMutableNotificationContent()
        content.title = "Sắp phát trực tiếp"
        content.body = "“\(title)” sắp bắt đầu — vào xem ngay."
        content.sound = .default
        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: fireAt)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: "live-reminder-\(key)", content: content, trigger: trigger)
        do {
            try await UNUserNotificationCenter.current().add(request)
            persist(adding: key)
            return true
        } catch {
            return false
        }
    }

    private func cancel(_ key: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["live-reminder-\(key)"])
        persist(removing: key)
    }

    private func ensureAuthorized() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return true
        case .denied: return false
        case .notDetermined:
            return (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        @unknown default: return false
        }
    }

    @MainActor private func persist(adding key: String) {
        remindedIDs.insert(key)
        UserDefaults.standard.set(Array(remindedIDs), forKey: self.key)
    }
    @MainActor private func persist(removing key: String) {
        remindedIDs.remove(key)
        UserDefaults.standard.set(Array(remindedIDs), forKey: self.key)
    }
}
