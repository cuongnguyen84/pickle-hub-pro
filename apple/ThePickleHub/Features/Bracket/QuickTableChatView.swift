import SwiftUI
import Supabase

// ============================================================================
// Tạo giải chia bảng bằng CHAT AI (bản native của web QuickTableChat).
//
// Luồng đúng như web: tầng tất định QTChatEngine (PR-1) quyết định câu hỏi,
// chip và câu trả lời; phần hiểu ngôn ngữ tự do nằm ở edge function
// `quick-table-chat` DÙNG CHUNG với web (Gemini chỉ trả bản vá nháp, không
// ghi DB). Tạo giải bằng đúng đường của wizard: createTable (RPC quota) +
// setupRoster (RPC atomic, kèm gán sân theo bảng p_group_courts của #910).
//
// Phạm vi bản này: gõ/dán chữ + chip theo bước + tạo giải trọn luồng.
// Chưa có: đính kèm ảnh/file + link Google Sheet, sửa danh sách/Bản nháp
// chi tiết, trộn lại bảng (web có — làm ở PR sau nếu cần).
// ============================================================================

// MARK: - DTOs của edge function

private struct QTChatMessageDTO: Codable {
    let role: String
    let text: String
}

private struct QTChatEntryDTO: Encodable {
    let p1: String
    let p2: String?
    let team: String?
    let seed: Int?
}

private struct QTChatDraftDTO: Encodable {
    let is_doubles: Bool?
    let player_count: Int?
    let group_count: Int?
    let name: String?
    let entries: [QTChatEntryDTO]?
    let roster_mode: String?
    let courts: [Int]?
    let group_courts: [Int?]?
    let start_time: String?
    let default_sets: Int?
    let series: Int?
    let series_style: String?
    let series_sizes: [Int]?
    let advance_per_group: Int?

    init(_ d: QTChatDraft) {
        is_doubles = d.isDoubles
        let n = QTChatEngine.entryCount(d)
        player_count = n > 0 ? n : d.playerCount
        group_count = d.groupCount
        name = d.name
        entries = d.entries?.map { QTChatEntryDTO(p1: $0.p1, p2: $0.p2, team: $0.team, seed: $0.seed) }
        roster_mode = d.rosterMode
        courts = d.courts
        group_courts = d.groupCourts
        start_time = d.startTime
        default_sets = d.defaultSets
        series = d.series
        series_style = d.seriesStyle
        series_sizes = d.seriesSizes
        advance_per_group = d.advancePerGroup
    }
}

private struct QTChatInvokeBody: Encodable {
    let messages: [QTChatMessageDTO]
    let draft: QTChatDraftDTO
    let pending: String
    let lang: String
    let facts: String
}

private struct QTChatInvokeResponse: Decodable {
    let reply: String?
    let intent: String
    let unmet: String?
    let patch: [String: QTChatJSONValue]?
}

/// Gọi edge function dùng chung với web; lỗi tạm thời thử lại đúng 1 lần
/// (như invokeChat của web).
private struct QTChatClient {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func send(messages: [QTChatMessageDTO], draft: QTChatDraft, pending: String, lang: String) async throws -> QTChatInvokeResponse {
        let body = QTChatInvokeBody(
            messages: messages, draft: QTChatDraftDTO(draft), pending: pending, lang: lang,
            facts: QTChatEngine.chatFacts(draft, lang: lang))
        do {
            return try await client.functions.invoke("quick-table-chat", options: FunctionInvokeOptions(body: body))
        } catch {
            return try await client.functions.invoke("quick-table-chat", options: FunctionInvokeOptions(body: body))
        }
    }
}

// MARK: - View model

@Observable
@MainActor
final class QuickTableChatViewModel {
    struct Msg: Identifiable, Equatable {
        let id = UUID()
        let role: String   // "user" | "bot"
        var text: String
    }

    enum ChipAction: Equatable {
        case doubles, singles
        case count(Int)
        case pairing(String)
        case useList
        case groupOption(Int)
        case series(Int)
        case seriesByRank
        case rosterMode(String)
        case courts(Int)
        case courtsSkip
        case timeNow, timeLater, timeValue(String)
        case sets(Int)
        case optionsDone
        case retry
        case classicForm
    }

