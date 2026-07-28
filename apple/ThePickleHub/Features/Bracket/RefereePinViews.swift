import SwiftUI
import UIKit

// Native port of web `RefereePinSettings` (organizer) + `RefereeJoinByPin`
// (viewer). Copy mirrors i18n `referee.pin`. Shared across all 4 formats via
// RefereePinFormat + RefereePinService.

// MARK: Organizer — enable / rotate / disable, reveal + copy

/// Rendered under referee management on the creator surfaces of every format.
struct RefereePinSettingsView: View {
    let format: RefereePinFormat
    let parentID: UUID

    private let service = RefereePinService()

    @State private var loading = true
    @State private var busy = false
    @State private var pin: String?
    @State private var isActive = false
    @State private var revealed = false
    @State private var message: String?
    @State private var confirmDisable = false
    @State private var confirmRotate = false

    private var grouped: String {
        guard let pin, pin.count == 6 else { return "" }
        return "\(pin.prefix(3)) \(pin.suffix(3))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Rectangle().fill(TLColor.border).frame(height: 1).padding(.vertical, 2)

            HStack(spacing: 10) {
                Image(systemName: "key.fill").font(.system(size: 13)).foregroundStyle(TLColor.accentText)
                Text("Cho phép vào bằng mã PIN")
                    .font(TLFont.sans(13.5, .medium)).foregroundStyle(TLColor.fg)
                Spacer()
                if loading {
                    ProgressView().controlSize(.small).tint(TLColor.fg3)
                } else {
                    Toggle("", isOn: Binding(get: { isActive }, set: { toggle($0) }))
                        .labelsHidden().tint(TLColor.accent).disabled(busy)
                }
            }

            if isActive, let pin, pin.count == 6 {
                HStack(spacing: 8) {
                    Text(revealed ? grouped : "••• •••")
                        .font(TLFont.mono(20, .semibold)).monospacedDigit()
                        .foregroundStyle(TLColor.fg).frame(minWidth: 108, alignment: .leading)
                    iconButton(revealed ? "eye.slash" : "eye") { revealed.toggle() }
                    iconButton("doc.on.doc") {
                        UIPasteboard.general.string = pin
                        message = "Đã sao chép mã PIN."
                    }
                    Button { Haptics.light(); confirmRotate = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.triangle.2.circlepath").font(.system(size: 11, weight: .bold))
                            Text("Tạo mã mới").font(TLFont.mono(10.5, .bold))
                        }
                        .foregroundStyle(TLColor.fg2).padding(.horizontal, 10).padding(.vertical, 8)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(TLColor.border, lineWidth: 1))
                    }.buttonStyle(.plain).disabled(busy)
                }
            }

            Text(isActive
                 ? "Người đã đăng nhập có thể nhập mã này để chấm điểm. Mã tự hết hiệu lực khi giải kết thúc."
                 : "Người đã đăng nhập có thể nhập mã này để chấm điểm. Họ không thể thay đổi cài đặt hay danh sách thi đấu.")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4).lineSpacing(2)

            if let message {
                Text(message).font(TLFont.sans(11.5)).foregroundStyle(TLColor.fg3)
            }
        }
        .task { await load() }
        .alert("Tắt mã PIN?", isPresented: $confirmDisable) {
            Button("Giữ mã PIN", role: .cancel) {}
            Button("Tắt mã PIN", role: .destructive) { Task { await disable() } }
        } message: {
            Text("Người mới sẽ không thể tham gia bằng mã này. Những trọng tài đã tham gia vẫn giữ quyền.")
        }
        .alert("Tạo mã PIN mới?", isPresented: $confirmRotate) {
            Button("Hủy", role: .cancel) {}
            Button("Tạo mã mới") { Task { await generate() } }
        } message: {
            Text("Mã hiện tại sẽ ngừng hoạt động ngay. Những trọng tài đã tham gia vẫn giữ quyền chấm điểm.")
        }
    }

    private func iconButton(_ systemName: String, _ action: @escaping () -> Void) -> some View {
        Button { Haptics.light(); action() } label: {
            Image(systemName: systemName).font(.system(size: 13)).foregroundStyle(TLColor.fg2)
                .frame(width: 34, height: 34)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain).disabled(busy)
    }

    private func load() async {
        loading = true
        // Non-creators get an empty result (not an error); real failures just
        // leave the switch off. Log-free by design — matches web.
        if let row = try? await service.get(format: format, parentID: parentID) {
            pin = row.pin; isActive = row.isActive
        }
        loading = false
    }

    private func toggle(_ next: Bool) {
        if next { Task { await generate() } } else { confirmDisable = true }
    }

    private func generate() async {
        guard !busy else { return }
        busy = true; message = nil
        do {
            pin = try await service.set(format: format, parentID: parentID)
            isActive = true; revealed = true
        } catch { message = "Không thể cập nhật mã PIN. Vui lòng thử lại." }
        busy = false
    }

    private func disable() async {
        guard !busy else { return }
        busy = true; message = nil
        do {
            try await service.clear(format: format, parentID: parentID)
            isActive = false; revealed = false
        } catch { message = "Không thể cập nhật mã PIN. Vui lòng thử lại." }
        busy = false
    }
}

