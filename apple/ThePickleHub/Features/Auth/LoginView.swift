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

}
