import SwiftUI

enum ForumRoute: Hashable { case detail(String); case newPost }

@Observable
final class ForumListModel {
    var posts: [ForumPost] = []
    var categories: [ForumCategory] = []
    var selectedSlug: String?
    var loaded = false
    var myID: String?
    private let repo = ForumRepository()

    @MainActor func load() async {
        if myID == nil { myID = await repo.currentUserID() }
        async let c = repo.categories()
        async let p = repo.posts(categorySlug: selectedSlug, tag: nil)
        categories = await c
        posts = await p
        loaded = true
    }
    @MainActor func select(_ slug: String?) async {
        selectedSlug = slug; loaded = false
        posts = await repo.posts(categorySlug: slug, tag: nil)
        loaded = true
    }
}

/// Forum home — native port of web `/forum`: category filter + post list.
/// Pushed from Profile (inside a NavigationStack); declares its own routes.
struct ForumListView: View {
    @State private var model = ForumListModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if !model.categories.isEmpty { categoryBar }
                if !model.loaded {
                    ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 40)
                } else if model.posts.isEmpty {
                    emptyState
                } else {
                    ForEach(model.posts) { p in
                        NavigationLink(value: ForumRoute.detail(p.id)) { postRow(p) }.buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Diễn đàn")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: ForumRoute.newPost) {
                    Image(systemName: "square.and.pencil").foregroundStyle(TLColor.accentText)
                }.accessibilityLabel("Bài viết mới")
            }
        }
        .navigationDestination(for: ForumRoute.self) { route in
            switch route {
            case .detail(let id): ForumDetailView(postID: id)
            case .newPost: ForumCreateView(categories: model.categories) { Task { await model.load() } }
            }
        }
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("◆ CỘNG ĐỒNG").font(TLFont.mono(9.5, .semibold)).tracking(1).foregroundStyle(TLColor.accentText)
            Text("Hỏi đáp, chia sẻ, bàn luận cùng cộng đồng.")
                .font(TLFont.serif(22)).italic().foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            NavigationLink(value: ForumRoute.newPost) {
                HStack(spacing: 6) { Image(systemName: "plus"); Text("Đăng bài") }
                    .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
            }.buttonStyle(.plain).padding(.top, 4)
        }
    }

    private var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("Tất cả", selected: model.selectedSlug == nil) { Task { await model.select(nil) } }
                ForEach(model.categories) { c in
                    chip(c.name, selected: model.selectedSlug == c.slug) { Task { await model.select(c.slug) } }
                }
            }
        }
    }

    private func chip(_ text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.light(); action() } label: {
            Text(text).font(TLFont.mono(11, selected ? .semibold : .medium))
                .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg3)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(selected ? TLColor.accent : TLColor.surface, in: Capsule())
                .overlay(Capsule().strokeBorder(selected ? Color.clear : TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    private func postRow(_ p: ForumPost) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                if p.isPinned {
                    Image(systemName: "pin.fill").font(.system(size: 9)).foregroundStyle(TLColor.accentText)
                }
                if p.isQA {
                    Text("HỎI ĐÁP").font(TLFont.mono(8, .bold)).tracking(0.5).foregroundStyle(TLColor.accentText)
                        .padding(.horizontal, 5).padding(.vertical, 2).background(TLColor.accent.opacity(0.12), in: Capsule())
                }
                if let cat = p.categoryName {
                    Text(cat).font(TLFont.mono(9)).foregroundStyle(TLColor.fg3)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(TLColor.surface2, in: Capsule())
                }
                Spacer(minLength: 4)
            }
            Text(p.title).font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
                .lineLimit(2).fixedSize(horizontal: false, vertical: true)
            if let tags = p.tags, !tags.isEmpty {
                HStack(spacing: 6) {
                    ForEach(tags.prefix(3), id: \.self) { t in
                        Text("#\(t)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.accentText)
                    }
                }
            }
            HStack(spacing: 10) {
                Text(p.authorName ?? "Người dùng").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                Text(ISODate.relative(p.createdAt)).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                Spacer()
                Label("\(p.commentCount)", systemImage: "bubble.left").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                Label("\(p.likeCount)", systemImage: "heart").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "bubble.left.and.text.bubble.right").font(.system(size: 30)).foregroundStyle(TLColor.fg4)
            Text("Chưa có bài viết nào").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
            Text("Hãy là người đầu tiên bắt đầu!").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
        }.frame(maxWidth: .infinity).padding(.top, 40)
    }
}
