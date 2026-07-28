import Foundation
import SwiftUI

// ============================================================================
// UX-04 — local-first draft autosave cho các màn tạo giải/sự kiện (parity với
// web useAutosaveDraft, PR #407). Envelope {v, savedAt, data} lưu UserDefaults,
// key scheme `draft:<flow>:<scope>` — trùng scheme localStorage bên web.
//
// Ranh giới D3/CodeQL: các trường tài khoản ngân hàng (bankCode,
// bankAccountNumber, bankAccountName) TUYỆT ĐỐI không đưa vào snapshot —
// người dùng nhập lại sau khi khôi phục, giống web.
// ============================================================================

private let draftSchemaVersion = 1
private let draftDebounce: Duration = .milliseconds(750)

private struct DraftEnvelope<T: Codable>: Codable {
    let v: Int
    let savedAt: Date
    let data: T
}

/// Store thủ công (không @AppStorage) — debounce ~750ms, flush khi app vào
/// background, guard chống "hồi sinh" draft vừa clear (publish → clear →
/// onChange thừa không được ghi lại).
@Observable
@MainActor
final class DraftStore<T: Codable & Equatable> {
    let key: String
    private(set) var lastSavedAt: Date?

    private let defaults: UserDefaults
    private var pending: Task<Void, Never>?
    private var cleared = false
    private var clearedSnapshot: T?

    init(flow: String, scope: String = "new", defaults: UserDefaults = .standard) {
        self.key = "draft:\(flow):\(scope)"
        self.defaults = defaults
    }

    /// Đọc draft đã lưu (đúng schema version) — gọi 1 lần ở onAppear.
    func restore() -> T? {
        guard let raw = defaults.data(forKey: key),
              let env = try? JSONDecoder().decode(DraftEnvelope<T>.self, from: raw),
              env.v == draftSchemaVersion
        else { return nil }
        return env.data
    }

    /// Lưu debounce — gọi từ onChange(of: snapshot).
    func save(_ value: T) {
        guard resurrectionGuard(value) else { return }
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: draftDebounce)
            guard !Task.isCancelled else { return }
            self?.write(value)
        }
    }

    /// Ghi ngay — gọi khi scenePhase → background (BTC bị gọi ra sân, khoá máy).
    func flush(_ value: T) {
        pending?.cancel()
        guard resurrectionGuard(value) else { return }
        write(value)
    }

    /// Xoá draft (sau khi tạo thành công, hoặc "Bắt đầu lại"). `current` =
    /// snapshot NGAY SAU khi xử lý xong (đã reset/đã tạo) — save/flush với
    /// đúng giá trị đó sẽ bị bỏ qua, đổi giá trị mới thì lưu lại bình thường.
    func clear(current: T) {
        pending?.cancel()
        cleared = true
        clearedSnapshot = current
        defaults.removeObject(forKey: key)
        lastSavedAt = nil
    }

    private func resurrectionGuard(_ value: T) -> Bool {
        if cleared {
            if value == clearedSnapshot { return false }
            cleared = false
            clearedSnapshot = nil
        }
        return true
    }

    private func write(_ value: T) {
        // ponytail: UserDefaults.set không throw nên không có nhánh saveFailed
        // như web (localStorage quota); encode fail chỉ xảy ra khi snapshot sai
        // kiểu — bỏ qua trong prod.
        guard let data = try? JSONEncoder().encode(
            DraftEnvelope(v: draftSchemaVersion, savedAt: Date(), data: value))
        else { return }
        defaults.set(data, forKey: key)
        lastSavedAt = Date()
    }
}

// MARK: - UI dùng chung (parity DraftAutosave.tsx)

/// Banner "Đã khôi phục bản nháp" — hiện 1 lần sau restore, có "Bắt đầu lại".
struct DraftRestoredBanner: View {
    let onStartOver: () -> Void
    @State private var dismissed = false

    var body: some View {
        if !dismissed {
            HStack(spacing: 8) {
                Image(systemName: "arrow.uturn.backward.circle")
                    .font(.system(size: 14)).foregroundStyle(TLColor.accentText)
                Text("Đã khôi phục bản nháp trên thiết bị này.")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Đã khôi phục bản nháp trên thiết bị này")
                Spacer(minLength: 4)
                Button("Bắt đầu lại") {
                    onStartOver()
                    dismissed = true
                }
                .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentText)
                .buttonStyle(.plain)
                .frame(minHeight: 44) // A11Y-02 touch target
                .accessibilityLabel("Bắt đầu lại, xoá bản nháp")
                TLIconButton(systemName: "xmark", label: "Đóng thông báo bản nháp") {
                    dismissed = true
                }
            }
            .padding(.horizontal, 12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }
}

/// Dòng "Đã lưu trên thiết bị lúc HH:mm" — đặt gần nút tạo, chiều cao cố định
/// để nút không nhảy khi text xuất hiện.
struct DraftSaveStatusLine: View {
    let savedAt: Date?

    private static let hhmm: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }()

    var body: some View {
        Text(text)
            .font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity, minHeight: 14, alignment: .leading)
            .accessibilityLabel(savedAt == nil ? "Chưa lưu bản nháp" : text)
    }

    private var text: String {
        guard let savedAt else { return " " }
        return "Đã lưu trên thiết bị lúc \(Self.hhmm.string(from: savedAt))"
    }
}
