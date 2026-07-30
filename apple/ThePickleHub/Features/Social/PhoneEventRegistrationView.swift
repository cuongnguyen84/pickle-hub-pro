import SwiftUI

/// Native guest registration using phone OTP, Turnstile and VietQR payment.
struct PhoneEventRegistrationView: View {
    let event: SocialEvent
    @Environment(\.dismiss) private var dismiss
    @State private var phone = ""
    @State private var email = ""
    @State private var name = ""
    @State private var code = ""
    @State private var selectedSlotID: String?
    @State private var slotCounts: [String: Int] = [:]
    @State private var sent = false
    @State private var busy = false
    @State private var message: String?
    @State private var turnstileToken: String?
    @State private var turnstileGeneration = 0
    @State private var completedToken: String?
    @State private var completionNotice: String?
    private let repo = SocialRepository()

    private var slots: [SocialEventSlot] { event.slots ?? [] }

    var body: some View {
        NavigationStack {
            if let completedToken {
                VStack(spacing: 0) {
                    if let completionNotice {
                        Text(completionNotice)
                            .font(TLFont.sans(12)).foregroundStyle(.orange)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12).background(Color.orange.opacity(0.08))
                    }
                    PlayerRegistrationView(token: completedToken)
                }
                .toolbar { closeToolbar }
            } else {
                registrationForm
                    .navigationTitle("Đăng ký")
                    .toolbar { closeToolbar }
            }
        }
        .task {
            guard !slots.isEmpty else { return }
            slotCounts = (try? await repo.registrationSlotCounts(eventID: event.id)) ?? [:]
        }
    }

    private var registrationForm: some View {
        Form {
            Section("Sự kiện") {
                Text(event.title).font(.headline)
                if let when = event.whenLabel { Label(when, systemImage: "calendar") }
                Label(event.priceLabel, systemImage: "ticket")
            }

            if !slots.isEmpty { slotSection }

            Section(sent ? "Xác nhận OTP" : "Thông tin người chơi") {
                TLTextField(placeholder: "Tên hiển thị", text: $name, keyboard: .default)
                    .disabled(sent)
                TLTextField(placeholder: "Email nhận mã OTP", text: $email, keyboard: .emailAddress)
                    .disabled(sent)
                TLTextField(placeholder: "Số điện thoại (+84…)", text: $phone, keyboard: .phonePad)
                    .disabled(sent)
                if sent {
                    TLTextField(placeholder: "Mã OTP 6 số", text: $code, keyboard: .numberPad)
                }
            }

            if !sent, let siteKey = AppConfig.turnstileSiteKey {
                Section("Xác minh bảo mật") {
                    TurnstileChallengeView(siteKey: siteKey,
                        onVerify: { turnstileToken = $0; message = nil },
                        onError: { turnstileToken = nil; message = String(localized: "Không thể xác minh. Hãy tải lại CAPTCHA.") })
                        .id(turnstileGeneration)
                        .frame(height: 74)
                    if turnstileToken == nil {
                        Button("Tải lại CAPTCHA") {
                            turnstileGeneration += 1
                            message = nil
                        }
                        .font(TLFont.sans(13, .medium))
                    }
                }
            } else if !sent {
                Section("Xác minh bảo mật") {
                    Label(
                        "Thiếu cấu hình Turnstile cho đăng ký native.",
                        systemImage: "exclamationmark.triangle.fill"
                    )
                    .font(TLFont.sans(13))
                    .foregroundStyle(TLColor.live)
                }
            }

            if let message {
                Section { Text(message).font(TLFont.sans(13)).foregroundStyle(TLColor.live) }
            }

            Section {
                Button(sent ? "Xác nhận OTP" : "Gửi mã OTP") {
                    Task { await submit() }
                }
                .disabled(!canSubmit)

                if sent {
                    Button("Lấy lại OTP") {
                        sent = false
                        code = ""
                        turnstileToken = nil
                        turnstileGeneration += 1
                        message = nil
                    }
                    .disabled(busy)
                }

            }
        }
    }

    private var slotSection: some View {
        Section("Chọn khung đăng ký") {
            ForEach(slots) { slot in
                let taken = slotCounts[slot.id] ?? 0
                let remaining = max(0, slot.capacity - taken)
                Button {
                    guard remaining > 0 else { return }
                    selectedSlotID = slot.id
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(slot.label).foregroundStyle(TLColor.fg)
                            Text(remaining > 0 ? "Còn \(remaining)/\(slot.capacity) chỗ" : "Đã đầy")
                                .font(TLFont.sans(12)).foregroundStyle(remaining > 0 ? TLColor.fg3 : TLColor.live)
                        }
                        Spacer()
                        if selectedSlotID == slot.id {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(TLColor.accentText)
                        }
                    }
                }
                .disabled(remaining == 0 || sent)
            }
        }
    }

    private var canSubmit: Bool {
        guard !busy else { return false }
        if sent { return code.filter(\.isNumber).count == 6 }
        let hasRequiredSlot = slots.isEmpty || selectedSlotID != nil
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let emailValid = cleanEmail.range(
            of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#,
            options: .regularExpression
        ) != nil
        return !phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            emailValid && hasRequiredSlot && turnstileToken != nil
    }

    @ToolbarContentBuilder
    private var closeToolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) { Button("Đóng") { dismiss() } }
    }

    @MainActor
    private func submit() async {
        busy = true
        message = nil
        defer { busy = false }
        do {
            if sent {
                let result = try await repo.verifyRegistrationOTP(
                    phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                    eventID: event.id,
                    code: code.filter(\.isNumber),
                    displayName: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    slotID: selectedSlotID)
                guard let token = result.magicToken, let registrationID = result.registrationID else {
                    throw SocialFlowError(code: "invalid_server_response")
                }
                try RegistrationTokenStore.save(token, eventID: event.id)

                if (event.priceVnd ?? 0) > 0 {
                    do {
                        let payment = try await repo.createPaymentOrder(
                            registrationID: registrationID, magicToken: token)
                        if payment.code == "payment_not_enabled" {
                            completionNotice = String(localized: "BTC chưa bật VietQR; bạn có thể thanh toán tại sân.")
                        }
                    } catch {
                        completionNotice = String(localized: "Đăng ký đã thành công nhưng chưa tải được thông tin thanh toán. Hãy thử làm mới màn hình.")
                    }
                }

                Haptics.success()
                completedToken = token
            } else {
                guard let token = turnstileToken else {
                    throw SocialFlowError(code: "captcha_failed")
                }
                let result = try await repo.sendRegistrationOTP(
                    phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                    eventID: event.id,
                    turnstileToken: token)
                sent = true
                turnstileToken = nil // Turnstile tokens are single-use.
                switch result.channel {
                case "email":
                    message = String(localized: "Kiểm tra email để lấy mã OTP")
                case "zalo":
                    message = String(localized: "Kiểm tra Zalo để lấy mã OTP")
                default:
                    message = String(localized: "Kiểm tra SMS để lấy mã OTP")
                }
            }
        } catch {
            message = error.localizedDescription
            if !sent {
                turnstileToken = nil
                turnstileGeneration += 1
            }
        }
    }
}
