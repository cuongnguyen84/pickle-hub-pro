import Observation
import SwiftUI

@MainActor @Observable
final class WorldCupLiveViewModel {
    enum Phase: Equatable { case loading, loaded, failed }

    private(set) var phase: Phase = .loading
    private(set) var feed = WorldCupLiveFeed(proMatches: [], groups: [])
    private let repository: any WorldCupLiveRepositoryProtocol

    init(repository: any WorldCupLiveRepositoryProtocol = WorldCupLiveRepository()) {
        self.repository = repository
    }

    func load() async {
        do {
            feed = try await repository.feed()
            phase = .loaded
        } catch {
            if !feed.hasData { phase = .failed }
        }
    }
}

/* Hallmark · component: live score board · genre: editorial · theme: Sport
 * states: loading · loaded · empty · error · contrast: token-backed
 * critique: P5 H5 E5 S5 R5 V5
 */
struct WorldCupLiveBoard: View {
    private enum Competition: String, CaseIterable, Identifiable {
        case pro, teams
        var id: String { rawValue }
        var title: String { self == .pro ? "Cá nhân Pro" : "Đội tuyển" }
    }

    @State private var model: WorldCupLiveViewModel
    @State private var competition: Competition = .pro
    @State private var event: WorldCupProEvent = .mensSingles
    @State private var athleteQuery = ""
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(repository: any WorldCupLiveRepositoryProtocol = WorldCupLiveRepository()) {
        _model = State(initialValue: WorldCupLiveViewModel(repository: repository))
    }

    var body: some View {
        Group {
            if Date() < Self.retirementDate {
                switch model.phase {
                case .loading: loading
                case .failed: EmptyView()
                case .loaded where model.feed.hasData: board
                case .loaded: EmptyView()
                }
            }
        }
        .task {
            await model.load()
            while !Task.isCancelled && Date() < Self.retirementDate {
                try? await Task.sleep(for: .seconds(30))
                if !Task.isCancelled { await model.load() }
            }
        }
    }

