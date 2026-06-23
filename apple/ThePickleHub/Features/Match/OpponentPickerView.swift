import SwiftUI

/// Search sheet for picking a partner/opponent. Queries the `dupr-user-search`
/// edge function (app users + DUPR hits) and also lets the user invite an
/// unregistered opponent by name (→ ghost slot + confirm link).
struct OpponentPickerView: View {
    let title: String
    let excludeIDs: [String]
    let onPick: (PickedPlayer) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var hits: [OpponentHit] = []
    @State private var searching = false
    @State private var searchTask: Task<Void, Never>?

    private let repo = MatchProposalRepository()

    private var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canInvite: Bool { trimmed.count >= 2 }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(hits) { hit in
                        hitRow(hit)
                        rowDivider
                    }

                    if canInvite {
                        inviteRow
                        rowDivider
                    }

                    if !searching && hits.isEmpty && !canInvite {
                        Text("Nhập tên hoặc @username để tìm")
                            .font(TLFont.sans(13))
                            .foregroundStyle(TLColor.fg3)
                            .padding(.top, 40)
                    }
                }
                .padding(.vertical, 4)
            }
            .background(TLColor.bg)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Đóng") { dismiss() }.foregroundStyle(TLColor.accentText)
                }
            }
            .overlay(alignment: .top) {
                if searching {
                    ProgressView().tint(TLColor.accentText).padding(.top, 8)
                }
            }
            .searchable(text: $query, prompt: "Tên hoặc @username")
            .onChange(of: query) { _, _ in scheduleSearch() }
        }
    }

    // MARK: Rows

    private func hitRow(_ hit: OpponentHit) -> some View {
        Button {
            guard hit.isAppUser else {
                // DUPR-only hit (no app account) → invite by their DUPR name.
                onPick(.invite(name: hit.fullName)); dismiss(); return
            }
            onPick(.from(hit: hit)); dismiss()
        } label: {
            HStack(spacing: 12) {
                avatar(initial: hit.fullName.first.map { String($0).uppercased() } ?? "?")
                VStack(alignment: .leading, spacing: 2) {
                    Text(hit.fullName)
                        .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                        .lineLimit(1)
                    if let username = hit.username?.nonEmpty {
                        Text("@\(username)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).lineLimit(1)
                    } else if !hit.isAppUser {
                        Text("DUPR · chưa có tài khoản")
                            .font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                    }
                }
                Spacer(minLength: 8)
                if let rating = hit.doublesRating ?? hit.singlesRating {
                    Text(String(format: "%.2f", rating))
                        .font(TLFont.mono(13, .semibold)).monospacedDigit()
                        .foregroundStyle(TLColor.accentText)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var inviteRow: some View {
        Button {
            onPick(.invite(name: trimmed)); dismiss()
        } label: {
            HStack(spacing: 12) {
                avatar(initial: "+")
                VStack(alignment: .leading, spacing: 2) {
                    Text("Mời “\(trimmed)”")
                        .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text("Chưa có tài khoản — gửi link xác nhận")
                        .font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                }
                Spacer()
            }
            .padding(.horizontal, 16).padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func avatar(initial: String) -> some View {
        Text(initial)
            .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentText)
            .frame(width: 36, height: 36)
            .background(TLColor.surface2, in: Circle())
            .overlay(Circle().strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var rowDivider: some View {
        Rectangle().fill(TLColor.border).frame(height: 1).padding(.leading, 16)
    }

    // MARK: Debounced search

    private func scheduleSearch() {
        searchTask?.cancel()
        let snapshot = trimmed
        guard snapshot.count >= 2 else {
            hits = []; searching = false; return
        }
        searching = true
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            let results = (try? await repo.searchOpponents(query: snapshot, excludeIDs: excludeIDs)) ?? []
            if Task.isCancelled { return }
            await MainActor.run {
                hits = results
                searching = false
            }
        }
    }
}
