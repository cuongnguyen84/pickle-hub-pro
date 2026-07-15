import SwiftUI

// ============================================================================
// SocialMatchmakingView — BTC xếp cặp Mexicano / Vòng tròn.
// Port web /social/:slug/xep-cap: chọn người chơi → sinh lịch → lưu vào
// social_event_matches (DELETE + INSERT, confirm khi ghi đè). Mở lại trang
// sẽ khôi phục lịch đã lưu. DUPR đôi ưu tiên hơn trình độ tự đánh giá.
// ============================================================================

@Observable
final class SocialMatchmakingModel {
    let event: SocialEvent
    var regs: [EventRegistration] = []
    var selected: Set<UUID> = []
    var format: MMFormat = .mexicano
    var rounds = 4
    var courts: Int
    var preferBalanced = true
    var schedule: MMSchedule?
    var viewingSaved = false
    var balancedRequestedButLow = false
    var loaded = false
    var saving = false
    var infoText: String?
    var errorText: String?
    private let repo = SocialOrganizerRepository()

    init(event: SocialEvent) {
        self.event = event
        self.courts = event.courtCount ?? 2
    }

    /// Đủ điều kiện xếp: chưa huỷ + không vắng mặt (khớp web eligible).
    var eligible: [EventRegistration] {
        regs.filter { $0.status != "cancelled" && $0.status != "no_show" }
    }

    @MainActor func load() async {
        regs = (try? await repo.registrations(eventID: event.id)) ?? []
        // Khôi phục lịch đã lưu (một lần, trước khi user bấm sinh).
        if schedule == nil, let saved = try? await repo.liveMatches(eventID: event.id), !saved.isEmpty {
            restore(from: saved)
        }
        loaded = true
    }

    private func restore(from saved: [SocialLiveMatch]) {
        let regByProfile = Dictionary(regs.compactMap { r in r.profileID.map { ($0, r) } },
                                      uniquingKeysWith: { a, _ in a })
        func player(_ profileID: UUID?) -> MMPlayer {
            guard let pid = profileID else { return MMPlayer(id: "__missing__\(UUID().uuidString)", name: "—", level: nil) }
            guard let reg = regByProfile[pid] else { return MMPlayer(id: pid.uuidString, name: "?", level: nil) }
            return MMPlayer(id: reg.id.uuidString, name: reg.displayName, level: reg.selfRatedLevel)
        }
        var byRound: [Int: [MMMatch]] = [:]
        for m in saved {
            byRound[m.round, default: []].append(MMMatch(
                round: m.round, court: m.court,
                teamA: (player(m.teamAPlayer1ID), player(m.teamAPlayer2ID)),
                teamB: (player(m.teamBPlayer1ID), player(m.teamBPlayer2ID))))
        }
        let mmRounds = byRound.keys.sorted().map { r in
            MMRound(round: r, matches: byRound[r]!.sorted { $0.court < $1.court }, sittingOut: [])
        }
        let ids = Set(mmRounds.flatMap { $0.matches.flatMap { [$0.teamA.0.id, $0.teamA.1.id, $0.teamB.0.id, $0.teamB.1.id] } })
        schedule = MMSchedule(rounds: mmRounds, playerCount: ids.count, format: format)
        viewingSaved = true
        // Chọn sẵn những người trong lịch đã lưu để "Tạo lại" giữ nguyên roster.
        selected = Set(ids.compactMap { UUID(uuidString: $0) })
    }

    @MainActor func generate() async {
        errorText = nil
        guard selected.count >= 4 else { errorText = "Cần ít nhất 4 người chơi."; return }
        let chosen = eligible.filter { selected.contains($0.id) }
        let profileIDs = chosen.compactMap(\.profileID)
        let dupr = await repo.duprDoubles(profileIDs: profileIDs)
        let players = chosen.map { r in
            MMPlayer(id: r.id.uuidString, name: r.displayName,
                     level: r.profileID.flatMap { dupr[$0] } ?? r.selfRatedLevel)
        }
        let next = Matchmaking.generate(
            format: format, players: players, rounds: rounds, courtCount: courts,
            seed: UInt64(Date().timeIntervalSince1970 * 1000), preferBalanced: preferBalanced)
        schedule = next
        balancedRequestedButLow = preferBalanced && format == .mexicano && !next.balancedPairingApplied
        viewingSaved = false
    }

