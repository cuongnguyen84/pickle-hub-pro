import SwiftUI

/// Sign-in entry. Native Google Sign-In (primary for this audience), email /
/// password, and a phone-OTP path.
struct LoginView: View {
    @Environment(SessionStore.self) private var session

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
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
            Text("Native iOS · Phase 1")
                .font(.subheadline)
                .foregroundStyle(TLColor.accentText)
        }
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
