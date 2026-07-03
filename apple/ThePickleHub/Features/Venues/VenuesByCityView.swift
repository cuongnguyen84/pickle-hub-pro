import SwiftUI

@Observable
final class VenuesByCityModel {
    var venues: [VenueListItem] = []
    var loaded = false
    private let repo = VenueRepository()

    @MainActor func load(city: String) async {
        venues = (try? await repo.byCity(city)) ?? []
        loaded = true
    }
}

/// City-scoped venue list — native port of web `/san/khu-vuc/:city`.
struct VenuesByCityView: View {
    let city: String
    @State private var model = VenuesByCityModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if !model.loaded {
                    ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 50)
                } else if model.venues.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "mappin.slash").font(.system(size: 30)).foregroundStyle(TLColor.fg4)
                        Text("Chưa có sân nào ở \(city)").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                    }.frame(maxWidth: .infinity).padding(.top, 50)
                } else {
                    Text("\(model.venues.count) sân").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                    ForEach(model.venues) { v in row(v) }
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle(city)
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load(city: city) }
        .refreshable { await model.load(city: city) }
    }

    private func row(_ v: VenueListItem) -> some View {
        NavigationLink { VenueDetailView(slug: v.slug, fallbackName: v.displayName) } label: {
            HStack(spacing: 12) {
                cover(v)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        Text(v.displayName).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                        if v.isVerified == true {
                            Image(systemName: "checkmark.seal.fill").font(.system(size: 11)).foregroundStyle(TLColor.accentText)
                        }
                    }
                    Text(v.locationLine).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3).lineLimit(1)
                    HStack(spacing: 8) {
                        Text(v.courtsLabel).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                        if let s = v.surfaceLabel { Text("· \(s)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4) }
                        if let i = v.indoorLabel { Text("· \(i)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4) }
                    }
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(TLColor.fg4)
            }
            .padding(12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    private func cover(_ v: VenueListItem) -> some View {
        Group {
            if let u = v.coverURL {
                AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { placeholder }
            } else { placeholder }
        }.frame(width: 52, height: 52).clipShape(RoundedRectangle(cornerRadius: 9))
    }
    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 9).fill(TLColor.surface2)
            .overlay(Image(systemName: "sportscourt").font(.system(size: 16)).foregroundStyle(TLColor.fg4))
    }
}