    /// Lưu lịch. Trả về true nếu cần confirm ghi đè trước (đã có lịch trong DB).
    @MainActor func saveNeedsOverwriteConfirm() async -> Bool {
        await repo.matchCount(eventID: event.id) > 0
    }

    @MainActor func persist() async {
        guard let schedule else { return }
        saving = true; errorText = nil; infoText = nil
        defer { saving = false }
        let regByID = Dictionary(regs.map { ($0.id.uuidString, $0) }, uniquingKeysWith: { a, _ in a })

        // Mọi người chơi phải có profile_id, nếu không live page sẽ trống.
        var missing: [String] = []
        var rows: [SocialOrganizerRepository.NewMatchRow] = []
        for r in schedule.rounds {
            for m in r.matches {
                let members = [m.teamA.0, m.teamA.1, m.teamB.0, m.teamB.1]
                let profiles = members.map { regByID[$0.id]?.profileID }
                for (p, member) in zip(profiles, members) where p == nil { missing.append(member.name) }
                guard profiles.allSatisfy({ $0 != nil }) else { continue }
                rows.append(.init(
                    event_id: event.id.uuidString.lowercased(), round: m.round, court: m.court,
                    team_a_player1_id: profiles[0]!.uuidString.lowercased(),
                    team_a_player2_id: profiles[1]!.uuidString.lowercased(),
                    team_b_player1_id: profiles[2]!.uuidString.lowercased(),
                    team_b_player2_id: profiles[3]!.uuidString.lowercased(),
                    status: "scheduled"))
            }
        }
        guard missing.isEmpty else {
            errorText = "Người chơi sau chưa có hồ sơ: \(Set(missing).sorted().joined(separator: ", "))."
            return
        }
        do {
            try await repo.saveSchedule(eventID: event.id, rows: rows)
            viewingSaved = true
            infoText = "Đã lưu lịch — mở Điều hành trực tiếp để chạy buổi chơi."
            Haptics.success()
        } catch {
            errorText = "Không lưu được: \(error.localizedDescription)"
        }
    }
}

struct SocialMatchmakingView: View {
    @State private var model: SocialMatchmakingModel
    @State private var confirmOverwrite = false

