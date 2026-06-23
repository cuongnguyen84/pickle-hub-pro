import SwiftUI

/// Newsletter signup, wired to the `newsletter-subscribe` edge function.
struct HomeNewsletter: View {
    @State private var email = ""
    @State private var phase: Phase = .idle

    private let repo = NewsletterRepository()

    private enum Phase: Equatable {
        case idle, sending, success(String), failure(String)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("BẢN TIN HÀNG NGÀY", systemImage: "diamond.fill")
                .font(TLFont.mono(10, .semibold)).tracking(0.8)
                .foregroundStyle(TLColor.accentText)

            Text("Tin pickleball, mỗi sáng.")
                .font(TLFont.serif(26)).foregroundStyle(TLColor.fg)

            Text("Trận đấu, phỏng vấn, phân tích — viết bởi phóng viên có mặt tại sân. Mỗi sáng thứ Tư, vào hộp thư của bạn.")
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg3)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            if case .success(let message) = phase {
                Label(message, systemImage: "checkmark.circle.fill")
                    .font(TLFont.sans(14, .medium))
                    .foregroundStyle(TLColor.accentText)
                    .padding(.top, 4)
            } else {
                HStack(spacing: 8) {
                    TextField("email@cua-ban.com", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .foregroundStyle(TLColor.fg)
                        .padding(12)
                        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))

                    Button { Task { await subscribe() } } label: {
                        Group {
                            if phase == .sending {
                                ProgressView().tint(TLColor.accentInk)
                            } else {
                                Text("Đăng ký").fontWeight(.semibold)
                            }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 12)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                        .foregroundStyle(TLColor.accentInk)
                    }
                    .disabled(phase == .sending || !email.contains("@"))
                }

                if case .failure(let message) = phase {
                    Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                }

                Text("Có thể hủy đăng ký bất cứ lúc nào.")
                    .font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
            }
        }
        .feedCard()
    }

    private func subscribe() async {
        phase = .sending
        do {
            let message = try await repo.subscribe(email: email)
            phase = .success(message.nonEmpty ?? "Đã đăng ký. Xem hộp thư của bạn.")
        } catch {
            phase = .failure(error.localizedDescription)
        }
    }
}
