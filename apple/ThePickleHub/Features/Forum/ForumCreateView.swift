import SwiftUI
import PhotosUI

@Observable
final class ForumCreateModel {
    var title = ""
    var content = ""
    var categoryID: String?
    var tags: [String] = []
    var tagInput = ""
    var isQA = false
    var imageData: [Data] = []
    var submitting = false
    var error: String?

    private let repo = ForumRepository()

    var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func addTag() {
        let t = tagInput.lowercased().trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: " ", with: "-")
        guard !t.isEmpty, tags.count < 5, !tags.contains(t) else { tagInput = ""; return }
        tags.append(t); tagInput = ""
    }

    @MainActor func submit(onDone: (String) -> Void) async {
        guard canSubmit else { return }
        submitting = true; error = nil
        let urls = imageData.isEmpty ? nil : await repo.uploadImages(imageData)
        do {
            let id = try await repo.createPost(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                content: content.trimmingCharacters(in: .whitespacesAndNewlines),
                categoryID: categoryID, tags: tags.isEmpty ? nil : tags,
                imageURLs: urls, isQA: isQA)
            onDone(id)
        } catch { self.error = error.localizedDescription }
        submitting = false
    }
}

/// Create a forum post — native port of web `/forum/new`.
struct ForumCreateView: View {
    let categories: [ForumCategory]
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model = ForumCreateModel()
    @State private var picked: [PhotosPickerItem] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                field("Tiêu đề") { tf($model.title, "Bạn muốn thảo luận gì?") }

                field("Chủ đề") {
                    Menu {
                        Button("Không") { model.categoryID = nil }
                        ForEach(categories) { c in Button(c.name) { model.categoryID = c.id } }
                    } label: {
                        HStack {
                            Text(categories.first { $0.id == model.categoryID }?.name ?? "Chọn chủ đề")
                                .font(TLFont.sans(14)).foregroundStyle(model.categoryID == nil ? TLColor.fg3 : TLColor.fg)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.system(size: 11)).foregroundStyle(TLColor.fg3)
                        }
                        .padding(.horizontal, 11).padding(.vertical, 11)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                }

                field("Nội dung") {
                    ZStack(alignment: .topLeading) {
                        if model.content.isEmpty {
                            Text("Chia sẻ chi tiết…").font(TLFont.sans(14)).foregroundStyle(TLColor.fg4)
                                .padding(.horizontal, 15).padding(.vertical, 16)
                        }
                        TextEditor(text: $model.content)
                            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg).scrollContentBackground(.hidden)
                            .frame(minHeight: 140).padding(.horizontal, 11).padding(.vertical, 8)
                    }
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                }

                field("Thẻ (tối đa 5)") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            TextField("Nhập rồi Enter", text: $model.tagInput)
                                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                                .submitLabel(.done).onSubmit { model.addTag() }
                        }
                        .padding(.horizontal, 11).padding(.vertical, 10)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                        if !model.tags.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(model.tags, id: \.self) { t in
                                        HStack(spacing: 4) {
                                            Text("#\(t)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg2)
                                            Button { model.tags.removeAll { $0 == t } } label: {
                                                Image(systemName: "xmark").font(.system(size: 8, weight: .bold)).foregroundStyle(TLColor.fg4)
                                            }
                                        }
                                        .padding(.horizontal, 8).padding(.vertical, 5).background(TLColor.surface2, in: Capsule())
                                    }
                                }
                            }
                        }
                    }
                }

                imageSection

                Toggle(isOn: $model.isQA) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Đánh dấu Hỏi–Đáp").font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                        Text("Cho phép chọn câu trả lời hay nhất").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                    }
                }.tint(TLColor.accent)

                if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }

                Button {
                    Haptics.success()
                    Task { await model.submit { _ in onCreated(); dismiss() } }
                } label: {
                    HStack(spacing: 6) {
                        if model.submitting { ProgressView().tint(TLColor.accentInk) }
                        Text(model.submitting ? "Đang đăng…" : "Đăng bài").font(TLFont.sans(14, .bold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain).disabled(!model.canSubmit || model.submitting).opacity(model.canSubmit ? 1 : 0.5)
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Bài viết mới")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var imageSection: some View {
        field("Ảnh (tối đa 4)") {
            VStack(alignment: .leading, spacing: 8) {
                PhotosPicker(selection: $picked, maxSelectionCount: 4, matching: .images) {
                    HStack(spacing: 6) { Image(systemName: "photo.on.rectangle"); Text("Thêm ảnh") }
                        .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentText)
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                }
                .onChange(of: picked) { _, items in
                    Task {
                        var datas: [Data] = []
                        for it in items.prefix(4) {
                            if let d = try? await it.loadTransferable(type: Data.self) { datas.append(d) }
                        }
                        model.imageData = datas
                    }
                }
                if !model.imageData.isEmpty {
                    Text("\(model.imageData.count) ảnh đã chọn").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
            }
        }
    }

    private func field<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased()).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            content()
        }
    }
    private func tf(_ binding: Binding<String>, _ placeholder: String) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 11).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
    }
}
