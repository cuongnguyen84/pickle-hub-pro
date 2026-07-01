import SwiftUI

/// Live chat surface shown under the player. Realtime messages, optimistic send,
/// moderator tools (delete / mute / room settings) and a chatter leaderboard —
/// a native port of the web `ChatPanel`.
struct ChatPanel: View {
    let livestreamID: String
    @State private var model: ChatViewModel
    @State private var draft = ""
    @State private var showLeaderboard = false
    @State private var showSettings = false
    @FocusState private var inputFocused: Bool

    init(livestreamID: String) {
        self.livestreamID = livestreamID
        _model = State(initialValue: ChatViewModel(livestreamID: livestreamID))
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(TLColor.border)
            messageList
            inputBar
        }
        .background(TLColor.bg)
        .task { await model.load() }
        .onDisappear { model.stop() }
        .sheet(isPresented: $showLeaderboard) {
            ChatLeaderboardSheet(entries: model.leaderboard)
        }
        .sheet(isPresented: $showSettings) {
            ChatSettingsSheet(model: model)
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 10) {
            Text("Bình luận").font(TLFont.serif(20)).foregroundStyle(TLColor.fg)
            if !model.settings.isChatEnabled {
                Text("ĐÃ TẮT").font(TLFont.mono(9, .bold)).tracking(0.8)
                    .foregroundStyle(TLColor.fg3)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(TLColor.surface2, in: Capsule())
            }
            Spacer()
            Button { showLeaderboard = true } label: {
                Image(systemName: "trophy").font(.system(size: 15)).foregroundStyle(TLColor.gold)
            }
            .accessibilityLabel("Bảng xếp hạng bình luận")
            if model.isModerator {
                Button { showSettings = true } label: {
                    Image(systemName: "slider.horizontal.3").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                }
                .accessibilityLabel("Cài đặt chat")
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
    }

    // MARK: Messages

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if model.hasOlder {
                        Button { Task { await model.loadOlder() } } label: {
                            Text("Tải tin cũ hơn").font(TLFont.mono(10, .semibold))
                                .foregroundStyle(TLColor.accentText)
                                .frame(maxWidth: .infinity).padding(.vertical, 6)
                        }
                    }
                    if model.isLoading {
                        TLLoadingView(rows: 5).padding(.top, 4)
                    } else if model.messages.isEmpty {
                        TLEmptyState(icon: "bubble.left.and.bubble.right",
                                     title: "Chưa có bình luận",
                                     subtitle: "Hãy là người đầu tiên cổ vũ trận đấu.")
                    }
                    ForEach(model.messages) { m in
                        ChatMessageRow(message: m, model: model)
                            .id(m.id)
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
            }
            .onChange(of: model.messages.count) {
                if let last = model.messages.last {
                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
    }

    // MARK: Input

    @ViewBuilder
    private var inputBar: some View {
        Divider().overlay(TLColor.border)
        if !model.isSignedIn {
            disabledBar("Đăng nhập để tham gia bình luận", icon: "person.crop.circle")
        } else if !model.settings.isChatEnabled {
            disabledBar("Chat đã bị tắt cho phòng này", icon: "nosign")
        } else if model.isMuted {
            disabledBar("Bạn đang bị tắt tiếng", icon: "speaker.slash")
        } else {
            // TimelineView drives the 1s slow-mode countdown without a manual timer.
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                let remaining = model.slowModeRemaining
                HStack(spacing: 10) {
                    TextField("Viết bình luận…", text: $draft, axis: .vertical)
                        .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                        .lineLimit(1...4)
                        .focused($inputFocused)
                        .submitLabel(.send)
                        .onSubmit(send)
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))

                    Button(action: send) {
                        Group {
                            if remaining > 0 {
                                Text("\(remaining)s").font(TLFont.mono(12, .bold))
                            } else {
                                Image(systemName: "arrow.up").font(.system(size: 16, weight: .bold))
                            }
                        }
                        .foregroundStyle(canSend(remaining) ? TLColor.accentInk : TLColor.fg4)
                        .frame(width: 42, height: 42)
                        .background(canSend(remaining) ? TLColor.accent : TLColor.surface2, in: Circle())
                    }
                    .disabled(!canSend(remaining))
                    .accessibilityLabel("Gửi")
                }
                .padding(.horizontal, 14).padding(.vertical, 10)
            }
        }
    }

    private func canSend(_ remaining: Int) -> Bool {
        remaining == 0 && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func send() {
        let text = draft
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, model.slowModeRemaining == 0 else { return }
        draft = ""
        Haptics.light()
        Task { await model.send(text) }
    }

    private func disabledBar(_ text: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 13)).foregroundStyle(TLColor.fg4)
            Text(text).font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg3)
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
    }
}

