import SwiftUI
import PhotosUI

// MARK: Manage (members + settings entry)

@Observable
final class ClubManageModel {
    var members: [ClubMember] = []
    var loaded = false
    var busyID: UUID?
    private let repo = ClubRepository()
    let club: Club
    init(club: Club) { self.club = club }

    var pending: [ClubMember] { members.filter { $0.status == "pending" } }
    var active: [ClubMember] { members.filter { $0.status == "active" } }

    @MainActor func load() async {
        members = await repo.members(clubID: club.id)
        loaded = true
    }
    @MainActor func approve(_ m: ClubMember) async {
        busyID = m.profileID
        try? await repo.approveMember(clubID: club.id, profileID: m.profileID)
        await load(); busyID = nil
    }
    @MainActor func remove(_ m: ClubMember) async {
        busyID = m.profileID
        try? await repo.removeMember(clubID: club.id, profileID: m.profileID)
        await load(); busyID = nil
    }
}

/// Club management (`/clb/:slug/quan-ly`) — approve join requests, view/remove
/// members, and a link to edit club settings. Organizer-only (reached from the
/// "Quản trị" button which only shows for creator/manager).
struct ClubManageView: View {
    let club: Club
    @State private var model: ClubManageModel

    init(club: Club) { self.club = club; _model = State(initialValue: ClubManageModel(club: club)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                NavigationLink { EditClubView(club: club) } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "slider.horizontal.3").font(.system(size: 15)).foregroundStyle(TLColor.accentText).frame(width: 22)
                        Text("Chỉnh sửa CLB").font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg)
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(TLColor.fg3)
                    }
                    .padding(14)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
                }.buttonStyle(.plain)

                if !model.loaded {
                    ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 20)
                } else {
                    if !model.pending.isEmpty {
                        section("YÊU CẦU THAM GIA (\(model.pending.count))") {
                            ForEach(model.pending) { m in memberRow(m, pending: true) }
                        }
                    }
                    section("THÀNH VIÊN (\(model.active.count))") {
                        if model.active.isEmpty {
                            Text("Chưa có thành viên.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                        } else {
                            ForEach(model.active) { m in memberRow(m, pending: false) }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Quản lý CLB")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    private func memberRow(_ m: ClubMember, pending: Bool) -> some View {
        let busy = model.busyID == m.profileID
        return HStack(spacing: 12) {
            avatar(m)
            VStack(alignment: .leading, spacing: 2) {
                Text(m.name).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg).lineLimit(1)
                if let d = m.duprDoubles ?? m.duprSingles {
                    Text("DUPR \(String(format: "%.2f", d))").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
            }
            Spacer(minLength: 6)
            if busy {
                ProgressView().tint(TLColor.accentText)
            } else if pending {
                Button { Task { await model.approve(m) } } label: {
                    Text("Duyệt").font(TLFont.mono(11, .bold)).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 12).padding(.vertical, 6).background(TLColor.accent, in: Capsule())
                }.buttonStyle(.plain)
                Button { Task { await model.remove(m) } } label: {
                    Text("Từ chối").font(TLFont.mono(11)).foregroundStyle(TLColor.live)
                }.buttonStyle(.plain)
            } else {
                Button(role: .destructive) { Task { await model.remove(m) } } label: {
                    Image(systemName: "person.badge.minus").font(.system(size: 14)).foregroundStyle(TLColor.fg3)
                }.buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func avatar(_ m: ClubMember) -> some View {
        Group {
            if let s = m.avatarURL, let u = URL(string: s) {
                AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { initial(m.initials) }
            } else { initial(m.initials) }
        }.frame(width: 36, height: 36).clipShape(Circle())
    }
    private func initial(_ s: String) -> some View {
        Circle().fill(TLColor.surface2).overlay(Text(s).font(TLFont.mono(12, .semibold)).foregroundStyle(TLColor.fg2))
    }
    private func section<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            content()
        }
    }
}

// MARK: Edit settings + archive

@Observable
final class EditClubModel {
    var name: String
    var description: String
    var location: String
    var logoURL: String?
    var newImage: Data?
    var saving = false
    var archiving = false
    var error: String?
    let club: Club
    private let repo = ClubRepository()

    init(club: Club) {
        self.club = club
        name = club.name
        description = club.description ?? ""
        location = club.locationText ?? ""
        logoURL = club.logoURL
    }

    var nameValid: Bool { let n = name.trimmingCharacters(in: .whitespaces); return n.count >= 3 && n.count <= 100 }
    var locationValid: Bool { location.trimmingCharacters(in: .whitespaces).count >= 3 }
    var canSave: Bool { !saving && nameValid && locationValid }

    @MainActor func save(onDone: () -> Void) async {
        guard canSave else { return }
        saving = true; error = nil
        var url = logoURL
        if let newImage { url = await repo.uploadLogo(data: newImage) ?? logoURL }
        do {
            try await repo.updateClub(id: club.id, name: name.trimmingCharacters(in: .whitespaces),
                                      description: description.trimmingCharacters(in: .whitespaces),
                                      location: location.trimmingCharacters(in: .whitespaces), logoURL: url)
            onDone()
        } catch { self.error = error.localizedDescription }
        saving = false
    }
    @MainActor func archive(onDone: () -> Void) async {
        archiving = true; error = nil
        do { try await repo.archiveClub(id: club.id); onDone() }
        catch { self.error = error.localizedDescription; archiving = false }
    }
}

/// Edit club settings + danger-zone archive (`/clb/:slug/quan-ly/cai-dat`).
struct EditClubView: View {
    let club: Club
    @State private var model: EditClubModel
    @State private var picked: PhotosPickerItem?
    @State private var preview: Image?
    @State private var showArchive = false
    @State private var archiveTyped = ""
    @Environment(\.dismiss) private var dismiss

    init(club: Club) { self.club = club; _model = State(initialValue: EditClubModel(club: club)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                logoField
                field("Tên CLB *") { tf($model.name, "Tên CLB") }
                field("Mô tả") {
                    ZStack(alignment: .topLeading) {
                        if model.description.isEmpty {
                            Text("Giới thiệu ngắn…").font(TLFont.sans(14)).foregroundStyle(TLColor.fg4).padding(.horizontal, 15).padding(.vertical, 14)
                        }
                        TextEditor(text: $model.description).font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                            .scrollContentBackground(.hidden).frame(minHeight: 80).padding(.horizontal, 11).padding(.vertical, 6)
                    }
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                }
                field("Khu vực *") { tf($model.location, "Khu vực") }
                Text("Slug: \(club.slug)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }

                Button {
                    Haptics.success(); Task { await model.save { dismiss() } }
                } label: {
                    HStack(spacing: 6) {
                        if model.saving { ProgressView().tint(TLColor.accentInk) }
                        Text(model.saving ? "Đang lưu…" : "Lưu thay đổi").font(TLFont.sans(14, .bold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(!model.canSave).opacity(model.canSave ? 1 : 0.5)

                dangerZone
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Chỉnh sửa CLB")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Lưu trữ CLB?", isPresented: $showArchive) {
            TextField("Gõ đúng tên CLB để xác nhận", text: $archiveTyped)
            Button("Huỷ", role: .cancel) { archiveTyped = "" }
            Button("Lưu trữ", role: .destructive) {
                Task { await model.archive { dismiss() } }
            }.disabled(archiveTyped.trimmingCharacters(in: .whitespaces) != club.name)
        } message: {
            Text("CLB sẽ bị ẩn khỏi danh sách. Gõ \"\(club.name)\" để xác nhận.")
        }
    }

    private var dangerZone: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("VÙNG NGUY HIỂM").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.live)
            Button(role: .destructive) { showArchive = true } label: {
                HStack(spacing: 6) {
                    if model.archiving { ProgressView().tint(TLColor.live) }
                    Image(systemName: "archivebox"); Text("Lưu trữ CLB")
                }
                .font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.live)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.live.opacity(0.5), lineWidth: 1))
            }.buttonStyle(.plain).disabled(model.archiving)
        }.padding(.top, 8)
    }

    private var logoField: some View {
        field("Logo") {
            HStack(spacing: 12) {
                PhotosPicker(selection: $picked, matching: .images) {
                    ZStack {
                        if let preview { preview.resizable().scaledToFill() }
                        else if let s = model.logoURL, let u = URL(string: s) {
                            AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { logoPlaceholder }
                        } else { logoPlaceholder }
                    }
                    .frame(width: 72, height: 72).clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
                }
                Text("Chạm để đổi logo").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }
            .onChange(of: picked) { _, item in
                Task {
                    if let d = try? await item?.loadTransferable(type: Data.self) {
                        model.newImage = d
                        if let ui = UIImage(data: d) { preview = Image(uiImage: ui) }
                    }
                }
            }
        }
    }
    private var logoPlaceholder: some View {
        Image(systemName: "photo").font(.system(size: 16)).foregroundStyle(TLColor.fg3)
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
