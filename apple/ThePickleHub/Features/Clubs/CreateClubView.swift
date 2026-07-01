import SwiftUI
import PhotosUI

/// Slugify a name → url-safe slug (Vietnamese diacritics stripped), ≤50 chars.
/// Mirror of web CreateClub.slugify.
func clubSlugify(_ input: String) -> String {
    let base = input.folding(options: .diacriticInsensitive, locale: Locale(identifier: "en_US_POSIX"))
        .replacingOccurrences(of: "đ", with: "d").replacingOccurrences(of: "Đ", with: "d")
        .lowercased()
    let hyphenated = base.replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
    let trimmed = hyphenated.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return String(trimmed.prefix(50))
}

@Observable
final class CreateClubModel {
    var name = ""
    var slug = ""
    var slugTouched = false
    var description = ""
    var location = ""
    var imageData: Data?
    var slugTaken = false
    var slugChecking = false
    var submitting = false
    var error: String?

    private let repo = ClubRepository()
    private var slugTask: Task<Void, Never>?

    private static let slugRE = try! NSRegularExpression(pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$")
    var slugValid: Bool {
        let s = slug
        guard s.count >= 3, s.count <= 50 else { return false }
        return Self.slugRE.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }
    var nameValid: Bool { let n = name.trimmingCharacters(in: .whitespaces); return n.count >= 3 && n.count <= 100 }
    var locationValid: Bool { location.trimmingCharacters(in: .whitespaces).count >= 3 }
    var canSubmit: Bool {
        !submitting && nameValid && slugValid && !slugTaken && !slugChecking && locationValid
    }

    func onNameChange() {
        if !slugTouched { slug = clubSlugify(name); scheduleSlugCheck() }
    }
    func onSlugEdit(_ new: String) { slugTouched = true; slug = clubSlugify(new); scheduleSlugCheck() }

    /// Debounced (350ms) uniqueness check, web parity.
    func scheduleSlugCheck() {
        slugTask?.cancel()
        guard slugValid else { slugTaken = false; slugChecking = false; return }
        slugChecking = true
        slugTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            if Task.isCancelled { return }
            slugTaken = await repo.slugTaken(slug)
            slugChecking = false
        }
    }

    @MainActor func submit(onDone: (String) -> Void) async {
        guard canSubmit else { return }
        submitting = true; error = nil
        var logoURL: String?
        if let imageData { logoURL = await repo.uploadLogo(data: imageData) }
        do {
            _ = try await repo.createClub(slug: slug, name: name.trimmingCharacters(in: .whitespaces),
                                          description: description.trimmingCharacters(in: .whitespaces),
                                          location: location.trimmingCharacters(in: .whitespaces), logoURL: logoURL)
            onDone(slug)
        } catch { self.error = error.localizedDescription }
        submitting = false
    }
}

struct CreateClubView: View {
    var onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var model = CreateClubModel()
    @State private var picked: PhotosPickerItem?
    @State private var previewImage: Image?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    field("Tên CLB *") {
                        VStack(alignment: .leading, spacing: 4) {
                            tf($model.name, "VD: CLB Pickleball Sài Gòn").onChange(of: model.name) { _, _ in model.onNameChange() }
                            if !model.name.isEmpty && !model.nameValid {
                                Text("Tên cần 3–100 ký tự.").font(TLFont.mono(9.5)).foregroundStyle(TLColor.live)
                            }
                        }
                    }
                    field("Đường dẫn (slug) *") {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                TextField("clb-sai-gon", text: Binding(get: { model.slug }, set: { model.onSlugEdit($0) }))
                                    .font(TLFont.mono(13)).foregroundStyle(TLColor.fg).autocorrectionDisabled().textInputAutocapitalization(.never)
                                    .padding(.horizontal, 11).padding(.vertical, 10)
                                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                                Button("Tự tạo") { model.slugTouched = false; model.slug = clubSlugify(model.name); model.scheduleSlugCheck() }
                                    .font(TLFont.sans(12, .semibold)).foregroundStyle(TLColor.accentText)
                            }
                            slugStatus
                        }
                    }
                    field("Mô tả") {
                        ZStack(alignment: .topLeading) {
                            if model.description.isEmpty {
                                Text("Giới thiệu ngắn về CLB…").font(TLFont.sans(14)).foregroundStyle(TLColor.fg4)
                                    .padding(.horizontal, 15).padding(.vertical, 14)
                            }
                            TextEditor(text: $model.description).font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                                .scrollContentBackground(.hidden).frame(minHeight: 80).padding(.horizontal, 11).padding(.vertical, 6)
                        }
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                    field("Khu vực *") { tf($model.location, "VD: Quận 1, TP.HCM") }
                    logoField
                    if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                    Text("Mỗi người tạo tối đa 3 CLB.").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    submitButton
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Tạo CLB")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Huỷ") { dismiss() }.foregroundStyle(TLColor.fg3) } }
        }
    }

    @ViewBuilder private var slugStatus: some View {
        if model.slug.count > 0 && !model.slugValid {
            Text("Slug 3–50 ký tự, chỉ a–z, 0–9, gạch ngang.").font(TLFont.mono(9.5)).foregroundStyle(TLColor.live)
        } else if model.slugValid && model.slugChecking {
            Text("Đang kiểm tra…").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
        } else if model.slugValid && model.slugTaken {
            Text("Đã có CLB dùng slug này.").font(TLFont.mono(9.5)).foregroundStyle(TLColor.live)
        } else if model.slugValid {
            Text("Slug khả dụng ✓").font(TLFont.mono(9.5)).foregroundStyle(TLColor.accentText)
        }
    }

    private var logoField: some View {
        field("Logo") {
            HStack(spacing: 12) {
                PhotosPicker(selection: $picked, matching: .images) {
                    ZStack {
                        if let previewImage {
                            previewImage.resizable().scaledToFill()
                        } else {
                            VStack(spacing: 3) {
                                Image(systemName: "photo").font(.system(size: 16))
                                Text("Tải lên").font(TLFont.mono(9))
                            }.foregroundStyle(TLColor.fg3)
                        }
                    }
                    .frame(width: 72, height: 72).clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: previewImage == nil ? [4] : [])))
                }
                if previewImage != nil {
                    Button("Xoá") { picked = nil; previewImage = nil; model.imageData = nil }
                        .font(TLFont.sans(12, .semibold)).foregroundStyle(TLColor.live)
                }
            }
            .onChange(of: picked) { _, item in
                Task {
                    if let d = try? await item?.loadTransferable(type: Data.self) {
                        model.imageData = d
                        if let ui = UIImage(data: d) { previewImage = Image(uiImage: ui) }
                    }
                }
            }
        }
    }

    private var submitButton: some View {
        Button {
            Haptics.success()
            Task { await model.submit { _ in onCreated(); dismiss() } }
        } label: {
            HStack(spacing: 6) {
                if model.submitting { ProgressView().tint(TLColor.accentInk) }
                Text(model.submitting ? "Đang tạo…" : "Tạo CLB").font(TLFont.sans(14, .bold))
            }
            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain).disabled(!model.canSubmit).opacity(model.canSubmit ? 1 : 0.5)
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
