import SwiftUI

/// Phone OTP sign-in via Supabase (no native SDK needed). Two steps: request a
/// code for an E.164 number, then verify the SMS code.
struct PhoneAuthView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var phone = ""
    @State private var code = ""
    @State private var codeSent = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Đăng nhập bằng số điện thoại")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(TLColor.fg)

                TLCard {
                    VStack(spacing: 12) {
                        TLTextField(placeholder: "+84…", text: $phone, keyboard: .phonePad)

                        if codeSent {
                            TLTextField(placeholder: "Mã OTP", text: $code, keyboard: .numberPad)
                        }

                        if let err = session.lastError {
                            Text(err).foregroundStyle(TLColor.live).font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        if codeSent {
                            TLPrimaryButton(title: "Xác nhận mã", isLoading: session.isWorking) {
                                Task { await session.verifyPhoneOTP(phone: phone, code: code) }
                            }
                        } else {
                            TLPrimaryButton(title: "Gửi mã OTP", isLoading: session.isWorking) {
                                Task { codeSent = await session.sendPhoneOTP(phone: phone) }
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
    }
}