// MARK: Viewer — enter a PIN to become a referee

/// A button that opens a sheet to redeem the organizer's PIN. Mount on each
/// format's detail view for signed-in viewers who aren't already referees.
struct RefereeJoinByPinView: View {
    let format: RefereePinFormat
    let parentID: UUID
    let isSignedIn: Bool
    /// Called after a successful redeem so the page can refresh referee state.
    let onJoined: () async -> Void

    @State private var showSheet = false

    var body: some View {
        Button {
            Haptics.light(); showSheet = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "key.fill").font(.system(size: 13))
                Text("Nhập mã trọng tài").font(TLFont.sans(14, .semibold))
            }
            .foregroundStyle(TLColor.fg).frame(maxWidth: .infinity).padding(.vertical, 12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showSheet) {
            RefereeJoinSheet(format: format, parentID: parentID, isSignedIn: isSignedIn, onJoined: onJoined)
                .presentationDetents([.height(280)])
        }
    }
}

private struct RefereeJoinSheet: View {
    let format: RefereePinFormat
    let parentID: UUID
    let isSignedIn: Bool
    let onJoined: () async -> Void

    @Environment(\.dismiss) private var dismiss
    private let service = RefereePinService()

    @State private var pin = ""
    @State private var submitting = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Nhập mã 6 số do ban tổ chức cung cấp.")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    .frame(maxWidth: .infinity, alignment: .leading)

                TextField("• • • • • •", text: Binding(
                    get: { pin },
                    set: { pin = RefereePinService.normalize($0); if error != nil { error = nil } }
                ))
                .keyboardType(.numberPad).multilineTextAlignment(.center)
                .font(TLFont.mono(26, .semibold)).monospacedDigit().tracking(6)
                .foregroundStyle(TLColor.fg).focused($focused)
                .frame(height: 58).frame(maxWidth: .infinity)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                    .strokeBorder(error != nil ? TLColor.live : TLColor.border, lineWidth: 1))

                if let error {
                    Text(error).font(TLFont.sans(12.5)).foregroundStyle(TLColor.live)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button { Task { await submit() } } label: {
                    HStack(spacing: 6) {
                        if submitting { ProgressView().controlSize(.small).tint(TLColor.accentInk) }
                        Text(submitting ? "Đang kiểm tra…" : "Bắt đầu chấm điểm")
                            .font(TLFont.sans(15, .semibold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent.opacity(pin.count == 6 && !submitting ? 1 : 0.4),
                                in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                }
                .buttonStyle(.plain).disabled(submitting || pin.count != 6)

                Spacer(minLength: 0)
            }
            .padding(20)
            .background(TLColor.bg)
            .navigationTitle("Vào chấm điểm")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) } }
            .onAppear { focused = true }
        }
    }

    private func submit() async {
        guard !submitting, pin.count == 6 else { return }
        guard isSignedIn else { error = "Đăng nhập để nhập mã trọng tài."; return }
        submitting = true; error = nil
        do {
            switch try await service.redeem(format: format, parentID: parentID, pin: pin) {
            case .ok, .alreadyReferee:
                await onJoined()
                dismiss()
            case .expired:
                error = "Giải đã kết thúc nên mã PIN không còn hiệu lực."
            case .rateLimited:
                error = "Bạn nhập sai quá nhiều lần. Thử lại sau 15 phút."
            case .invalid, .unknown:
                error = "Mã PIN không đúng. Kiểm tra lại mã do ban tổ chức cung cấp."
            }
        } catch {
            self.error = "Không thể xác nhận mã. Vui lòng thử lại."
        }
        submitting = false
    }
}
