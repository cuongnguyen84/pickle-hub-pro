import SwiftUI

/// Open-registration surface (status == registration_open) — faithful native port
/// of web `DoublesEliminationRegistrationSection`. Progress card, viewer
/// self-registration (pick partner) / my-registration banner, organizer manual
/// add + close-registration button, and the registered-teams list.
///
/// DUPR range + dedupe + capacity are all enforced by the RPC; native just
/// localizes the error code. Native has no DUPR SSO connect step (web gates the
/// self-register form behind it) — instead the RPC surfaces MISSING_DUPR if a
/// player has no rating.
struct DoublesElimRegistrationView: View {
    let detail: DEDetail
    let model: DoublesElimViewModel
    let shareID: String

    // Self-register
    @State private var partner: PickedPlayer?
    @State private var teamName = ""
    @State private var showPartnerPicker = false
    // Organizer manual add
    @State private var orgPanelOpen = false
    @State private var orgP1: PickedPlayer?
    @State private var orgP2: PickedPlayer?
    @State private var orgTeamName = ""
    @State private var orgPickerSlot = 1
    @State private var showOrgPicker = false
    @State private var teamToRemove: DETeam?

    private var isOrganizer: Bool { model.isCreator }
    private var myTeam: DETeam? { detail.myTeam(model.currentUserID) }
    private var isSignedIn: Bool { model.currentUserID != nil }

