// Hallmark · component: event card · genre: editorial · theme: existing The Line tokens
// Pre-emit critique: P5 H5 E4 S5 R5 V4
import SwiftUI

@Observable
@MainActor
private final class ProTourEventsStripModel {
    var events: [ProTourEvent] = []
    private let repository: any ProTourRepositoryProtocol

    init(repository: any ProTourRepositoryProtocol = ProTourRepository()) {
        self.repository = repository
    }

    func load() async {
        guard let all = try? await repository.events(forceRefresh: false) else { return }
        events = all.filter { $0.shouldAppearOnLive() }.sorted { $0.startDate < $1.startDate }
    }
}

struct ProTourEventsStrip: View {
    @State private var model = ProTourEventsStripModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            if !model.events.isEmpty {
                HStack {
                    Text(String(localized: "GIẢI CHUYÊN NGHIỆP"))
                        .font(TLType.eyebrowMono(10)).tracking(1).foregroundStyle(TLColor.accentText)
                    Spacer()
                    if model.events.contains(where: { $0.phase() == .live }) {
                        HStack(spacing: 5) {
                            Circle().fill(TLColor.live).frame(width: 6, height: 6)
                            Text("LIVE").font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.live)
                        }
                    }
                }
                if model.events.count == 1, let event = model.events.first {
                    eventLink(event)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(spacing: 12) {
                            ForEach(model.events) { event in
                                eventLink(event)
                                    .containerRelativeFrame(.horizontal)
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollTargetBehavior(.viewAligned)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            await model.load()
        }
    }

    private func eventLink(_ event: ProTourEvent) -> some View {
        NavigationLink { ProTourEventView(slug: event.slug) } label: {
            ProTourEventCard(event: event)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(language == "vi" ? "Xem kết quả \(event.nameVI)" : "View results for \(event.nameEN)")
        .accessibilityHint(language == "vi" ? "Mở trang kết quả giải đấu" : "Opens tournament results")
    }

    private var language: String {
        Locale.current.language.languageCode?.identifier == "vi" ? "vi" : "en"
    }
}

private struct ProTourEventCard: View {
    let event: ProTourEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                AsyncImage(url: event.logoRemoteURL) { phase in
                    if let image = phase.image { image.resizable().scaledToFit().padding(4) }
                    else { Image(systemName: "trophy.fill").foregroundStyle(TLColor.gold) }
                }
                .frame(width: 48, height: 48)
                .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(event.tour) · \(event.tier)".uppercased())
                        .font(TLType.eyebrowMono(8.5)).tracking(0.5).foregroundStyle(TLColor.accentText)
                    Text(language == "vi" ? event.nameVI : event.nameEN)
                        .font(TLType.titleSans(16)).foregroundStyle(TLColor.fg)
                        .lineLimit(2).multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Spacer()
                phasePill
            }

            Rectangle().fill(TLColor.border).frame(height: 1)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    location
                    Spacer(minLength: 8)
                    date
                    disclosure
                }
                VStack(alignment: .leading, spacing: 7) {
                    location
                    HStack { date; Spacer(); disclosure }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 154, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border2, lineWidth: 1))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(event.phase() == .live ? TLColor.live : TLColor.accent)
                .frame(height: 3)
                .clipShape(.rect(topLeadingRadius: TLRadius.lg, topTrailingRadius: TLRadius.lg))
        }
    }

    private var phasePill: some View {
        let phase = event.phase()
        let text = switch phase {
        case .live: "LIVE"
        case .upcoming: language == "vi" ? "SẮP DIỄN RA" : "UPCOMING"
        case .finished: language == "vi" ? "KẾT QUẢ" : "RESULTS"
        }
        return Text(text).font(TLType.eyebrowMono(8)).foregroundStyle(phase == .upcoming ? TLColor.accentInk : phase == .live ? .white : TLColor.fg2)
            .padding(.horizontal, 7).padding(.vertical, 4)
            .background(phase == .live ? TLColor.live : phase == .upcoming ? TLColor.accent : TLColor.surface2, in: Capsule())
    }

    private var location: some View {
        Label("\(flag)  \(event.city)", systemImage: "mappin.and.ellipse")
            .font(TLFont.sans(11.5, .medium)).foregroundStyle(TLColor.fg2).lineLimit(1)
    }

    private var date: some View {
        Label(event.formattedDates(language: language), systemImage: "calendar")
            .font(TLFont.mono(10, .medium)).foregroundStyle(TLColor.fg3).lineLimit(1)
    }

    private var disclosure: some View {
        Image(systemName: "arrow.up.right")
            .font(.system(size: 12, weight: .semibold)).foregroundStyle(TLColor.accentText)
    }

    private var language: String { Locale.current.language.languageCode?.identifier == "vi" ? "vi" : "en" }
    private var flag: String {
        String(String.UnicodeScalarView(event.countryCode.uppercased().prefix(2).unicodeScalars.compactMap {
            UnicodeScalar(127_397 + Int($0.value))
        }))
    }
}
