import SwiftUI

/// Native Quick Table creation — a faithful port of the web 3-step wizard
/// (Bước 1 Thông tin → Bước 2 Thể thức → Bước 3 Chia bảng) plus the roster
/// setup step. Round-robin + no-registration is handled fully natively; other
/// paths (registration mode, large_playoff) create the table then hand off to
/// the web for the next step.
struct CreateQuickTableView: View {
    let onCreated: (_ shareID: String, _ name: String) -> Void
    let onOpenWeb: (URL) -> Void

    @Environment(\.dismiss) private var dismiss

    enum Step { case count, format, groups, roster }
    @State private var step: Step = .count

    // Step 1
    @State private var name = ""
    @State private var playerCountText = ""
    @State private var requiresRegistration = false
    @State private var isDoubles = false
    @State private var defaultSets = 1
    @State private var requiresSkillLevel = false
    @State private var ratingSource = "self"   // self | dupr | either
    @State private var minDupr = ""
    @State private var maxDupr = ""
    @State private var autoApprove = false
    @State private var registrationMessage = ""
    @State private var showAdvanced = false

    // Step 2/3
    @State private var suggestedFormat: String?   // round_robin | large_playoff | nil
    @State private var selectedFormat = ""
    @State private var suggestions: [GroupSuggestion] = []
    @State private var selectedGroupCount: Int?

    // After RPC
    @State private var createdTable: QTTable?
    @State private var roster: [PlayerField] = []
    @State private var assignmentMode = "auto"   // auto | manual
    @State private var courts = ""
    @State private var startTime = ""

    @State private var working = false
    @State private var errorMessage: String?

    private let repo = QuickTableRepository()

    struct PlayerField: Identifiable, Equatable { let id = UUID(); var name = ""; var team = ""; var seed = "" }

    /// Manual group assignment (round-robin, >1 group) is a heavy separate screen
    /// on web — offered here but handed off to the web for the assignment step.
    private var manualAvailable: Bool {
        selectedFormat == "round_robin" && (selectedGroupCount ?? 1) > 1
    }

