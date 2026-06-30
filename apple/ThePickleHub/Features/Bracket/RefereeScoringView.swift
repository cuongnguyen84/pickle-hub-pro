import SwiftUI
import Combine

/// Màn chấm điểm trực tiếp cho trọng tài. Engine (`ScoringEngine`) tự lo điểm, số
/// server, side-out, hết game, và (doubles side-out có tên) vị trí giao/đỡ.
/// Dùng chung cho TeamMatch (MLP) + Quick Table. Quick Table còn cấp `onLiveScore`
/// (đẩy điểm realtime cho người xem) + `onClaimLive` (set LIVE badge). Xem
/// `apple/docs/referee-live-scoring-spec.md`.
struct RefereeScoringView: View {
    let teamAName: String
    let teamBName: String
    var lineupA: String? = nil
    var lineupB: String? = nil
    var playersA: [String]? = nil
    var playersB: [String]? = nil
    let mode: ScoringMode
    var isSingles: Bool = false
    let winTarget: Int
    var winByTwo: Bool = true
    /// Quick Table only — đẩy điểm hiện tại (score1/score2) mỗi pha cho người xem.
    var onLiveScore: ((_ a: Int, _ b: Int) -> Void)? = nil
    /// Quick Table only — claim live_referee_id (LIVE badge) khi bắt đầu.
    var onClaimLive: (() -> Void)? = nil
    let onFinish: (_ scoreA: Int, _ scoreB: Int, _ note: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var state: ScoreState?
    @State private var history: [ScoreState] = []
    @State private var confirming = false

    // Setup
    @State private var setupServer: ServeSide?
    @State private var setupServerIdx: Int?
    @State private var setupReceiverIdx: Int?
    @State private var regularTO = 2
    @State private var tossing = false
    @State private var tossHighlight: ServeSide?

    // Nhắc đổi sân
    @State private var sideSwitchAnnounced = false
    @State private var showSideSwitch = false

    // Ghi chú 2 bên
    @State private var noteA = ""
    @State private var noteB = ""
    @State private var showNote = false

    // Timeout
    @State private var usedRegA = 0
    @State private var usedRegB = 0
    @State private var usedMedA = 0
    @State private var usedMedB = 0
    @State private var activeTO: ActiveTO?

    private struct ActiveTO: Equatable { let side: ServeSide; let medical: Bool; var left: Int }

    private var rotationCapable: Bool {
        mode == .sideOut && !isSingles && playersA?.count == 2 && playersB?.count == 2
    }
    private var sideSwitchPoint: Int { (winTarget + 1) / 2 }
    private var hasNote: Bool { !noteA.isEmpty || !noteB.isEmpty }
    private func mmss(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        // Visually rotate to landscape instead of forcing the device interface
        // orientation. The referee screen is a fullScreenCover presented over a
        // .sheet; asking iOS to rotate that stack made the portrait root and the
        // landscape cover fight, spinning the screen forever. A rotationEffect
        // never touches interface orientation, so it can't oscillate — same
        // approach the web (ForceLandscape) uses.
        ForceLandscape {
            ZStack {
                TLColor.bg.ignoresSafeArea()
                if let s = state {
                    board(s)
                    if let t = activeTO { timeoutOverlay(t) }
                    if showSideSwitch { sideSwitchOverlay }
                    if showNote { noteOverlay }
                    if confirming { confirmOverlay(s) }
                } else {
                    setup
                }
            }
            .onReceive(tick) { _ in
                if var t = activeTO, t.left > 0 { t.left -= 1; activeTO = t }
            }
            .onAppear {
                if mode == .rally && state == nil {
                    state = .start(mode: .rally, isSingles: isSingles, winTarget: winTarget, winByTwo: winByTwo)
                    onClaimLive?(); onLiveScore?(0, 0)
                }
            }
        }
    }

    // MARK: Setup

    private var setup: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 12) {
                    Text("ĐỘI NÀO GIAO BÓNG TRƯỚC?")
                        .font(TLFont.mono(13, .bold)).tracking(1).foregroundStyle(TLColor.fg3)
                    HStack(spacing: 14) {
                        teamPick(teamAName, .a)
                        teamPick(teamBName, .b)
                    }
                    Button { coinToss() } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "dice.fill").font(.system(size: 13, weight: .bold))
                            Text(tossing ? "ĐANG QUAY…" : "BỐC THĂM").font(TLFont.mono(12, .bold)).tracking(0.5)
                        }
                        .foregroundStyle(TLColor.accentText).padding(.horizontal, 18).padding(.vertical, 10)
                        .background(TLColor.accent.opacity(0.12), in: Capsule())
                        .overlay(Capsule().strokeBorder(TLColor.accent.opacity(0.5), lineWidth: 1))
                    }
                    .buttonStyle(.plain).disabled(tossing)
                }

                VStack(spacing: 8) {
                    Text("SỐ TIMEOUT MỖI ĐỘI").font(TLFont.mono(12, .bold)).tracking(1).foregroundStyle(TLColor.fg3)
                    Picker("", selection: $regularTO) {
                        Text("1").tag(1); Text("2").tag(2); Text("3").tag(3)
                    }.pickerStyle(.segmented)
                }

                if rotationCapable, let server = setupServer, !tossing {
                    playerPick(title: "AI GIAO BÓNG TRƯỚC?",
                               teamName: server == .a ? teamAName : teamBName,
                               names: server == .a ? playersA! : playersB!,
                               selected: setupServerIdx) { setupServerIdx = $0 }
                    playerPick(title: "AI ĐỠ BÓNG TRƯỚC?",
                               teamName: server == .a ? teamBName : teamAName,
                               names: server == .a ? playersB! : playersA!,
                               selected: setupReceiverIdx) { setupReceiverIdx = $0 }
                }

                if setupReady {
                    Button { Haptics.success(); beginGame() } label: {
                        Text("BẮT ĐẦU").font(TLFont.mono(14, .bold)).tracking(1)
                            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 15)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }

                Button("Huỷ") { dismiss() }.font(TLFont.mono(12, .semibold)).foregroundStyle(TLColor.fg4)
            }
            .padding(24)
        }
    }

    private var setupReady: Bool {
        guard setupServer != nil, !tossing else { return false }
        if rotationCapable { return setupServerIdx != nil && setupReceiverIdx != nil }
        return true
    }

    /// Bốc thăm có hiệu ứng: nháy qua lại 2 đội, chậm dần, rồi dừng random.
    private func coinToss() {
        guard !tossing else { return }
        setupServer = nil; setupServerIdx = nil; setupReceiverIdx = nil
        tossing = true
        Task { @MainActor in
            let total = Int.random(in: 18...23)
            for n in 1...total {
                tossHighlight = n % 2 == 0 ? .a : .b
                Haptics.light()
                try? await Task.sleep(nanoseconds: UInt64(45 + n * 7) * 1_000_000)
            }
            tossHighlight = nil; tossing = false
            setupServer = Bool.random() ? .a : .b
            Haptics.success()
        }
    }

    private func beginGame() {
        guard let server = setupServer else { return }
        if rotationCapable {
            state = .start(mode: mode, isSingles: isSingles, winTarget: winTarget, winByTwo: winByTwo,
                           firstServer: server, players: (a: playersA!, b: playersB!),
                           firstServerIdx: setupServerIdx ?? 0, firstReceiverIdx: setupReceiverIdx ?? 0)
        } else {
            state = .start(mode: mode, isSingles: isSingles, winTarget: winTarget, winByTwo: winByTwo, firstServer: server)
        }
        onClaimLive?(); onLiveScore?(0, 0)
    }

    private func teamPick(_ name: String, _ side: ServeSide) -> some View {
        let on = tossing ? tossHighlight == side : setupServer == side
        return Button {
            Haptics.light(); setupServer = side; setupServerIdx = nil; setupReceiverIdx = nil
        } label: {
            Text(name).font(TLFont.serif(20)).italic()
                .foregroundStyle(on ? TLColor.accentInk : TLColor.fg)
                .frame(maxWidth: .infinity).padding(.vertical, 34)
                .background(on ? TLColor.accent : TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(on ? Color.clear : TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain).disabled(tossing)
    }

    private func playerPick(title: String, teamName: String, names: [String],
                            selected: Int?, onSelect: @escaping (Int) -> Void) -> some View {
        VStack(spacing: 10) {
            Text(title).font(TLFont.mono(12, .bold)).tracking(1).foregroundStyle(TLColor.fg3)
            Text(teamName).font(TLFont.mono(10, .medium)).foregroundStyle(TLColor.fg4)
            HStack(spacing: 12) {
                ForEach(Array(names.enumerated()), id: \.offset) { idx, n in
                    let on = selected == idx
                    Button { Haptics.light(); onSelect(idx) } label: {
                        Text(n).font(TLFont.sans(15, .semibold)).lineLimit(1)
                            .foregroundStyle(on ? TLColor.accentInk : TLColor.fg)
                            .frame(maxWidth: .infinity).padding(.vertical, 18)
                            .background(on ? TLColor.accent : TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(on ? Color.clear : TLColor.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Bảng chấm

    private func board(_ s: ScoreState) -> some View {
        VStack(spacing: 0) {
            calloutBar(s)
            if mode == .rally {
                HStack(spacing: 0) {
                    tapZone(s, side: .a, name: teamAName, lineup: lineupA)
                    Rectangle().fill(TLColor.border).frame(width: 1)
                    tapZone(s, side: .b, name: teamBName, lineup: lineupB)
                }
            } else {
                sideOutScores(s)
                HStack(spacing: 0) {
                    actionZone(title: "ĐIỂM", sub: "cho \(s.serving == .a ? teamAName : teamBName)", green: true) {
                        register(s, winner: s.serving)
                    }
                    Rectangle().fill(TLColor.border).frame(width: 1)
                    actionZone(title: "ĐỔI GIAO", sub: "mất giao", green: false) {
                        register(s, winner: s.serving.other)
                    }
                }
            }
            timeoutStrip
            bottomBar(s)
        }
    }

    private func register(_ s: ScoreState, winner: ServeSide) {
        guard !s.isGameOver else { return }
        Haptics.light()
        history.append(s)
        let next = ScoringEngine.applyRally(s, winner: winner)
        state = next
        onLiveScore?(next.a, next.b)
        if next.isGameOver {
            confirming = true
        } else if !sideSwitchAnnounced && max(next.a, next.b) >= sideSwitchPoint {
            sideSwitchAnnounced = true; showSideSwitch = true; Haptics.success()
        }
    }

    private func sideOutScores(_ s: ScoreState) -> some View {
        HStack(spacing: 16) {
            Text("\(teamAName) \(s.a)").foregroundStyle(s.serving == .a ? TLColor.accentText : TLColor.fg2)
            Text("·").foregroundStyle(TLColor.fg4)
            Text("\(teamBName) \(s.b)").foregroundStyle(s.serving == .b ? TLColor.accentText : TLColor.fg2)
        }
        .font(TLFont.mono(13, .semibold)).monospacedDigit()
        .frame(maxWidth: .infinity).padding(.vertical, 8).background(TLColor.surface)
    }

    private func actionZone(title: String, sub: String, green: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Text(title).font(TLFont.mono(44, .bold)).foregroundStyle(green ? TLColor.accentText : TLColor.fg)
                Text(sub).font(TLFont.mono(12)).foregroundStyle(green ? TLColor.accentText : TLColor.fg3)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(green ? TLColor.accent.opacity(0.12) : TLColor.bg)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func calloutBar(_ s: ScoreState) -> some View {
        VStack(spacing: 4) {
            Text(s.callout)
                .font(TLFont.mono(56, .bold)).monospacedDigit()
                .foregroundStyle(TLColor.fg).minimumScaleFactor(0.5).lineLimit(1)
            if let server = s.servingPlayer, let recv = s.receivingPlayer, let right = s.servingSideRight {
                Text("GIAO: \(server) (sân \(right ? "phải" : "trái"))  ·  ĐỠ: \(recv)")
                    .font(TLFont.mono(12, .bold)).foregroundStyle(TLColor.accentText)
                    .minimumScaleFactor(0.6).lineLimit(1)
            } else {
                Text(mode == .sideOut
                     ? "đang giao: \(s.serving == .a ? teamAName : teamBName)" + (isSingles ? "" : " · server \(s.serverNumber)")
                     : "tính điểm trực tiếp")
                    .font(TLFont.mono(12, .medium)).foregroundStyle(TLColor.accentText)
            }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(TLColor.surface)
    }

    private func tapZone(_ s: ScoreState, side: ServeSide, name: String, lineup: String?) -> some View {
        Button { register(s, winner: side) } label: {
            VStack(spacing: 10) {
                Text(name).font(TLFont.serif(22)).italic().foregroundStyle(TLColor.fg).lineLimit(1)
                if let lineup { Text(lineup).font(TLFont.mono(11)).foregroundStyle(TLColor.fg4).lineLimit(1) }
                Text("\(s.score(of: side))")
                    .font(TLFont.mono(72, .bold)).monospacedDigit().foregroundStyle(TLColor.fg)
                Text("CHẠM = +1").font(TLFont.mono(11, .bold)).tracking(1).foregroundStyle(TLColor.fg4)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(TLColor.bg)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: Timeout

    private var timeoutStrip: some View {
        HStack(spacing: 0) {
            timeoutGroup(name: teamAName, reg: regularTO - usedRegA, med: 1 - usedMedA, side: .a)
            Spacer(minLength: 8)
            timeoutGroup(name: teamBName, reg: regularTO - usedRegB, med: 1 - usedMedB, side: .b)
        }
        .padding(.horizontal, 12).padding(.vertical, 6).background(TLColor.surface)
    }

    private func timeoutGroup(name: String, reg: Int, med: Int, side: ServeSide) -> some View {
        HStack(spacing: 6) {
            Text(name).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).lineLimit(1).frame(maxWidth: 90, alignment: .leading)
            toButton(icon: "timer", count: reg, color: TLColor.fg2) { startTO(side, medical: false) }
            toButton(icon: "cross.fill", count: med, color: TLColor.live) { startTO(side, medical: true) }
        }
    }

    private func toButton(icon: String, count: Int, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 3) {
                Image(systemName: icon).font(.system(size: 11, weight: .semibold))
                Text("\(count)").font(TLFont.mono(11, .bold))
            }
            .foregroundStyle(count <= 0 ? TLColor.fg4 : color)
            .padding(.horizontal, 9).padding(.vertical, 5)
            .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(TLColor.border, lineWidth: 1))
            .opacity(count <= 0 ? 0.5 : 1)
        }
        .buttonStyle(.plain).disabled(count <= 0)
    }

    private func startTO(_ side: ServeSide, medical: Bool) {
        if medical {
            if (side == .a ? usedMedA : usedMedB) >= 1 { return }
            if side == .a { usedMedA += 1 } else { usedMedB += 1 }
        } else {
            if (side == .a ? usedRegA : usedRegB) >= regularTO { return }
            if side == .a { usedRegA += 1 } else { usedRegB += 1 }
        }
        Haptics.light()
        activeTO = ActiveTO(side: side, medical: medical, left: medical ? 300 : 60)
    }

    private func timeoutOverlay(_ t: ActiveTO) -> some View {
        let team = t.side == .a ? teamAName : teamBName
        return ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 14) {
                Image(systemName: t.medical ? "cross.fill" : "timer")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(t.medical ? TLColor.live : TLColor.accentText)
                Text((t.medical ? "TIMEOUT Y TẾ" : "TIMEOUT") + " · \(team)")
                    .font(TLFont.mono(13, .bold)).tracking(0.5)
                    .foregroundStyle(t.medical ? TLColor.live : TLColor.accentText)
                Text(mmss(t.left)).font(TLFont.mono(56, .bold)).monospacedDigit()
                    .foregroundStyle(t.left <= 0 ? TLColor.live : TLColor.fg)
                if t.left <= 0 { Text("HẾT GIỜ").font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                Button { Haptics.light(); activeTO = nil } label: {
                    Text("Tiếp tục").font(TLFont.mono(13, .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                }
                .buttonStyle(.plain)
            }
            .padding(24)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.xl))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.xl).strokeBorder(TLColor.border, lineWidth: 1))
            .padding(40)
        }
    }

    private func bottomBar(_ s: ScoreState) -> some View {
        HStack(spacing: 10) {
            Button {
                guard let last = history.popLast() else { return }
                Haptics.light(); state = last; confirming = false
                onLiveScore?(last.a, last.b)
                if max(last.a, last.b) < sideSwitchPoint { sideSwitchAnnounced = false }
                showSideSwitch = false
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.uturn.backward").font(.system(size: 13, weight: .bold))
                    Text("HOÀN TÁC").font(TLFont.mono(12, .bold)).tracking(0.5)
                }
                .foregroundStyle(history.isEmpty ? TLColor.fg4 : TLColor.fg2)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain).disabled(history.isEmpty)

            Text("tới \(winTarget)").font(TLFont.mono(11, .medium)).foregroundStyle(TLColor.fg4)

            Button { Haptics.light(); showNote = true } label: {
                Image(systemName: hasNote ? "note.text.badge.plus" : "note.text")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(hasNote ? TLColor.accentText : TLColor.fg2)
                    .frame(width: 44, height: 44)
                    .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)

            Button { Haptics.light(); confirming = true } label: {
                Text("KẾT THÚC").font(TLFont.mono(12, .bold)).tracking(0.5)
                    .foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(TLColor.surface)
    }

    // MARK: Nhắc đổi sân

    private var sideSwitchOverlay: some View {
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()
            VStack(spacing: 14) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 32, weight: .bold)).foregroundStyle(TLColor.accentText)
                Text("ĐỔI SÂN").font(TLFont.mono(15, .bold)).tracking(2).foregroundStyle(TLColor.fg)
                Text("Tới mốc \(sideSwitchPoint) điểm — hai đội đổi sân.")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
                Button { Haptics.light(); showSideSwitch = false } label: {
                    Text("Đã đổi sân").font(TLFont.mono(13, .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                }
                .buttonStyle(.plain)
            }
            .padding(24)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.xl))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.xl).strokeBorder(TLColor.border, lineWidth: 1))
            .padding(40)
        }
    }

    // MARK: Ghi chú trọng tài (2 bên)

    private var noteOverlay: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 12) {
                Text("GHI CHÚ TRỌNG TÀI").font(TLFont.mono(12, .bold)).tracking(1).foregroundStyle(TLColor.fg3)
                noteField(teamAName, $noteA)
                noteField(teamBName, $noteB)
                Button { Haptics.light(); showNote = false } label: {
                    Text("Xong").font(TLFont.mono(13, .bold)).foregroundStyle(TLColor.accentInk)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                }
                .buttonStyle(.plain)
            }
            .padding(22)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.xl))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.xl).strokeBorder(TLColor.border, lineWidth: 1))
            .padding(28)
        }
    }

    private func noteField(_ label: String, _ text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.accentText)
            TextField("Sự cố, hội ý, khiếu nại…", text: text, axis: .vertical)
                .lineLimit(2...4).font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .padding(9).background(TLColor.bg, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    private func combinedNote() -> String? {
        var parts: [String] = []
        if !noteA.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { parts.append("\(teamAName): \(noteA)") }
        if !noteB.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { parts.append("\(teamBName): \(noteB)") }
        return parts.isEmpty ? nil : parts.joined(separator: "\n")
    }

    // MARK: Xác nhận kết thúc

    private func confirmOverlay(_ s: ScoreState) -> some View {
        let winnerName = s.a == s.b ? nil : (s.a > s.b ? teamAName : teamBName)
        return ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 18) {
                if let winnerName {
                    Text("\(winnerName) THẮNG").font(TLFont.mono(13, .bold)).tracking(1).foregroundStyle(TLColor.accentText)
                }
                Text("\(s.a) – \(s.b)").font(TLFont.mono(44, .bold)).monospacedDigit().foregroundStyle(TLColor.fg)
                if s.a == s.b {
                    Text("Tỉ số hoà — chưa có đội thắng.").font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                }
                HStack(spacing: 12) {
                    Button("Sửa") { confirming = false }
                        .font(TLFont.mono(13, .bold)).foregroundStyle(TLColor.fg2)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 11))

                    Button("Xác nhận") {
                        Haptics.success(); onFinish(s.a, s.b, combinedNote()); dismiss()
                    }
                    .font(TLFont.mono(13, .bold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                    .disabled(s.a == s.b)
                    .opacity(s.a == s.b ? 0.5 : 1)
                }
            }
            .padding(24)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.xl))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.xl).strokeBorder(TLColor.border, lineWidth: 1))
            .padding(40)
        }
    }
}

/// Rotates its content 90° so a portrait app shows a landscape scoring board,
/// without ever touching the device interface orientation (which fought the
/// sheet/cover stack and span forever). Passes through if already landscape.
private struct ForceLandscape<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        GeometryReader { geo in
            let portrait = geo.size.height >= geo.size.width
            if portrait {
                content
                    .frame(width: geo.size.height, height: geo.size.width)
                    .rotationEffect(.degrees(90))
                    .frame(width: geo.size.width, height: geo.size.height)
            } else {
                content
            }
        }
        .ignoresSafeArea()
    }
}