    /// User ids already registered (+ self) so the search excludes them.
    private var excludeIDs: [String] {
        var ids: [String] = []
        for t in detail.teams {
            if let p1 = t.player1UserID { ids.append(p1.uuidString.lowercased()) }
            if let p2 = t.player2UserID { ids.append(p2.uuidString.lowercased()) }
        }
        if let me = model.currentUserID { ids.append(me.uuidString.lowercased()) }
        return ids
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            progressCard
            if isOrganizer {
                organizerNotice
                if !detail.isFull { organizerAddPanel }
                if detail.isFull { closeButton }
            } else if !isSignedIn {
                notice("Đăng nhập để đăng ký đội.", warn: false)
            } else if let team = myTeam {
                myRegistrationCard(team)
            } else if detail.isFull {
                notice("Đã đủ đội. Đợi ban tổ chức bắt đầu giải.", warn: false)
            } else {
                registrationForm
            }
            if let msg = model.regMessage {
                Text(msg).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2)
            }
            registeredTeamsList
        }
        .sheet(isPresented: $showPartnerPicker) {
            OpponentPickerView(title: "Chọn đồng đội", excludeIDs: excludeIDs) { picked in
                guard picked.userID != nil else {
                    model.regMessage = "VĐV này chưa có tài khoản — không thể đăng ký."
                    return
                }
                partner = picked
            }
        }
        .sheet(isPresented: $showOrgPicker) {
            OpponentPickerView(title: orgPickerSlot == 1 ? "VĐV 1" : "VĐV 2", excludeIDs: orgExcludeIDs) { picked in
                guard picked.userID != nil else {
                    model.regMessage = "VĐV này chưa có tài khoản."
                    return
                }
                if orgPickerSlot == 1 { orgP1 = picked } else { orgP2 = picked }
            }
        }
        .alert("Xoá đội?", isPresented: Binding(get: { teamToRemove != nil }, set: { if !$0 { teamToRemove = nil } })) {
            Button("Hủy", role: .cancel) { teamToRemove = nil }
            Button("Xoá", role: .destructive) {
                if let team = teamToRemove { Task { await model.organizerRemove(team: team, shareID: shareID) } }
                teamToRemove = nil
            }
        } message: {
            Text("Xoá đội “\(teamToRemove?.teamName ?? "")”? Không thể hoàn tác.")
        }
    }

    // MARK: Progress

    private var capacityPct: Double {
        guard detail.tournament.teamCount > 0 else { return 0 }
        return min(1, Double(detail.teams.count) / Double(detail.tournament.teamCount))
    }

    private var progressCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles").font(.system(size: 12)).foregroundStyle(TLColor.accentText)
                    Text("ĐĂNG KÝ ĐANG MỞ").font(TLFont.mono(10, .semibold)).tracking(1).foregroundStyle(TLColor.accentText)
                }
                Spacer()
                Text("\(detail.teams.count) / \(detail.tournament.teamCount) đội")
                    .font(TLFont.mono(11)).monospacedDigit().foregroundStyle(TLColor.fg3)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(TLColor.bg).frame(height: 8)
                    Capsule().fill(detail.isFull ? TLColor.accent : TLColor.accent.opacity(0.6))
                        .frame(width: max(6, geo.size.width * capacityPct), height: 8)
                }
            }
            .frame(height: 8)
            Text(detail.isFull
                 ? "Đã đủ đội. Ban tổ chức sẽ chốt và tạo bracket."
                 : "Đăng ký đội của bạn (2 VĐV đã liên kết DUPR).")
                .font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Notices

    private func notice(_ text: String, warn: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: warn ? "exclamationmark.triangle.fill" : "lock.fill")
                .font(.system(size: 13)).foregroundStyle(warn ? TLColor.live : TLColor.fg3)
            Text(text).font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg2)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background((warn ? TLColor.live.opacity(0.06) : TLColor.surface), in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
            .strokeBorder(warn ? TLColor.live.opacity(0.3) : TLColor.border, lineWidth: 1))
    }

    private var organizerNotice: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.shield.fill").font(.system(size: 13)).foregroundStyle(TLColor.accentText)
            Text("Bạn là BTC — quản lý danh sách đội đăng ký bên dưới.")
                .font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg2)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.accent.opacity(0.06), in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
    }

    // MARK: My registration

    private func myRegistrationCard(_ team: DETeam) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "trophy.fill").font(.system(size: 18)).foregroundStyle(TLColor.accentText)
            VStack(alignment: .leading, spacing: 3) {
                Text(team.teamName).font(TLFont.serif(18)).foregroundStyle(TLColor.fg).lineLimit(1)
                HStack(spacing: 6) {
                    Text("Đội của bạn").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                    if let avg = team.duprAvgRating {
                        Text("· DUPR \(String(format: "%.2f", avg))").font(TLFont.mono(10)).foregroundStyle(TLColor.accentText)
                    }
                }
            }
            Spacer()
            Button { Haptics.light(); Task { await model.cancelRegistration(shareID: shareID) } } label: {
                HStack(spacing: 4) {
                    Image(systemName: "xmark").font(.system(size: 10, weight: .bold))
                    Text("Huỷ").font(TLFont.mono(11, .semibold))
                }
                .foregroundStyle(TLColor.fg2).padding(.horizontal, 12).padding(.vertical, 8)
                .background(TLColor.surface2, in: Capsule())
            }
            .buttonStyle(.plain).disabled(model.regBusy)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.accent.opacity(0.06), in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
    }

    // MARK: Self-register form

    private var duprRange: String? {
        let lo = detail.tournament.minDuprRating
        let hi = detail.tournament.maxDuprRating
        if let lo, let hi { return String(format: "%.2f – %.2f", lo, hi) }
        if let lo { return String(format: "≥ %.2f", lo) }
        if let hi { return String(format: "≤ %.2f", hi) }
        return nil
    }

    private var registrationForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("◆ ĐĂNG KÝ ĐỘI").font(TLFont.mono(10, .semibold)).tracking(1).foregroundStyle(TLColor.accentText)
            Text("Chọn đồng đội").font(TLFont.serif(22)).foregroundStyle(TLColor.fg)
            if let range = duprRange {
                Text("Khoảng DUPR cho phép: \(range)").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
            }
            partnerSlot(picked: partner, onClear: { partner = nil }, onPick: { showPartnerPicker = true })
            TextField("Tên đội (tuỳ chọn — auto từ tên 2 VĐV)", text: $teamName)
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            Button {
                guard let uid = partner?.userID, let partnerID = UUID(uuidString: uid) else { return }
                Haptics.success()
                let name = teamName.trimmingCharacters(in: .whitespaces)
                Task {
                    await model.register(partnerUserID: partnerID, teamName: name.isEmpty ? nil : name, shareID: shareID)
                    if model.regMessage?.hasPrefix("Đăng ký thành công") == true { partner = nil; teamName = "" }
                }
            } label: {
                HStack(spacing: 6) {
                    if model.regBusy { ProgressView().tint(TLColor.accentInk) }
                    else { Image(systemName: "sparkles").font(.system(size: 12)) }
                    Text("Xác nhận đăng ký").font(TLFont.sans(14, .semibold))
                }
                .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                .background((partner == nil ? TLColor.surface2 : TLColor.accent), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain).disabled(partner == nil || model.regBusy)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Organizer manual add

    private var orgExcludeIDs: [String] {
        var ids = excludeIDs
        if let id = orgP1?.userID { ids.append(id.lowercased()) }
        if let id = orgP2?.userID { ids.append(id.lowercased()) }
        return ids
    }

    @ViewBuilder
    private var organizerAddPanel: some View {
        if orgPanelOpen {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("◆ BTC THÊM ĐỘI").font(TLFont.mono(10, .semibold)).tracking(1).foregroundStyle(TLColor.accentText)
                        Text("Tìm 2 VĐV đã có DUPR").font(TLFont.serif(20)).foregroundStyle(TLColor.fg)
                    }
                    Spacer()
                    Button { orgPanelOpen = false; orgP1 = nil; orgP2 = nil; orgTeamName = "" } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 18)).foregroundStyle(TLColor.fg4)
                    }.buttonStyle(.plain)
                }
                if let range = duprRange {
                    Text("Khoảng DUPR cho phép: \(range)").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
                }
                labeledSlot("VĐV 1", picked: orgP1, onClear: { orgP1 = nil }, onPick: { orgPickerSlot = 1; showOrgPicker = true })
                labeledSlot("VĐV 2", picked: orgP2, onClear: { orgP2 = nil }, onPick: { orgPickerSlot = 2; showOrgPicker = true })
                TextField("Tên đội (tuỳ chọn — auto từ 2 VĐV)", text: $orgTeamName)
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                Button {
                    guard let id1 = orgP1?.userID, let id2 = orgP2?.userID,
                          let p1 = UUID(uuidString: id1), let p2 = UUID(uuidString: id2) else { return }
                    Haptics.success()
                    let name = orgTeamName.trimmingCharacters(in: .whitespaces)
                    Task {
                        let ok = await model.organizerAdd(player1: p1, player2: p2, teamName: name.isEmpty ? nil : name, shareID: shareID)
                        if ok { orgP1 = nil; orgP2 = nil; orgTeamName = ""; orgPanelOpen = false }
                    }
                } label: {
                    HStack(spacing: 6) {
                        if model.regBusy { ProgressView().tint(TLColor.accentInk) }
                        else { Image(systemName: "plus").font(.system(size: 12, weight: .bold)) }
                        Text("Thêm vào danh sách").font(TLFont.sans(14, .semibold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(((orgP1 == nil || orgP2 == nil) ? TLColor.surface2 : TLColor.accent), in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain).disabled(orgP1 == nil || orgP2 == nil || model.regBusy)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        } else {
            Button { Haptics.light(); orgPanelOpen = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus").font(.system(size: 12, weight: .bold))
                    Text("Thêm thủ công VĐV").font(TLFont.sans(13.5, .semibold))
                }
                .foregroundStyle(TLColor.accentText).padding(.horizontal, 14).padding(.vertical, 11)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
            }
            .buttonStyle(.plain)
        }
    }

    private func labeledSlot(_ label: String, picked: PickedPlayer?, onClear: @escaping () -> Void, onPick: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
            partnerSlot(picked: picked, onClear: onClear, onPick: onPick)
        }
    }

    /// A pick-a-player control: shows the chosen player chip, or a tap-to-search row.
    private func partnerSlot(picked: PickedPlayer?, onClear: @escaping () -> Void, onPick: @escaping () -> Void) -> some View {
        Group {
            if let picked {
                HStack(spacing: 8) {
                    Image(systemName: "person.circle.fill").font(.system(size: 16)).foregroundStyle(TLColor.accentText)
                    Text(picked.name).font(TLFont.sans(14)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Spacer()
                    Button { onClear() } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 15)).foregroundStyle(TLColor.fg4)
                    }.buttonStyle(.plain)
                }
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(TLColor.accent.opacity(0.06), in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
            } else {
                Button { Haptics.light(); onPick() } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").font(.system(size: 13)).foregroundStyle(TLColor.fg3)
                        Text("Tìm tên đồng đội").font(TLFont.sans(14)).foregroundStyle(TLColor.fg3)
                        Spacer()
                    }
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                }.buttonStyle(.plain)
            }
        }
    }

    // MARK: Close registration

    private var closeButton: some View {
        Button { Haptics.success(); Task { await model.closeRegistration(shareID: shareID) } } label: {
            HStack(spacing: 6) {
                if model.regBusy { ProgressView().tint(TLColor.accentInk) }
                Text("Đóng đăng ký & tạo bracket").font(TLFont.sans(14, .semibold))
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain).disabled(model.regBusy)
    }

    // MARK: Registered teams list

    private var registeredTeamsList: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "person.2.fill").font(.system(size: 11)).foregroundStyle(TLColor.fg3)
                Text("ĐỘI ĐÃ ĐĂNG KÝ · \(detail.teams.count)")
                    .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            }
            if detail.teams.isEmpty {
                Text("Chưa có đội nào đăng ký.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
            } else {
                ForEach(detail.teams) { team in registeredRow(team) }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func registeredRow(_ team: DETeam) -> some View {
        let mine = team.belongsTo(model.currentUserID)
        return HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(team.player1Name ?? "—").font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text("/").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                    Text(team.player2Name ?? "—").font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg).lineLimit(1)
                }
                if let avg = team.duprAvgRating {
                    HStack(spacing: 4) {
                        Text("avg").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                        Text(String(format: "%.2f", avg)).font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText)
                        if team.duprSeedSource == "approx" {
                            Text("· ước tính").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                        }
                    }
                }
            }
            Spacer(minLength: 8)
            if isOrganizer {
                Button { Haptics.light(); teamToRemove = team } label: {
                    Image(systemName: "trash").font(.system(size: 13)).foregroundStyle(TLColor.live)
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background((mine ? TLColor.accent.opacity(0.06) : TLColor.bg), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(mine ? TLColor.accent.opacity(0.3) : TLColor.border, lineWidth: 1))
    }
}
