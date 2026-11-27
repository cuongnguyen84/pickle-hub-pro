import SwiftUI

/// The profile tab system (web `ProfileTabs`, PR #1135): which tabs a
/// profile shows and which one opens first. Pure logic, unit-tested.
enum ProfileTab: String, CaseIterable, Identifiable {
    case posts
    case matches
    case achievements
    case tournaments

    var id: String { rawValue }

    var label: String {
        switch self {
        case .posts: return String(localized: "Bài viết")
        case .matches: return String(localized: "Trận đấu")
        case .achievements: return String(localized: "Thành tích")
        case .tournaments: return String(localized: "Giải đấu")
        }
    }
}

enum ProfileTabLogic {
    /// Posts shows for the owner, while the total is unknown, or when
    /// the player has at least one approved post; Achievements needs
    /// athlete data; Matches and Tournaments always show.
    static func visibleTabs(isOwn: Bool, postsTotal: Int?, hasAthlete: Bool) -> [ProfileTab] {
        var tabs: [ProfileTab] = []
        if isOwn || postsTotal == nil || (postsTotal ?? 0) > 0 { tabs.append(.posts) }
        tabs.append(.matches)
        if hasAthlete { tabs.append(.achievements) }
        tabs.append(.tournaments)
        return tabs
    }

    /// Athletes land on Matches; everyone else on Posts when it shows.
    static func defaultTab(isOwn: Bool, postsTotal: Int?, hasAthlete: Bool) -> ProfileTab {
        if hasAthlete { return .matches }
        let visible = visibleTabs(isOwn: isOwn, postsTotal: postsTotal, hasAthlete: hasAthlete)
        return visible.contains(.posts) ? .posts : .matches
    }
}