    init(event: SocialEvent) { _model = State(initialValue: SocialMatchmakingModel(event: event)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                TLSegmented(options: MMFormat.allCases,
                            selection: Binding(get: { model.format }, set: { model.format = $0 }),
                            label: { $0.label })
                playersCard
                configCard
                if let info = model.infoText {
                    Text(info).font(TLFont.sans(13)).foregroundStyle(TLColor.accentText)
                }
                if let err = model.errorText {
                    Text(err).font(TLFont.sans(13)).foregroundStyle(.red)
                }
                if let schedule = model.schedule, !schedule.rounds.isEmpty {
                    scheduleCard(schedule)
                } else if model.loaded {
                    Text("Chọn người chơi rồi bấm Sinh lịch.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                        .frame(maxWidth: .infinity).padding(.vertical, 24)
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Xếp cặp")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .confirmationDialog("Đã có lịch được lưu — ghi đè? Tỉ số các trận cũ sẽ mất.",
                            isPresented: $confirmOverwrite, titleVisibility: .visible) {
            Button("Ghi đè lịch", role: .destructive) { Task { await model.persist() } }
        }
    }

    private var playersCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("CHỌN NGƯỜI CHƠI · \(model.selected.count)")
                    .font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg2)
                Spacer()
                Button("Tất cả") { model.selected = Set(model.eligible.map(\.id)) }
                    .font(TLFont.sans(12, .semibold))
                Button("Bỏ chọn") { model.selected = [] }
                    .font(TLFont.sans(12, .semibold)).foregroundStyle(TLColor.fg3)
            }
            if model.eligible.isEmpty && model.loaded {
                Text("Chưa có đăng ký.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            }
            ForEach(model.eligible) { r in
                Button {
                    if model.selected.contains(r.id) { model.selected.remove(r.id) }
                    else { model.selected.insert(r.id) }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: model.selected.contains(r.id) ? "checkmark.square.fill" : "square")
                            .font(.system(size: 17))
                            .foregroundStyle(model.selected.contains(r.id) ? TLColor.accentText : TLColor.fg4)
                        Text(r.displayName).font(TLFont.sans(14)).foregroundStyle(TLColor.fg).lineLimit(1)
                        if r.status == "checked_in" {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 11)).foregroundStyle(TLColor.accentText)
                        }
                        Spacer()
                        if let lv = r.selfRatedLevel {
                            Text(String(format: "%.1f", lv)).font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                        }
                    }
                    .padding(.vertical, 7)
                }
                .buttonStyle(.plain)
            }
            if model.selected.count % 4 != 0 && !model.selected.isEmpty {
                Text("Số người không chia hết cho 4 — sẽ có người ngồi ngoài luân phiên.")
                    .font(TLFont.sans(12)).foregroundStyle(.orange)
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
    }

    private var configCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Stepper("Số vòng: \(model.rounds)", value: $model.rounds, in: 1...20)
                .font(TLFont.sans(14))
            Stepper("Số sân: \(model.courts)", value: $model.courts, in: 1...20)
                .font(TLFont.sans(14))
            if model.format == .mexicano {
                Toggle(isOn: $model.preferBalanced) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Ưu tiên cân bằng theo DUPR").font(TLFont.sans(14, .medium))
                        Text("Kích hoạt khi ≥75% người chơi có DUPR; thấp hơn tự về random.")
                            .font(TLFont.sans(11)).foregroundStyle(TLColor.fg3)
                    }
                }
                .tint(TLColor.accent)
            }
            Button {
                Task { await model.generate() }
            } label: {
                Label(model.schedule == nil ? "Sinh lịch" : "Tạo lại", systemImage: model.schedule == nil ? "sparkles" : "arrow.clockwise")
                    .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(model.selected.count < 4)
            .opacity(model.selected.count < 4 ? 0.5 : 1)
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
    }

    private func scheduleCard(_ schedule: MMSchedule) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("LỊCH THI ĐẤU").font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg2)
                Spacer()
                Button {
                    UIPasteboard.general.string = Matchmaking.scheduleToText(schedule)
                    Haptics.light()
                } label: { Image(systemName: "doc.on.doc").font(.system(size: 14)) }
            }

            if model.viewingSaved {
                Text("Đây là lịch đã lưu. Bấm Tạo lại để sinh lịch mới.")
                    .font(TLFont.sans(12)).foregroundStyle(TLColor.accentText)
                    .padding(8).frame(maxWidth: .infinity, alignment: .leading)
                    .background(TLColor.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
            }
            if model.balancedRequestedButLow {
                Text("Chưa đủ 75% người chơi có DUPR (\(Int(schedule.duprCoverage * 100))%) — đã ghép ngẫu nhiên.")
                    .font(TLFont.sans(12)).foregroundStyle(.orange)
            }

            ForEach(schedule.rounds, id: \.round) { r in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Vòng \(r.round)").font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg)
                        if let fairness = r.fairness {
                            Text("cân bằng \(Int(fairness * 100))%")
                                .font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                        }
                    }
                    ForEach(r.matches, id: \.court) { m in
                        HStack(alignment: .top, spacing: 8) {
                            Text("S\(m.court)").font(TLFont.mono(10, .semibold))
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(TLColor.surface2, in: Capsule())
                                .foregroundStyle(TLColor.fg3)
                            Text("\(m.teamA.0.name) & \(m.teamA.1.name)")
                                .font(TLFont.sans(13)).foregroundStyle(TLColor.fg)
                            Text("vs").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                            Text("\(m.teamB.0.name) & \(m.teamB.1.name)")
                                .font(TLFont.sans(13)).foregroundStyle(TLColor.fg)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(TLColor.surface2.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
                    }
                    if !r.sittingOut.isEmpty {
                        Text("Ngồi ngoài: \(r.sittingOut.map(\.name).joined(separator: ", "))")
                            .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                    }
                }
            }

            if !model.viewingSaved {
                Button {
                    Task {
                        if await model.saveNeedsOverwriteConfirm() { confirmOverwrite = true }
                        else { await model.persist() }
                    }
                } label: {
                    HStack {
                        if model.saving { ProgressView().controlSize(.small) }
                        Text("Lưu vào sự kiện")
                    }
                    .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(model.saving)
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
    }
}