    private var playerCount: Int { Int(playerCountText) ?? 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    switch step {
                    case .count: stepCount
                    case .format: stepFormat
                    case .groups: stepGroups
                    case .roster: stepRoster
                    }
                    if let errorMessage {
                        Text(errorMessage).font(TLFont.sans(13)).foregroundStyle(TLColor.live)
                    }
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle("Bảng đấu nhanh")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
            }
        }
    }

    // MARK: Step header

    private func stepHeader(_ kicker: String, _ title: String, _ desc: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("◆ \(kicker)").font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.accentText)
            Text(title).font(TLFont.serif(24)).foregroundStyle(TLColor.fg).fixedSize(horizontal: false, vertical: true)
            Text(desc).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Step 1 — count

    private var stepCount: some View {
        VStack(alignment: .leading, spacing: 20) {
            stepHeader("Bước 1 / 3", "Bước 1: Thông tin giải đấu", "Nhập thông tin cơ bản về giải đấu")

            labeled("Tên giải / bảng đấu") {
                inputField("VD: Giải Pickleball Mùa Hè 2024", text: $name)
            }
            labeled("Số người chơi (dự kiến)") {
                inputField("VD: 16", text: $playerCountText, keyboard: .numberPad)
            }

            Rectangle().fill(TLColor.border).frame(height: 1)

            checkRow(isOn: $requiresRegistration, icon: "checklist",
                     title: "Yêu cầu VĐV đăng ký trước",
                     desc: "VĐV phải đăng ký và được BTC duyệt trước khi vào danh sách thi đấu")

            if requiresRegistration { registrationOptions }

            primaryButton("Tiếp tục", enabled: playerCount >= 2) {
                Haptics.light()
                suggestedFormat = playerCount > 48 ? "large_playoff" : (playerCount > 32 ? nil : "round_robin")
                step = .format
            }
        }
    }

    private var registrationOptions: some View {
        VStack(alignment: .leading, spacing: 16) {
            checkRow(isOn: $isDoubles, icon: "person.2",
                     title: "Thi đấu đôi",
                     desc: "VĐV đăng ký theo cặp đôi, có thể mời partner qua link")

            labeled("Số ván mặc định") {
                Picker("", selection: $defaultSets) {
                    Text("Best of 1").tag(1); Text("Best of 3").tag(3); Text("Best of 5").tag(5)
                }
                .pickerStyle(.segmented)
            }

            checkRow(isOn: $requiresSkillLevel, icon: nil,
                     title: "Bắt buộc khai trình độ",
                     desc: "VĐV phải khai trình độ (DUPR hoặc tự mô tả)")

            if requiresSkillLevel { ratingSourcePicker }

            DisclosureGroup(isExpanded: $showAdvanced) {
                VStack(alignment: .leading, spacing: 14) {
                    checkRow(isOn: $autoApprove, icon: nil,
                             title: "Tự động duyệt đăng ký",
                             desc: "VĐV được duyệt ngay khi đăng ký (không khuyến nghị)")
                    labeled("Thông báo cho VĐV khi đăng ký") {
                        TextField("VD: BTC sẽ xác nhận trình độ…", text: $registrationMessage, axis: .vertical)
                            .lineLimit(2...4)
                            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                            .padding(10)
                            .background(TLColor.bg, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                }
                .padding(.top, 12)
            } label: {
                Text("Cài đặt nâng cao").font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg2)
            }
            .tint(TLColor.fg3)
        }
        .padding(16)
        .background(TLColor.bg, in: RoundedRectangle(cornerRadius: TLRadius.sm))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
        .padding(.leading, 4)
    }

    private var ratingSourcePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Nguồn rating").font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg)
            radioRow("self", "Tự kê khai", "Người chơi nhập rating tự do (như cũ)")
            radioRow("dupr", "Bắt buộc DUPR", "Người chơi phải kết nối DUPR — rating tự fill từ profile")
            radioRow("either", "Cả hai (ưu tiên DUPR)", "Auto-fill nếu user đã DUPR, nếu chưa thì tự kê khai")
            if ratingSource != "self" {
                Rectangle().fill(TLColor.border).frame(height: 1)
                Text("GIỚI HẠN DUPR (TÙY CHỌN)").font(TLFont.mono(9, .medium)).tracking(0.6).foregroundStyle(TLColor.fg3)
                HStack(spacing: 8) {
                    inputField("Tối thiểu", text: $minDupr, keyboard: .decimalPad)
                    Text("–").foregroundStyle(TLColor.fg4)
                    inputField("Tối đa", text: $maxDupr, keyboard: .decimalPad)
                }
                Text("Để trống = không giới hạn. VD: 3.0 – 4.5 chỉ nhận VĐV trong khoảng này.")
                    .font(TLFont.sans(11)).foregroundStyle(TLColor.fg4)
            }
        }
        .padding(12)
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm))
    }

    private func radioRow(_ value: String, _ title: String, _ desc: String) -> some View {
        Button { ratingSource = value } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: ratingSource == value ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(ratingSource == value ? TLColor.accentText : TLColor.fg4).font(.system(size: 16))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                    Text(desc).font(TLFont.sans(11)).foregroundStyle(TLColor.fg3).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: Step 2 — format

    private var stepFormat: some View {
        VStack(alignment: .leading, spacing: 16) {
            stepHeader("Bước 2 / 3", "Bước 2: Chọn thể thức",
                       "\(playerCount) người — " + (suggestedFormat == "large_playoff"
                        ? "Thể thức dành cho giải đông người."
                        : "Chia người chơi thành các bảng, mỗi người đấu với tất cả người khác trong bảng."))

            formatOption(value: "round_robin", icon: "trophy",
                         title: "Chia bảng (Round Robin)",
                         desc: "Chia người chơi thành các bảng, mỗi người đấu với tất cả người khác trong bảng. Top của mỗi bảng sẽ vào vòng Playoff.",
                         disabled: playerCount > 48, disabledMsg: "Không khả dụng với >48 người")
            formatOption(value: "large_playoff", icon: "bolt",
                         title: "Playoff đông người",
                         desc: "Thể thức dành cho giải đông người. Lượt 1-2 ghi nhận thắng/thua và hiệu số, từ lượt 3 trở đi là single elimination.",
                         disabled: playerCount < 32, disabledMsg: "Chỉ khả dụng với ≥32 người")

            backButton { step = .count }
        }
    }

    private func formatOption(value: String, icon: String, title: String, desc: String, disabled: Bool, disabledMsg: String) -> some View {
        Button {
            guard !disabled else { return }
            Haptics.light()
            selectedFormat = value
            if value == "round_robin" {
                suggestions = GroupSuggestion.suggest(playerCount: playerCount)
                selectedGroupCount = suggestions.first(where: \.isRecommended)?.groupCount ?? suggestions.first?.groupCount
                step = .groups
            } else {
                Task { await createTable() }   // large_playoff → create now (hand off after)
            }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon).font(.system(size: 18)).foregroundStyle(TLColor.accentText).frame(width: 26)
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        Text(title).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                        if suggestedFormat == value {
                            Text("KHUYẾN NGHỊ").font(TLFont.mono(8, .bold)).tracking(0.6)
                                .foregroundStyle(TLColor.accentText)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(TLColor.accent.opacity(0.1), in: Capsule())
                        }
                    }
                    Text(disabled ? disabledMsg : desc)
                        .font(TLFont.sans(12)).foregroundStyle(disabled ? TLColor.fg4 : TLColor.fg3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(suggestedFormat == value ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
            .opacity(disabled ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }

    // MARK: Step 3 — groups

    private var stepGroups: some View {
        VStack(alignment: .leading, spacing: 14) {
            stepHeader("Bước 3 / 3", "Bước 3: Chia bảng", "\(playerCount) người")

            if suggestions.isEmpty {
                Text("Không có cấu hình bảng phù hợp cho \(playerCount) người. Thử số người khác.")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            }
            ForEach(suggestions) { s in groupSuggestionRow(s) }

            HStack(spacing: 12) {
                backButton { step = .format }
                primaryButton("Tạo", enabled: selectedGroupCount != nil && !working) {
                    Task { await createTable() }
                }
            }
        }
    }

    private func groupSuggestionRow(_ s: GroupSuggestion) -> some View {
        let selected = selectedGroupCount == s.groupCount
        return Button { selectedGroupCount = s.groupCount } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("\(s.groupCount) bảng").font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                        if s.isRecommended {
                            Text("KHUYẾN NGHỊ").font(TLFont.mono(8, .bold)).tracking(0.6).foregroundStyle(TLColor.accentText)
                                .padding(.horizontal, 6).padding(.vertical, 2).background(TLColor.accent.opacity(0.1), in: Capsule())
                        }
                    }
                    Text("\(s.playersPerGroup.map(String.init).joined(separator: ", ")) người mỗi bảng")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
                    Text("\(s.reason) → \(s.totalPlayoffSpots) suất vào playoff")
                        .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                }
                Spacer(minLength: 0)
                if selected { Image(systemName: "checkmark").foregroundStyle(TLColor.accentText) }
            }
            .padding(16)
            .background((selected ? TLColor.accent.opacity(0.08) : TLColor.surface), in: RoundedRectangle(cornerRadius: TLRadius.lg))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(selected ? TLColor.accent : TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Step 4 — roster (setup, non-registration)

    private var stepRoster: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                stepHeader("VĐV", "Nhập danh sách người chơi", "Nhập tên và hạt giống (tùy chọn)")
                Spacer()
                Button { roster.shuffle() } label: {
                    Label("Xáo trộn", systemImage: "shuffle").font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.accentText)
                }
                .buttonStyle(.plain)
            }

            VStack(spacing: 8) {
                ForEach(Array($roster.enumerated()), id: \.element.id) { index, $p in
                    HStack(spacing: 6) {
                        Text("\(index + 1)").font(TLFont.mono(12)).foregroundStyle(TLColor.fg3).frame(width: 20)
                        TextField("Tên VĐV *", text: $p.name)
                            .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                            .padding(.horizontal, 10).padding(.vertical, 9)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
                        TextField("Team", text: $p.team)
                            .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2).frame(width: 60)
                            .padding(.horizontal, 8).padding(.vertical, 9)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
                        TextField("Seed", text: $p.seed)
                            .keyboardType(.numberPad).multilineTextAlignment(.center)
                            .font(TLFont.mono(13)).foregroundStyle(TLColor.fg2).frame(width: 46)
                            .padding(.horizontal, 6).padding(.vertical, 9)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
                        Button { if roster.count > 2 { roster.removeAll { $0.id == p.id } } } label: {
                            Image(systemName: "trash").font(.system(size: 13)).foregroundStyle(TLColor.fg4)
                        }
                        .buttonStyle(.plain).disabled(roster.count <= 2)
                        .accessibilityLabel("Xóa VĐV")
                    }
                }
            }

            Button { roster.append(PlayerField()) } label: {
                Label("Thêm người chơi", systemImage: "plus")
                    .font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border2, lineWidth: 1))
            }
            .buttonStyle(.plain)

            if manualAvailable {
                labeled("Phương thức chia bảng") {
                    HStack(spacing: 10) {
                        assignmentOption("auto", icon: "wand.and.stars", title: "Tự động", desc: "Hệ thống chia đều, tránh cùng team, rải seed")
                        assignmentOption("manual", icon: "hand.point.up.left", title: "Thủ công", desc: "Tự chọn VĐV vào từng bảng")
                    }
                }
            }

            // Court + time (round_robin only)
            if selectedFormat == "round_robin" {
                HStack(spacing: 10) {
                    labeled("Số sân (tùy chọn)") {
                        inputField("VD: 2, 3, 8", text: $courts)
                    }
                    labeled("Giờ bắt đầu (tùy chọn)") {
                        inputField("--:--", text: $startTime)
                    }
                }
            }

            tipsBox

            primaryButton(
                working ? "Đang xử lý…"
                    : (assignmentMode == "manual" && manualAvailable ? "Tiếp tục chia bảng" : "Tạo bảng đấu và chia bảng"),
                enabled: filledRoster.count >= 2 && !working
            ) {
                Task { await finishSetup() }
            }
        }
    }

    private func assignmentOption(_ value: String, icon: String, title: String, desc: String) -> some View {
        let selected = assignmentMode == value
        return Button { assignmentMode = value } label: {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).font(.system(size: 17)).foregroundStyle(selected ? TLColor.accentText : TLColor.fg2)
                Text(title).font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg)
                Text(desc).font(TLFont.sans(11)).foregroundStyle(TLColor.fg3).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background((selected ? TLColor.accent.opacity(0.08) : TLColor.surface), in: RoundedRectangle(cornerRadius: TLRadius.sm))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(selected ? TLColor.accent : TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var tipsBox: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "person.2").font(.system(size: 13)).foregroundStyle(TLColor.accentText).padding(.top, 2)
            VStack(alignment: .leading, spacing: 5) {
                Text("Mẹo chia bảng tốt:").font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg)
                tip("Nhập Team để tránh cùng team vào cùng bảng")
                tip("Đánh số Seed (1 = mạnh nhất) để rải hạt giống đều các bảng")
                if assignmentMode == "auto" { tip("Hệ thống sẽ tự động chia người chơi vào các bảng đều nhau") }
                else { tip("Bạn sẽ tự phân VĐV vào từng bảng ở bước tiếp theo") }
            }
        }
        .padding(14)
        .background(TLColor.bg, in: RoundedRectangle(cornerRadius: TLRadius.sm))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func tip(_ text: String) -> some View {
        Text("· \(text)").font(TLFont.sans(12)).foregroundStyle(TLColor.fg2).fixedSize(horizontal: false, vertical: true)
    }

    private var filledRoster: [QuickTableRepository.RosterEntry] {
        roster.map { QuickTableRepository.RosterEntry(name: $0.name.trimmingCharacters(in: .whitespaces),
                                                      team: $0.team.nonEmpty, seed: Int($0.seed)) }
            .filter { !$0.name.isEmpty }
    }

    // MARK: Actions

    @MainActor
    private func createTable() async {
        working = true; errorMessage = nil
        do {
            let opts = QuickTableRepository.CreateOptions(
                name: name, playerCount: playerCount, format: selectedFormat,
                groupCount: selectedGroupCount, requiresRegistration: requiresRegistration,
                isDoubles: isDoubles, defaultSets: defaultSets, requiresSkillLevel: requiresSkillLevel,
                ratingSource: ratingSource, minDupr: Double(minDupr), maxDupr: Double(maxDupr),
                autoApprove: autoApprove, registrationMessage: registrationMessage
            )
            let table = try await repo.createTable(opts)
            createdTable = table
            // Non-registration round-robin → native roster setup. Else hand off to web.
            if !requiresRegistration && selectedFormat == "round_robin" {
                roster = (0..<max(2, playerCount)).map { _ in PlayerField() }
                step = .roster
            } else {
                Haptics.success()
                dismiss()
                onOpenWeb(WebRoutes.quickTable(shareID: table.shareID))
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        working = false
    }

    @MainActor
    private func finishSetup() async {
        guard let table = createdTable else { return }
        // Manual group assignment is a separate web screen — hand off.
        if assignmentMode == "manual" && manualAvailable {
            Haptics.success()
            dismiss()
            onOpenWeb(WebRoutes.base.appending(path: "tools/quick-tables/\(table.shareID)/setup"))
            return
        }
        working = true; errorMessage = nil
        do {
            let courtList = courts.split(whereSeparator: { $0 == "," || $0 == " " })
                .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            try await repo.setupRoster(tableID: table.id, players: filledRoster,
                                       groupCount: selectedGroupCount ?? 1,
                                       courts: courtList, startTime: startTime)
            Haptics.success()
            dismiss()
            onCreated(table.shareID, name.trimmingCharacters(in: .whitespaces))
        } catch {
            errorMessage = error.localizedDescription
        }
        working = false
    }

    // MARK: Reusable bits

    private func labeled<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg2)
            content()
        }
    }

    private func inputField(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(placeholder, text: text)
            .keyboardType(keyboard)
            .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 12).padding(.vertical, 11)
            .frame(maxWidth: .infinity)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func checkRow(isOn: Binding<Bool>, icon: String?, title: String, desc: String) -> some View {
        Button { isOn.wrappedValue.toggle() } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: isOn.wrappedValue ? "checkmark.square.fill" : "square")
                    .foregroundStyle(isOn.wrappedValue ? TLColor.accentText : TLColor.fg4).font(.system(size: 18))
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        if let icon { Image(systemName: icon).font(.system(size: 12)).foregroundStyle(TLColor.accentText) }
                        Text(title).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                    }
                    Text(desc).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    private func primaryButton(_ title: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if working { ProgressView().tint(TLColor.accentInk) }
                Text(title).font(TLFont.sans(15, .semibold))
                if !working { Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold)) }
            }
            .foregroundStyle(TLColor.accentInk)
            .frame(maxWidth: .infinity).padding(.vertical, 13)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm))
        }
        .buttonStyle(.plain)
        .opacity(enabled ? 1 : 0.4)
        .disabled(!enabled)
    }

    private func backButton(_ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text("← Quay lại").font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg2)
                .padding(.vertical, 13).padding(.horizontal, 18)
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
