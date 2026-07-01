import SwiftUI
import PhotosUI

/// Account settings — native port of the web `/account` page: edit avatar +
/// display name, toggle public profile, delete account. Sign-out lives on the
/// parent ProfileView. Email/password change stay web-only (Supabase auth email
/// flows are not native).
@Observable
final class AccountSettingsModel {
    var displayName = ""
    var avatarURL: String?
    var isPublic = false
    var savingName = false
    var uploadingAvatar = false
    var togglingPublic = false
    var deleting = false
    var error: String?
    var savedName = false

    private let repo = ProfileRepository()

    @MainActor
    func seed(from profile: Profile) {
        displayName = profile.resolvedDisplayName == "—" ? "" : profile.resolvedDisplayName
        avatarURL = profile.avatarURL
        Task { isPublic = await repo.fetchIsPublicProfile() }
    }

    @MainActor
    func saveName() async {
        let name = displayName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        savingName = true; error = nil; savedName = false
        do { try await repo.updateDisplayName(name); savedName = true }
        catch { self.error = error.localizedDescription }
        savingName = false
    }

    @MainActor
    func upload(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        uploadingAvatar = true; error = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else { uploadingAvatar = false; return }
            avatarURL = try await repo.uploadAvatar(data: data, fileExtension: "jpg")
            Haptics.success()
        } catch { self.error = error.localizedDescription }
        uploadingAvatar = false
    }

    @MainActor
    func togglePublic(_ next: Bool) async {
        togglingPublic = true; error = nil
        do { try await repo.setPublicProfile(next); isPublic = next }
        catch { self.error = error.localizedDescription }
        togglingPublic = false
    }

    @MainActor
    func delete(onDone: @escaping () async -> Void) async {
        deleting = true; error = nil
        do { try await repo.deleteAccount(); await onDone() }
        catch { self.error = error.localizedDescription; deleting = false }
    }
}

struct AccountSettingsView: View {
    let profile: Profile
    var onChanged: () -> Void = {}

    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var model = AccountSettingsModel()
    @State private var pickedItem: PhotosPickerItem?
    @State private var showDeleteConfirm = false
    @State private var deleteText = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                avatarSection
                nameSection
                publicSection
                if let err = model.error {
                    Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                }
                dangerSection
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Cài đặt tài khoản")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { model.seed(from: profile) }
        .onChange(of: pickedItem) { _, item in
            Task { await model.upload(item); onChanged() }
        }
        .alert("Xoá tài khoản?", isPresented: $showDeleteConfirm) {
            TextField("Nhập XOÁ để xác nhận", text: $deleteText)
            Button("Huỷ", role: .cancel) { deleteText = "" }
            Button("Xoá vĩnh viễn", role: .destructive) {
                Task { await model.delete { await session.signOut() } }
            }.disabled(deleteText.trimmingCharacters(in: .whitespaces).uppercased() != "XOÁ")
        } message: {
            Text("Toàn bộ hồ sơ, giải đấu và nội dung của bạn sẽ bị xoá. Không thể hoàn tác.")
        }
    }

    // MARK: Avatar

    private var avatarSection: some View {
        HStack(spacing: 16) {
            ZStack {
                if let urlString = model.avatarURL, let url = URL(string: urlString) {
                    AsyncImage(url: url) { img in
                        img.resizable().scaledToFill()
                    } placeholder: { initialCircle }
                    .frame(width: 72, height: 72).clipShape(Circle())
                } else {
                    initialCircle.frame(width: 72, height: 72)
                }
                if model.uploadingAvatar {
                    Circle().fill(.black.opacity(0.4)).frame(width: 72, height: 72)
                    ProgressView().tint(.white)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                PhotosPicker(selection: $pickedItem, matching: .images) {
                    Text("Đổi ảnh đại diện").font(TLFont.sans(14, .semibold))
                        .foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(TLColor.accent, in: Capsule())
                }
                .disabled(model.uploadingAvatar)
                Text("JPG hoặc PNG").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }
            Spacer()
        }
    }

    private var initialCircle: some View {
        Circle().fill(TLColor.surface2)
            .overlay(
                Text(String(model.displayName.prefix(1)).uppercased())
                    .font(TLFont.serif(28)).foregroundStyle(TLColor.fg2)
            )
    }

    // MARK: Display name

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TÊN HIỂN THỊ").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            HStack(spacing: 10) {
                TextField("Tên của bạn", text: $model.displayName)
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 11).padding(.vertical, 10)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                Button {
                    Haptics.light()
                    Task { await model.saveName(); onChanged() }
                } label: {
                    Group {
                        if model.savingName { ProgressView().tint(TLColor.accentInk) }
                        else { Text(model.savedName ? "Đã lưu" : "Lưu").font(TLFont.sans(14, .bold)) }
                    }
                    .foregroundStyle(TLColor.accentInk)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(model.displayName.trimmingCharacters(in: .whitespaces).isEmpty || model.savingName)
            }
        }
    }

    // MARK: Public profile

    private var publicSection: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Hồ sơ công khai").font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                Text("Cho phép người khác xem hồ sơ của bạn").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
            }
            Spacer()
            if model.togglingPublic { ProgressView().tint(TLColor.accentText) }
            Toggle("", isOn: Binding(
                get: { model.isPublic },
                set: { next in Task { await model.togglePublic(next) } }
            )).labelsHidden().tint(TLColor.accent).disabled(model.togglingPublic)
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Danger zone

    private var dangerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("VÙNG NGUY HIỂM").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.live)
            Button(role: .destructive) { Haptics.light(); showDeleteConfirm = true } label: {
                HStack(spacing: 6) {
                    if model.deleting { ProgressView().tint(TLColor.live) }
                    Text(model.deleting ? "Đang xoá..." : "Xoá tài khoản")
                }
                .font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.live)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                    .strokeBorder(TLColor.live.opacity(0.5), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(model.deleting)
        }
        .padding(.top, 8)
    }
}
