import SwiftUI

/// One game's score, edited as text so empty fields are allowed mid-entry.
struct GameScore: Identifiable, Equatable {
    let id = UUID()
    var a = ""
    var b = ""

    var parsed: (a: Int, b: Int)? {
        guard let ai = Int(a), let bi = Int(b) else { return nil }
        return (ai, bi)
    }
}

@Observable
final class MatchLogViewModel {
    enum Step: Int { case opponents, scores, review }
    enum SubmitState: Equatable {
        case idle, submitting, done(CreateMatchResult), failed(String)
    }

    var step: Step = .opponents
    var format: MatchFormat = .doubles {
        didSet { if format != oldValue { resetSlots() } }
    }
    var partner: PickedPlayer?               // Team A slot 2 (doubles only)
    var opponents: [PickedPlayer?] = [nil, nil]   // Team B
    var games: [GameScore] = [GameScore(a: "11", b: "7")]
    var submit: SubmitState = .idle
    var selfProfile: Profile?

    private let repo = MatchProposalRepository()
    private let profileRepo = ProfileRepository()

    @MainActor
    func loadSelf() async {
        if selfProfile == nil {
            selfProfile = try? await profileRepo.currentUserProfile()
        }
    }

    private func resetSlots() {
        partner = nil
        opponents = Array(repeating: nil, count: format.slotsPerSide)
    }

    /// Team B slots actually required for the current format.
    var opponentSlots: Int { format.slotsPerSide }

    var selfName: String { selfProfile?.resolvedDisplayName ?? "Bạn" }

    /// IDs already in play — fed to search so a person can't be picked twice.
    func excludeIDs() -> [String] {
        var ids = [selfProfile?.id.uuidString.lowercased()].compactMap { $0 }
        if let p = partner?.userID { ids.append(p) }
        ids.append(contentsOf: opponents.compactMap { $0?.userID })
        return ids
    }

    var canAdvanceFromOpponents: Bool {
        let filledOpponents = opponents.prefix(opponentSlots).allSatisfy { $0 != nil }
        let partnerOK = format == .singles || partner != nil
        return filledOpponents && partnerOK
    }

    var validGames: [(a: Int, b: Int)] {
        games.compactMap(\.parsed).filter { $0.a >= 0 && $0.b >= 0 }
    }

    var canSubmit: Bool { !validGames.isEmpty }

    var canAddGame: Bool { games.count < 3 }

    func addGame() { if canAddGame { games.append(GameScore()) } }

    @MainActor
    func performSubmit() async {
        guard let selfID = selfProfile?.id.uuidString.lowercased() else {
            submit = .failed("Chưa tải được hồ sơ của bạn."); return
        }
        let scored = validGames
        guard !scored.isEmpty else { submit = .failed("Cần ít nhất một ván có tỉ số."); return }

        var teamA = [PickedPlayer(userID: selfID, name: selfName)]
        if format == .doubles, let partner { teamA.append(partner) }
        let teamB = opponents.prefix(opponentSlots).compactMap { $0 }

        submit = .submitting
        do {
            let result = try await repo.create(
                format: format,
                teamA: teamA,
                teamB: teamB,
                scoresA: scored.map(\.a),
                scoresB: scored.map(\.b)
            )
            submit = .done(result)
        } catch {
            submit = .failed(error.localizedDescription)
        }
    }
}

/// Native "Log trận" — a 3-step community match wizard (opponents → scores →
/// review) that creates a PARTNER match proposal. The opponent confirms the
/// score later, so this needs no DUPR connection.
struct MatchLogView: View {
    @State private var model = MatchLogViewModel()
    @State private var pickerSlot: PickerSlot?

