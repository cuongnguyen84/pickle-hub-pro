import SwiftUI

/// Khung chat trợ lý AI chung (edge fn site-assistant) — mở từ nút nổi ở AppTabView.
/// Hỏi–đáp + chip link (đi màn hình native nếu có, không thì mở web), kèm ngữ cảnh
/// màn hình đang xem (AssistantContextStore). "Liên hệ admin" mở form gửi
/// site-assistant { support } — thay 2 nút Messenger/Zalo của web (12/11/2026).
@Observable
@MainActor
final class AssistantViewModel {
    struct Msg: Identifiable, Equatable {
        let id = UUID()
        let role: String   // "user" | "bot"
        let text: String
        var links: [SiteAssistant.Link] = []
    }

    var messages: [Msg] = []
    var input = ""
    var busy = false
    var contactOpen = false
    var form = SiteAssistant.SupportForm()
    var formError: String?
    var sending = false
    private let threadId = UUID().uuidString.lowercased()

    var turns: [SiteAssistant.Turn] { messages.map { SiteAssistant.Turn(role: $0.role, text: $0.text) } }

    func send(page: String, tab: String, context: SiteAssistant.ScreenContext?, loggedIn: Bool) async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !busy else { return }
        input = ""
        messages.append(Msg(role: "user", text: String(text.prefix(500))))
        busy = true
        defer { busy = false }
        do {
            let r = try await SiteAssistant.send(threadId: threadId, page: page, tab: tab, context: context, loggedIn: loggedIn, turns: turns)
            messages.append(Msg(role: "bot", text: r.reply, links: r.links))
            if r.contact { openContact(email: nil) }
        } catch {
            messages.append(Msg(role: "bot", text: String(localized: "Mạng chậm hoặc trợ lý đang bận. Bạn thử lại sau nhé.")))
        }
    }

    func openContact(email: String?) {
        guard !contactOpen else { return }
        form = SiteAssistant.SupportForm(message: SiteAssistant.prefill(turns), email: email ?? "")
        formError = nil
        contactOpen = true
    }

    func submitContact(page: String, tab: String, label: String, loggedIn: Bool) async {
        if let err = SiteAssistant.validate(form, loggedIn: loggedIn) {
            formError = Self.message(for: err)
            return
        }
        sending = true
        defer { sending = false }
        do {
            let r = try await SiteAssistant.sendSupport(
                SiteAssistant.supportPayload(form, page: page, tab: tab, label: label, turns: turns))
            if r.ok {
                contactOpen = false
                messages.append(Msg(role: "bot", text: r.reply ?? String(localized: "Đã gửi cho admin ThePickleHub. Bọn mình sẽ liên hệ lại sớm.")))
            } else {
                formError = r.reply ?? String(localized: "Chưa gửi được, bạn thử lại sau nhé.")
            }
        } catch {
            formError = String(localized: "Chưa gửi được, bạn thử lại sau nhé.")
        }
    }

    static func message(for e: SiteAssistant.SupportError) -> String {
        switch e {
        case .messageRequired: return String(localized: "Bạn nhập nội dung cần hỗ trợ nhé.")
        case .contactRequired: return String(localized: "Bạn để lại SĐT, email hoặc Zalo để admin liên hệ lại nhé.")
        case .invalidEmail: return String(localized: "Email chưa đúng định dạng.")
        case .invalidPhone: return String(localized: "Số điện thoại chưa đúng (8–15 chữ số).")
        }
    }
}

struct AssistantSheet: View {
    let page: String
    let tab: String
    let onNavigate: (SiteAssistant.Destination) -> Void

    @State private var model = AssistantViewModel()
    @Environment(\.dismiss) private var dismiss
    @Environment(SessionStore.self) private var session
    @FocusState private var focused: Bool

