import SwiftUI

@Observable
final class VenueSubmitModel {
    var name = ""
    var address = ""
    var district = ""
    var city = ""
    var numCourts = ""
    var surface: String?
    var isIndoor = false
    var phone = ""
    var website = ""
    var submitting = false
    var error: String?

    private let repo = VenueRepository()

    var canSubmit: Bool {
        let n = name.trimmingCharacters(in: .whitespaces)
        return !submitting && n.count >= 2 && n.count <= 120
            && address.trimmingCharacters(in: .whitespaces).count >= 3
            && city.trimmingCharacters(in: .whitespaces).count >= 2
    }

    @MainActor func submit(onDone: (String) -> Void) async {
        guard canSubmit else { return }
        submitting = true; error = nil
        let courts = Int(numCourts.trimmingCharacters(in: .whitespaces)).flatMap { $0 >= 0 ? $0 : nil }
        do {
            let slug = try await repo.submitVenue(
                name: name, address: address, district: district.nonEmpty, city: city,
                numCourts: courts, surface: surface, isIndoor: isIndoor,
                phone: phone.nonEmpty, website: website.nonEmpty)
            onDone(slug)
        } catch { self.error = error.localizedDescription }
        submitting = false
    }
}

/// Submit a community court — native port of web `/san/them`. Pending admin
/// review (is_verified=false). Auth-gated (reached from the Venues "+").
struct VenueSubmitView: View {
    var onSubmitted: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var model = VenueSubmitModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    field("Tên sân *") { tf($model.name, "VD: Sân Pickleball Tăng Bạt Hổ") }
                    field("Địa chỉ *") { tf($model.address, "Số nhà, đường") }
                    HStack(spacing: 10) {
                        field("Quận/Huyện") { tf($model.district, "Quận 1") }
                        field("Tỉnh/TP *") { tf($model.city, "TP.HCM") }
                    }
                    HStack(spacing: 10) {
                        field("Số sân") { tf($model.numCourts, "VD: 4").keyboardType(.numberPad) }
                        field("Mặt sân") { surfaceMenu }
                    }
                    Toggle(isOn: $model.isIndoor) {
                        Text("Sân trong nhà").font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                    }.tint(TLColor.accent)
                    field("Điện thoại") { tf($model.phone, "090…").keyboardType(.phonePad) }
                    field("Website / Facebook") { tf($model.website, "https://…").keyboardType(.URL).textInputAutocapitalization(.never) }

                    if let err = model.error { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                    Text("Sân mới sẽ chờ quản trị viên duyệt trước khi xác minh.").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)

                    Button {
                        Haptics.success(); Task { await model.submit { _ in onSubmitted(); dismiss() } }
                    } label: {
                        HStack(spacing: 6) {
                            if model.submitting { ProgressView().tint(TLColor.accentInk) }
                            Text(model.submitting ? "Đang gửi…" : "Thêm sân").font(TLFont.sans(14, .bold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain).disabled(!model.canSubmit).opacity(model.canSubmit ? 1 : 0.5)
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Thêm sân")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) } }
        }
    }

    private var surfaceMenu: some View {
        Menu {
            Button("Không rõ") { model.surface = nil }
            ForEach(VenueSurface.options, id: \.self) { s in
                Button(VenueSurface.label(s) ?? s) { model.surface = s }
            }
        } label: {
            HStack {
                Text(model.surface.flatMap { VenueSurface.label($0) } ?? String(localized: "Chọn"))
                    .font(TLFont.sans(14)).foregroundStyle(model.surface == nil ? TLColor.fg3 : TLColor.fg)
                Spacer()
                Image(systemName: "chevron.up.chevron.down").font(.system(size: 11)).foregroundStyle(TLColor.fg3)
            }
            .padding(.horizontal, 11).padding(.vertical, 11)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    private func field<C: View>(_ label: LocalizedStringKey, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).textCase(.uppercase).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            content()
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
    private func tf(_ binding: Binding<String>, _ placeholder: LocalizedStringKey) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 11).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
    }
}