    enum PickerSlot: Identifiable, Equatable {
        case partner
        case opponent(Int)
        var id: String {
            switch self {
            case .partner: return "partner"
            case .opponent(let i): return "opp-\(i)"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if case .done(let result) = model.submit {
                    SuccessSection(result: result)
                } else {
                    stepHeader
                    switch model.step {
                    case .opponents: opponentsStep
                    case .scores: scoresStep
                    case .review: reviewStep
                    }
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Log trận")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.loadSelf() }
        .sheet(item: $pickerSlot) { slot in
            OpponentPickerView(
                title: slot == .partner ? "Chọn đồng đội" : "Chọn đối thủ",
                excludeIDs: model.excludeIDs()
            ) { picked in
                switch slot {
                case .partner: model.partner = picked
                case .opponent(let i): if i < model.opponents.count { model.opponents[i] = picked }
                }
            }
        }
    }

    // MARK: Step header

    private var stepHeader: some View {
        HStack(spacing: 6) {
            ForEach(0..<3) { index in
                Capsule()
                    .fill(index <= model.step.rawValue ? TLColor.accent : TLColor.border)
                    .frame(height: 3)
            }
        }
    }

    // MARK: Step 1 — opponents

    private var opponentsStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionTitle("Thể thức")
            formatToggle

            sectionTitle("Đội của bạn")
            playerSlot(name: model.selfName, sub: "Bạn", filled: true) { }
            if model.format == .doubles {
                slotButton(model.partner, placeholder: "Thêm đồng đội") { pickerSlot = .partner }
            }

            sectionTitle("Đối thủ")
            ForEach(0..<model.opponentSlots, id: \.self) { index in
                let picked = index < model.opponents.count ? model.opponents[index] : nil
                slotButton(picked, placeholder: "Chọn đối thủ") { pickerSlot = .opponent(index) }
            }

            primaryButton("Tiếp tục", enabled: model.canAdvanceFromOpponents) {
                model.step = .scores
            }
        }
    }

