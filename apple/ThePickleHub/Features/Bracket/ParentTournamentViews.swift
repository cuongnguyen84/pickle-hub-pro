import SwiftUI

@Observable
@MainActor
private final class ParentTournamentDetailModel {
    enum Phase { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var detail: ParentTournamentDetail?
    var currentUserID: UUID?
    var working = false
    var errorMessage: String?

    private let shareID: String
    private let repository = ParentTournamentRepository()

    init(shareID: String) {
        self.shareID = shareID
    }

    var isOwner: Bool {
        guard let detail, let currentUserID else { return false }
        return detail.tournament.creatorUserID == currentUserID
    }

    func load() async {
        phase = .loading
        do {
            async let loaded = repository.load(shareID: shareID)
            async let userID = repository.currentUserID()
            detail = try await loaded
            currentUserID = await userID
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func attach(tableShareID: String) async -> Bool {
        guard let parentID = detail?.tournament.id else { return false }
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            try await repository.attach(tableShareID: tableShareID, to: parentID)
            detail = try await repository.load(shareID: shareID)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func delete() async -> Bool {
        guard let id = detail?.tournament.id else { return false }
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            try await repository.delete(id: id)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

/// Public/owner native page for a multi-event tournament.
struct ParentTournamentDetailView: View {
    let shareID: String
    var fallbackName = String(localized: "Giải tổng")

    @Environment(\.dismiss) private var dismiss
    @State private var model: ParentTournamentDetailModel
    @State private var showCreateEvent = false
    @State private var showDeleteConfirmation = false
    @State private var childTarget: CreatedQuickTableRef?

    private struct CreatedQuickTableRef: Identifiable, Hashable {
        let id: String
        let name: String
    }

    init(shareID: String, fallbackName: String = String(localized: "Giải tổng")) {
        self.shareID = shareID
        self.fallbackName = fallbackName
        _model = State(initialValue: ParentTournamentDetailModel(shareID: shareID))
    }

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                ScrollView { TLLoadingView(rows: 4).padding(22) }
            case .failed(let message):
                TLErrorState(message: message) { Task { await model.load() } }
            case .loaded:
                if let detail = model.detail {
                    content(detail)
                } else {
                    TLErrorState(message: String(localized: "Không tìm thấy giải tổng.")) {
                        Task { await model.load() }
                    }
                }
            }
        }
        .background(TLColor.bg)
        .navigationTitle(model.detail?.tournament.name ?? fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $showCreateEvent) {
            CreateQuickTableView(onCreated: { createdShareID, name in
                Task {
                    if await model.attach(tableShareID: createdShareID) {
                        childTarget = CreatedQuickTableRef(id: createdShareID, name: name)
                    }
                }
            })
        }
        .navigationDestination(item: $childTarget) { event in
            QuickTableDetailView(shareID: event.id, fallbackName: event.name)
        }
        .alert("Xóa giải tổng?", isPresented: $showDeleteConfirmation) {
            Button("Hủy", role: .cancel) {}
            Button("Xóa", role: .destructive) {
                Task {
                    if await model.delete() {
                        Haptics.success()
                        dismiss()
                    }
                }
            }
        } message: {
            Text("Thao tác này không thể hoàn tác. Các nội dung thi đấu KHÔNG bị xóa — chúng sẽ tách ra thành giải riêng.")
        }
        .alert("Không thể hoàn tất", isPresented: Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )) {
            Button("Đóng", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private func content(_ detail: ParentTournamentDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                hero(detail.tournament, eventCount: detail.events.count)

                HStack {
                    Text("NỘI DUNG THI ĐẤU")
                        .font(TLFont.mono(11, .semibold))
                        .tracking(1.5)
                        .foregroundStyle(TLColor.fg2)
                    Spacer()
                    if model.isOwner {
                        Button {
                            Haptics.light()
                            showCreateEvent = true
                        } label: {
                            Label("Tạo nội dung", systemImage: "plus")
                                .font(TLFont.sans(13, .semibold))
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(TLColor.accent)
                        .foregroundStyle(TLColor.accentInk)
                        .disabled(model.working)
                    }
                }

                if detail.events.isEmpty {
                    TLEmptyState(
                        icon: "square.stack.3d.up",
                        title: "Chưa có nội dung thi đấu",
                        subtitle: model.isOwner
                            ? "Tạo Quick Table đầu tiên; app sẽ tự gắn vào giải tổng này."
                            : "Ban tổ chức chưa công bố nội dung nào.",
                        actionTitle: model.isOwner ? "Tạo nội dung" : nil,
                        action: model.isOwner ? { showCreateEvent = true } : nil
                    )
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                } else {
                    VStack(spacing: 10) {
                        ForEach(detail.events) { event in
                            Button {
                                Haptics.light()
                                childTarget = CreatedQuickTableRef(id: event.shareID, name: event.displayName)
                            } label: {
                                eventRow(event)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if model.isOwner {
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        Label("Xóa giải tổng", systemImage: "trash")
                            .font(TLFont.sans(13, .semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(TLColor.live)
                    .disabled(model.working)
                }
            }
            .padding(22)
        }
    }

    private func hero(_ tournament: ParentTournament, eventCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            if let banner = tournament.bannerURL.flatMap(WebRoutes.asset) {
                AsyncImage(url: banner) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Rectangle().fill(TLColor.surface2)
                }
                .frame(height: 160)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            Text("GIẢI TỔNG · \(eventCount) NỘI DUNG")
                .font(TLFont.mono(10, .bold))
                .tracking(1.5)
                .foregroundStyle(TLColor.accentText)

            Text(tournament.name)
                .font(TLFont.serif(31))
                .italic()
                .foregroundStyle(TLColor.fg)

            HStack(spacing: 14) {
                if let date = eventDateLabel(tournament.eventDate) {
                    Label(date, systemImage: "calendar")
                }
                if let location = tournament.location?.nonEmpty {
                    Label(location, systemImage: "mappin.and.ellipse")
                }
            }
            .font(TLFont.mono(10.5))
            .foregroundStyle(TLColor.fg3)

            if let description = tournament.description?.nonEmpty {
                Text(description)
                    .font(TLFont.sans(14))
                    .foregroundStyle(TLColor.fg2)
                    .lineSpacing(2)
            }

            ShareLink(item: WebRoutes.parentTournament(shareID: tournament.shareID)) {
                Label("Chia sẻ trang giải", systemImage: "square.and.arrow.up")
                    .font(TLFont.sans(13, .semibold))
                    .frame(minHeight: 44)
            }
            .foregroundStyle(TLColor.accentText)
        }
        .padding(18)
        .background(
            LinearGradient(
                colors: [TLColor.accent.opacity(0.12), TLColor.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 20, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(TLColor.border, lineWidth: 1)
        )
    }

    private func eventRow(_ event: ParentTournamentEvent) -> some View {
        HStack(spacing: 13) {
            Image(systemName: event.isDoubles == true ? "person.2.fill" : "person.fill")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(TLColor.accentText)
                .frame(width: 40, height: 40)
                .background(TLColor.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 11))
            VStack(alignment: .leading, spacing: 4) {
                Text(event.displayName)
                    .font(TLFont.sans(15, .semibold))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                Text("\(event.playerCount ?? 0) VĐV · \(event.formatLabel)")
                    .font(TLFont.mono(10))
                    .foregroundStyle(TLColor.fg3)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 5) {
                Text(event.statusLabel.uppercased())
                    .font(TLFont.mono(8.5, .bold))
                    .tracking(0.7)
                    .foregroundStyle(TLColor.accentText)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(TLColor.fg4)
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(TLColor.border, lineWidth: 1)
        )
        .contentShape(Rectangle())
    }

    private func eventDateLabel(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        // canonical — KHÔNG theo locale: fixed-format parser; hiển thị bên dưới theo locale app
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: raw) else { return raw }
        return date.formatted(.dateTime.day().month().year())
    }
}

/// Native create form for a parent tournament.
struct CreateParentTournamentView: View {
    let onCreated: (ParentTournament) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var location = ""
    @State private var includesDate = false
    @State private var eventDate = Date()
    @State private var working = false
    @State private var errorMessage: String?

    private let repository = ParentTournamentRepository()

    var body: some View {
        NavigationStack {
            Form {
                Section("Thông tin chính") {
                    TextField("Tên giải tổng", text: $name)
                        .textInputAutocapitalization(.words)
                    TextField("Địa điểm (không bắt buộc)", text: $location)
                        .textInputAutocapitalization(.words)
                    Toggle("Có ngày tổ chức", isOn: $includesDate)
                    if includesDate {
                        DatePicker("Ngày tổ chức", selection: $eventDate, displayedComponents: .date)
                    }
                }

                Section("Mô tả") {
                    TextField(
                        "Thông tin chung về giải, tối đa 500 ký tự",
                        text: $description,
                        axis: .vertical
                    )
                    .lineLimit(3...7)
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(TLFont.sans(13))
                            .foregroundStyle(TLColor.live)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(TLColor.bg)
            .navigationTitle("Tạo giải tổng")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hủy") { dismiss() }
                        .disabled(working)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(working ? "Đang tạo…" : "Tạo") {
                        Task { await create() }
                    }
                    .disabled(working || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    @MainActor
    private func create() async {
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            let tournament = try await repository.create(
                name: name,
                description: description,
                eventDate: includesDate ? databaseDate(eventDate) : nil,
                location: location
            )
            Haptics.success()
            dismiss()
            onCreated(tournament)
        } catch {
            errorMessage = error.localizedDescription
            Haptics.error()
        }
    }

    private func databaseDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
