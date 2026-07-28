import SwiftUI

@Observable
@MainActor
final class OnboardingModel {
    var displayName = ""
    var username = ""
    var usernameTouched = false
    var skill: String?
    var checking = false
    var available: Bool?      // nil = unknown, true/false after check
    var saving = false
    var error: String?

    private let repo = ProfileRepository()
    private var checkTask: Task<Void, Never>?

    static let skills: [(value: String, label: String, desc: String)] = [
        ("beginner", "NGƯỜI MỚI", "Mới bắt đầu, đang học"),
        ("intermediate", "TRUNG CẤP", "Chơi ổn định, hiểu luật"),
        ("advanced", "NÂNG CAO", "Thi đấu giải phong trào"),
        ("pro", "CHUYÊN NGHIỆP", "Trình độ cao / vận động viên"),
    ]

    // ^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$  (3–32, web USERNAME_RE)
    private static let usernameRE = try! NSRegularExpression(pattern: "^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$")
    var usernameValid: Bool {
        let u = username
        return Self.usernameRE.firstMatch(in: u, range: NSRange(u.startIndex..., in: u)) != nil
    }
    var canSave: Bool {
        let n = displayName.trimmingCharacters(in: .whitespaces)
        return !saving && n.count >= 2 && n.count <= 50 && usernameValid && available == true && skill != nil
    }

    /// User's current username — checking it must read "available" (self-bypass,
    /// mirrors web ProfileSetup: username_is_available returns false for your own row).
    private var ownUsername: String?

    func seed(from profile: Profile) {
        if displayName.isEmpty { displayName = profile.resolvedDisplayName == "—" ? "" : profile.resolvedDisplayName }
        ownUsername = profile.username?.nonEmpty
        if username.isEmpty, let u = ownUsername { username = u; scheduleCheck() }
    }

    func onUsernameEdit(_ new: String) {
        usernameTouched = true
        username = new.lowercased().trimmingCharacters(in: .whitespaces)
        scheduleCheck()
    }
    func suggestFromName() {
        guard !usernameTouched else { return }
        username = clubSlugify(displayName)   // reuse the diacritic-stripping slugify
        scheduleCheck()
    }

    /// Debounced availability check (web hits username_is_available).
    func scheduleCheck() {
        checkTask?.cancel()
        available = nil
        guard usernameValid else { checking = false; return }
        if username == ownUsername { available = true; checking = false; return }
        checking = true
        checkTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            if Task.isCancelled { return }
            available = await repo.usernameAvailable(username)
            checking = false
        }
    }

    @MainActor func save(onDone: () -> Void) async {
        guard canSave, let skill else { return }
        saving = true; error = nil
        do {
            try await repo.completeOnboarding(displayName: displayName.trimmingCharacters(in: .whitespaces),
                                              username: username, skillLevel: skill)
            onDone()
        } catch { self.error = error.localizedDescription }
        saving = false
    }
}

/// Profile setup — native port of the web `/onboarding` ProfileSetup step
/// (display name + username + skill level → marks onboarding complete). The
/// optional DUPR / venue / suggested-follows steps are skipped (DUPR has its
/// own native chip). Reached from Profile.
struct OnboardingView: View {
    let profile: Profile
    var onDone: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @State private var model = OnboardingModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Hoàn tất hồ sơ để bạn bè tìm thấy bạn và xếp cặp đúng trình.")
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg2).fixedSize(horizontal: false, vertical: true)

                field("Tên hiển thị") {
                    tf($model.displayName, "Tên của bạn")
                        .textContentType(.name)
                        .onChange(of: model.displayName) { _, _ in model.suggestFromName() }
                }
                field("Username") {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text("@").font(TLFont.mono(14)).foregroundStyle(TLColor.fg3)
                            TextField("ten-cua-ban", text: Binding(get: { model.username }, set: { model.onUsernameEdit($0) }))
                                .font(TLFont.mono(14)).foregroundStyle(TLColor.fg)
                                .autocorrectionDisabled().textInputAutocapitalization(.never)
                                .textContentType(.username).keyboardType(.asciiCapable)
                        }
                        .padding(.horizontal, 11).padding(.vertical, 10)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                        usernameStatus
                    }
                }
                field("Trình độ") {
                    VStack(spacing: 8) { ForEach(OnboardingModel.skills, id: \.value) { skillRow($0) } }
                }

                if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }

                Button {
                    Haptics.light()
                    Task {
                        await model.save { onDone(); dismiss() }
                        if model.error == nil { Haptics.success() } else { Haptics.error() }
                    }
                } label: {
                    HStack(spacing: 6) {
                        if model.saving { ProgressView().tint(TLColor.accentInk) }
                        Text(model.saving ? "Đang lưu…" : "Hoàn tất").font(TLFont.sans(14, .bold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(!model.canSave).opacity(model.canSave ? 1 : 0.5)
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Thiết lập hồ sơ")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { model.seed(from: profile) }
    }

    @ViewBuilder private var usernameStatus: some View {
        if !model.username.isEmpty && !model.usernameValid {
            Text("3–32 ký tự, chữ thường/số/gạch ngang.").font(TLFont.mono(11)).foregroundStyle(TLColor.live)
        } else if model.usernameValid && model.checking {
            Text("Đang kiểm tra…").font(TLFont.mono(11)).foregroundStyle(TLColor.fg4)
        } else if model.available == false {
            Text("Username đã có người dùng.").font(TLFont.mono(11)).foregroundStyle(TLColor.live)
        } else if model.available == true {
            Text("Khả dụng ✓").font(TLFont.mono(11)).foregroundStyle(TLColor.accentText)
        }
    }

    private func skillRow(_ s: (value: String, label: String, desc: String)) -> some View {
        let selected = model.skill == s.value
        return Button { Haptics.light(); model.skill = s.value } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.label).font(TLFont.mono(11, .bold)).tracking(0.5).foregroundStyle(selected ? TLColor.accentText : TLColor.fg)
                    Text(s.desc).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                }
                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 16)).foregroundStyle(selected ? TLColor.accentText : TLColor.fg4)
            }
            .padding(13)
            .background(selected ? TLColor.accent.opacity(0.08) : TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(selected ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
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