    struct Chip: Identifiable {
        let id = UUID()
        let label: String
        let sub: String?
        let action: ChipAction
    }

    var messages: [Msg] = []
    var draft = QTChatDraft()
    var input = ""
    var busy = false
    var creating = false
    var createdTable: QTTable?
    var rosterFailed = false
    var errorText: String?

    private var failedText: String?
    private var history: [(draft: QTChatDraft, messages: [Msg])] = []
    private let repo = QuickTableRepository()
    private let client = QTChatClient()

    var lang: String {
        Bundle.main.preferredLocalizations.first?.hasPrefix("en") == true ? "en" : "vi"
    }
    var slot: QTChatSlot { QTChatEngine.nextSlot(draft) }
    var unit: String { QTChatEngine.unit(draft, lang) }

    // MARK: Khởi tạo / làm lại / quay lại

    func startIfNeeded() {
        guard messages.isEmpty else { return }
        messages.append(Msg(role: "bot", text: String(localized: "Chào bạn 👋 Kể mình nghe về giải nhé, ví dụ: “Giải CLB tối thứ 7, 16 đôi, chia 4 bảng”. Hoặc dán luôn danh sách vào đây.")))
        let s = slot
        if s != .format {
            messages.append(Msg(role: "bot", text: question(for: s)))
        }
    }

    private func resetAll() {
        draft = QTChatDraft()
        messages = []
        history = []
        failedText = nil
        createdTable = nil
        rosterFailed = false
        startIfNeeded()
    }

    private func undo() {
        guard let prev = history.popLast() else { return }
        draft = prev.draft
        messages = prev.messages
        failedText = nil
    }

    private func snap() {
        history.append((draft, messages))
        if history.count > 30 { history.removeFirst(history.count - 30) }
    }

    // MARK: Câu hỏi theo bước (bản native của web questionFor)

    func question(for s: QTChatSlot) -> String {
        let d = draft
        let n = QTChatEngine.entryCount(d)
        switch s {
        case .format:
            return String(localized: "Đánh đôi hay đánh đơn? Đôi là 2 người một đội, đơn là từng vận động viên.")
        case .count:
            return String(localized: "Có bao nhiêu \(unit)? Hoặc dán luôn danh sách vào đây.")
        case .tooMany:
            return String(localized: "Chat hiện tạo được tối đa \(QTChatEngine.maxChatEntries) \(unit). Giải \(n) \(unit) nên dùng thể thức playoff lớn trong form thường.")
        case .pairing:
            let count = d.entries?.count ?? 0
            return count % 2 == 1
                ? String(localized: "Mình thấy \(count) tên lẻ — ghép đôi cần số chẵn nên đang thừa 1 người. Gõ thêm 1 tên, hoặc:")
                : String(localized: "Mình thấy \(count) tên lẻ. Ghép thành đôi thế nào?")
        case .mismatch:
            return String(localized: "Danh sách có \(n) \(unit), nhưng bạn nói \(d.playerCount ?? 0). Lấy theo danh sách hay dán thêm?")
        case .groups:
            let base = d.groupCount != nil
                ? String(localized: "Không chia được \(d.groupCount!) bảng (mỗi bảng 3–8 \(unit), tối đa 16 bảng). Chọn một cách dưới đây nhé:")
                : String(localized: "\(n) \(unit) chia thế nào?")
            return base + (n > 32 ? String(localized: " Giải đông, nhiều bảng sẽ xong nhanh hơn.") : "")
        case .series:
            return String(localized: "Hết vòng bảng thì sao? Một vòng loại: lấy 2 \(unit) đứng đầu mỗi bảng. Nhiều vòng: \(unit) mạnh vào vòng đầu, \(unit) còn lại vào vòng sau. Số không chẵn thì \(unit) xếp cao được nghỉ vòng đầu.")
        case .roster:
            return String(localized: "Bạn đã có tên từng \(unit) chưa? Chưa có thì tạo giải rồi nhập sau.")
        case .paste:
            return String(localized: "Dán danh sách vào đây nhé — mỗi dòng 1 \(unit)\(d.isDoubles == false ? "" : ", kiểu “Nam - Hùng”").")
        case .name:
            return String(localized: "Đặt tên giải là gì?")
        case .courts:
            return String(localized: "Có bao nhiêu sân thi đấu? Mình sẽ tự xếp sân và giờ cho từng trận.")
        case .startTime:
            return String(localized: "Mấy giờ bắt đầu? Bấm một nút, hoặc gõ kiểu “7h tối”.")
        case .options:
            return String(localized: "Gần xong rồi! Muốn thêm gì nữa không?")
        case .confirm:
            return String(localized: "Mọi thứ đã sẵn sàng. Kiểm tra lại rồi bấm Tạo giải nhé.")
        }
    }

