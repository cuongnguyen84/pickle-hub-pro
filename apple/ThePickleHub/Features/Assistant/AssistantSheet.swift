import SwiftUI

/// Khung chat trợ lý AI chung (edge fn site-assistant) — mở từ nút nổi ở AppTabView.
/// Chỉ hỏi–đáp + chip link; chip đi màn hình native nếu có, không thì mở web.
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
    private let threadId = UUID().uuidString.lowercased()

    func send(page: String, tab: String) async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !busy else { return }
        input = ""
        messages.append(Msg(role: "user", text: String(text.prefix(500))))
        busy = true
        defer { busy = false }
        let turns = messages.map { SiteAssistant.Turn(role: $0.role, text: $0.text) }
        do {
            let r = try await SiteAssistant.send(threadId: threadId, page: page, tab: tab, turns: turns)
            messages.append(Msg(role: "bot", text: r.reply, links: r.links))
        } catch {
            messages.append(Msg(role: "bot", text: String(localized: "Mạng chậm hoặc trợ lý đang bận. Bạn thử lại sau nhé.")))
        }
    }
}

struct AssistantSheet: View {
    let page: String
    let tab: String
    let onNavigate: (SiteAssistant.Destination) -> Void

    @State private var model = AssistantViewModel()
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 10) {
                            bubble(String(localized: "Chào bạn 👋 Mình là trợ lý ThePickleHub. Hỏi mình về màn hình bạn đang xem hoặc cách dùng một tính năng — mình sẽ chỉ đường cho bạn."), user: false)
                            ForEach(model.messages) { m in
                                VStack(alignment: m.role == "user" ? .trailing : .leading, spacing: 6) {
                                    bubble(m.text, user: m.role == "user")
                                    if !m.links.isEmpty { chips(m.links) }
                                }
                                .frame(maxWidth: .infinity, alignment: m.role == "user" ? .trailing : .leading)
                                .id(m.id)
                            }
                            if model.busy { ProgressView().padding(.leading, 8) }
                        }
                        .padding(12)
                    }
                    .onChange(of: model.messages.count) {
                        if let last = model.messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                    }
                }
                Divider().overlay(TLColor.border)
                HStack(alignment: .bottom, spacing: 8) {
                    TextField(String(localized: "Nhập câu hỏi cho trợ lý…"), text: $model.input, axis: .vertical)
                        .lineLimit(1...4)
                        .focused($focused)
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 10))
                        .onSubmit { Task { await model.send(page: page, tab: tab) } }
                    Button { Task { await model.send(page: page, tab: tab) } } label: {
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
