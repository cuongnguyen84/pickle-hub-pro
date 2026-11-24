import PhotosUI
import SwiftUI

@Observable
final class SocialPostComposerModel {
    var image: ProcessedImage?
    var body = ""
    var topic: SocialPostTopic?
    var submitting = false
    var error: String?
    /// Set once the server accepts the post; drives the confirmation
    /// state so the author sees whether the post is live or queued.
    var created: CreatedSocialPost?

    private let repo = SocialPostRepository()

    var canSubmit: Bool { image != nil && !submitting && created == nil }

    @MainActor
    func submit() async {
        guard let image, canSubmit else { return }
        submitting = true
        error = nil
        do {
            created = try await repo.createPost(
                image: image, body: body, topic: topic
            )
        } catch {
            self.error = error.localizedDescription
        }
        submitting = false
    }
}

/// Composer sheet for a community photo post - the native twin of the
/// web feed composer (PR-A): one photo (required), an optional caption
/// and one topic from the closed list. The image runs through the same
/// ImagePipeline policy the forum uses; the create-post edge function
/// stores it and decides pending vs approved.
struct SocialPostComposerView: View {
    /// Called once, right after the server accepts the post, so the
    /// feed behind the sheet can refresh.
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model = SocialPostComposerModel()
    @State private var picked: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                if let created = model.created {
                    confirmation(created)
                } else {
                    form
                }
            }
            .background(TLColor.bg)
            .navigationTitle("Bài viết mới")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 18) {
            field("Ảnh bài đăng") {
                // Hoisted out of the PhotosPicker label closure: that
                // builder is a nonisolated context and cannot touch the
                // main-actor-isolated model directly.
                let pickerTitle = model.image == nil
                    ? String(localized: "Chọn ảnh từ thư viện")
                    : String(localized: "Đổi ảnh khác")
                VStack(alignment: .leading, spacing: 8) {
                    if let image = model.image,
                       let uiImage = UIImage(data: image.data) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    PhotosPicker(selection: $picked, matching: .images) {
                        HStack(spacing: 6) {
                            Image(systemName: "photo.on.rectangle")
                            Text(pickerTitle)
                        }
                        .font(TLFont.sans(13, .semibold))
                        .foregroundStyle(TLColor.accentText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(TLColor.border, lineWidth: 1)
                        )
                    }
                    .onChange(of: picked) { _, item in
                        guard let item else { return }
                        Task { @MainActor in
                            do {
                                model.image = try await ImagePipeline.load(
                                    item, policy: .forum
                                )
                                model.error = nil
                            } catch {
                                picked = nil
                                model.image = nil
                                model.error = error.localizedDescription
                            }
                        }
                    }
                }
            }

            field("Nội dung") {
                ZStack(alignment: .topLeading) {
                    if model.body.isEmpty {
                        Text("Kể câu chuyện đằng sau bức ảnh…")
                            .font(TLFont.sans(14))
                            .foregroundStyle(TLColor.fg4)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 16)
                    }
                    TextEditor(text: $model.body)
                        .font(TLFont.sans(14))
                        .foregroundStyle(TLColor.fg)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 100)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 8)
                }
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(TLColor.border, lineWidth: 1)
                )
            }

            field("Chủ đề bài đăng") {
                let topicTitle = model.topic?.label
                    ?? String(localized: "Không đặt chủ đề")
                Menu {
                    Button("Không đặt chủ đề") { model.topic = nil }
                    ForEach(SocialPostTopic.allCases, id: \.rawValue) { topic in
                        Button(topic.label) { model.topic = topic }
                    }
                } label: {
                    HStack {
                        Text(topicTitle)
                            .font(TLFont.sans(14))
                            .foregroundStyle(model.topic == nil ? TLColor.fg3 : TLColor.fg)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 11))
                            .foregroundStyle(TLColor.fg3)
                    }
                    .padding(.horizontal, 11)
                    .padding(.vertical, 11)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(TLColor.border, lineWidth: 1)
                    )
                }
            }

            if let err = model.error {
                Text(err)
                    .font(TLFont.sans(12))
                    .foregroundStyle(TLColor.live)
            }

            Button {
                Task {
                    await model.submit()
                    if model.created != nil { onCreated() }
                }
            } label: {
                HStack(spacing: 6) {
                    if model.submitting {
                        ProgressView().tint(TLColor.accentInk)
                    }
                    Text("Đăng bài").font(TLFont.sans(14, .bold))
                }
                .foregroundStyle(TLColor.accentInk)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(!model.canSubmit)
            .opacity(model.canSubmit ? 1 : 0.5)
        }
        .padding(16)
    }

    private func confirmation(_ created: CreatedSocialPost) -> some View {
        VStack(spacing: 14) {
            Image(systemName: created.isPending ? "clock.badge.checkmark" : "checkmark.circle")
                .font(.system(size: 40))
                .foregroundStyle(TLColor.accentText)
            Text(created.isPending
                 ? "Bài đã gửi, đang chờ quản trị viên duyệt."
                 : "Bài đã lên bảng tin.")
                .font(TLFont.sans(15, .semibold))
                .foregroundStyle(TLColor.fg)
                .multilineTextAlignment(.center)
            Button("Đóng lại") { dismiss() }
                .font(TLFont.sans(14, .bold))
                .foregroundStyle(TLColor.accentInk)
                .padding(.horizontal, 28)
                .padding(.vertical, 12)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
        .padding(.top, 80)
    }

    private func field<C: View>(
        _ label: LocalizedStringKey,
        @ViewBuilder _ content: () -> C
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .textCase(.uppercase)
                .font(TLFont.mono(10, .semibold))
                .tracking(0.8)
                .foregroundStyle(TLColor.fg3)
            content()
        }
    }
}
