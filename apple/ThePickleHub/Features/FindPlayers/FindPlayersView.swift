import SwiftUI

@Observable
final class FindPlayersModel {
    var requests: [PlayRequest] = []
    var loaded = false
    var city = ""
    var myID: String?

    // Post form
    var showForm = false
    var note = ""
    var fCity = ""
    var fDistrict = ""
    var band: SkillBand?
    var whenOn = false
    var when = Date()
    var posting = false
    var error: String?

    private let repo = FindPlayersRepository()

    var canPost: Bool { note.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5 }

    @MainActor func load() async {
        if myID == nil { myID = await repo.currentUserID() }
        requests = await repo.openRequests(city: city)
        loaded = true
    }

    @MainActor func submit() async {
        guard canPost else { return }
        posting = true; error = nil
        do {
            try await repo.postRequest(city: fCity, district: fDistrict, band: band,
                                       playAt: whenOn ? when : nil, note: note)
            note = ""; fCity = ""; fDistrict = ""; band = nil; whenOn = false; showForm = false
            await load()
        } catch { self.error = error.localizedDescription }
        posting = false
    }

    func contact(_ authorID: String) async -> String? {
        await repo.getOrCreateDM(otherID: authorID)
    }
}

/// "Tìm kèo" board — native port of web `/tim-ban-choi`: browse + post open-play
/// requests, contact a poster (opens a DM thread). Auth-gated (reached from Profile).
struct FindPlayersView: View {
    @State private var model = FindPlayersModel()
    @State private var openThread: ThreadTarget?

    struct ThreadTarget: Identifiable, Hashable { let id: String; let title: String; let username: String? }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                postSection
                cityFilter
                if !model.loaded {
                    ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 30)
                } else if model.requests.isEmpty {
                    emptyState
                } else {
                    ForEach(model.requests) { r in requestCard(r) }
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Tìm kèo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink { MessagesView() } label: {
                    Image(systemName: "bubble.left.and.bubble.right").foregroundStyle(TLColor.accentText)
                }
                .accessibilityLabel("Tin nhắn của tôi")
            }
        }
        .task { await model.load() }
        .refreshable { await model.load() }
        .navigationDestination(item: $openThread) { t in
            MessageThreadView(conversationID: t.id, title: t.title, otherUsername: t.username)
        }
    }

    // MARK: Post form

    @ViewBuilder
    private var postSection: some View {
        if model.showForm {
            VStack(alignment: .leading, spacing: 12) {
                ZStack(alignment: .topLeading) {
                    if model.note.isEmpty {
                        Text("Bạn muốn chơi thế nào? (VD: cần 2 bạn trình 3.0 tối nay ở sân Tăng Bạt Hổ)")
                            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg4)
                            .padding(.horizontal, 15).padding(.vertical, 16)
                    }
                    TextEditor(text: $model.note)
                        .font(TLFont.sans(14)).foregroundStyle(TLColor.fg).scrollContentBackground(.hidden)
                        .frame(minHeight: 72).padding(.horizontal, 11).padding(.vertical, 8)
                }
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))

                HStack(spacing: 10) {
                    tf($model.fCity, "Thành phố")
                    tf($model.fDistrict, "Quận/Huyện")
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("TRÌNH").font(TLFont.mono(9.5, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            chip("Mọi trình", selected: model.band == nil) { model.band = nil }
                            ForEach(SkillBand.all) { b in
                                chip(b.label, selected: model.band?.key == b.key) { model.band = b }
                            }
                        }
                    }
                }

                Toggle(isOn: $model.whenOn) {
                    Text("Hẹn giờ").font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg)
                }.tint(TLColor.accent)
                if model.whenOn {
                    DatePicker("", selection: $model.when, in: Date()...).datePickerStyle(.compact).labelsHidden()
                }

                if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }

                HStack(spacing: 10) {
                    Button { Haptics.success(); Task { await model.submit() } } label: {
                        HStack(spacing: 5) {
                            if model.posting { ProgressView().tint(TLColor.accentInk) }
                            Text("Đăng").font(TLFont.sans(14, .bold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 11)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                    }.buttonStyle(.plain).disabled(!model.canPost || model.posting).opacity(model.canPost ? 1 : 0.5)
                    Button { model.showForm = false } label: {
                        Text("Huỷ").font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg2)
                            .frame(maxWidth: .infinity).padding(.vertical, 11)
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                    }.buttonStyle(.plain)
                }
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        } else {
            Button { Haptics.light(); model.showForm = true } label: {
                HStack(spacing: 6) { Image(systemName: "plus"); Text("Đăng tìm kèo") }
                    .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
            }.buttonStyle(.plain)
        }
    }

    private var cityFilter: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.system(size: 13)).foregroundStyle(TLColor.fg4)
            TextField("Lọc theo khu vực (VD: Hà Nội)", text: $model.city)
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .submitLabel(.search)
                .onSubmit { Task { await model.load() } }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Request card

    private func requestCard(_ r: PlayRequest) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(r.authorName).font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg)
                if let loc = r.location {
                    HStack(spacing: 3) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 9)).foregroundStyle(TLColor.fg4)
                        Text(loc).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                    }
                }
                if let range = r.skillRange {
                    Text("Trình \(range)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(TLColor.surface2, in: Capsule())
                }
                Spacer(minLength: 4)
            }
            if let t = playAtLabel(r.playAt) {
                Text(t).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }
            Text(r.note).font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            if r.authorID != model.myID {
                Button {
                    Haptics.light()
                    Task {
                        if let cid = await model.contact(r.authorID) {
                            openThread = ThreadTarget(id: cid, title: r.authorName, username: r.authorUsername)
                        }
                    }
                } label: {
                    HStack(spacing: 5) { Image(systemName: "bubble.left"); Text("Nhắn tin nhận kèo") }
                        .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(TLColor.accent, in: Capsule())
                }.buttonStyle(.plain).padding(.top, 2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "figure.pickleball").font(.system(size: 30)).foregroundStyle(TLColor.fg4)
            Text("Chưa có tin tìm kèo nào").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
            Text("Đăng tin đầu tiên!").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
        }.frame(maxWidth: .infinity).padding(.top, 40)
    }

    // MARK: Helpers

    private func chip(_ text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.light(); action() } label: {
            Text(text).font(TLFont.mono(11, selected ? .semibold : .medium))
                .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg3)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(selected ? TLColor.accent : TLColor.surface, in: Capsule())
                .overlay(Capsule().strokeBorder(selected ? Color.clear : TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }
    private func tf(_ binding: Binding<String>, _ placeholder: String) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 11).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
    }
    private func playAtLabel(_ iso: String?) -> String? {
        guard let d = ISODate.parse(iso) else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "vi_VN"); f.dateFormat = "dd/MM · HH:mm"
        return f.string(from: d)
    }
}
