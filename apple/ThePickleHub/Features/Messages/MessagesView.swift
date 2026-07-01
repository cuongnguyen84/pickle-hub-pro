import SwiftUI

// MARK: Inbox

@Observable
final class MessagesInboxModel {
    var conversations: [DMConversation] = []
    var loaded = false
    private let repo = MessagesRepository()

    @MainActor func load() async {
        conversations = await repo.myConversations()
        loaded = true
    }
}

/// DM inbox — native port of web `/tin-nhan` list. Polls every 15s (web parity).
struct MessagesView: View {
    @State private var model = MessagesInboxModel()

    var body: some View {
        Group {
            if !model.loaded {
                ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 60)
            } else if model.conversations.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(model.conversations) { c in
                            NavigationLink {
                                MessageThreadView(conversationID: c.conversationID, title: c.title, otherUsername: c.otherUsername)
                            } label: { row(c) }
                            .buttonStyle(.plain)
                            Rectangle().fill(TLColor.border).frame(height: 1).padding(.leading, 68)
                        }
                    }
                }
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Tin nhắn")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await model.load()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                if Task.isCancelled { break }
                await model.load()
            }
        }
        .refreshable { await model.load() }
    }

    private func row(_ c: DMConversation) -> some View {
        HStack(spacing: 12) {
            avatar(c)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(c.title).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Spacer(minLength: 4)
                    if c.unreadCount > 0 {
                        Text("\(c.unreadCount)").font(TLFont.mono(10, .bold)).foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 6).padding(.vertical, 2).background(TLColor.accent, in: Capsule())
                    }
                }
                Text(c.lastBody?.nonEmpty ?? " ").font(TLFont.sans(13))
                    .foregroundStyle(c.unreadCount > 0 ? TLColor.fg2 : TLColor.fg3).lineLimit(1)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private func avatar(_ c: DMConversation) -> some View {
        Group {
            if let s = c.otherAvatar, let url = URL(string: s) {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { initial(c.title) }
            } else { initial(c.title) }
        }
        .frame(width: 40, height: 40).clipShape(Circle())
    }
    private func initial(_ name: String) -> some View {
        Circle().fill(TLColor.surface2)
            .overlay(Text(String(name.prefix(1)).uppercased()).font(TLFont.serif(16)).foregroundStyle(TLColor.fg2))
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "bubble.left.and.bubble.right").font(.system(size: 32)).foregroundStyle(TLColor.fg4)
            Text("Chưa có cuộc trò chuyện").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
            Text("Vào Tìm bạn chơi để bắt đầu.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
        }.frame(maxWidth: .infinity).padding(.top, 80)
    }
}

// MARK: Thread

@Observable
final class MessageThreadModel {
    var messages: [DMMessage] = []
    var myID = ""
    var loaded = false
    var draft = ""
    var sending = false
    let conversationID: String
    private let repo = MessagesRepository()

    init(conversationID: String) { self.conversationID = conversationID }

    @MainActor func load() async {
        if myID.isEmpty { myID = await repo.currentUserID() ?? "" }
        messages = await repo.messages(conversationID: conversationID)
        loaded = true
        await repo.markRead(conversationID: conversationID)
    }

    @MainActor func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !sending else { return }
        sending = true
        do {
            try await repo.sendMessage(conversationID: conversationID, body: String(text.prefix(1000)))
            draft = ""
            await load()
        } catch {}
        sending = false
    }
}

/// A single DM thread — messages + composer. Polls every 4s (web parity),
/// marks read on load.
struct MessageThreadView: View {
    let title: String
    let otherUsername: String?
    @State private var model: MessageThreadModel

    init(conversationID: String, title: String, otherUsername: String?) {
        self.title = title
        self.otherUsername = otherUsername
        _model = State(initialValue: MessageThreadModel(conversationID: conversationID))
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(model.messages) { m in bubble(m) }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(16)
                }
                .onChange(of: model.messages.count) { _, _ in
                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("bottom", anchor: .bottom) }
                }
                .onAppear { proxy.scrollTo("bottom", anchor: .bottom) }
            }
            composer
        }
        .background(TLColor.bg)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let u = otherUsername {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink { PlayerProfileView(username: u) } label: {
                        Image(systemName: "person.crop.circle").foregroundStyle(TLColor.accentText)
                    }
                }
            }
        }
        .task {
            await model.load()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                if Task.isCancelled { break }
                await model.load()
            }
        }
    }

    private func bubble(_ m: DMMessage) -> some View {
        let mine = m.senderID == model.myID
        return HStack(spacing: 0) {
            if mine { Spacer(minLength: 44) }
            VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
                Text(m.body).font(TLFont.sans(14))
                    .foregroundStyle(mine ? TLColor.accentInk : TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(mine ? TLColor.accent : TLColor.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(mine ? Color.clear : TLColor.border, lineWidth: 1))
                if let t = hhmm(m.createdAt) {
                    Text(t).font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                }
            }
            if !mine { Spacer(minLength: 44) }
        }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Nhập tin nhắn…", text: $model.draft, axis: .vertical)
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .lineLimit(1...4)
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(TLColor.border, lineWidth: 1))
            let empty = model.draft.trimmingCharacters(in: .whitespaces).isEmpty
            Button { Task { await model.send() } } label: {
                Image(systemName: "arrow.up").font(.system(size: 15, weight: .bold)).foregroundStyle(TLColor.accentInk)
                    .frame(width: 36, height: 36).background(TLColor.accent, in: Circle())
            }
            .buttonStyle(.plain).disabled(empty || model.sending).opacity(empty ? 0.5 : 1)
        }
        .padding(12)
        .background(TLColor.bg)
        .overlay(alignment: .top) { Rectangle().fill(TLColor.border).frame(height: 1) }
    }

    private func hhmm(_ iso: String?) -> String? {
        guard let d = ISODate.parse(iso) else { return nil }
        let f = DateFormatter(); f.dateFormat = "HH:mm"
        return f.string(from: d)
    }
}

/// Lenient ISO8601 parse (Postgres timestamps come with/without fractional seconds).
enum ISODate {
    static func parse(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)
    }

    /// Vietnamese relative time ("2 giờ trước"), for feed/forum timestamps.
    static func relative(_ iso: String?) -> String {
        guard let d = parse(iso) else { return "" }
        let rf = RelativeDateTimeFormatter()
        rf.locale = Locale(identifier: "vi_VN")
        rf.unitsStyle = .short
        return rf.localizedString(for: d, relativeTo: Date())
    }
}