    // MARK: Luồng lượt chat (bản native của web send/advance/choose)

    private func pushBot(_ text: String) {
        messages.append(Msg(role: "bot", text: text))
    }

    private func advance(_ next: QTChatDraft, ack: String?) {
        let locked = QTChatEngine.lockAdvance(next)
        draft = locked
        failedText = nil
        let q = question(for: QTChatEngine.nextSlot(locked))
        let unchangedText = lang == "vi" ? "Bản nháp chưa đổi." : "The draft did not change."
        let unchanged = (ack ?? "").isEmpty || ack == unchangedText
        var text = [ack?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "", q]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        while text.contains(". .") { text = text.replacingOccurrences(of: ". .", with: ".") }
        if !q.isEmpty, unchanged,
           let lastBot = messages.last(where: { $0.role == "bot" })?.text, lastBot.contains(q) {
            text = String(localized: "Mình chưa đổi được. Bấm một nút bên dưới, hoặc nói cách khác nhé.")
        }
        if !text.isEmpty { pushBot(text) }
    }

    func sendTapped() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !busy, createdTable == nil else { return }
        input = ""
        Task { await process(text, isRetry: false) }
    }

    private func process(_ rawText: String, isRetry: Bool) async {
        let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        if !isRetry {
            let cmd = text.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: ".!"))
                .trimmingCharacters(in: .whitespaces)
            if ["làm lại", "lam lai", "xoá hết", "xóa hết", "xoa het", "reset", "start over", "restart"].contains(cmd) {
                resetAll()
                return
            }
            if ["quay lại", "quay lai", "undo", "back"].contains(cmd) {
                undo()
                return
            }
            snap()
            messages.append(Msg(role: "user", text: text))
            // Bước sân/giờ trả lời tại chỗ, không gọi AI (như web).
            if let local = QTChatEngine.localSlotPatch(text, slot: slot) {
                let next = QTChatEngine.applyPatch(draft, local)
                advance(next, ack: QTChatEngine.factualAck(before: draft, after: next, lang: lang, request: text))
                return
            }
            // Sửa bằng lời tất định được thì không gọi AI (như web).
            if let spoken = QTChatEngine.applySpokenEdit(draft, text),
               !QTChatEngine.messageNeedsModel(text) {
                advance(spoken, ack: QTChatEngine.factualAck(before: draft, after: spoken, lang: lang, request: text))
                return
            }
        }
        await callModel(text: text)
    }

    private func callModel(text: String) async {
        busy = true
        errorText = nil
        let historyDTOs = messages.suffix(8).map { QTChatMessageDTO(role: $0.role, text: String($0.text.prefix(4000))) }
        let pending = slot.rawValue
        do {
            let res = try await client.send(messages: historyDTOs, draft: draft, pending: pending, lang: lang)
            busy = false
            if let err = res.error, !err.isEmpty { throw NSError(domain: "qtchat", code: 1, userInfo: [NSLocalizedDescriptionKey: err]) }
            let said = res.reply ?? ""
            if res.intent != "fill" && res.intent != "answer" {
                let spoken = QTChatEngine.applySpokenEdit(draft, text)
                let next = spoken ?? draft
                // Yêu cầu chưa đáp ứng mà AI trả reply rỗng → câu fallback tử tế,
                // không bao giờ để câu trả lời rỗng (luật #910, như web).
                let ack = said.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && next == draft
                    ? QTChatEngine.fallbackReply(intent: res.intent, unmet: res.unmet, lang: lang)
                    : QTChatEngine.replyFromDraft(before: draft, after: next, llmReply: said, lang: lang, request: text)
                advance(next, ack: ack)
                return
            }
            let trusted = QTChatEngine.trustPatch(res.patch ?? [:], text: text, slot: slot)
            let patch = QTChatEngine.dropInventedRoster(
                QTChatPatch.fromModelJSON(trusted), text: text, before: draft.entries)
            let patched = QTChatEngine.applyPatch(draft, patch)
            let spoken = QTChatEngine.applySpokenEdit(patched, text)
            let next = spoken ?? patched
            var ack = QTChatEngine.replyFromDraft(before: draft, after: next, llmReply: said, lang: lang, request: text)
            // Vừa đổi cỡ nhánh → nói rõ cỡ mới (như web).
            if next.advancePerGroup == nil,
               next.seriesSizes != nil, next.seriesSizes != draft.seriesSizes,
               let line = QTChatEngine.seriesPlanLine(next, lang: lang), !ack.contains(line) {
                ack = "\(ack) \(line)."
            }
            advance(next, ack: ack)
        } catch {
            busy = false
            failedText = text
            pushBot(String(localized: "Mình chưa nghe rõ, mạng hoặc trợ lý đang chậm. Thử lại nhé?"))
        }
    }

    // MARK: Chip theo bước (bản native của web chips)

    var chips: [Chip] {
        if createdTable != nil || busy || creating { return [] }
        if failedText != nil {
            return [Chip(label: String(localized: "Thử lại"), sub: nil, action: .retry)]
        }
        let d = draft
        let n = QTChatEngine.entryCount(d)
        switch slot {
        case .format:
            return [
                Chip(label: String(localized: "Đôi"), sub: nil, action: .doubles),
                Chip(label: String(localized: "Đơn"), sub: nil, action: .singles),
            ]
        case .count:
            return [8, 12, 16, 24, 32].map { Chip(label: "\($0)", sub: nil, action: .count($0)) }
        case .tooMany:
            return [
                Chip(label: String(localized: "Dùng form thường"), sub: nil, action: .classicForm),
                Chip(label: String(localized: "Sửa số lượng"), sub: nil, action: .count(0)),
            ]
        case .pairing:
            return [
                Chip(label: String(localized: "Ghép theo thứ tự"), sub: String(localized: "1+2, 3+4…"), action: .pairing("sequential")),
                Chip(label: String(localized: "Ghép ngẫu nhiên"), sub: nil, action: .pairing("random")),
                Chip(label: String(localized: "Mỗi dòng là 1 đội"), sub: nil, action: .pairing("each_line")),
            ]
        case .mismatch:
            return [
                Chip(label: String(localized: "Lấy \(n) \(unit)"), sub: nil, action: .useList),
            ]
        case .groups:
            return QTChatEngine.groupChoices(n).map { o in
                Chip(
                    label: o.groupCount == 1
                        ? String(localized: "1 bảng vòng tròn")
                        : "\(o.groupCount) bảng × \(o.sizes[0] == o.sizes[o.sizes.count - 1] ? "\(o.sizes[0])" : "\(o.sizes[o.sizes.count - 1])–\(o.sizes[0])")",
                    sub: o.groupCount == 1
                        ? String(localized: "Ai cũng gặp nhau, xếp theo thắng và thua")
                        : String(localized: "2 \(unit) đứng đầu mỗi bảng đi tiếp"),
                    action: .groupOption(o.groupCount))
            }
        case .series:
            var out = [Chip(label: String(localized: "Một vòng loại"), sub: String(localized: "2 \(unit) đứng đầu mỗi bảng đi tiếp"), action: .series(1))]
            if let sizes = QTChatEngine.findGroupOption(n, d.groupCount)?.sizes {
                for k in 2...QTChatEngine.maxSeries {
                    if let plan = QTSeries.plan(sizes: sizes, k: k) {
                        let label = plan.enumerated()
                            .map { "\(QTSeries.name(style: d.seriesStyle, division: $0.offset)) \($0.element.size)" }
                            .joined(separator: " + ")
                        out.append(Chip(label: "\(k) vòng: \(label)", sub: nil, action: .series(k)))
                    }
                }
            }
            out.append(Chip(label: String(localized: "Mỗi thứ hạng một vòng riêng"), sub: nil, action: .seriesByRank))
            return out
        case .roster:
            return [
                Chip(label: String(localized: "Dán danh sách tên"), sub: nil, action: .rosterMode("now")),
                Chip(label: String(localized: "Để người chơi tự đăng ký"), sub: nil, action: .rosterMode("registration")),
                Chip(label: String(localized: "Tạo giải, nhập tên sau"), sub: nil, action: .rosterMode("later")),
            ]
        case .paste:
            return []
        case .name:
            return []
        case .courts:
            return [2, 4, 6, 8].map { Chip(label: String(localized: "\($0) sân"), sub: nil, action: .courts($0)) }
                + [Chip(label: String(localized: "Chưa biết, bỏ qua"), sub: nil, action: .courtsSkip)]
        case .startTime:
            return [
                Chip(label: String(localized: "Bây giờ"), sub: nil, action: .timeNow),
                Chip(label: "7:00", sub: nil, action: .timeValue("07:00")),
                Chip(label: "8:00", sub: nil, action: .timeValue("08:00")),
                Chip(label: "18:00", sub: nil, action: .timeValue("18:00")),
                Chip(label: "19:00", sub: nil, action: .timeValue("19:00")),
                Chip(label: String(localized: "Để sau"), sub: nil, action: .timeLater),
            ]
        case .options:
            return [
                Chip(label: String(localized: "Mỗi trận 1 set"), sub: nil, action: .sets(1)),
                Chip(label: String(localized: "Thắng 2 trong 3 set"), sub: nil, action: .sets(3)),
                Chip(label: String(localized: "Thắng 3 trong 5 set"), sub: nil, action: .sets(5)),
                Chip(label: String(localized: "Xong, xem lại"), sub: nil, action: .optionsDone),
            ]
        case .confirm:
            return []
        }
    }

    func tapChip(_ chip: Chip) {
        switch chip.action {
        case .classicForm:
            return // view tự dismiss về form thường
        case .retry:
            guard let text = failedText else { return }
            failedText = nil
            // Edge function đòi tin cuối là của người dùng: bỏ các bong bóng
            // bot (báo lỗi) nằm sau tin người dùng đó trước khi gửi lại.
            while let last = messages.last, last.role == "bot" { messages.removeLast() }
            Task { await callModel(text: text) }
            return
        default:
            break
        }
        snap()
        messages.append(Msg(role: "user", text: chip.label))
        var d = draft
        switch chip.action {
        case .doubles: d.isDoubles = true
        case .singles: d.isDoubles = false; d.pairingDone = false
        case .count(let k):
            if k == 0 { d.playerCount = nil; d.entries = nil; d.rosterMode = nil }
            else { d.playerCount = k }
        case .pairing(let mode):
            if let entries = d.entries {
                let paired = QTChatEngine.pairEntries(entries, mode: mode)
                d.entries = paired
                d.pairingDone = true
                d.playerCount = mode == "each_line" ? entries.count : paired.count
            }
        case .useList:
            d.playerCount = QTChatEngine.entryCount(d)
        case .groupOption(let g):
            d.groupCount = g
        case .series(let k):
            d.series = k
            d.seriesSizes = nil
        case .seriesByRank:
            let patched = QTChatEngine.applyPatch(d, QTChatPatch(seriesModeByRank: true))
            advance(patched, ack: nil)
            return
        case .rosterMode(let mode):
            d.rosterMode = mode
        case .courts(let k):
            d.courts = Array(1...k)
            d.courtsDone = true
        case .courtsSkip:
            d.courtsDone = true
        case .timeNow:
            let now = Date()
            let cal = Calendar.current
            d.startTime = String(format: "%02d:%02d", cal.component(.hour, from: now), cal.component(.minute, from: now))
            d.timeDone = true
        case .timeLater:
            d.timeDone = true
        case .timeValue(let v):
            d.startTime = v
            d.timeDone = true
        case .sets(let s):
            d.defaultSets = s
            // Đổi set xong vẫn ở bước tuỳ chọn như web (chip "Xong, xem lại" chốt).
            draft = QTChatEngine.lockAdvance(d)
            return
        case .optionsDone:
            d.optionsDone = true
        case .classicForm, .retry:
            return
        }
        advance(d, ack: nil)
    }

    // MARK: Tạo giải (bản native của web create)

    func create() async {
        guard slot == .confirm, !creating,
              let name = draft.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else { return }
        creating = true
        errorText = nil
        let d = draft
        let n = QTChatEngine.entryCount(d)
        do {
            let table = try await repo.createTable(QuickTableRepository.CreateOptions(
                name: name, playerCount: n, format: "round_robin", groupCount: d.groupCount,
                requiresRegistration: d.rosterMode == "registration",
                isDoubles: d.isDoubles != false, defaultSets: d.defaultSets ?? 1,
                requiresSkillLevel: false, ratingSource: "self",
                minDupr: nil, maxDupr: nil, autoApprove: false, registrationMessage: nil))
            let plan = QTChatEngine.createPlan(d)
            let courtsOnTable = (d.entries?.isEmpty ?? true) && !(d.courts?.isEmpty ?? true)
            if (d.defaultSets ?? 1) > 1 || plan.seriesCount > 1 || plan.customSizes != nil || courtsOnTable {
                await repo.applyChatSettings(
                    tableID: table.id,
                    defaultSets: (d.defaultSets ?? 1) > 1 ? d.defaultSets : nil,
                    courts: courtsOnTable ? (d.courts ?? []).map(String.init) : nil,
                    startTime: courtsOnTable ? d.startTime : nil,
                    playoffSeries: (plan.seriesCount > 1 || plan.customSizes != nil) ? plan.seriesCount : nil,
                    playoffSeriesStyle: (plan.seriesCount > 1 || plan.customSizes != nil) ? (d.seriesStyle ?? "series") : nil,
                    playoffSeriesSizes: plan.customSizes)
            }
            var ok = true
            if let entries = d.entries, !entries.isEmpty {
                do {
                    try await repo.setupRoster(
                        tableID: table.id,
                        players: QTChatEngine.buildRoster(d).map {
                            QuickTableRepository.RosterEntry(
                                name: $0.name, player1Name: $0.p1, player2Name: $0.p2,
                                team: $0.team, seed: $0.seed)
                        },
                        groupCount: d.groupCount ?? 1,
                        courts: (d.courts ?? []).map(String.init),
                        startTime: d.startTime,
                        groupCourts: d.groupCourts)
                } catch { ok = false }
            }
            createdTable = table
            rosterFailed = !ok
            pushBot(String(localized: "🎉 Đã tạo “\(name)”!"))
            Haptics.success()
        } catch {
            errorText = error.localizedDescription
        }
        creating = false
    }

    func createAnother() {
        resetAll()
    }
}

