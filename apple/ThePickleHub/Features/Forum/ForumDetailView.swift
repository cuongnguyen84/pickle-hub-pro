import SwiftUI
import PhotosUI

@Observable
final class ForumDetailModel {
    let postID: String
    var post: ForumPost?
    var comments: [ForumComment] = []
    var likedPost = false
    var likedComments: Set<String> = []
    var myID: String?
    var loaded = false
    var notFound = false

    // Composer
    var draft = ""
    var replyTo: ForumComment?
    var imageData: [Data] = []
    var sending = false

    private let repo = ForumRepository()
    init(postID: String) { self.postID = postID }

    var isOwner: Bool { myID != nil && post?.userID == myID }
    func ownsComment(_ c: ForumComment) -> Bool { myID != nil && c.userID == myID }

    @MainActor func load() async {
        if myID == nil { myID = await repo.currentUserID() }
        guard let p = await repo.post(id: postID) else { notFound = true; loaded = true; return }
        post = p
        comments = await repo.comments(postID: postID)
        likedPost = await repo.likedTargetIDs([postID], type: "post").contains(postID)
        likedComments = await repo.likedTargetIDs(comments.map(\.id), type: "comment")
        loaded = true
    }

    @MainActor func toggleLikePost() async {
        guard let post else { return }
        try? await repo.toggleLike(targetID: post.id, targetType: "post", isLiked: likedPost)
        await load()
    }
    @MainActor func toggleLikeComment(_ c: ForumComment) async {
        try? await repo.toggleLike(targetID: c.id, targetType: "comment", isLiked: likedComments.contains(c.id))
        await load()
    }
    @MainActor func toggleBest(_ c: ForumComment) async {
        try? await repo.toggleBestAnswer(commentID: c.id, postID: postID, isBestAnswer: c.isBestAnswer)
        await load()
    }
    @MainActor func deleteComment(_ c: ForumComment) async {
        try? await repo.deleteComment(id: c.id); await load()
    }
    @MainActor func deletePost() async -> Bool {
        (try? await repo.deletePost(id: postID)) != nil
    }
    @MainActor func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !sending else { return }
        sending = true
        let urls = imageData.isEmpty ? nil : await repo.uploadImages(imageData)
        do {
            try await repo.createComment(postID: postID, content: text, parentID: replyTo?.id, imageURLs: urls)
            draft = ""; replyTo = nil; imageData = []
            await load()
        } catch {}
        sending = false
    }
}

/// Post detail + comments — native port of web `/forum/post/:id`.
struct ForumDetailView: View {
    let postID: String
    @State private var model: ForumDetailModel
    @State private var picked: [PhotosPickerItem] = []
    @Environment(\.dismiss) private var dismiss

