import SwiftUI

@Observable
final class ClubsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var clubs: [ClubListItem] = []
    var search = ""
    var uid: UUID?

    private let repo = ClubRepository()
    private var searchTask: Task<Void, Never>?

    var myClubs: [ClubListItem] { uid.map { id in clubs.filter { $0.createdBy == id } } ?? [] }
    var discover: [ClubListItem] {
        guard let id = uid else { return clubs }
        return clubs.filter { $0.createdBy != id }
    }

    @MainActor
    func load() async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            uid = await repo.currentUserID()
            clubs = try await repo.list(search: search)
            phase = .loaded
        } catch { phase = .failed(error.localizedDescription) }
    }

    func scheduleSearch() {
        searchTask?.cancel()
        searchTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(300))
            if Task.isCancelled { return }
            await load()
        }
    }

    func currentUserID() async -> UUID? { await repo.currentUserID() }
}

/// Sub-tab "CLB" — clubs discovery. Search + "CLB của tôi" vs "Khám phá".
struct ClubsListView: View {
    @State private var model = ClubsViewModel()
    @State private var openWeb: IdentifiedURL?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                searchRow
                content
            }
            .padding(.horizontal, 18).padding(.top, 6).padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .task { if case .loading = model.phase { await model.load() } }
        .refreshable { await model.load() }
        .sheet(item: $openWeb) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    private var searchRow: some View {
        HStack(spacing: 8) {
            HStack(spacing: 9) {
                Image(systemName: "magnifyingglass").font(.system(size: 15)).foregroundStyle(TLColor.fg3)
                TextField("Tìm CLB, khu vực…", text: Binding(get: { model.search }, set: { model.search = $0; model.scheduleSearch() }))
                    .font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg).autocorrectionDisabled()
            }
            .padding(.horizontal, 12).frame(height: 42)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))

            Button {
                Haptics.light()
                Task {
                    let url = await model.currentUserID() == nil
                        ? WebRoutes.base.appending(path: "login")
                        : WebRoutes.base.appending(path: "clubs/new")
                    openWeb = IdentifiedURL(url: url)
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus").font(.system(size: 13, weight: .bold))
                    Text("Tạo").font(TLFont.sans(13, .semibold))
                }
                .foregroundStyle(TLColor.accentInk).padding(.horizontal, 15).frame(height: 42)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)
        }
        .padding(.bottom, 16)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 50)
        case .failed(let message):
            errorState(message)
        case .loaded:
            if model.clubs.isEmpty {
                emptyState
            } else {
                if !model.myClubs.isEmpty {
                    sectionHeader("CLB CỦA TÔI", trailing: nil)
                    VStack(spacing: 13) { ForEach(model.myClubs) { ClubCardView(club: $0, mine: true) } }
                        .padding(.bottom, 22)
                }
                sectionHeader("KHÁM PHÁ", trailing: "GẦN BẠN")
                VStack(spacing: 13) { ForEach(model.discover) { ClubCardView(club: $0, mine: false) } }
            }
        }
    }

    private func sectionHeader(_ title: String, trailing: String?) -> some View {
        HStack(spacing: 10) {
            Text(title).font(TLFont.mono(11, .semibold)).tracking(1.5).foregroundStyle(TLColor.fg2)
            Rectangle().fill(LinearGradient(colors: [TLColor.border, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1)
            if let trailing { Text(trailing).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4) }
        }
        .padding(.bottom, 12)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.3").font(.system(size: 32)).foregroundStyle(TLColor.fg4)
            Text("Chưa có CLB nào").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
            Text("Tạo CLB để quy tụ cộng đồng của bạn.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity).padding(.top, 50)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được CLB").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load() } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 50)
    }
}

/// Club discovery card — logo/initials, serif name, location, description, event
/// count + "XEM CLB →". Faithful to the mockup.
struct ClubCardView: View {
    let club: ClubListItem
    let mine: Bool

    var body: some View {
        NavigationLink {
            ClubDetailView(slug: club.slug, fallbackName: club.name)
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    ClubLogo(url: club.logoURLResolved, initials: club.initials, size: 52)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(club.name).font(TLFont.serif(22)).foregroundStyle(TLColor.fg).lineLimit(1)
                        if let loc = club.locationText?.nonEmpty {
                            Text(loc).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3).lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                    if mine {
                        Text("THÀNH VIÊN").font(TLFont.mono(8.5, .bold)).tracking(0.4).foregroundStyle(TLColor.accentText)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(TLColor.accent.opacity(0.1), in: Capsule())
                            .overlay(Capsule().strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
                    }
                }
                if let desc = club.description?.nonEmpty {
                    Text(desc).font(TLFont.sans(13)).foregroundStyle(TLColor.fg2).lineLimit(2)
                }
                HStack {
                    Text("\(club.upcomingEvents ?? 0) SỰ KIỆN SẮP TỚI")
                        .font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
                    Spacer()
                    Text("XEM CLB →").font(TLFont.mono(10, .bold)).tracking(0.6).foregroundStyle(TLColor.accentText)
                }
                .padding(.top, 11).overlay(alignment: .top) { Rectangle().fill(TLColor.border).frame(height: 1).offset(y: 5) }
            }
            .padding(15)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// Club logo (image) or gradient initials tile.
struct ClubLogo: View {
    let url: URL?
    let initials: String
    var size: CGFloat = 52

    var body: some View {
        ZStack {
            if let url {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { initialsTile }
            } else { initialsTile }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.25, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: size * 0.25, style: .continuous).strokeBorder(TLColor.accent.opacity(0.25), lineWidth: 1))
    }

    private var initialsTile: some View {
        LinearGradient(colors: [TLColor.accent.opacity(0.18), TLColor.surface2], startPoint: .topLeading, endPoint: .bottomTrailing)
            .overlay(Text(initials).font(TLFont.sans(size * 0.33, .bold)).foregroundStyle(TLColor.accentText))
    }
}
