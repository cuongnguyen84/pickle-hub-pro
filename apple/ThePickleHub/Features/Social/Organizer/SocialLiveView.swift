import SwiftUI

// ============================================================================
// SocialLiveView — BTC điều hành buổi chơi trực tiếp.
// Port web /social/:slug/live (nhánh organizer): mọi trận in_progress hiện
// ô nhập tỉ số (organizer_override qua edge fn submit-match-score), trận
// scheduled có nút Bắt đầu, BXH seed đủ roster.
// ponytail: poll 5s thay realtime channel — màn này BTC mở chủ động,
// nâng lên postgres_changes (như ChatViewModel) nếu cần đa thiết bị mượt.
// ============================================================================

@Observable
final class SocialLiveModel {
    let event: SocialEvent
    var matches: [SocialLiveMatch] = []
    var regs: [EventRegistration] = []
    var loaded = false
    var busyID: UUID?
    var errorText: String?
    private let repo = SocialOrganizerRepository()

    init(event: SocialEvent) { self.event = event }

    /// profile_id (lowercased) → tên hiển thị, từ registrations.
    var names: [String: String] {
        Dictionary(regs.compactMap { r in r.profileID.map { ($0.uuidString.lowercased(), r.displayName) } },
                   uniquingKeysWith: { a, _ in a })
    }

    var inProgress: [SocialLiveMatch] { matches.filter { $0.status == "in_progress" } }
    var firstScheduled: SocialLiveMatch? { matches.first { $0.status == "scheduled" } }
    var scheduledCount: Int { matches.filter { $0.status == "scheduled" }.count }
    var completedCount: Int { matches.filter { $0.status == "completed" }.count }

    var standings: [StandingRow] {
        let base = SocialStandings.compute(matches)
        let roster = regs.compactMap { r in
            r.profileID.map { (profileID: $0.uuidString.lowercased(), level: r.selfRatedLevel) }
        }
        return SocialStandings.seedWithRoster(base, roster: roster)
    }

    func name(_ id: UUID?) -> String {
        id.flatMap { names[$0.uuidString.lowercased()] } ?? "—"
    }
    func teamLabel(_ m: SocialLiveMatch, _ team: String) -> String {
        team == "a"
            ? "\(name(m.teamAPlayer1ID)) & \(name(m.teamAPlayer2ID))"
            : "\(name(m.teamBPlayer1ID)) & \(name(m.teamBPlayer2ID))"
    }

    @MainActor func load() async {
        matches = (try? await repo.liveMatches(eventID: event.id)) ?? []
        regs = (try? await repo.registrations(eventID: event.id)) ?? []
        loaded = true
    }

    @MainActor func refresh() async {
        matches = (try? await repo.liveMatches(eventID: event.id)) ?? matches
    }

    @MainActor func start(_ m: SocialLiveMatch) async {
        busyID = m.id; errorText = nil
        do { try await repo.startMatch(id: m.id) } catch { errorText = error.localizedDescription }
        await refresh(); busyID = nil
    }

    @MainActor func submit(_ m: SocialLiveMatch, a: Int, b: Int) async -> Bool {
        busyID = m.id; errorText = nil
        defer { busyID = nil }
        do {
            try await repo.submitScoreAsOrganizer(matchID: m.id, teamA: a, teamB: b)
            await refresh()
            Haptics.success()
            return true
        } catch {
            errorText = "Không ghi được tỉ số: \(error.localizedDescription)"
            return false
        }
    }
}

struct SocialLiveView: View {
    @State private var model: SocialLiveModel
    @State private var showAllStandings = false

    init(event: SocialEvent) { _model = State(initialValue: SocialLiveModel(event: event)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if model.loaded && model.matches.isEmpty {
                    TLEmptyState(icon: "calendar.badge.exclamationmark", title: "Chưa có lịch thi đấu",
                                 subtitle: "Vào Xếp cặp để sinh lịch và lưu vào sự kiện trước.")
                        .frame(maxWidth: .infinity)
                } else {
                    progressStrip
                    if let err = model.errorText {
                        Text(err).font(TLFont.sans(13)).foregroundStyle(.red)
                    }
                    if !model.inProgress.isEmpty { nowSection }
                    if let next = model.firstScheduled { nextSection(next) }
                    if !model.standings.isEmpty { standingsSection }
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Điều hành trực tiếp")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .task {
            // Poll 5s khi màn đang mở (tỉ số từ máy khác / người chơi web).
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                await model.refresh()
            }
        }
        .refreshable { await model.refresh() }
    }

    private var progressStrip: some View {
        HStack(spacing: 8) {
            chip("\(model.inProgress.count) đang đấu", model.inProgress.isEmpty ? TLColor.fg3 : TLColor.live)
            chip("\(model.scheduledCount) chờ", TLColor.fg3)
            chip("\(model.completedCount) xong", TLColor.accentText)
            Spacer()
        }
    }

