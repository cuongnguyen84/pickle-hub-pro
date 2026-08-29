import SwiftUI

/// Editorial homepage, mirroring the web `Index.tsx` magazine layout.
/// Chunk 1: partnership card, "Tuần này" features, "Tin mới", stats, manifesto,
/// pull-quote. (Videos, upcoming, live, ticker, newsletter follow.)
struct HomeView: View {
    @State private var model = HomeViewModel()
    @State private var openURL: IdentifiedURL?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if !model.tickers.isEmpty {
                    HomeTicker(items: model.tickers)
                }

                VStack(alignment: .leading, spacing: 34) {
                    VStack(alignment: .leading, spacing: 18) {
                        partnerCard
                        if ShopFeatureGate.isEnabled {
                            shopEntry
                        }
                        if !model.live.isEmpty {
                            liveBar
                        }
                    }

                    // Mirrors web Index.tsx: live/upcoming/replay-≤7d streams
                    // lead the feed; fully quiet days keep editorial first.
                    if !model.live.isEmpty || !model.scheduled.isEmpty || !model.recentEnded.isEmpty {
                        livestreamSection
                    }

                    if let hero = model.posts.first {
                        leadStory(hero)
                    }
                    if model.posts.count > 1 {
                        HomeFeatureSection(posts: Array(model.posts.dropFirst()))
                    }
                    if !model.news.isEmpty {
                        HomeNewsSection(items: model.news)
                    }
                    if let stats = model.stats {
                        statsRow(stats)
                    }

                    manifesto

                    HomeUpcomingSection(tournaments: model.upcoming)

                    if !model.videos.isEmpty {
                        HomeVideosSection(videos: model.videos) { openURL = IdentifiedURL(url: $0) }
                    }

                    pullQuote
                    HomeNewsletter()
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 36)
            }
        }
        .background(TLColor.bg)
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(item: $openURL) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    private var shopEntry: some View {
        NavigationLink(value: HomeRoute.shop) {
            HStack(spacing: TLSpacing.md) {
                Image(systemName: "bag.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(TLColor.accentInk)
                    .frame(width: 44, height: 44)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text("SHOP")
                        .font(TLType.eyebrowMono(9)).tracking(1)
                        .foregroundStyle(TLColor.accentText)
                    Text("Đồ pickleball từ người bán trong nước")
                        .font(TLType.titleSans(14))
                        .foregroundStyle(TLColor.fg)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right").foregroundStyle(TLColor.fg3)
            }
            .padding(TLSpacing.md)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border2, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Mở Shop ThePickleHub")
    }

    private var livestreamSection: some View {
        HomeLiveSection(
            liveStreams: model.live,
            scheduledStreams: model.scheduled,
            endedStreams: model.recentEnded
        )
    }

    // MARK: Partnership

    /// THEPICKLEHUB × DUPR official-partner banner with the "Log trận" +
    /// "Hướng dẫn" quick actions (restored — Cuong keeps this as the Home lead).
    private var partnerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("OFFICIAL PARTNERSHIP", systemImage: "checkmark.seal.fill")
                    .font(TLFont.mono(9, .semibold)).tracking(0.6)
                    .foregroundStyle(TLColor.accentText)
                Spacer()
                Text("VERIFIED").font(TLFont.mono(9, .semibold)).foregroundStyle(TLColor.fg3)
            }
            HStack(spacing: 8) {
                Text("THEPICKLEHUB").font(TLFont.sans(17, .bold)).foregroundStyle(TLColor.fg)
                Text("×").font(TLFont.sans(15)).foregroundStyle(TLColor.fg3)
                Text("DUPR").font(TLFont.sans(17, .bold)).foregroundStyle(TLColor.fg)
                Text("Official Partner").font(TLFont.serif(17)).foregroundStyle(TLColor.fg3)
            }
            Text("GLOBAL STANDARD · 2018 → 2026")
                .font(TLFont.mono(9)).tracking(0.6).foregroundStyle(TLColor.fg4)

            HStack(spacing: 8) {
                NavigationLink {
                    MatchLogView()
                } label: {
                    partnerButton(String(localized: "Log trận"), systemImage: "plus", filled: true)
                }
                .buttonStyle(.plain)
                NavigationLink {
                    BlogListView()
                } label: {
                    partnerButton(String(localized: "Hướng dẫn"), systemImage: "arrow.right", filled: false)
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 4)
        }
        .feedCard()
    }

    private func partnerButton(_ title: String, systemImage: String, filled: Bool) -> some View {
        HStack(spacing: 5) {
            if !filled { Text(title) }
            Image(systemName: systemImage).font(.system(size: 11, weight: .bold))
            if filled { Text(title) }
        }
        .font(TLFont.mono(11, .semibold))
        .foregroundStyle(filled ? TLColor.accentInk : TLColor.fg2)
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(filled ? TLColor.accent : .clear, in: Capsule())
        .overlay(Capsule().strokeBorder(filled ? .clear : TLColor.border2, lineWidth: 1))
    }

    /// Always-present live strip. Shows the current live broadcast (tap → player)
    /// or a muted "no live" state. Only real backend data — no fabricated scores.
    @ViewBuilder
    private var liveBar: some View {
        let barShape = RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
        if let stream = model.live.first ?? model.scheduled.first {
            let isLive = stream.isLive
            let eyebrow = isLive
                ? "LIVE" + (stream.orgName.map { " · \($0)" } ?? "")
                : "SẮP PHÁT" + (scheduledTimeLabel(stream).map { " · \($0)" } ?? "")
            NavigationLink {
                LiveWatchScreen(stream: stream)
            } label: {
                HStack(spacing: 11) {
                    if isLive {
                        LivePulseDot(reduceMotion: reduceMotion)
                    } else {
                        Image(systemName: "clock.badge")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(TLColor.accentText)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(eyebrow)
                            .font(TLType.eyebrowMono(9)).tracking(1)
                            .foregroundStyle(isLive ? TLColor.live : TLColor.accentText)
                            .lineLimit(1)
                        Text(stream.displayTitle)
                            .font(TLFont.sans(13, isLive ? .medium : .semibold))
                            .foregroundStyle(TLColor.fg)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 20)).foregroundStyle(TLColor.accentText)
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(isLive ? TLColor.surface : TLColor.accent.opacity(0.10), in: barShape)
                .overlay(barShape.strokeBorder(isLive ? TLColor.border : TLColor.accentDim.opacity(0.5), lineWidth: isLive ? 1 : 1.5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                isLive
                    ? "Đang trực tiếp: \(stream.displayTitle)"
                    : "Sắp phát sóng: \(stream.displayTitle)"
            )
        } else {
            HStack(spacing: 11) {
                Circle().fill(TLColor.fg4).frame(width: 8, height: 8)
                Text("Chưa có trận trực tiếp")
                    .font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg3)
                Spacer()
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(TLColor.surface, in: barShape)
            .overlay(barShape.strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    /// Single lead story under a "/ TUẦN NÀY" kicker.
    @ViewBuilder
    private func leadStory(_ post: BlogPostSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("/ TUẦN NÀY")
                .font(TLType.eyebrowMono(9)).tracking(1.5)
                .foregroundStyle(TLColor.accentText)
            StoryLink(post: post)
        }
    }

    // MARK: Stats

    private func statsRow(_ stats: HomeStats) -> some View {
        HStack(spacing: 24) {
            statChip(value: stats.totalTournaments, label: String(localized: "GIẢI ĐẤU"))
            statChip(value: stats.totalUsers, label: String(localized: "NGƯỜI CHƠI"))
            Spacer()
        }
    }

    private func statChip(value: Int, label: String) -> some View {
        HStack(spacing: 8) {
            Text(HomeStats.grouped(value))
                .font(TLFont.mono(20, .bold)).foregroundStyle(TLColor.fg)
            Text(label)
                .font(TLFont.mono(10, .medium)).tracking(0.6).foregroundStyle(TLColor.fg3)
        }
    }

    // MARK: Manifesto

    private var manifesto: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("/ 02 — Tinh thần của chúng tôi")
                .font(TLFont.mono(10, .medium)).foregroundStyle(TLColor.fg3)

            (Text("Pickleball xứng đáng có sự chăm sóc ")
                + Text("như mọi môn thể thao đã có cả thế kỷ trước.").foregroundColor(TLColor.accentText).italic())
                .font(TLFont.serif(28))
                .foregroundStyle(TLColor.fg)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 18) {
                manifestoPoint(
                    num: "01", title: String(localized: "Báo chí thật"),
                    lead: String(localized: "Tường thuật trận đấu, chân dung vận động viên, phân tích — viết bởi phóng viên "),
                    accent: String(localized: "có mặt tại sân."), tail: String(localized: " Không tổng hợp. No AI slop.")
                )
                manifestoPoint(
                    num: "02", title: String(localized: "Một giải, một app"),
                    lead: String(localized: "PPA. APP. MLP. European Open. Vietnam National. Mọi bracket, mọi tỉ số, mọi sân — "),
                    accent: String(localized: "ở một nơi."), tail: ""
                )
                manifestoPoint(
                    num: "03", title: String(localized: "Dành cho người chơi"),
                    lead: String(localized: "Tìm bạn đánh, đặt sân, theo dõi DUPR. Tất cả những gì người chơi cần — "),
                    accent: String(localized: "và không có thứ gì họ không cần."), tail: ""
                )
            }
        }
        .padding(.vertical, 8)
    }

    private func manifestoPoint(num: String, title: String, lead: String, accent: String, tail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(num) / \(title.uppercased())")
                .font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.accentText)
            (Text(lead) + Text(accent).foregroundColor(TLColor.accentText).italic() + Text(tail))
                .font(TLFont.sans(15))
                .foregroundStyle(TLColor.fg2)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Pull-quote

    private var pullQuote: some View {
        VStack(spacing: 14) {
            Text("“Câu chuyện hay nhất xảy ra giữa hai pha bóng — và chúng tôi cũng có mặt ở đó.”")
                .font(TLFont.serif(26))
                .foregroundStyle(TLColor.fg)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            Text("— TÒA SOẠN THEPICKLEHUB")
                .font(TLFont.mono(10, .medium)).tracking(0.8).foregroundStyle(TLColor.fg4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }
}

/// Destinations reached from the Home toolbar menu (the native stand-in for the
/// web header nav).
enum HomeRoute: Hashable {
    case shop
    case tournaments
    case rankings
    case notifications
    case search
    case profile
}