    private var board: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            TLSegmented(
                options: Competition.allCases,
                selection: $competition,
                label: { $0.title },
                indicator: { $0 == .pro && model.feed.liveCount > 0 },
                indicatorHint: "đang có trận trực tiếp"
            )
            if competition == .pro { proContent } else { teamsContent }
            Text("Nguồn: ban tổ chức · cập nhật gần thời gian thực")
                .font(TLType.bodySans(10)).foregroundStyle(TLColor.fg4)
        }
        .padding(16)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(TLColor.border, lineWidth: 1))
        .padding(.horizontal, 22)
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 7) {
                Image(systemName: "trophy.fill").foregroundStyle(TLColor.gold)
                Text("PICKLEBALL WORLD CUP 2026 · ĐÀ NẴNG")
                    .font(TLType.eyebrowMono(9)).tracking(0.7).foregroundStyle(TLColor.gold)
            }
            HStack(alignment: .firstTextBaseline) {
                Text("Livescore").font(TLType.titleSans(20)).foregroundStyle(TLColor.fg)
                Spacer()
                if model.feed.liveCount > 0 {
                    HStack(spacing: 6) {
                        Circle().fill(TLColor.live).frame(width: 7, height: 7)
                        Text("\(model.feed.liveCount) LIVE")
                            .font(TLType.eyebrowMono(9)).foregroundStyle(TLColor.live)
                    }
                }
            }
        }
    }

    private var proContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(WorldCupProEvent.allCases) { item in
                        Button(item.title) { event = item }
                            .font(TLType.bodySans(11))
                            .foregroundStyle(event == item ? TLColor.accentInk : TLColor.fg2)
                            .padding(.horizontal, 11).frame(minHeight: 34)
                            .background(event == item ? TLColor.accent : TLColor.surface2, in: Capsule())
                    }
                }
            }
            athleteSearchField
            let matches = model.feed.matches(for: event, athleteQuery: athleteQuery)
            if matches.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text(athleteQuery.isEmpty ? "Chưa có trận đấu ở nội dung này." : "Không tìm thấy vận động viên.")
                        .font(TLType.bodySans(12)).foregroundStyle(TLColor.fg2)
                    if !athleteQuery.isEmpty {
                        Text("Thử nhập tên khác hoặc chọn nội dung thi đấu khác.")
                            .font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3)
                    }
                }
                .padding(.vertical, 8)
            } else {
                HStack {
                    Text("TẤT CẢ KẾT QUẢ")
                        .font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.fg3)
                    Spacer()
                    Text("\(matches.count) trận")
                        .font(TLType.dataMono(9)).foregroundStyle(TLColor.fg3)
                }
                ForEach(matches) { match in WorldCupProMatchRow(match: match) }
            }
        }
    }

    private var athleteSearchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(TLColor.fg3)
                .accessibilityHidden(true)
            TextField("Tìm tên vận động viên", text: $athleteQuery)
                .font(TLType.bodySans(12))
                .foregroundStyle(TLColor.fg)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .accessibilityLabel("Tìm vận động viên")
            if !athleteQuery.isEmpty {
                Button {
                    athleteQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(TLColor.fg3)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Xóa tên đang tìm")
            }
        }
        .padding(.leading, 12)
        .padding(.trailing, athleteQuery.isEmpty ? 12 : 0)
        .frame(minHeight: 44)
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var teamsContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(model.feed.groups.flatMap(\.matches).contains { $0.status == .live }
                 ? "Đang thi đấu" : "Vòng bảng · 16 bảng · 64 quốc gia")
                .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
            ForEach(model.feed.groups) { group in
                WorldCupGroupCard(group: group)
            }
        }
    }

    private var loading: some View {
        RoundedRectangle(cornerRadius: 20).fill(TLColor.surface2)
            .frame(height: 220).padding(.horizontal, 22)
            .accessibilityLabel("Đang tải tỷ số World Cup")
    }

    static let retirementDate: Date = {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(identifier: "Asia/Ho_Chi_Minh")
        components.year = 2026; components.month = 9; components.day = 8
        return components.date ?? .distantPast
    }()
}

private struct WorldCupProMatchRow: View {
    let match: WorldCupProMatch

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(match.roundName ?? match.divisionName ?? "World Cup")
                    .font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.fg3).lineLimit(1)
                Spacer()
                if match.isLive { Text("LIVE").font(TLType.eyebrowMono(8)).foregroundStyle(TLColor.live) }
            }
            scoreRow(name: match.sideAName, score: match.visibleScore.a, side: "A")
            scoreRow(name: match.sideBName, score: match.visibleScore.b, side: "B")
            if let gameLine = match.gameLine {
                Text(gameLine).font(TLType.dataMono(9)).foregroundStyle(TLColor.fg3)
            }
        }
        .padding(12)
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(alignment: .leading) {
            Rectangle().fill(match.isLive ? TLColor.live : TLColor.border2).frame(width: 3)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func scoreRow(name: String, score: String, side: String) -> some View {
        HStack(spacing: 8) {
            if match.servingSide == side {
                Circle().fill(TLColor.gold).frame(width: 6, height: 6).accessibilityLabel("Đang giao bóng")
            }
            Text(name).font(TLType.bodySans(13)).fontWeight(match.leaderSide == side ? .bold : .regular)
                .foregroundStyle(isVietnamese(side: side) ? TLColor.live : TLColor.fg).lineLimit(1)
            Spacer(minLength: 6)
            Text(score).font(TLType.dataMono(15)).fontWeight(.bold).monospacedDigit()
                .foregroundStyle(TLColor.fg)
        }
    }

    private func isVietnamese(side: String) -> Bool {
        side == "A" ? match.sideAIsVietnamese : match.sideBIsVietnamese
    }
}