    private var formatToggle: some View {
        HStack(spacing: 4) {
            ForEach(MatchFormat.allCases) { option in
                let selected = option == model.format
                Button { model.format = option } label: {
                    Text(option.label)
                        .font(TLFont.sans(14, selected ? .semibold : .medium))
                        .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(selected ? TLColor.accent : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(TLColor.surface, in: Capsule())
        .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Step 2 — scores

    private var scoresStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionTitle("Tỉ số")
            ForEach(Array(model.games.enumerated()), id: \.element.id) { index, _ in
                gameRow(index: index)
            }
            if model.canAddGame {
                Button { model.addGame() } label: {
                    Label("Thêm ván", systemImage: "plus")
                        .font(TLFont.mono(11, .semibold)).tracking(0.4).textCase(.uppercase)
                        .foregroundStyle(TLColor.accentText)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 10) {
                secondaryButton("Quay lại") { model.step = .opponents }
                primaryButton("Tiếp tục", enabled: model.canSubmit) { model.step = .review }
            }
        }
    }

    private func gameRow(index: Int) -> some View {
        HStack(spacing: 12) {
            Text("Ván \(index + 1)")
                .font(TLFont.mono(11, .medium)).foregroundStyle(TLColor.fg3)
                .frame(width: 56, alignment: .leading)
            scoreField(text: Binding(
                get: { model.games[index].a },
                set: { model.games[index].a = sanitize($0) }
            ))
            Text("–").foregroundStyle(TLColor.fg4)
            scoreField(text: Binding(
                get: { model.games[index].b },
                set: { model.games[index].b = sanitize($0) }
            ))
            Spacer(minLength: 0)
            if model.games.count > 1 {
                Button {
                    model.games.remove(at: index)
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(TLColor.fg4)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func scoreField(text: Binding<String>) -> some View {
        TextField("0", text: text)
            .keyboardType(.numberPad)
            .multilineTextAlignment(.center)
            .font(TLFont.mono(18, .semibold)).monospacedDigit()
            .foregroundStyle(TLColor.fg)
            .frame(width: 56, height: 44)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func sanitize(_ value: String) -> String {
        String(value.filter(\.isNumber).prefix(2))
    }

    // MARK: Step 3 — review

    private var reviewStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionTitle("Xem lại")
            TLCard {
                VStack(alignment: .leading, spacing: 14) {
                    reviewTeamRow(names: teamANames, isWinner: teamAWins)
                    Rectangle().fill(TLColor.border).frame(height: 1)
                    reviewTeamRow(names: teamBNames, isWinner: !teamAWins)
                    Rectangle().fill(TLColor.border).frame(height: 1)
                    HStack {
                        Text("Tỉ số").font(TLFont.mono(10, .medium)).textCase(.uppercase).foregroundStyle(TLColor.fg3)
                        Spacer()
                        Text(scoreLine).font(TLFont.mono(14, .semibold)).foregroundStyle(TLColor.fg)
                    }
                    Text("\(model.format.label) · đối thủ sẽ xác nhận tỉ số")
                        .font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                }
            }

            if case .failed(let message) = model.submit {
                Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
            }

            HStack(spacing: 10) {
                secondaryButton("Quay lại") { model.step = .scores }
                primaryButton(
                    model.submit == .submitting ? "Đang gửi…" : "Gửi trận",
                    enabled: model.submit != .submitting
                ) {
                    Task { await model.performSubmit() }
                }
            }
        }
    }

    private func reviewTeamRow(names: String, isWinner: Bool) -> some View {
        HStack {
            Text(names)
                .font(TLFont.serif(18))
                .foregroundStyle(isWinner ? TLColor.fg : TLColor.fg2)
            Spacer(minLength: 8)
            if isWinner {
                Text("THẮNG").font(TLFont.mono(9, .semibold)).tracking(0.6)
                    .foregroundStyle(TLColor.accentText)
            }
        }
    }

    private var teamANames: String {
        var names = [model.selfName]
        if model.format == .doubles, let p = model.partner { names.append(p.name) }
        return names.joined(separator: " / ")
    }

    private var teamBNames: String {
        model.opponents.prefix(model.opponentSlots).compactMap { $0?.name }.joined(separator: " / ")
    }

    private var scoreLine: String {
        model.validGames.map { "\($0.a)–\($0.b)" }.joined(separator: ", ")
    }

    private var teamAWins: Bool {
        let games = model.validGames
        let a = games.filter { $0.a > $0.b }.count
        let b = games.filter { $0.b > $0.a }.count
        return a >= b
    }

    // MARK: Reusable bits

    private func sectionTitle(_ text: String) -> some View {
        Text(text).font(TLFont.mono(10, .semibold)).tracking(0.8).textCase(.uppercase)
            .foregroundStyle(TLColor.fg3)
    }

    private func playerSlot(name: String, sub: String, filled: Bool, action: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            Text(String(name.prefix(1)).uppercased())
                .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentText)
                .frame(width: 36, height: 36)
                .background(TLColor.surface2, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                Text(sub).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
            }
            Spacer()
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    @ViewBuilder
    private func slotButton(_ picked: PickedPlayer?, placeholder: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if let picked {
                    Text(String(picked.name.prefix(1)).uppercased())
                        .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentText)
                        .frame(width: 36, height: 36)
                        .background(TLColor.surface2, in: Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(picked.name).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                        Text(picked.isInvite ? "Sẽ mời xác nhận" : (picked.username.map { "@\($0)" } ?? "Người chơi"))
                            .font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).lineLimit(1)
                    }
                    Spacer()
                    Image(systemName: "arrow.triangle.2.circlepath").font(.system(size: 12)).foregroundStyle(TLColor.fg4)
                } else {
                    Image(systemName: "plus.circle").font(.system(size: 18)).foregroundStyle(TLColor.accentText)
                    Text(placeholder).font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg2)
                    Spacer()
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func primaryButton(_ title: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        }
        .buttonStyle(.plain)
        .opacity(enabled ? 1 : 0.4)
        .disabled(!enabled)
    }

    private func secondaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg2)
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// Shown after a successful submit — confirms the proposal and surfaces any
/// invite links to share with unregistered opponents.
private struct SuccessSection: View {
    let result: CreateMatchResult

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 44)).foregroundStyle(TLColor.accent)
                Text("Đã ghi trận!")
                    .font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                Text("Đối thủ sẽ nhận thông báo để xác nhận tỉ số.")
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg3)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 20)

            if !result.invites.isEmpty {
                Text("Gửi link xác nhận")
                    .font(TLFont.mono(10, .semibold)).tracking(0.8).textCase(.uppercase)
                    .foregroundStyle(TLColor.fg3)
                ForEach(result.invites) { invite in
                    ShareLink(item: invite.confirmURL) {
                        HStack(spacing: 12) {
                            Image(systemName: "square.and.arrow.up").foregroundStyle(TLColor.accentInk)
                            Text("Mời \(invite.displayName)")
                                .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                            Spacer()
                        }
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .frame(maxWidth: .infinity)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                    }
                }
            }
        }
    }
}
