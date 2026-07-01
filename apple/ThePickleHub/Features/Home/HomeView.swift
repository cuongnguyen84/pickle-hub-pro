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
                        liveBar
                    }

                    if let hero = model.posts.first {
                        leadStory(hero)
                    }
                    if model.posts.count > 1 {
                        HomeFeatureSection(posts: Array(model.posts.dropFirst()))
                    }
                    if !model.live.isEmpty {
                        HomeLiveSection(streams: model.live) { openURL = IdentifiedURL(url: $0) }
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
                    partnerButton("Log trận", systemImage: "plus", filled: true)
                }
                .buttonStyle(.plain)
                NavigationLink {
                    BlogListView()
                } label: {
                    partnerButton("Hướng dẫn", systemImage: "arrow.right", filled: false)
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
        if let stream = model.live.first(where: { $0.isLive }) ?? model.live.first {
            Button {
                Haptics.light()
                openURL = IdentifiedURL(url: WebRoutes.live(id: stream.id))
            } label: {
                HStack(spacing: 11) {
                    LivePulseDot(reduceMotion: reduceMotion)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("LIVE" + (stream.orgName.map { " · \($0)" } ?? ""))
                            .font(TLType.eyebrowMono(9)).tracking(1)
                            .foregroundStyle(TLColor.live)
                            .lineLimit(1)
                        Text(stream.displayTitle)
                            .font(TLFont.sans(13, .medium))
                            .foregroundStyle(TLColor.fg)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 20)).foregroundStyle(TLColor.accentText)
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(TLColor.surface, in: barShape)
                .overlay(barShape.strokeBorder(TLColor.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Đang trực tiếp: \(stream.displayTitle)")
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
            statChip(value: stats.totalTournaments, label: "GIẢI ĐẤU")
            statChip(value: stats.totalUsers, label: "NGƯỜI CHƠI")
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
                    num: "01", title: "Báo chí thật",
                    lead: "Tường thuật trận đấu, chân dung vận động viên, phân tích — viết bởi phóng viên ",
                    accent: "có mặt tại sân.", tail: " Không tổng hợp. No AI slop."
                )
                manifestoPoint(
                    num: "02", title: "Một giải, một app",
                    lead: "PPA. APP. MLP. European Open. Vietnam National. Mọi bracket, mọi tỉ số, mọi sân — ",
                    accent: "ở một nơi.", tail: ""
                )
                manifestoPoint(
                    num: "03", title: "Dành cho người chơi",
                    lead: "Tìm bạn đánh, đặt sân, theo dõi DUPR. Tất cả những gì người chơi cần — ",
                    accent: "và không có thứ gì họ không cần.", tail: ""
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
    case tournaments
    case rankings
    case notifications
    case search
    case profile
}
