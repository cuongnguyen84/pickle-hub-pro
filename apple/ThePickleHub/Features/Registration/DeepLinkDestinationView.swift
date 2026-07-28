import SwiftUI

// ============================================================================
// DeepLinkDestinationView — đích của một DeepLink, present dạng sheet từ
// ThePickleHubApp.onOpenURL. Mỗi case tự load dữ liệu cần thiết.
// ============================================================================

struct DeepLinkDestinationView: View {
    let link: DeepLink

    var body: some View {
        NavigationStack {
            switch link {
            case .registration(let token):
                PlayerRegistrationView(token: token)
            case .joinInvite(let code):
                JoinInviteLoaderView(code: code)
            case .socialEvent(let slug):
                SocialEventLoaderView(slug: slug)
            case .livestream(let id):
                LivestreamLoaderView(id: id)
            case .quickTable(let shareID):
                QuickTableDetailView(shareID: shareID, fallbackName: "Quick Table")
            case .quickTableScore(let matchID):
                QuickTableScoreLinkView(matchID: matchID)
            case .parentTournament(let shareID):
                ParentTournamentDetailView(shareID: shareID)
            case .doublesElimination(let shareID):
                DoublesElimDetailView(shareID: shareID, fallbackName: String(localized: "Loại kép"))
            case .doublesEliminationScore(let matchID):
                DoublesEliminationScoreLinkView(matchID: matchID)
            case .teamMatch(let shareID):
                TeamMatchDetailView(shareID: shareID, fallbackName: String(localized: "Đấu đồng đội"))
            case .teamMatchScore(let matchID):
                TeamMatchScoreLinkView(matchID: matchID)
            case .flexTournament(let shareID):
                FlexDetailView(shareID: shareID, fallbackName: String(localized: "Giải linh hoạt"))
            case .toolsHub:
                ToolsView()
            case .createQuickTable:
                CreateQuickTableView { _, _ in }
            case .createDoublesElimination:
                CreateDoublesElimView { _, _ in }
            case .createTeamMatch:
                CreateTeamMatchView { _, _ in }
            case .createFlexTournament:
                CreateFlexView { _, _ in }
            case .dashboardPicker:
                TournamentDashboardPickerView()
            case .tournamentDashboard(let type, let id):
                TournamentDashboardDeepLinkView(type: type, id: id)
            }
        }
    }
}

private struct QuickTableScoreLinkView: View {
    let matchID: UUID
    @State private var shareID: String?
    @State private var loaded = false