@Observable
final class PlayerProfileViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(Profile, PlayerStats?)
        case notPublic
        case failed(String)
    }

    var phase: Phase = .loading
    // Social hero + tabs state (web redesign 2026-11-24), loaded
    // alongside the profile; failures here never blank the page.
    var posts: [ProfilePostRow] = []
    var postsTotal: Int?
    var isOwn = false
    var viewerSignedIn = false
    var isFollowing = false
    var followersCount = 0
    var followingCount = 0
    var matchRows: [PlayerMatchHistoryRow] = []
    var matchesLoaded = false
    var matchesReachedEnd = false

    private let repo = ProfileRepository()

    @MainActor
    func load(username: String) async {
        phase = .loading
        do {
            guard let profile = try await repo.profile(username: username) else {
                phase = .notPublic
                return
            }
            // Stats are best-effort — a failure here shouldn't blank the card.
            let stats = try? await repo.stats(username: username)
            phase = .loaded(profile, stats)
            followersCount = stats?.followersCount ?? 0
            followingCount = stats?.followingCount ?? 0

            let viewerID = try? await SupabaseManager.shared.client.auth.session.user.id
            viewerSignedIn = viewerID != nil
            isOwn = viewerID == profile.id
            if let result = try? await repo.profilePosts(userID: profile.id) {
                posts = result.posts
                postsTotal = result.total
            } else {
                postsTotal = 0
            }
            if viewerSignedIn && !isOwn {
                isFollowing = await repo.isFollowing(targetID: profile.id)
            }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func toggleFollow(profileID: UUID) async {
        let target = !isFollowing
        isFollowing = target
        followersCount += target ? 1 : -1
        do {
            try await repo.setFollowing(targetID: profileID, following: target)
        } catch {
            isFollowing = !target
            followersCount += target ? -1 : 1
        }
    }

    @MainActor
    func loadMatches(profileID: UUID) async {
        guard !matchesLoaded else { return }
        matchesLoaded = true
        let page = (try? await repo.matchHistory(playerID: profileID, limit: 20, offset: 0)) ?? []
        matchRows = page
        matchesReachedEnd = page.count < 20
    }

    @MainActor
    func loadMoreMatches(profileID: UUID) async {
        guard matchesLoaded, !matchesReachedEnd else { return }
        let page = (try? await repo.matchHistory(playerID: profileID, limit: 20, offset: matchRows.count)) ?? []
        matchRows.append(contentsOf: page)
        matchesReachedEnd = page.count < 20
    }
}

/// A player's public profile, the native twin of the web
/// /nguoi-choi/:username page after the 2026-11-24 redesign: social
/// hero (cover, overlapping avatar, identity, stat row, follow) over
/// the pill tab system (Posts / Matches / Achievements / Tournaments).
struct PlayerProfileView: View {
    let username: String
    @State private var model = PlayerProfileViewModel()
    @State private var pickedTab: ProfileTab?
    @State private var followListKind: ProfileRepository.FollowKind?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                switch model.phase {
                case .loading:
                    ProgressView().tint(TLColor.accentText).padding(.top, 60)

                case .loaded(let profile, let stats):
                    hero(profile: profile, stats: stats)
                    tabs(profile: profile, stats: stats)

                case .notPublic:
                    emptyState(
                        icon: "lock.fill",
                        title: String(localized: "Hồ sơ không công khai"),
                        message: String(localized: "Người chơi này chưa mở hồ sơ công khai.")
                    )

                case .failed(let message):
                    TLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("Không tải được hồ sơ", systemImage: "xmark.octagon.fill")
                                .foregroundStyle(TLColor.live)
                                .font(.headline)
                            Text(message).font(.caption).foregroundStyle(TLColor.fg3).textSelection(.enabled)
                            Button("Thử lại") { Task { await model.load(username: username) } }
                                .foregroundStyle(TLColor.accentText)
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .assistantContext({ if case .loaded(let p, let st) = model.phase { return SiteAssistant.context(profile: p, stats: st) }; return nil }())
        .navigationTitle("@\(username)")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: username) { await model.load(username: username) }
        .sheet(item: followListBinding) { kind in
            if case .loaded(let profile, _) = model.phase {
                FollowListView(userID: profile.id, kind: kind)
            }
        }
    }

    private var followListBinding: Binding<FollowListKindItem?> {
        Binding(
            get: { followListKind.map(FollowListKindItem.init) },
            set: { followListKind = $0?.kind }
        )
    }

    // MARK: Hero

    private func hero(profile: Profile, stats: PlayerStats?) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ProfileCoverView(
                coverURL: profile.coverURL,
                username: profile.username,
                displayName: profile.resolvedDisplayName
            )

            // Avatar overlaps the cover's bottom edge; actions sit right.
            HStack(alignment: .top, spacing: 12) {
                avatar(profile: profile)
                    .offset(y: -34)
                    .padding(.leading, 4)
                Spacer(minLength: 8)
                if model.viewerSignedIn && !model.isOwn {
                    followButton(profile: profile)
                        .padding(.top, 10)
                }
            }
            .frame(height: 62)

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(profile.resolvedDisplayName)
                        .font(TLFont.sans(24, .bold))
                        .foregroundStyle(TLColor.fg)
                        .lineLimit(2)
                    if profile.isVerified == true {
                        VerifiedBadge(size: 19)
                    }
                    if profile.isPro == true {
                        Text("PRO")
                            .font(TLFont.mono(9, .bold)).tracking(0.8)
                            .foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(TLColor.gold, in: Capsule())
                    }
                }
                Text("@\(profile.resolvedUsername)")
                    .font(TLFont.sans(13))
                    .foregroundStyle(TLColor.fg3)
                if let bio = profile.bio?.nonEmpty {
                    Text(bio)
                        .font(TLFont.sans(14))
                        .foregroundStyle(TLColor.fg2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let meta = metaLine(profile: profile) {
                    Text(meta)
                        .font(TLFont.sans(12))
                        .foregroundStyle(TLColor.fg3)
                }
                if let dupr = profile.duprDoubles ?? profile.duprSingles {
                    HStack(spacing: 6) {
                        Text("DUPR")
                            .font(TLFont.mono(9, .bold)).tracking(0.8)
                            .foregroundStyle(TLColor.fg3)
                        Text(String(format: "%.2f", dupr))
                            .font(TLFont.mono(13, .bold))
                            .foregroundStyle(TLColor.fg)
                        Text(profile.duprDoubles != nil ? "Đôi" : "Đơn")
                            .font(TLFont.sans(11))
                            .foregroundStyle(TLColor.fg3)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(TLColor.surface2, in: Capsule())
                    .padding(.top, 2)
                }
            }
            .padding(.horizontal, 4)

            // Stat row: followers / following open their lists.
            HStack(spacing: 0) {
                statButton(value: model.followersCount, label: String(localized: "Người theo dõi")) {
                    followListKind = .followers
                }
                statButton(value: model.followingCount, label: String(localized: "Đang theo dõi")) {
                    followListKind = .following
                }
                statCell(value: model.postsTotal ?? 0, label: String(localized: "Bài viết"))
                statCell(value: stats?.totalMatches ?? 0, label: String(localized: "Trận"))
            }
            .padding(.top, 16)
        }
    }

    private func avatar(profile: Profile) -> some View {
        Group {
            if let urlString = profile.avatarURL?.nonEmpty, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Circle().fill(TLColor.surface2)
                    }
                }
            } else {
                Circle().fill(TLColor.surface2)
                    .overlay(
                        Text(String(profile.resolvedDisplayName.prefix(1)).uppercased())
                            .font(TLFont.serif(34))
                            .foregroundStyle(TLColor.fg3)
                    )
            }
        }
        .frame(width: 84, height: 84)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(TLColor.border, lineWidth: 1))
        .background(Circle().fill(TLColor.bg))
    }

    private func followButton(profile: Profile) -> some View {
        Button {
            Task { await model.toggleFollow(profileID: profile.id) }
        } label: {
            Text(model.isFollowing ? "Đang theo dõi" : "Theo dõi")
                .font(TLFont.sans(13, .semibold))
                .foregroundStyle(model.isFollowing ? TLColor.fg : TLColor.accentInk)
                .padding(.horizontal, 16).padding(.vertical, 8)
                .background(model.isFollowing ? TLColor.surface2 : TLColor.accent, in: Capsule())
                .overlay(
                    Capsule().strokeBorder(TLColor.border, lineWidth: model.isFollowing ? 1 : 0)
                )
        }
        .buttonStyle(.plain)
    }

    private func statButton(value: Int, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            statContent(value: value, label: label)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
    }

    private func statCell(value: Int, label: String) -> some View {
        statContent(value: value, label: label)
            .frame(maxWidth: .infinity)
    }

    private func statContent(value: Int, label: String) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(TLFont.mono(16, .bold)).monospacedDigit()
                .foregroundStyle(TLColor.fg)
            Text(label)
                .font(TLFont.sans(11))
                .foregroundStyle(TLColor.fg3)
                .lineLimit(1)
        }
    }

    private func metaLine(profile: Profile) -> String? {
        let skillLabels = [
            "beginner": String(localized: "Người mới"),
            "intermediate": String(localized: "Trung bình"),
            "advanced": String(localized: "Khá"),
            "pro": String(localized: "Chuyên nghiệp"),
        ]
        var parts: [String] = []
        if let city = profile.city?.nonEmpty { parts.append(city) }
        if let skill = profile.skillLevel, let label = skillLabels[skill] { parts.append(label) }
        if let created = profile.createdAt, let date = FeedDate.parse(created) {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "vi_VN")
            formatter.dateFormat = "MMM yyyy"
            parts.append("\(String(localized: "Tham gia")) \(formatter.string(from: date))")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: Tabs

    private func hasAthlete(stats: PlayerStats?, profile: Profile) -> Bool {
        (stats?.totalMatches ?? 0) > 0 || profile.duprDoubles != nil || profile.duprSingles != nil
    }

    private func tabs(profile: Profile, stats: PlayerStats?) -> some View {
        let athlete = hasAthlete(stats: stats, profile: profile)
        let visible = ProfileTabLogic.visibleTabs(isOwn: model.isOwn, postsTotal: model.postsTotal, hasAthlete: athlete)
        let fallback = ProfileTabLogic.defaultTab(isOwn: model.isOwn, postsTotal: model.postsTotal, hasAthlete: athlete)
        let active = pickedTab.flatMap { visible.contains($0) ? $0 : nil } ?? fallback
        return VStack(alignment: .leading, spacing: 16) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(visible) { tab in
                        Button {
                            pickedTab = tab
                        } label: {
                            Text(tab == .posts && (model.postsTotal ?? 0) > 0 ? "\(tab.label) (\(model.postsTotal ?? 0))" : tab.label)
                                .font(TLFont.sans(13, tab == active ? .semibold : .medium))
                                .foregroundStyle(tab == active ? TLColor.bg : TLColor.fg3)
                                .padding(.horizontal, 16).padding(.vertical, 8)
                                .background(tab == active ? TLColor.fg : Color.clear, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(4)
                .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
            }

            switch active {
            case .posts:
                postsTab(profile: profile)
            case .matches:
                matchesTab(profile: profile)
            case .achievements:
                VStack(spacing: 20) {
                    RatingCardView(profile: profile, isOwn: model.isOwn)
                    if let stats {
                        statsStrip(stats)
                    }
                }
            case .tournaments:
                placeholderText(String(localized: "Sắp ra mắt - lịch sử giải đấu đã tham gia (Sprint 4)."))
            }
        }
    }

    // MARK: Posts tab

    private func postsTab(profile: Profile) -> some View {
        Group {
            if model.posts.isEmpty {
                placeholderText(model.isOwn
                    ? String(localized: "Bạn chưa có bài viết cộng đồng nào - đăng bài đầu tiên từ nút + ở feed nhé.")
                    : String(localized: "Chưa có bài viết cộng đồng nào."))
            } else {
                VStack(spacing: 16) {
                    ForEach(model.posts) { post in
                        profilePostCard(post)
                    }
                }
            }
        }
    }

    private func profilePostCard(_ post: ProfilePostRow) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Natural aspect, never cropped (web #1138): the whole
            // photo stays visible at any orientation, capped at 720pt.
            AsyncImage(url: URL(string: post.imageURL)) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFit()
                } else {
                    Rectangle().fill(TLColor.surface2).aspectRatio(4 / 3, contentMode: .fit)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(maxHeight: 720)
            .background(TLColor.bgElev)
            .clipped()

            VStack(alignment: .leading, spacing: 6) {
                if let body = post.body?.nonEmpty {
                    Text(body)
                        .font(TLFont.sans(14))
                        .foregroundStyle(TLColor.fg2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 8) {
                    if let topic = post.topic, let label = SocialPostTopic(rawValue: topic)?.label {
                        Text(label)
                            .font(TLFont.mono(9, .medium)).tracking(0.8).textCase(.uppercase)
                            .foregroundStyle(TLColor.accentText)
                    }
                    Text(FeedDate.relative(FeedDate.parse(post.createdAt)))
                        .font(TLFont.sans(11))
                        .foregroundStyle(TLColor.fg4)
                }
            }
            .padding(12)
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(TLColor.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: Matches tab

    private func matchesTab(profile: Profile) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if !model.matchesLoaded {
                ProgressView().tint(TLColor.fg3)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else if model.matchRows.isEmpty {
                placeholderText(String(localized: "Chưa có trận đấu nào."))
            } else {
                ForEach(model.matchRows) { row in
                    matchRow(row)
                    if row.id != model.matchRows.last?.id {
                        Divider().overlay(TLColor.border)
                    }
                }
                if !model.matchesReachedEnd {
                    Button("Xem thêm trận đấu") {
                        Task { await model.loadMoreMatches(profileID: profile.id) }
                    }
                    .font(TLFont.sans(13, .semibold))
                    .foregroundStyle(TLColor.accentText)
                    .padding(.top, 12)
                }
            }
        }
        .task { await model.loadMatches(profileID: profile.id) }
    }

    private func matchRow(_ row: PlayerMatchHistoryRow) -> some View {
        let teams = FeedFormat.groupTeams(row.participants)
        func names(_ side: [FeedParticipant]) -> String {
            side.map { $0.displayName?.nonEmpty ?? $0.username ?? "" }.filter { !$0.isEmpty }.joined(separator: " & ")
        }
        let scores = zip(row.teamAScore, row.teamBScore).map { "\($0)-\($1)" }.joined(separator: " · ")
        return HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(names(teams.teamA))
                    .font(TLFont.sans(13, row.playerTeam == "a" ? .semibold : .regular))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                Text(names(teams.teamB))
                    .font(TLFont.sans(13, row.playerTeam == "b" ? .semibold : .regular))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                Text(FeedDate.relative(FeedDate.parse(row.playedAt)))
                    .font(TLFont.sans(11))
                    .foregroundStyle(TLColor.fg4)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Text(scores)
                    .font(TLFont.mono(12, .medium)).monospacedDigit()
                    .foregroundStyle(TLColor.fg2)
                Text(row.playerWon ? "Thắng" : "Thua")
                    .font(TLFont.mono(9, .bold)).tracking(0.8)
                    .foregroundStyle(row.playerWon ? TLColor.accentInk : TLColor.fg2)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(row.playerWon ? TLColor.accent : TLColor.surface2, in: Capsule())
            }
        }
        .padding(.vertical, 10)
    }

    // MARK: Shared bits

    private func placeholderText(_ text: String) -> some View {
        Text(text)
            .font(TLFont.serif(17))
            .foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 16)
    }

    private func statsStrip(_ stats: PlayerStats) -> some View {
        TLCard {
            VStack(spacing: 14) {
                HStack(spacing: 0) {
                    statCellOld(String(localized: "Trận"), "\(stats.totalMatches)")
                    divider
                    statCellOld(String(localized: "Thắng"), "\(stats.wins)")
                    divider
                    statCellOld("Thua", "\(stats.losses)")
                    divider
                    statCellOld(String(localized: "Tỉ lệ"), String(format: "%.0f%%", stats.winRate))
                }
                if let form = stats.last5Form?.nonEmpty {
                    formRow(form)
                }
            }
        }
    }

    private func statCellOld(_ label: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(TLFont.mono(20, .bold)).monospacedDigit()
                .foregroundStyle(TLColor.fg)
            Text(label)
                .font(TLFont.mono(9, .medium)).tracking(0.8).textCase(.uppercase)
                .foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle().fill(TLColor.border).frame(width: 1, height: 28)
    }

    private func formRow(_ form: String) -> some View {
        HStack(spacing: 6) {
            Text("PHONG ĐỘ")
                .font(TLFont.mono(9, .medium)).tracking(0.8)
                .foregroundStyle(TLColor.fg3)
            Spacer(minLength: 8)
            ForEach(Array(form.prefix(5).enumerated()), id: \.offset) { _, char in
                let isWin = char == "W"
                Text(isWin ? "T" : "B")
                    .font(TLFont.mono(11, .bold))
                    .foregroundStyle(isWin ? TLColor.accentInk : TLColor.fg2)
                    .frame(width: 22, height: 22)
                    .background(isWin ? TLColor.accent : TLColor.surface2, in: Circle())
            }
        }
    }

    private func emptyState(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon).font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text(title).font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message)
                .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.top, 60).padding(.horizontal, 24)
    }
}

/// Identifiable wrapper so the follow-list sheet can use `.sheet(item:)`.
private struct FollowListKindItem: Identifiable {
    let kind: ProfileRepository.FollowKind
    var id: String { kind == .followers ? "followers" : "following" }
}