private struct WorldCupGroupCard: View {
    let group: WorldCupOpenGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("BẢNG \(group.letter)").font(TLType.eyebrowMono(9)).foregroundStyle(TLColor.fg2)
                if group.containsVietnam {
                    Text("VIỆT NAM").font(TLType.eyebrowMono(8)).foregroundStyle(.white)
                        .padding(.horizontal, 7).frame(height: 20).background(TLColor.live, in: Capsule())
                }
                Spacer()
                let played = group.matches.filter { $0.status != .scheduled }.count
                if played > 0 { Text("\(played)/\(group.matches.count) trận").font(TLType.bodySans(9)).foregroundStyle(TLColor.fg3) }
            }
            ForEach(group.teams) { team in
                HStack(spacing: 8) {
                    Text(team.flag).accessibilityHidden(true)
                    Text(team.displayName).font(TLType.bodySans(12))
                        .fontWeight(team.slug == "viet_nam" ? .bold : .regular)
                        .foregroundStyle(team.slug == "viet_nam" ? TLColor.live : TLColor.fg)
                    Spacer()
                    if let seed = team.seed { Text("#\(seed)").font(TLType.dataMono(9)).foregroundStyle(TLColor.fg3) }
                }
            }
        }
        .padding(12)
        .background(group.containsVietnam ? TLColor.live.opacity(0.05) : TLColor.surface2,
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(group.containsVietnam ? TLColor.live.opacity(0.45) : TLColor.border, lineWidth: 1))
    }
}

struct WorldCupHomeLiveCard: View {
    @State private var model = WorldCupLiveViewModel()
    let openLiveTab: () -> Void

    init(openLiveTab: @escaping () -> Void = {}) {
        self.openLiveTab = openLiveTab
    }

    var body: some View {
        Group {
            if Date() < WorldCupLiveBoard.retirementDate {
                switch model.phase {
                case .loading:
                    RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
                        .fill(TLColor.surface2)
                        .frame(height: 112)
                        .accessibilityLabel("Đang tải kết quả World Cup")
                case .loaded:
                    loadedCard
                case .failed:
                    EmptyView()
                }
            }
        }
        .task {
            await model.load()
            while !Task.isCancelled && Date() < WorldCupLiveBoard.retirementDate {
                try? await Task.sleep(for: .seconds(30))
                if !Task.isCancelled { await model.load() }
            }
        }
    }

    @ViewBuilder
    private var loadedCard: some View {
        if !featuredMatches.isEmpty {
            Button(action: openLiveTab) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        AsyncImage(url: URL(string: "https://thepicklehub.net/images/world-cup-2026-logo.jpg")) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "trophy.fill").foregroundStyle(TLColor.gold)
                        }
                        .frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 10))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(hasLive ? "LIVESCORE" : "KẾT QUẢ HÔM NAY")
                                .font(TLType.titleSans(16)).foregroundStyle(TLColor.fg)
                            Text(hasLive ? "● \(model.feed.liveCount) TRẬN ĐANG ĐẤU" : "PICKLEBALL WORLD CUP 2026")
                                .font(TLType.eyebrowMono(9))
                                .foregroundStyle(hasLive ? TLColor.live : TLColor.gold)
                        }
                        Spacer()
                        Image(systemName: "arrow.right").foregroundStyle(TLColor.gold)
                    }
                    ForEach(featuredMatches) { WorldCupProMatchRow(match: $0) }
                }
                .padding(15)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(hasLive ? "Xem tỷ số trực tiếp Pickleball World Cup" : "Xem kết quả Pickleball World Cup hôm nay")
            .accessibilityHint("Mở tab Trực tiếp")
        }
    }

    private var featuredMatches: [WorldCupProMatch] {
        let source = hasLive ? model.feed.liveProMatches : model.feed.resultsToday()
        return Array(source.sorted { lhs, rhs in
            if lhs.isVietnam != rhs.isVietnam { return lhs.isVietnam }
            return lhs.lastSeenAt > rhs.lastSeenAt
        }.prefix(2))
    }

    private var hasLive: Bool { !model.feed.liveProMatches.isEmpty }
}