    private func chip(_ text: String, _ color: Color) -> some View {
        Text(text).font(TLFont.mono(11, .semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }

    // MARK: Đang diễn ra — BTC nhập tỉ số từng sân

    private var nowSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("ĐANG DIỄN RA")
            ForEach(model.inProgress) { m in
                LiveScoreCard(model: model, match: m)
            }
        }
    }

    // MARK: Tiếp theo

    private func nextSection(_ m: SocialLiveMatch) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("TIẾP THEO · VÒNG \(m.round) · SÂN \(m.court)")
            VStack(alignment: .leading, spacing: 10) {
                Text(model.teamLabel(m, "a")).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                Text("vs").font(TLFont.mono(11)).foregroundStyle(TLColor.fg4)
                Text(model.teamLabel(m, "b")).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                Button {
                    Task { await model.start(m) }
                } label: {
                    HStack {
                        if model.busyID == m.id { ProgressView().controlSize(.small) }
                        Label("Bắt đầu trận", systemImage: "play.fill")
                    }
                    .font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(model.busyID == m.id)
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
        }
    }

    // MARK: BXH

    private var standingsSection: some View {
        let rows = showAllStandings ? model.standings : Array(model.standings.prefix(8))
        return VStack(alignment: .leading, spacing: 10) {
            sectionHeader("BẢNG XẾP HẠNG")
            VStack(spacing: 0) {
                HStack {
                    Text("Người chơi").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3)
                    Spacer()
                    Text("T").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3).frame(width: 28)
                    Text("B").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3).frame(width: 28)
                    Text("+/−").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3).frame(width: 40)
                }
                .padding(.vertical, 6)
                ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                    Rectangle().fill(TLColor.border).frame(height: 1)
                    HStack {
                        Text("\(i + 1)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).frame(width: 18, alignment: .leading)
                        Text(model.names[r.playerID] ?? "?").font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg).lineLimit(1)
                        Spacer()
                        Text("\(r.wins)").font(TLFont.mono(12)).frame(width: 28)
                        Text("\(r.losses)").font(TLFont.mono(12)).frame(width: 28)
                        Text(r.pointDiff > 0 ? "+\(r.pointDiff)" : "\(r.pointDiff)")
                            .font(TLFont.mono(12))
                            .foregroundStyle(r.pointDiff > 0 ? TLColor.accentText : r.pointDiff < 0 ? .red : TLColor.fg3)
                            .frame(width: 40)
                    }
                    .padding(.vertical, 8)
                }
            }
            .padding(.horizontal, 12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
            if model.standings.count > 8 && !showAllStandings {
                Button("Xem tất cả \(model.standings.count) người") { showAllStandings = true }
                    .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg2)
            }
        }
    }

    private func sectionHeader(_ title: LocalizedStringKey) -> some View {
        HStack(spacing: 10) {
            Text(title).font(TLFont.mono(11, .semibold)).tracking(1.2).foregroundStyle(TLColor.fg2)
            Rectangle().fill(LinearGradient(colors: [TLColor.border, .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1)
        }
    }
}

/// Card nhập tỉ số một trận in_progress (BTC override).
private struct LiveScoreCard: View {
    let model: SocialLiveModel
    let match: SocialLiveMatch
    @State private var scoreA = ""
    @State private var scoreB = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("VÒNG \(match.round) · SÂN \(match.court)")
                    .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
                Spacer()
                Text("LIVE").font(TLFont.mono(9, .bold)).tracking(1)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(TLColor.live.opacity(0.15), in: Capsule())
                    .foregroundStyle(TLColor.live)
            }
            HStack(spacing: 10) {
                scoreColumn(model.teamLabel(match, "a"), $scoreA)
                Text("–").font(TLFont.mono(18)).foregroundStyle(TLColor.fg4)
                scoreColumn(model.teamLabel(match, "b"), $scoreB)
            }
            Button {
                guard let a = Int(scoreA), let b = Int(scoreB), a >= 0, b >= 0 else { return }
                Task {
                    if await model.submit(match, a: a, b: b) { scoreA = ""; scoreB = "" }
                }
            } label: {
                HStack {
                    if model.busyID == match.id { ProgressView().controlSize(.small) }
                    Text("Chốt tỉ số (BTC)")
                }
                .font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.accentInk)
                .frame(maxWidth: .infinity).padding(.vertical, 11)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(Int(scoreA) == nil || Int(scoreB) == nil || model.busyID == match.id)
            .opacity(Int(scoreA) == nil || Int(scoreB) == nil ? 0.5 : 1)
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.live.opacity(0.4), lineWidth: 1))
    }

    private func scoreColumn(_ label: String, _ value: Binding<String>) -> some View {
        VStack(spacing: 6) {
            Text(label).font(TLFont.sans(12, .medium)).foregroundStyle(TLColor.fg2)
                .lineLimit(2).multilineTextAlignment(.center).frame(maxWidth: .infinity)
            TextField("0", text: value)
                .keyboardType(.numberPad)
                .font(TLFont.mono(24, .bold))
                .multilineTextAlignment(.center)
                .padding(.vertical, 10)
                .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 10))
        }
    }
}