    var body: some View {
        Group {
            if let shareID {
                QuickTableDetailView(
                    shareID: shareID,
                    fallbackName: String(localized: "Chấm điểm Quick Table"),
                    initialScoringMatchID: matchID
                )
            } else if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else {
                TLEmptyState(
                    icon: "sportscourt",
                    title: "Không tìm thấy trận đấu",
                    subtitle: "Trận đã bị xóa hoặc bạn không có quyền truy cập."
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            shareID = try? await QuickTableRepository().shareID(forMatchID: matchID)
            loaded = true
        }
    }
}

private struct DoublesEliminationScoreLinkView: View {
    let matchID: UUID
    @State private var shareID: String?
    @State private var loaded = false

    var body: some View {
        Group {
            if let shareID {
                DoublesElimDetailView(
                    shareID: shareID,
                    fallbackName: String(localized: "Chấm điểm loại trực tiếp"),
                    initialScoringMatchID: matchID
                )
            } else if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else {
                missingScoreLink
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            shareID = try? await DoublesElimRepository().shareID(forMatchID: matchID)
            loaded = true
        }
    }

    private var missingScoreLink: some View {
        TLEmptyState(
            icon: "sportscourt",
            title: "Không tìm thấy trận đấu",
            subtitle: "Trận đã bị xóa hoặc bạn không có quyền truy cập."
        )
    }
}

private struct TeamMatchScoreLinkView: View {
    let matchID: UUID
    @State private var shareID: String?
    @State private var loaded = false

    var body: some View {
        Group {
            if let shareID {
                TeamMatchDetailView(
                    shareID: shareID,
                    fallbackName: String(localized: "Chấm điểm đấu đồng đội"),
                    initialScoringMatchID: matchID
                )
            } else if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else {
                missingScoreLink
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            shareID = try? await TeamMatchRepository().shareID(forMatchID: matchID)
            loaded = true
        }
    }

    private var missingScoreLink: some View {
        TLEmptyState(
            icon: "sportscourt",
            title: "Không tìm thấy trận đấu",
            subtitle: "Trận đã bị xóa hoặc bạn không có quyền truy cập."
        )
    }
}

private struct TournamentDashboardDeepLinkView: View {
    let type: String
    let id: String
    @State private var tournament: ActiveDashboardTournament?
    @State private var loaded = false

    var body: some View {
        Group {
            if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else if let tournament {
                TournamentDashboardView(tournament: tournament)
            } else {
                TLEmptyState(
                    icon: "display.trianglebadge.exclamationmark",
                    title: "Bảng sân chưa hoạt động",
                    subtitle: "Giải đã kết thúc, chưa bắt đầu hoặc bạn không có quyền xem."
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            let expected: TournamentDashboardType? = switch type {
            case "quick-table": .quickTable
            case "team-match": .teamMatch
            case "doubles-elimination": .doublesElimination
            default: nil
            }
            let rows = await TournamentDashboardRepository().activeTournaments()
            tournament = rows.first {
                guard $0.type == expected else { return false }
                return $0.shareID == id || $0.id.uuidString.caseInsensitiveCompare(id) == .orderedSame
            }
            loaded = true
        }
    }
}

/// `/live/:id` (notification tap) → load stream → LiveWatchScreen.
private struct LivestreamLoaderView: View {
    let id: UUID
    @State private var stream: LivestreamSummary?
    @State private var loaded = false

    var body: some View {
        Group {
            if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else if let stream {
                LiveWatchScreen(stream: stream)
            } else {
                TLEmptyState(icon: "dot.radiowaves.up.forward", title: "Không tìm thấy livestream",
                             subtitle: "Buổi phát không tồn tại hoặc đã bị gỡ.")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            stream = (try? await LiveRepository().stream(id: id)) ?? nil
            loaded = true
        }
    }
}

/// `/join/:code` → tra lời mời và nhận lời ghép đôi ngay trong app.
private struct JoinInviteLoaderView: View {
    let code: String
    @State private var details: QuickTableRepository.InviteDetails?
    @State private var loaded = false
    @State private var accepted = false
    @State private var name = ""
    @State private var team = ""
    @State private var rating = "none"
    @State private var skill = ""
    @State private var link = ""
    @State private var busy = false
    @State private var errorMessage: String?
    private let repo = QuickTableRepository()

    var body: some View {
        ScrollView {
            if !loaded {
                ProgressView().tint(TLColor.accentText).padding(.top, 80)
            } else if let details {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(spacing: 10) {
                        Image(systemName: accepted ? "checkmark.circle.fill" : "person.2.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(TLColor.accentText)
                        Text(accepted ? "Đã tham gia đội" : "Lời mời ghép đôi")
                            .font(TLFont.serif(24)).foregroundStyle(TLColor.fg)
                        Text("\(details.team.player1DisplayName) mời bạn cùng thi đấu tại \(details.tableName).")
                            .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)

                    if !accepted && details.invitation.status == "pending" {
                        field("Tên hiển thị *", text: $name, placeholder: "Tên của bạn")
                        field("Team / CLB", text: $team, placeholder: "Tùy chọn")
                        Picker("Hệ trình độ", selection: $rating) {
                            Text("Không").tag("none")
                            Text("DUPR").tag("DUPR")
                            Text("Khác").tag("other")
                        }
                        .pickerStyle(.segmented)
                        if rating != "none" {
                            field("Điểm trình độ", text: $skill, placeholder: "VD: 3.5")
                        }
                        field("Link hồ sơ", text: $link, placeholder: "Tùy chọn")
                        if let errorMessage {
                            Text(errorMessage).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                        }
                        Button {
                            Task { await accept() }
                        } label: {
                            HStack {
                                if busy { ProgressView().tint(TLColor.accentInk) }
                                Text(busy ? "Đang tham gia…" : "Nhận lời và tham gia đội")
                            }
                            .font(TLFont.sans(15, .semibold))
                            .foregroundStyle(TLColor.accentInk)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    } else if !accepted {
                        Text("Lời mời đã được sử dụng, bị hủy hoặc hết hạn.")
                            .font(TLFont.sans(13)).foregroundStyle(TLColor.live)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }

                    NavigationLink {
                        QuickTableDetailView(shareID: details.shareID, fallbackName: details.tableName)
                    } label: {
                        Text("Mở giải: \(details.tableName)")
                            .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }
                .padding(20)
            } else {
                TLEmptyState(icon: "link.badge.plus", title: "Lời mời không hợp lệ",
                             subtitle: "Link mời đã hết hạn hoặc không tồn tại.")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .navigationTitle("Tham gia đội")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            details = try? await repo.invitationDetails(code: code)
            loaded = true
        }
    }

    private func field(_ title: LocalizedStringKey, text: Binding<String>, placeholder: LocalizedStringKey) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).textCase(.uppercase).font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3)
            TextField(placeholder, text: text)
                .padding(.horizontal, 12).frame(minHeight: 44)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    @MainActor
    private func accept() async {
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            try await repo.acceptInvitation(
                code: code,
                displayName: name,
                team: team,
                ratingSystem: rating,
                skillLevel: Double(skill.replacingOccurrences(of: ",", with: ".")),
                profileLink: link
            )
            accepted = true
            Haptics.success()
        } catch {
            errorMessage = UserFacingError.message(failure: "Không tham gia được đội.", error: error)
            Haptics.error()
        }
    }
}

/// `/social/:slug` → load sự kiện → SocialDetailView.
private struct SocialEventLoaderView: View {
    let slug: String
    @State private var event: SocialEvent?
    @State private var loaded = false
    private let repo = SocialRepository()

    var body: some View {
        Group {
            if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else if let event {
                SocialDetailView(event: event)
            } else {
                TLEmptyState(icon: "calendar.badge.exclamationmark", title: "Không tìm thấy sự kiện",
                             subtitle: "Sự kiện không tồn tại hoặc đã bị gỡ.")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            event = try? await repo.event(slug: slug)
            loaded = true
        }
    }
}