// MARK: - View

struct QuickTableChatView: View {
    /// Như CreateQuickTableView: tạo xong thì báo shareID + tên cho nơi mở.
    let onCreated: (_ shareID: String, _ name: String) -> Void

    @State private var model = QuickTableChatViewModel()
    @Environment(\.dismiss) private var dismiss
    @FocusState private var composerFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                draftSummary
                messagesList
                if let table = model.createdTable {
                    createdCard(table)
                } else {
                    chipsRow
                    composer
                }
            }
            .background(TLColor.bg)
            .navigationTitle("Tạo giải bằng chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
            }
            .onAppear { model.startIfNeeded() }
        }
    }

    // MARK: Bản nháp tóm tắt

    @ViewBuilder
    private var draftSummary: some View {
        let d = model.draft
        let n = QTChatEngine.entryCount(d)
        let hasAny = d.isDoubles != nil || n > 0 || d.playerCount != nil || d.groupCount != nil
            || d.name != nil || d.rosterMode != nil || !(d.courts?.isEmpty ?? true)
        if hasAny {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 12) {
                    summaryField("Thể thức", d.isDoubles == nil ? nil : (d.isDoubles! ? "Đôi" : "Đơn"))
                    summaryField("Số lượng", n > 0 ? "\(n)" : d.playerCount.map { "\($0)" })
                    summaryField("Chia bảng", d.groupCount.map { "\($0) bảng" })
                    summaryField("Tên giải", d.name)
                }
                if let line = QTChatEngine.playoffSummary(d, lang: model.lang) {
                    Text(line).font(TLFont.sans(12)).foregroundStyle(TLColor.fg2)
                }
                if let pins = QTChatEngine.groupCourtsLine(d, lang: model.lang) {
                    Text(pins).font(TLFont.sans(12)).foregroundStyle(TLColor.fg2)
                }
                if let entries = d.entries, !entries.isEmpty {
                    DisclosureGroup("Danh sách (\(entries.count))") {
                        VStack(alignment: .leading, spacing: 3) {
                            ForEach(Array(entries.enumerated()), id: \.offset) { _, e in
                                Text(e.label).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .font(TLFont.sans(12.5, .medium))
                    .foregroundStyle(TLColor.fg)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TLColor.surface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(TLColor.border).frame(height: 1)
            }
        }
    }

    private func summaryField(_ label: String, _ value: String?) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased()).font(TLFont.mono(8.5, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
            Text(value ?? "—").font(TLFont.sans(12.5, .medium)).foregroundStyle(value == nil ? TLColor.fg3 : TLColor.fg)
        }
    }

    // MARK: Tin nhắn

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(model.messages) { msg in
                        HStack {
                            if msg.role == "user" { Spacer(minLength: 48) }
                            Text(msg.text)
                                .font(TLFont.sans(14.5))
                                .foregroundStyle(msg.role == "user" ? TLColor.bg : TLColor.fg)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 9)
                                .background(
                                    msg.role == "user" ? TLColor.accent : TLColor.surface,
                                    in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            if msg.role == "bot" { Spacer(minLength: 48) }
                        }
                        .id(msg.id)
                    }
                    if model.busy {
                        HStack(spacing: 8) {
                            ProgressView().controlSize(.small)
                            Text("Đang đọc tin nhắn…").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                            Spacer()
                        }
                    }
                    if model.slot == .confirm, model.createdTable == nil {
                        Button {
                            Task { await model.create() }
                        } label: {
                            HStack {
                                Spacer()
                                if model.creating { ProgressView().tint(TLColor.bg) }
                                Text(model.creating ? "Đang xếp bảng và lịch…" : "Tạo giải")
                                    .font(TLFont.sans(15, .semibold))
                                Spacer()
                            }
                            .foregroundStyle(TLColor.bg)
                            .padding(.vertical, 13)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(model.creating)
                    }
                    if let errorText = model.errorText {
                        Text(errorText).font(TLFont.sans(12.5)).foregroundStyle(TLColor.live)
                    }
                }
                .padding(16)
            }
            .onChange(of: model.messages.count) { _, _ in
                if let last = model.messages.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
    }

    // MARK: Chip + ô nhập

    @ViewBuilder
    private var chipsRow: some View {
        let chips = model.chips
        if !chips.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(chips) { chip in
                        Button {
                            if chip.action == .classicForm { dismiss() }
                            else { model.tapChip(chip) }
                        } label: {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(chip.label).font(TLFont.sans(13.5, .medium)).foregroundStyle(TLColor.fg)
                                if let sub = chip.sub {
                                    Text(sub).font(TLFont.sans(11)).foregroundStyle(TLColor.fg3)
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(TLColor.surface, in: Capsule())
                            .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Nhắn hoặc dán danh sách…", text: $model.input, axis: .vertical)
                .lineLimit(1...5)
                .font(TLFont.sans(15))
                .foregroundStyle(TLColor.fg)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
                .focused($composerFocused)
                .onSubmit { model.sendTapped() }
            Button { model.sendTapped() } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(model.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.busy
                        ? TLColor.fg3 : TLColor.accentText)
            }
            .buttonStyle(.plain)
            .disabled(model.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.busy)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(TLColor.bg)
    }

    // MARK: Đã tạo

    private func createdCard(_ table: QTTable) -> some View {
        VStack(spacing: 10) {
            if model.rosterFailed {
                Text("Giải đã tạo nhưng chưa xếp được bảng. Mở giải để nhập danh sách và thử lại.")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.live)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button {
                dismiss()
                onCreated(table.shareID, table.displayName)
            } label: {
                HStack {
                    Spacer()
                    Text("Mở giải").font(TLFont.sans(15, .semibold))
                    Spacer()
                }
                .foregroundStyle(TLColor.bg)
                .padding(.vertical, 13)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            }
            .buttonStyle(.plain)
            Button("Tạo giải khác") { model.createAnother() }
                .font(TLFont.sans(14, .medium))
                .foregroundStyle(TLColor.accentText)
        }
        .padding(16)
        .background(TLColor.bg)
    }
}
