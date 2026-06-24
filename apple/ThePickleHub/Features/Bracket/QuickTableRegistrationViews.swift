import SwiftUI

/// Organizer registration manager — port of web RegistrationManager. Pending rows
/// get approve/reject; bulk-approve all pending; approved/rejected listed below.
struct QuickTableRegistrationsSheet: View {
    let model: QuickTableViewModel
    @Environment(\.dismiss) private var dismiss

    private var pending: [QTRegistration] { model.registrations.filter { $0.status == "pending" } }
    private var approved: [QTRegistration] { model.registrations.filter { $0.status == "approved" } }
    private var rejected: [QTRegistration] { model.registrations.filter { $0.status == "rejected" } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let err = model.regError { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                    if model.registrations.isEmpty {
                        Text("Chưa có ai đăng ký.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).padding(.top, 8)
                    }
                    if !pending.isEmpty {
                        sectionHeader("Chờ duyệt · \(pending.count)") {
                            Button { Haptics.success(); Task { await model.bulkApprovePending() } } label: {
                                Text("Duyệt tất cả").font(TLFont.mono(10.5, .bold)).foregroundStyle(TLColor.accentInk)
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(TLColor.accent, in: Capsule())
                            }.buttonStyle(.plain).disabled(model.regBusy)
                        }
                        ForEach(pending) { r in pendingRow(r) }
                    }
                    if !approved.isEmpty {
                        sectionHeader("Đã duyệt · \(approved.count)") { EmptyView() }
                        ForEach(approved) { r in plainRow(r, color: TLColor.accentText) }
                    }
                    if !rejected.isEmpty {
                        sectionHeader("Từ chối · \(rejected.count)") { EmptyView() }
                        ForEach(rejected) { r in plainRow(r, color: TLColor.live) }
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Đăng ký")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Xong") { dismiss() }.foregroundStyle(TLColor.accentText) } }
        }
    }

    private func sectionHeader<Trailing: View>(_ title: String, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack {
            Text(title.uppercased()).font(TLFont.mono(10.5, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
            Spacer()
            trailing()
        }
    }

    private func regMeta(_ r: QTRegistration) -> String {
        var parts: [String] = []
        if let t = r.team, !t.isEmpty { parts.append(t) }
        if let s = r.skillLevel { parts.append("\(r.ratingSystem ?? "") \(s)".trimmingCharacters(in: .whitespaces)) }
        return parts.joined(separator: " · ")
    }

    private func pendingRow(_ r: QTRegistration) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(r.displayName).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                if !regMeta(r).isEmpty { Text(regMeta(r)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3) }
            }
            Spacer()
            Button { Haptics.success(); Task { await model.approve(r.id) } } label: {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 22)).foregroundStyle(TLColor.accent)
            }.buttonStyle(.plain).disabled(model.regBusy)
            Button { Haptics.light(); Task { await model.reject(r.id) } } label: {
                Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(TLColor.fg4)
            }.buttonStyle(.plain).disabled(model.regBusy)
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func plainRow(_ r: QTRegistration, color: Color) -> some View {
        HStack(spacing: 10) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(r.displayName).font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg2).lineLimit(1)
            Spacer()
            if !regMeta(r).isEmpty { Text(regMeta(r)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4) }
            if r.status == "rejected" {
                Button { Haptics.light(); Task { await model.approve(r.id) } } label: {
                    Text("Duyệt lại").font(TLFont.mono(9.5, .semibold)).foregroundStyle(TLColor.accentText)
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
    }
}

/// Self-registration form — port of web RegistrationForm.
struct QuickTableSelfRegisterSheet: View {
    let isDoubles: Bool
    let busy: Bool
    let error: String?
    let onSubmit: (_ name: String, _ team: String, _ rating: String, _ skill: Double?, _ link: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var team = ""
    @State private var rating = "none"   // DUPR | other | none
    @State private var skill = ""
    @State private var link = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    field("Tên hiển thị *") {
                        tf($name, "Tên của bạn")
                    }
                    if isDoubles {
                        field("Đội / Cặp (tùy chọn)") { tf($team, "Tên đội") }
                    }
                    field("Hệ trình độ") {
                        Picker("", selection: $rating) {
                            Text("Không").tag("none"); Text("DUPR").tag("DUPR"); Text("Khác").tag("other")
                        }.pickerStyle(.segmented)
                    }
                    if rating != "none" {
                        field("Điểm trình độ (tùy chọn)") {
                            tf($skill, "VD: 3.5").keyboardType(.decimalPad)
                        }
                    }
                    field("Link hồ sơ (tùy chọn)") { tf($link, "DUPR / Facebook…").keyboardType(.URL).textInputAutocapitalization(.never) }
                    if let error { Text(error).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Đăng ký tham gia")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.success()
                        onSubmit(name, team, rating, Double(skill.replacingOccurrences(of: ",", with: ".")), link)
                    } label: {
                        if busy { ProgressView().tint(TLColor.accentText) }
                        else { Text("Gửi").font(TLFont.sans(15, .semibold)) }
                    }
                    .foregroundStyle(name.trimmingCharacters(in: .whitespaces).isEmpty ? TLColor.fg4 : TLColor.accentText)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                }
            }
        }
    }

    private func field<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label.uppercased()).font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
            content()
        }
    }

    private func tf(_ binding: Binding<String>, _ placeholder: String) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
    }
}