    private var context: SiteAssistant.ScreenContext? { AssistantContextStore.shared.current }
    private var signedInEmail: String? {
        if case .signedIn(let identity) = session.state { return identity.email ?? "" }
        return nil
    }
    private var loggedIn: Bool { signedInEmail != nil }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 10) {
                            bubble(String(localized: "Chào bạn 👋 Mình là trợ lý AI của ThePickleHub (AI, không phải người). Mình biết bạn đang xem màn hình nào — hỏi về màn hình này hoặc cách dùng tính năng nhé. Cần gặp admin thì cứ nói, mình chuyển lời ngay."), user: false)
                            ForEach(model.messages) { m in
                                VStack(alignment: m.role == "user" ? .trailing : .leading, spacing: 6) {
                                    bubble(m.text, user: m.role == "user")
                                    if !m.links.isEmpty { chips(m.links) }
                                }
                                .frame(maxWidth: .infinity, alignment: m.role == "user" ? .trailing : .leading)
                                .id(m.id)
                            }
                            if model.busy { ProgressView().padding(.leading, 8) }
                            if model.contactOpen { contactForm.id("contact") }
                        }
                        .padding(12)
                    }
                    .onChange(of: model.messages.count) {
                        if let last = model.messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                    }
                    .onChange(of: model.contactOpen) {
                        if model.contactOpen { withAnimation { proxy.scrollTo("contact", anchor: .bottom) } }
                    }
                }
                if !model.contactOpen && !model.busy {
                    HStack {
                        Button { model.openContact(email: signedInEmail) } label: {
                            Label(String(localized: "Liên hệ admin"), systemImage: "person.crop.circle.badge.questionmark")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(TLColor.accentText)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .overlay(Capsule().stroke(TLColor.border2))
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 12).padding(.bottom, 4)
                }
                Divider().overlay(TLColor.border)
                HStack(alignment: .bottom, spacing: 8) {
                    TextField(String(localized: "Nhập câu hỏi cho trợ lý…"), text: $model.input, axis: .vertical)
                        .lineLimit(1...4)
                        .focused($focused)
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 10))
                        .onSubmit { Task { await send() } }
                    Button { Task { await send() } } label: {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(TLColor.accentInk)
                            .frame(width: 40, height: 40)
                            .background(TLColor.accent, in: Circle())
                    }
                    .disabled(model.busy || model.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityLabel(String(localized: "Gửi câu hỏi cho trợ lý"))
                }
                .padding(12)
            }
            .background(TLColor.bg)
            .navigationTitle(String(localized: "Trợ lý AI ThePickleHub"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel(String(localized: "Đóng trợ lý AI"))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func send() async {
        await model.send(page: page, tab: tab, context: context, loggedIn: loggedIn)
    }

    private var contactForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(String(localized: "Gửi cho admin ThePickleHub")).font(.system(size: 15, weight: .semibold)).foregroundStyle(TLColor.fg)
            Text(String(localized: "Admin là người thật, sẽ liên hệ lại qua thông tin bạn để lại."))
                .font(.system(size: 12)).foregroundStyle(TLColor.fg2)
            field(String(localized: "Bạn cần hỗ trợ gì?"), text: $model.form.message, axis: .vertical)
            field(String(localized: "Tên (không bắt buộc)"), text: $model.form.name)
                .textContentType(.name)
            Text(loggedIn
                 ? String(localized: "Admin thấy tài khoản của bạn; thêm SĐT/Zalo nếu muốn được gọi lại nhanh hơn.")
                 : String(localized: "Để lại ít nhất một cách liên hệ để admin trả lời bạn."))
                .font(.system(size: 12)).foregroundStyle(TLColor.fg2)
            field(String(localized: "Số điện thoại"), text: $model.form.phone)
                .keyboardType(.phonePad).textContentType(.telephoneNumber)
            field(String(localized: "Email"), text: $model.form.email)
                .keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never)
            field(String(localized: "Zalo"), text: $model.form.zalo)
            if let err = model.formError {
                Text(err).font(.system(size: 12)).foregroundStyle(TLColor.live)
            }
            HStack(spacing: 8) {
                Button {
                    Task { await model.submitContact(page: page, tab: tab, label: context?.label ?? tab, loggedIn: loggedIn) }
                } label: {
                    HStack(spacing: 6) {
                        if model.sending { ProgressView().tint(TLColor.accentInk) }
                        Text(String(localized: "Gửi cho admin"))
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(TLColor.accentInk)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(TLColor.accent, in: Capsule())
                }
                .disabled(model.sending)
                Button(String(localized: "Không gửi nữa")) { model.contactOpen = false }
                    .font(.system(size: 14))
                    .disabled(model.sending)
            }
        }
        .padding(12)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(TLColor.border))
    }

    private func field(_ title: String, text: Binding<String>, axis: Axis = .horizontal) -> some View {
        TextField(title, text: text, axis: axis)
            .lineLimit(axis == .vertical ? 3...6 : 1...1)
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 8))
            .accessibilityLabel(title)
    }

    private func bubble(_ text: String, user: Bool) -> some View {
        Text(text)
            .font(.system(size: 15))
            .foregroundStyle(TLColor.fg)
            .padding(.horizontal, 11).padding(.vertical, 8)
            .background(user ? TLColor.greenGlow : TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .frame(maxWidth: 320, alignment: user ? .trailing : .leading)
    }

    private func chips(_ links: [SiteAssistant.Link]) -> some View {
        HStack(spacing: 6) {
            ForEach(links, id: \.href) { l in
                Button {
                    if let d = SiteAssistant.destination(for: l.href, shopEnabled: ShopFeatureGate.isEnabled, lang: SiteAssistant.appLang) {
                        dismiss()
                        onNavigate(d)
                    }
                } label: {
                    Text(verbatim: "\(l.label) →")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(TLColor.accentText)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .overlay(Capsule().stroke(TLColor.border2))
                }
            }
        }
    }
}
