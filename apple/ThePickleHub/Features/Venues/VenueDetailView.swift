import SwiftUI

@Observable
final class VenueDetailViewModel {
    enum Phase: Equatable { case loading, loaded(VenueDetail), failed(String) }
    var phase: Phase = .loading
    var nearby: [VenueListItem] = []
    private let repo = VenueRepository()

    @MainActor
    func load(slug: String) async {
        do {
            let detail = try await repo.detail(slug: slug)
            phase = .loaded(detail)
            nearby = await repo.nearby(city: detail.city, excludingSlug: slug)
        } catch { phase = .failed(error.localizedDescription) }
    }
}

/// Venue detail (`/san/:slug`) — cover, feature chips, directions/call/share,
/// opening hours, amenities, nearby courts. Port of web VenueDetail.tsx.
struct VenueDetailView: View {
    let slug: String
    let fallbackName: String

    @State private var model = VenueDetailViewModel()
    @State private var openWeb: IdentifiedURL?

    var body: some View {
        ScrollView {
            content.padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle(fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .task { if case .loading = model.phase { await model.load(slug: slug) } }
        .sheet(item: $openWeb) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 80)
        case .failed(let message):
            errorState(message)
        case .loaded(let v):
            VStack(alignment: .leading, spacing: 18) {
                cover(v)
                VStack(alignment: .leading, spacing: 16) {
                    header(v)
                    chips(v)
                    actions(v)
                    if !v.hoursRows.isEmpty { hours(v) }
                    if let amenities = v.amenities, !amenities.isEmpty { amenitiesBlock(amenities) }
                    if !model.nearby.isEmpty { nearbyBlock }
                }
                .padding(.horizontal, 18)
            }
        }
    }

    private func cover(_ v: VenueDetail) -> some View {
        ZStack {
            if let url = v.coverURL {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { CourtLinesView() }
            } else { CourtLinesView() }
        }
        .frame(height: 220).frame(maxWidth: .infinity).clipped()
    }

    private func header(_ v: VenueDetail) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 7) {
                Text(v.displayName).font(TLFont.serif(28)).foregroundStyle(TLColor.fg)
                    .fixedSize(horizontal: false, vertical: true)
                if v.isVerified == true {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 17)).foregroundStyle(TLColor.accent)
                }
            }
            Label(v.fullAddress, systemImage: "mappin.and.ellipse")
                .font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg3)
        }
    }

    private func chips(_ v: VenueDetail) -> some View {
        FlowLayout(spacing: 8, lineSpacing: 8) {
            featureChip(v.courtsLabel)
            if let indoor = v.indoorLabel { featureChip(indoor) }
            if let surface = v.surfaceLabel { featureChip(surface) }
        }
    }

    private func featureChip(_ text: String) -> some View {
        Text(text).font(TLFont.mono(10.5)).foregroundStyle(TLColor.fg2)
            .padding(.horizontal, 11).padding(.vertical, 6)
            .background(TLColor.surface2, in: Capsule())
            .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func actions(_ v: VenueDetail) -> some View {
        HStack(spacing: 9) {
            if let dir = v.directionsURL {
                Button { Haptics.light(); openWeb = IdentifiedURL(url: dir) } label: {
                    Label("Chỉ đường", systemImage: "location.fill")
                        .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain)
            }
            if let phone = v.phone?.nonEmpty, let tel = URL(string: "tel:\(phone.filter { !$0.isWhitespace })") {
                Link(destination: tel) {
                    Image(systemName: "phone.fill").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                        .frame(width: 46, height: 44)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
                }.accessibilityLabel("Gọi")
            }
            ShareLink(item: WebRoutes.base.appending(path: "san/\(v.slug)")) {
                Image(systemName: "square.and.arrow.up").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                    .frame(width: 46, height: 44)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
            }.accessibilityLabel("Chia sẻ")
        }
    }

    private func hours(_ v: VenueDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("GIỜ MỞ CỬA")
            VStack(spacing: 0) {
                ForEach(Array(v.hoursRows.enumerated()), id: \.offset) { i, row in
                    if i > 0 { Rectangle().fill(TLColor.border).frame(height: 1) }
                    HStack {
                        Text(row.day).font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
                        Spacer()
                        Text(row.value).font(TLFont.mono(11)).foregroundStyle(TLColor.fg)
                    }
                    .padding(.horizontal, 13).padding(.vertical, 10)
                }
            }
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    private func amenitiesBlock(_ amenities: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("TIỆN ÍCH")
            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(amenities, id: \.self) { featureChip($0) }
            }
        }
    }

    private var nearbyBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("SÂN GẦN ĐÂY")
            VStack(spacing: 13) {
                ForEach(model.nearby) { VenueRowCardLink(venue: $0) }
            }
        }
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t).font(TLFont.mono(10.5, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "mappin.slash").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được sân").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(slug: slug) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

/// Compact nearby-venue row that pushes another VenueDetailView.
private struct VenueRowCardLink: View {
    let venue: VenueListItem
    var body: some View {
        NavigationLink {
            VenueDetailView(slug: venue.slug, fallbackName: venue.displayName)
        } label: {
            HStack(spacing: 13) {
                CourtLinesView(tint: TLColor.accent.opacity(0.6)).frame(width: 64, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
                VStack(alignment: .leading, spacing: 3) {
                    Text(venue.displayName).font(TLFont.serif(18)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text(venue.locationLine).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(TLColor.fg4)
            }
            .padding(11)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
