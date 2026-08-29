// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
// Hallmark · macrostructure: Mobile Catalogue Results · genre: commerce-utilitarian
import Observation
import SwiftUI

@MainActor @Observable
final class ShopSearchViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    enum Sort: String, CaseIterable, Identifiable {
        case relevant = "Phù hợp"
        case priceLow = "Giá thấp"
        case priceHigh = "Giá cao"

        var id: String { rawValue }
    }

    private let repository: any ShopRepository
    private let analytics: any ShopAnalytics
    var query: String
    var category: ShopCategory?
    var sort: Sort = .relevant
    var newOnly = false
    var verifiedOnly = false
    var availableOnly = true
    var selectedAttributes: [String: String] = [:]
    var phase: Phase = .loading
    var products: [ShopProductCardSummary] = []
    var attributeFacets: [String: [String]] = [:]
    var total = 0
    var hasMore = false
    var isLoadingMore = false
    var isOfflineFallback = false
    private var cursorAt: Date?
    private var cursorID: UUID?

    init(repository: any ShopRepository, query: String, category: ShopCategory?,
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        self.repository = repository
        self.analytics = analytics
        self.query = query
        self.category = category
    }

    func search(reload: Bool = false) async {
        phase = .loading
        cursorAt = nil
        cursorID = nil
        do {
            try await Task.sleep(for: .milliseconds(250))
            let page = try await repository.productPage(request(cachePolicy: reload ? .reload : .useCache))
            apply(page, appending: false)
            attributeFacets = [:]
            phase = .loaded
            await analytics.track(.searchSubmitted(queryLength: query.count, resultCount: products.count))
        } catch is CancellationError {
            return
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func loadMore() async {
        guard hasMore, !isLoadingMore, cursorAt != nil, cursorID != nil else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do { apply(try await repository.productPage(request(cursorAt: cursorAt, cursorID: cursorID)), appending: true) }
        catch is CancellationError { }
        catch { /* keep the already visible page; pull-to-refresh exposes errors */ }
    }

    private func request(cursorAt: Date? = nil, cursorID: UUID? = nil,
                         cachePolicy: ShopPublicSearchRequest.CachePolicy = .useCache) -> ShopPublicSearchRequest {
        ShopPublicSearchRequest(
            query: query, categorySlug: category?.rawValue,
            condition: newOnly ? .new : nil, inStockOnly: availableOnly,
            sort: publicSort, cursorAt: cursorAt, cursorID: cursorID, limit: 24,
            cachePolicy: cachePolicy
        )
    }

    private func apply(_ page: ShopProductPage, appending: Bool) {
        let incoming = verifiedOnly ? page.products.filter(\.seller.isVerified) : page.products
        products = appending
            ? products + incoming.filter { item in !products.contains(where: { $0.id == item.id }) }
            : incoming
        total = page.total
        hasMore = page.hasMore
        cursorAt = page.nextCursorAt
        cursorID = page.nextCursorID
        isOfflineFallback = page.isOfflineFallback
    }

    private var publicSort: ShopPublicSearchRequest.Sort {
        switch sort {
        case .relevant: .recent
        case .priceLow: .priceAscending
        case .priceHigh: .priceDescending
        }
    }
}

struct ShopSearchView: View {
    @State private var model: ShopSearchViewModel
    @State private var showsControls = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(
        initialQuery: String = "",
        initialCategory: ShopCategory? = nil,
        repository: any ShopRepository = ShopRepositoryFactory.appRepository(),
        analytics: any ShopAnalytics = FirebaseShopAnalytics()
    ) {
        _model = State(initialValue: ShopSearchViewModel(
            repository: repository,
            query: initialQuery,
            category: initialCategory,
            analytics: analytics
        ))
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TLSpacing.lg) {
                searchField
                resultControls
                if model.isOfflineFallback { offlineNotice }
                appliedCategory
                results
            }
            .padding(.horizontal, TLSpacing.lg)
            .padding(.bottom, 44)
        }
        .background(TLColor.bg)
        .navigationTitle(model.category?.title ?? "Tìm trong Shop")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: SearchKey(
            query: model.query, category: model.category, sort: model.sort,
            newOnly: model.newOnly, verifiedOnly: model.verifiedOnly,
            availableOnly: model.availableOnly
            , attributes: model.selectedAttributes.map { "\($0.key)=\($0.value)" }.sorted()
        )) {
            await model.search()
        }
        .sheet(isPresented: $showsControls) { controlSheet }
        .refreshable { await model.search(reload: true) }
    }

    private var searchField: some View {
        HStack(spacing: TLSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(TLColor.accentText)
            TextField("Tìm vợt, giày, bóng…", text: $model.query)
                .font(TLType.bodySans())
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if !model.query.isEmpty {
                Button { model.query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(TLColor.fg4)
                }
                .accessibilityLabel("Xóa từ khóa")
            }
        }
        .padding(.horizontal, TLSpacing.lg)
        .frame(height: 50)
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
    }

    private var resultControls: some View {
        HStack {
            Text(resultLabel)
                .font(TLType.bodySans(12))
                .foregroundStyle(TLColor.fg3)
                .contentTransition(.numericText())
            Spacer()
            Button { showsControls = true } label: {
                Label("Lọc & sắp xếp", systemImage: "slider.horizontal.3")
                    .font(TLType.titleSans(12))
                    .foregroundStyle(TLColor.fg)
                    .padding(.horizontal, TLSpacing.md)
                    .frame(height: 40)
                    .background(TLColor.surface, in: Capsule())
                    .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder private var appliedCategory: some View {
        if model.category != nil || !model.selectedAttributes.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: TLSpacing.sm) {
                    if let category = model.category {
                        filterChip(category.title) { model.category = nil; model.selectedAttributes = [:] }
                    }
                    ForEach(model.selectedAttributes.keys.sorted(), id: \.self) { key in
                        filterChip("\(key): \(model.selectedAttributes[key] ?? "")") {
                            model.selectedAttributes.removeValue(forKey: key)
                        }
                    }
                }
            }
        }
    }

    private func filterChip(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: "xmark")
                .font(TLType.bodySans(11)).foregroundStyle(TLColor.accentInk)
                .padding(.horizontal, TLSpacing.md).frame(height: 36)
                .background(TLColor.accent, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Bỏ bộ lọc \(label)")
    }

    @ViewBuilder private var results: some View {
        switch model.phase {
        case .loading:
            TLLoadingView(rows: 4)
        case .failed(let message):
            TLErrorState(message: message) { Task { await model.search() } }
        case .loaded where model.products.isEmpty:
            TLEmptyState(
                icon: "magnifyingglass",
                title: "Không tìm thấy sản phẩm",
                subtitle: "Thử từ khóa ngắn hơn hoặc bỏ danh mục đang chọn."
            )
        case .loaded:
            LazyVGrid(columns: resultColumns, spacing: TLSpacing.md) {
                ForEach(model.products) { product in
                    NavigationLink(value: ShopRoute.product(product.slug)) {
                        ShopProductCard(product: product)
                    }
                    .buttonStyle(.plain)
                }
            }
            if model.hasMore {
                ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity)
                    .task { await model.loadMore() }
            }
        }
    }

    private var offlineNotice: some View {
        Label("Đang hiển thị dữ liệu công khai đã lưu gần đây", systemImage: "wifi.slash")
            .font(TLType.bodySans(11)).foregroundStyle(TLColor.gold)
            .padding(TLSpacing.md).frame(maxWidth: .infinity, alignment: .leading)
            .background(TLColor.gold.opacity(0.10), in: RoundedRectangle(cornerRadius: TLRadius.sm))
            .accessibilityLabel("Ngoại tuyến. Đang hiển thị dữ liệu công khai đã lưu gần đây")
    }

    private var controlSheet: some View {
        NavigationStack {
            Form {
                Section("Danh mục") {
                    Picker("Danh mục", selection: $model.category) {
                        Text("Tất cả").tag(ShopCategory?.none)
                        ForEach(ShopCategory.allCases) { category in
                            Text(category.title).tag(Optional(category))
                        }
                    }
                }
                Section("Sắp xếp") {
                    Picker("Sắp xếp", selection: $model.sort) {
                        ForEach(ShopSearchViewModel.Sort.allCases) { sort in
                            Text(sort.rawValue).tag(sort)
                        }
                    }
                    .pickerStyle(.inline)
                }
                Section("Tình trạng") {
                    Toggle("Chỉ sản phẩm mới", isOn: $model.newOnly)
                    Toggle("Shop đã xác minh", isOn: $model.verifiedOnly)
                    Toggle("Còn hàng", isOn: $model.availableOnly)
                }
                ForEach(model.attributeFacets.keys.sorted(), id: \.self) { key in
                    Section(key) {
                        Picker(key, selection: attributeBinding(key)) {
                            Text("Tất cả").tag(String?.none)
                            ForEach(model.attributeFacets[key] ?? [], id: \.self) { value in
                                Text(value).tag(Optional(value))
                            }
                        }
                    }
                }
            }
            .navigationTitle("Lọc & sắp xếp")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Xem \(model.products.count) sản phẩm") { showsControls = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var resultLabel: String {
        model.phase == .loading ? "Đang tìm…" : "\(model.products.count) sản phẩm"
    }

    private var resultColumns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        return Array(repeating: GridItem(.flexible(), spacing: TLSpacing.md), count: count)
    }

    private func attributeBinding(_ key: String) -> Binding<String?> {
        Binding(
            get: { model.selectedAttributes[key] },
            set: { value in model.selectedAttributes[key] = value }
        )
    }
}

private struct SearchKey: Equatable {
    let query: String
    let category: ShopCategory?
    let sort: ShopSearchViewModel.Sort
    let newOnly: Bool
    let verifiedOnly: Bool
    let availableOnly: Bool
    let attributes: [String]
}
