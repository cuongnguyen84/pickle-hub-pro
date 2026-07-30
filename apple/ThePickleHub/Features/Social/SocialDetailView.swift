import SwiftUI

/// Detail for one social event. Registration is handled entirely by the native
/// phone-OTP/payment flow.
struct SocialDetailView: View {
    let event: SocialEvent

    @State private var registeredCount: Int?
    @State private var showRegister = false
    @State private var matches: [ClubMatch] = []
    @State private var roster: [SocialRosterEntry] = []
    @State private var showAllRoster = false
    @State private var canManage = false
    @State private var savedRegistrationToken: String?
    private let repo = SocialRepository()
    private let organizerRepo = SocialOrganizerRepository()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                infoCard
                if let perks = event.freePerks, !perks.isEmpty {
                    perksCard(perks)
                }
                if let desc = event.descriptionVi?.nonEmpty {
                    Text(desc)
                        .font(TLFont.sans(15)).foregroundStyle(TLColor.fg2)
                        .lineSpacing(3).fixedSize(horizontal: false, vertical: true)
                }
                actions
                if canManage { organizerSection }
                if !matches.isEmpty { matchesSection }
                if !roster.isEmpty { rosterSection }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Sự kiện")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            registeredCount = try? await repo.registrationCount(eventID: event.id)
            matches = await repo.matches(eventID: event.id)
            roster = await repo.roster(eventID: event.id)
            canManage = await organizerRepo.canManage(event: event)
            savedRegistrationToken = try? RegistrationTokenStore.token(eventID: event.id)
        }
        .sheet(isPresented: $showRegister, onDismiss: {
            savedRegistrationToken = try? RegistrationTokenStore.token(eventID: event.id)
        }) {
            PhoneEventRegistrationView(event: event)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let when = event.whenLabel {
                Text(when)
                    .font(TLFont.mono(11, .semibold)).tracking(0.6).textCase(.uppercase)
                    .foregroundStyle(TLColor.accentText)
            }
            Text(event.title)
                .font(TLFont.serif(30)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var infoCard: some View {
        TLCard {
            VStack(alignment: .leading, spacing: 12) {
                if let location = event.locationText?.nonEmpty {
                    infoRow(icon: "mappin.and.ellipse", text: location)
                }
                infoRow(icon: "ticket", text: event.priceLabel)
                if let level = event.levelLabel {
                    infoRow(icon: "chart.bar", text: level)
                }
                if let courts = event.courtCount {
                    infoRow(icon: "square.split.2x1", text: "\(courts) sân")
                }
                if let max = event.maxPlayers {
                    let reg = registeredCount.map { "\($0)/\(max)" } ?? "\(max)"
                    infoRow(icon: "person.2", text: String(localized: "\(reg) người chơi"))
                }
                if let ball = event.ballType?.nonEmpty {
                    infoRow(icon: "circle.dotted", text: ball)
                }
            }
        }
    }

    private func infoRow(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 13)).foregroundStyle(TLColor.fg3).frame(width: 18)
            Text(text).font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            Spacer(minLength: 0)
        }
    }

    private func perksCard(_ perks: [String]) -> some View {
        TLCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("ƯU ĐÃI").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
                ForEach(perks, id: \.self) { perk in
                    Label(perk, systemImage: "checkmark.circle.fill")
                        .font(TLFont.sans(14)).foregroundStyle(TLColor.fg2)
                }
            }
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            if let savedRegistrationToken {
                NavigationLink {
                    PlayerRegistrationView(token: savedRegistrationToken)
                } label: {
                    Label("Quản lý đăng ký của tôi", systemImage: "person.crop.circle.badge.checkmark")
                        .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentText)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                            .strokeBorder(TLColor.accentDim, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }

            Button { showRegister = true } label: {
                Text("Đăng ký")
                    .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            }
            .buttonStyle(.plain)

            if let zalo = event.zaloGroupURL?.nonEmpty, let url = URL(string: zalo) {
                Link(destination: url) {
                    Label("Nhóm Zalo", systemImage: "bubble.left.and.bubble.right")
                        .font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg2)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border2, lineWidth: 1))
                }
            }
        }
    }

    // MARK: Organizer (BTC) — port web /danh-sach, /xep-cap, /live, /sua

    private var organizerSection: some View {
        VStack(alignment: .leading, spacing: 9) {
            sectionHeader("BAN TỔ CHỨC")
            VStack(spacing: 0) {
                organizerRow(icon: "list.clipboard", title: "Danh sách đăng ký") {
                    SocialRosterManageView(event: event)
                }
                Rectangle().fill(TLColor.border).frame(height: 1)
                organizerRow(icon: "person.2.badge.gearshape", title: String(localized: "Xếp cặp (Mexicano / Vòng tròn)")) {
                    SocialMatchmakingView(event: event)
                }
                Rectangle().fill(TLColor.border).frame(height: 1)
                organizerRow(icon: "dot.radiowaves.left.and.right", title: "Điều hành trực tiếp") {
                    SocialLiveView(event: event)
                }
                Rectangle().fill(TLColor.border).frame(height: 1)
                organizerRow(icon: "slider.horizontal.3", title: String(localized: "Sửa / hủy sự kiện")) {
                    EditSocialEventView(event: event)
                }
            }
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
        }
    }

    private func organizerRow<Dest: View>(icon: String, title: String, @ViewBuilder destination: @escaping () -> Dest) -> some View {
        NavigationLink { destination() } label: {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 14)).foregroundStyle(TLColor.accentText).frame(width: 22)
                Text(title).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(TLColor.fg4)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
        }
        .buttonStyle(.plain)
    }

    // MARK: Matches in the session (read — scores prominent + DUPR badge)

    private var matchesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("TRẬN ĐẤU TRONG BUỔI · \(matches.count)")
            VStack(spacing: 11) { ForEach(matches) { ClubMatchCard(match: $0) } }
        }
    }

    // MARK: Roster (masked names)

    private var rosterSection: some View {
        VStack(alignment: .leading, spacing: 9) {
            sectionHeader("ĐÃ ĐĂNG KÝ · \(roster.count)")
            VStack(spacing: 0) {
                ForEach(Array((showAllRoster ? roster : Array(roster.prefix(5))).enumerated()), id: \.element.id) { i, r in
                    if i > 0 { Rectangle().fill(TLColor.border).frame(height: 1) }
                    HStack(spacing: 11) {
                        Text("\(i + 1)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).frame(width: 20)
                        Text(r.maskedName).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                        Spacer()
                        if let level = r.levelText { Text(level).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4) }
                    }
                    .padding(.vertical, 10)
                }
            }
            if roster.count > 5 && !showAllRoster {
                Button { showAllRoster = true } label: {
                    Text("Xem tất cả \(roster.count) người").font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.fg2)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border2, lineWidth: 1))
                }.buttonStyle(.plain)
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
