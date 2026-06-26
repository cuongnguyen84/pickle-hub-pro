import SwiftUI

@Observable
final class VenuesViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var venues: [VenueListItem] = []
    var search = ""
    var cityFilter: String? = nil

    private let repo = VenueRepository()
    private var searchTask: Task<Void, Never>?

    /// Cities present in the current result set (for the filter chips).
    var cities: [String] {
        var seen = Set<String>()
        return venues.compactMap { $0.city.nonEmpty }.filter { seen.insert($0).inserted }
    }

    var filtered: [VenueListItem] {
        guard let city = cityFilter else { return venues }
        return venues.filter { $0.city == city }
    }

    @MainActor
    func load() async {
        if case .loaded = phase {} else { phase = .loading }
        do { venues = try await repo.list(search: search); phase = .loaded }
        catch { phase = .failed(error.localizedDescription) }
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

/// Sub-tab "Sân" — court finder. Faithful UI port of the approved mockup:
/// search + add, city chips, featured verified court, compact court cards,
/// browse-by-city. Data parity with web `/san`.
struct VenuesListView: View {
    @State private var model = VenuesViewModel()
    @State private var openWeb: IdentifiedURL?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                searchRow
                cityChips
                content
            }
            .padding(.horizontal, 18).padding(.top, 6).padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .task { if case .loading = model.phase { await model.load() } }
        .refreshable { await model.load() }
        .sheet(item: $openWeb) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    // MARK: Search + add

    private var searchRow: some View {
        HStack(spacing: 8) {
            HStack(spacing: 9) {
                Image(systemName: "magnifyingglass").font(.system(size: 15)).foregroundStyle(TLColor.fg3)
                TextField("Tìm theo tên sân, quận…", text: Binding(get: { model.search }, set: { model.search = $0; model.scheduleSearch() }))
                    .font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg)
                    .autocorrectionDisabled()
            }
            .padding(.horizontal, 12).frame(height: 42)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))

            Button {
                Haptics.light()
                Task {
                    let url = await model.currentUserID() == nil
                        ? WebRoutes.base.appending(path: "login")
                        : WebRoutes.base.appending(path: "san/them")
                    openWeb = IdentifiedURL(url: url)
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus").font(.system(size: 13, weight: .bold))
                    Text("Thêm").font(TLFont.sans(13, .semibold))
                }
                .foregroundStyle(TLColor.accentInk).padding(.horizontal, 14).frame(height: 42)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)
        }
        .padding(.bottom, 14)
    }

    // MARK: City chips

    @ViewBuilder
    private var cityChips: some View {
        if !model.cities.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("TẤT CẢ", active: model.cityFilter == nil) { model.cityFilter = nil }
                    ForEach(model.cities, id: \.self) { city in
                        chip(city.uppercased(), active: model.cityFilter == city) {
                            model.cityFilter = (model.cityFilter == city ? nil : city)
                        }
                    }
                }
                .padding(.bottom, 4)
            }
            .padding(.bottom, 16)
        }
    }

    private func chip(_ text: String, active: Bool, _ action: @escaping () -> Void) -> some View {
        Button { Haptics.light(); withAnimation(.easeInOut(duration: 0.15)) { action() } } label: {
            Text(text).font(TLFont.mono(11, .semibold)).tracking(0.4)
                .foregroundStyle(active ? TLColor.accentText : TLColor.fg3)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(active ? TLColor.accent.opacity(0.12) : .clear, in: Capsule())
                .overlay(Capsule().strokeBorder(active ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 50)
        case .failed(let message):
            errorState(message)
        case .loaded:
            let items = model.filtered
            if items.isEmpty {
                emptyState
            } else {
                sectionHeader(total: items.count)
                VenueFeaturedCard(venue: items[0])
                if items.count > 1 {
                    VStack(spacing: 13) {
                        ForEach(items.dropFirst()) { VenueRowCard(venue: $0) }
                    }
                    .padding(.top, 13)
                }
                browseByCity
            }
        }
    }

    private func sectionHeader(total: Int) -> some View {
        HStack(spacing: 10) {
            Text("SÂN GẦN BẠN").font(TLFont.mono(11, .semibold)).tracking(1.2).foregroundStyle(TLColor.fg2)
            Rectangle().fill(LinearGradient(colors: [TLColor.border, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1)
            Text("\(total) SÂN").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
        }
        .padding(.bottom, 13)
    }

    private var browseByCity: some View {
        VStack(alignment: .leading, spacing: 11) {
            Rectangle().fill(TLColor.border).frame(height: 1).padding(.top, 22)
            Text("TÌM SÂN THEO KHU VỰC").font(TLFont.mono(10, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
            WrapChips(items: VenueCities.all) { city in
                Button {
                    Haptics.light()
                    let slug = city.folding(options: .diacriticInsensitive, locale: .current)
                        .lowercased().replacingOccurrences(of: ".", with: "").replacingOccurrences(of: " ", with: "-")
                    openWeb = IdentifiedURL(url: WebRoutes.base.appending(path: "san/khu-vuc/\(slug)"))
                } label: {
                    Text(city).font(TLFont.mono(11)).foregroundStyle(TLColor.fg2)
                        .padding(.horizontal, 11).padding(.vertical, 6)
                        .background(TLColor.surface2, in: Capsule())
                        .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "mappin.slash").font(.system(size: 32)).foregroundStyle(TLColor.fg4)
            Text("Không tìm thấy sân").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
            Text("Thử từ khoá khác hoặc thêm sân mới.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity).padding(.top, 50)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được sân").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load() } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 50)
    }
}

// MARK: - Cards

private struct VenueFeaturedCard: View {
    let venue: VenueListItem
    var body: some View {
        NavigationLink {
            VenueDetailView(slug: venue.slug, fallbackName: venue.displayName)
        } label: {
            VStack(spacing: 0) {
                ZStack {
                    CourtLinesView(tint: TLColor.accent).frame(height: 152).clipped()
                    LinearGradient(colors: [.clear, .black.opacity(0.25)], startPoint: .center, endPoint: .bottom)
                    VStack {
                        HStack(alignment: .top) {
                            if venue.isVerified == true { verifiedPill }
                            Spacer()
                            if let n = venue.numCourts, n > 0 { tag("\(n) SÂN") }
                        }
                        Spacer()
                        HStack {
                            if let indoor = venue.indoorLabel { tag(indoor.uppercased()) }
                            Spacer()
                        }
                    }
                    .padding(12)
                }
                .frame(height: 152)

                VStack(alignment: .leading, spacing: 5) {
                    Text(venue.displayName).font(TLFont.serif(24)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Label(venue.locationLine, systemImage: "mappin.and.ellipse")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).lineLimit(1)
                    HStack {
                        Text([venue.surfaceLabel].compactMap { $0 }.joined())
                            .font(TLFont.mono(10)).tracking(0.5).foregroundStyle(TLColor.fg3)
                        Spacer()
                        Text("XEM SÂN →").font(TLFont.mono(10, .bold)).tracking(0.5).foregroundStyle(TLColor.accentText)
                    }
                    .padding(.top, 12).overlay(alignment: .top) { Rectangle().fill(TLColor.border).frame(height: 1).offset(y: 6) }
                }
                .padding(14)
            }
            .background(TLColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var verifiedPill: some View {
        HStack(spacing: 5) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 11)).foregroundStyle(TLColor.accent)
            Text("ĐÃ XÁC MINH").font(TLFont.mono(9, .bold)).tracking(0.6).foregroundStyle(TLColor.accentText)
        }
        .padding(.horizontal, 9).padding(.vertical, 4)
        .background(.black.opacity(0.5), in: Capsule())
        .overlay(Capsule().strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
    }

    private func tag(_ text: String) -> some View {
        Text(text).font(TLFont.mono(9.5, .bold)).foregroundStyle(.white)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct VenueRowCard: View {
    let venue: VenueListItem
    var body: some View {
        NavigationLink {
            VenueDetailView(slug: venue.slug, fallbackName: venue.displayName)
        } label: {
            HStack(spacing: 13) {
                ZStack(alignment: .bottomTrailing) {
                    CourtLinesView(tint: TLColor.accent.opacity(0.6)).frame(width: 84, height: 84)
                    if let n = venue.numCourts, n > 0 {
                        Text("\(n) SÂN").font(TLFont.mono(8.5, .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 4)).padding(5)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(venue.displayName).font(TLFont.serif(20)).foregroundStyle(TLColor.fg).lineLimit(1)
                        if venue.isVerified == true {
                            Image(systemName: "checkmark.seal.fill").font(.system(size: 13)).foregroundStyle(TLColor.accent)
                        }
                    }
                    Label(venue.locationLine, systemImage: "mappin.and.ellipse")
                        .font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3).lineLimit(1)
                    HStack {
                        Text([venue.indoorLabel, venue.surfaceLabel].compactMap { $0 }.joined(separator: " · ").uppercased())
                            .font(TLFont.mono(9.5)).tracking(0.4).foregroundStyle(TLColor.fg4).lineLimit(1)
                        Spacer()
                        Text("XEM SÂN →").font(TLFont.mono(9.5, .bold)).foregroundStyle(TLColor.accentText)
                    }
                    .padding(.top, 5)
                }
            }
            .padding(12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
