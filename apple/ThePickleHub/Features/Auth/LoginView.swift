import SwiftUI
import AuthenticationServices

/// Sign-in entry. Apple and Google use native SDKs, then exchange their OIDC
/// token for the same Supabase session as email/password and phone OTP.
struct LoginView: View {
    @Environment(SessionStore.self) private var session

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    appleButton
                    googleButton
                    emailCard
                    signupLink
                    phoneLink
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("ThePickleHub")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(TLColor.fg)
            Text("Đăng nhập để tiếp tục")
                .font(.subheadline)
                .foregroundStyle(TLColor.accentText)
        }
    }

    private var appleButton: some View {
        SignInWithAppleButton(.continue) { request in
            session.prepareAppleSignIn(request)
        } onCompletion: { result in
            Task { await session.completeAppleSignIn(result) }
        }
        .signInWithAppleButtonStyle(.white)
        .frame(maxWidth: .infinity, minHeight: 50)
        .clipShape(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .disabled(session.isWorking)
        .accessibilityLabel("Tiếp tục với Apple")
    }

    private var googleButton: some View {
        Button {
            Task { await session.signInWithGoogle() }
        } label: {
            HStack(spacing: 8) {
                if session.isWorking { ProgressView().tint(TLColor.fg) }
                Image(systemName: "g.circle.fill")
                Text("Tiếp tục với Google").fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .foregroundStyle(TLColor.fg)
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(TLColor.border2, lineWidth: 1)
        )
        .disabled(session.isWorking)
    }

    private var emailCard: some View {
        TLCard {
            VStack(spacing: 12) {
                TLTextField(placeholder: "Email", text: $email, keyboard: .emailAddress)
                TLTextField(placeholder: "Mật khẩu", text: $password, isSecure: true)

                if let err = session.lastError {
                    Text(err).foregroundStyle(TLColor.live).font(.caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                TLPrimaryButton(title: "Đăng nhập", isLoading: session.isWorking) {
                    Task { await session.signIn(email: email, password: password) }
                }
            }
        }
    }

    private var phoneLink: some View {
        NavigationLink {
            PhoneAuthView()
        } label: {
            Text("Đăng nhập bằng số điện thoại")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(TLColor.accentText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
    }

    private var signupLink: some View {
        NavigationLink {
            SignUpView()
        } label: {
            Text("Chưa có tài khoản? Đăng ký")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TLColor.accentText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
    }

}

private struct SignUpView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var submittedEmail: String?
    @State private var validationError: String?

    private var cleanEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var canSubmit: Bool {
        !session.isWorking &&
            cleanEmail.range(
                of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#,
                options: .regularExpression
            ) != nil &&
            password.count >= 8 &&
            password == confirmation
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Đăng ký tài khoản")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(TLColor.fg)
                Text("Tạo tài khoản miễn phí để sử dụng các công cụ tổ chức.")
                    .font(.subheadline)
                    .foregroundStyle(TLColor.fg2)

                if let submittedEmail {
                    TLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("Kiểm tra email của bạn", systemImage: "envelope.badge")
                                .font(.headline)
                                .foregroundStyle(TLColor.accentText)
                            Text("Chúng tôi đã gửi liên kết xác nhận đến \(submittedEmail). Mở liên kết trong email rồi quay lại đăng nhập.")
                                .font(.subheadline)
                                .foregroundStyle(TLColor.fg2)

                            if let error = session.lastError {
                                Text(error)
                                    .foregroundStyle(TLColor.live)
                                    .font(.caption)
                            }

                            TLPrimaryButton(
                                title: "Tôi đã xác nhận email",
                                isLoading: session.isWorking
                            ) {
                                Task {
                                    if await session.signIn(
                                        email: submittedEmail,
                                        password: password
                                    ) {
                                        Haptics.success()
                                        dismiss()
                                    }
                                }
                            }

                            Button("Quay lại đăng nhập") {
                                dismiss()
                            }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(TLColor.accentText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                    }
                } else {
                    TLCard {
                        VStack(spacing: 12) {
                            TLTextField(
                                placeholder: "Email",
                                text: $email,
                                keyboard: .emailAddress
                            )
                            TLTextField(
                                placeholder: "Mật khẩu (ít nhất 8 ký tự)",
                                text: $password,
                                isSecure: true
                            )
                            TLTextField(
                                placeholder: "Nhập lại mật khẩu",
                                text: $confirmation,
                                isSecure: true
                            )

                            if let error = validationError ?? session.lastError {
                                Text(error)
                                    .foregroundStyle(TLColor.live)
                                    .font(.caption)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            TLPrimaryButton(
                                title: "Đăng ký",
                                isLoading: session.isWorking
                            ) {
                                Task { await submit() }
                            }
                            .disabled(!canSubmit)
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Bằng việc đăng ký, bạn đồng ý với:")
                            .font(.caption)
                            .foregroundStyle(TLColor.fg3)
                        HStack(spacing: 16) {
                            Link("Điều khoản sử dụng",
                                 destination: WebRoutes.base.appending(path: "terms"))
                            Link("Chính sách quyền riêng tư",
                                 destination: WebRoutes.base.appending(path: "privacy"))
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(TLColor.accentText)
                    }
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Đăng ký")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
    }

    @MainActor
    private func submit() async {
        validationError = nil
        guard password == confirmation else {
            validationError = String(localized: "Mật khẩu nhập lại không khớp.")
            return
        }
        guard password.count >= 8 else {
            validationError = String(localized: "Mật khẩu phải có ít nhất 8 ký tự.")
            return
        }
        if await session.signUp(email: cleanEmail, password: password) {
            submittedEmail = cleanEmail
        }
    }
}