// MARK: - Message row

private struct ChatMessageRow: View {
    let message: ChatMessage
    let model: ChatViewModel

    private var rank: Int? { model.chatterRank(message.userID) }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            avatar
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(message.displayName)
                        .font(TLFont.sans(12.5, .semibold))
                        .foregroundStyle(message.userID == model.userID ? TLColor.accentText : TLColor.fg2)
                        .lineLimit(1)
                    if let rank { rankBadge(rank) }
                    if message.pending {
                        Image(systemName: "clock").font(.system(size: 9)).foregroundStyle(TLColor.fg4)
                    }
                }
                Text(message.message)
                    .font(TLFont.sans(14))
                    .foregroundStyle(message.failed ? TLColor.live : TLColor.fg)
                    .fixedSize(horizontal: false, vertical: true)
                if message.failed {
                    Button { Task { await model.retry(message) } } label: {
                        Text("Gửi lại").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .contextMenu { if model.isModerator && !message.id.hasPrefix("pending-") { moderatorMenu } }
    }

    @ViewBuilder
    private var moderatorMenu: some View {
        Button(role: .destructive) { Task { await model.delete(message) } } label: {
            Label("Xóa bình luận", systemImage: "trash")
        }
        Menu {
            Button("5 phút") { Task { await model.mute(userID: message.userID, minutes: 5) } }
            Button("30 phút") { Task { await model.mute(userID: message.userID, minutes: 30) } }
            Button("24 giờ") { Task { await model.mute(userID: message.userID, minutes: 60 * 24) } }
        } label: {
            Label("Tắt tiếng người này", systemImage: "speaker.slash")
        }
    }

    private func rankBadge(_ rank: Int) -> some View {
        let color = rank == 1 ? TLColor.gold : (rank == 2 ? TLColor.fg2 : TLColor.accentDim)
        return Text("#\(rank)")
            .font(TLFont.mono(8.5, .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 5).padding(.vertical, 1)
            .background(color.opacity(0.14), in: Capsule())
    }

    private var avatar: some View {
        let url = message.avatarURL.flatMap { URL(string: $0) ?? WebRoutes.asset($0) }
        return Group {
            if let url {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { TLColor.surface2 }
            } else {
                Text(String(message.displayName.prefix(1)).uppercased())
                    .font(TLFont.sans(12, .bold)).foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(TLColor.surface2)
            }
        }
        .frame(width: 28, height: 28)
        .clipShape(Circle())
    }
}

// MARK: - Leaderboard sheet

private struct ChatLeaderboardSheet: View {
    let entries: [ChatLeaderboardEntry]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    if entries.isEmpty {
                        TLEmptyState(icon: "trophy", title: "Chưa có dữ liệu", subtitle: "Bảng xếp hạng sẽ cập nhật khi có bình luận.")
                    }
                    ForEach(entries) { e in
                        HStack(spacing: 12) {
                            Text("#\(e.rank)").font(TLFont.mono(14, .bold))
                                .foregroundStyle(e.rank == 1 ? TLColor.gold : TLColor.fg3)
                                .frame(width: 34, alignment: .leading)
                            Text(e.displayName).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                            Spacer()
                            Text("\(e.messageCount)").font(TLFont.mono(13, .semibold)).foregroundStyle(TLColor.accentText)
                        }
                        .padding(14)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Bình luận nhiều nhất")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Đóng") { dismiss() }.foregroundStyle(TLColor.accentText) } }
        }
    }
}

// MARK: - Moderator settings sheet

private struct ChatSettingsSheet: View {
    let model: ChatViewModel
    @Environment(\.dismiss) private var dismiss

    private let slowOptions = [0, 5, 10, 30, 60]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Toggle(isOn: Binding(
                        get: { model.settings.isChatEnabled },
                        set: { _ in Task { await model.toggleChatEnabled() } }
                    )) {
                        Text("Bật chat").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                    }
                    .tint(TLColor.accent)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Chế độ chậm").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                        Text("Giới hạn thời gian giữa hai tin của mỗi người.")
                            .font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
                        HStack(spacing: 8) {
                            ForEach(slowOptions, id: \.self) { s in
                                let selected = model.settings.slowModeSeconds == s
                                Button { Task { await model.setSlowMode(s) } } label: {
                                    Text(s == 0 ? "Tắt" : "\(s)s")
                                        .font(TLFont.mono(12, selected ? .bold : .medium))
                                        .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                                        .padding(.horizontal, 12).padding(.vertical, 8)
                                        .background(selected ? TLColor.accent : TLColor.surface2, in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle("Cài đặt chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Đóng") { dismiss() }.foregroundStyle(TLColor.accentText) } }
        }
    }
}