    init(postID: String) {
        self.postID = postID
        _model = State(initialValue: ForumDetailModel(postID: postID))
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if !model.loaded {
                        ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 60)
                    } else if model.notFound || model.post == nil {
                        Text("Không tìm thấy bài viết.").font(TLFont.sans(14)).foregroundStyle(TLColor.fg3).padding(.top, 40)
                    } else if let post = model.post {
                        postHeader(post)
                        Text(post.content).font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                            .fixedSize(horizontal: false, vertical: true)
                        imageGrid(post.imageURLs)
                        tagRow(post.tags)
                        likeBar(post)
                        Rectangle().fill(TLColor.border).frame(height: 1)
                        commentsSection(post)
                    }
                }
                .padding(16)
            }
            if model.post != nil && model.myID != nil { composer }
        }
        .background(TLColor.bg)
        .navigationTitle("Bài viết")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if model.isOwner {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Xoá bài", role: .destructive) {
                            Task { if await model.deletePost() { dismiss() } }
                        }
                    } label: { Image(systemName: "ellipsis").foregroundStyle(TLColor.accentText) }
                }
            }
        }
        .task { await model.load() }
    }

    // MARK: Post

    private func postHeader(_ p: ForumPost) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                if p.isPinned { Image(systemName: "pin.fill").font(.system(size: 10)).foregroundStyle(TLColor.accentText) }
                if p.isQA {
                    Text("HỎI ĐÁP").font(TLFont.mono(8.5, .bold)).tracking(0.5).foregroundStyle(TLColor.accentText)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(TLColor.accent.opacity(0.12), in: Capsule())
                }
                if let cat = p.categoryName {
                    Text(cat).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(TLColor.surface2, in: Capsule())
                }
                Spacer(minLength: 4)
            }
            Text(p.title).font(TLFont.serif(22)).foregroundStyle(TLColor.fg).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                authorAvatar(p.authorAvatar, name: p.authorName)
                VStack(alignment: .leading, spacing: 1) {
                    Text(p.authorName ?? "Người dùng").font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg)
                    Text(ISODate.relative(p.createdAt)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
            }
        }
    }

    private func likeBar(_ p: ForumPost) -> some View {
        Button { Task { await model.toggleLikePost() } } label: {
            HStack(spacing: 5) {
                Image(systemName: model.likedPost ? "heart.fill" : "heart")
                Text("\(p.likeCount)")
            }
            .font(TLFont.sans(14, .medium))
            .foregroundStyle(model.likedPost ? TLColor.live : TLColor.fg3)
        }
        .buttonStyle(.plain).disabled(model.myID == nil)
    }

    // MARK: Comments

    private func commentsSection(_ post: ForumPost) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("BÌNH LUẬN (\(model.comments.count))").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            if model.comments.isEmpty {
                Text("Chưa có bình luận.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            } else {
                ForEach(model.comments) { c in commentCard(c, post: post) }
            }
        }
    }

    private func commentCard(_ c: ForumComment, post: ForumPost) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if c.isBestAnswer {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 10))
                    Text("TRẢ LỜI HAY NHẤT").font(TLFont.mono(8.5, .bold)).tracking(0.5)
                }.foregroundStyle(TLColor.accentText)
            }
            if let pa = c.parentAuthorName, let pc = c.parentContent {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pa).font(TLFont.mono(9.5, .semibold)).foregroundStyle(TLColor.fg3)
                    Text(pc).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).lineLimit(2)
                }
                .padding(.leading, 8).overlay(alignment: .leading) { Rectangle().fill(TLColor.border2).frame(width: 2) }
            }
            HStack(spacing: 8) {
                authorAvatar(c.authorAvatar, name: c.authorName, size: 26)
                Text(c.authorName ?? "Người dùng").font(TLFont.sans(12.5, .medium)).foregroundStyle(TLColor.fg)
                Text(ISODate.relative(c.createdAt)).font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                Spacer()
            }
            Text(c.content).font(TLFont.sans(14)).foregroundStyle(TLColor.fg).fixedSize(horizontal: false, vertical: true)
            imageGrid(c.imageURLs)
            HStack(spacing: 16) {
                Button { Task { await model.toggleLikeComment(c) } } label: {
                    HStack(spacing: 4) {
                        Image(systemName: model.likedComments.contains(c.id) ? "heart.fill" : "heart")
                        Text("\(c.likeCount)")
                    }.font(TLFont.mono(11)).foregroundStyle(model.likedComments.contains(c.id) ? TLColor.live : TLColor.fg3)
                }.buttonStyle(.plain).disabled(model.myID == nil)

                if model.myID != nil {
                    Button { model.replyTo = c } label: {
                        Text("Trả lời").font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                    }.buttonStyle(.plain)
                }
                if post.isQA && model.isOwner {
                    Button { Task { await model.toggleBest(c) } } label: {
                        Text(c.isBestAnswer ? "Bỏ chọn hay nhất" : "Chọn hay nhất")
                            .font(TLFont.mono(11)).foregroundStyle(TLColor.accentText)
                    }.buttonStyle(.plain)
                }
                Spacer()
                if model.ownsComment(c) {
                    Button(role: .destructive) { Task { await model.deleteComment(c) } } label: {
                        Image(systemName: "trash").font(.system(size: 11)).foregroundStyle(TLColor.live)
                    }.buttonStyle(.plain)
                }
            }
        }
        .padding(12)
        .background(c.isBestAnswer ? TLColor.accent.opacity(0.06) : TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(c.isBestAnswer ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
    }

    // MARK: Composer

    private var composer: some View {
        VStack(spacing: 8) {
            if let r = model.replyTo {
                HStack(spacing: 6) {
                    Text("Trả lời \(r.authorName ?? "")").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3).lineLimit(1)
                    Spacer()
                    Button { model.replyTo = nil } label: { Image(systemName: "xmark").font(.system(size: 10)).foregroundStyle(TLColor.fg4) }
                }
            }
            HStack(spacing: 10) {
                PhotosPicker(selection: $picked, maxSelectionCount: 2, matching: .images) {
                    Image(systemName: model.imageData.isEmpty ? "photo" : "photo.fill")
                        .font(.system(size: 16)).foregroundStyle(TLColor.accentText)
                }
                .onChange(of: picked) { _, items in
                    Task {
                        var datas: [Data] = []
                        for it in items.prefix(2) { if let d = try? await it.loadTransferable(type: Data.self) { datas.append(d) } }
                        model.imageData = datas
                    }
                }
                TextField(model.replyTo == nil ? "Viết bình luận…" : "Trả lời…", text: $model.draft, axis: .vertical)
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg).lineLimit(1...4)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(TLColor.border, lineWidth: 1))
                let empty = model.draft.trimmingCharacters(in: .whitespaces).isEmpty
                Button { Task { await model.send(); picked = [] } } label: {
                    Image(systemName: "arrow.up").font(.system(size: 15, weight: .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(width: 36, height: 36).background(TLColor.accent, in: Circle())
                }.buttonStyle(.plain).disabled(empty || model.sending).opacity(empty ? 0.5 : 1)
            }
        }
        .padding(12)
        .background(TLColor.bg)
        .overlay(alignment: .top) { Rectangle().fill(TLColor.border).frame(height: 1) }
    }

    // MARK: Shared

    private func authorAvatar(_ url: String?, name: String?, size: CGFloat = 32) -> some View {
        Group {
            if let s = url, let u = URL(string: s) {
                AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { avatarInitial(name, size: size) }
            } else { avatarInitial(name, size: size) }
        }
        .frame(width: size, height: size).clipShape(Circle())
    }
    private func avatarInitial(_ name: String?, size: CGFloat) -> some View {
        Circle().fill(TLColor.surface2)
            .overlay(Text(String((name ?? "?").prefix(1)).uppercased()).font(TLFont.serif(size * 0.5)).foregroundStyle(TLColor.fg2))
    }

    @ViewBuilder
    private func imageGrid(_ urls: [String]?) -> some View {
        if let urls, !urls.isEmpty {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(urls, id: \.self) { s in
                    if let u = URL(string: s) {
                        AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Rectangle().fill(TLColor.surface2) }
                            .frame(height: 140).frame(maxWidth: .infinity).clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func tagRow(_ tags: [String]?) -> some View {
        if let tags, !tags.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(tags, id: \.self) { t in
                        Text("#\(t)").font(TLFont.mono(10)).foregroundStyle(TLColor.accentText)
                    }
                }
            }
        }
    }
}
