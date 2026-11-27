import SwiftUI

/// Followers / following list for a profile (web `FollowListDialog`,
/// PR #1135): avatar + name + verified seal per row, and every row
/// navigates to that player's profile.
struct FollowListView: View {
    let userID: UUID
    let kind: ProfileRepository.FollowKind

    @State private var people: [FollowPerson] = []
    @State private var loaded = false
    @Environment(\.dismiss) private var dismiss

    private var title: String {
        kind == .followers ? String(localized: "Người theo dõi") : String(localized: "Đang theo dõi")
    }

    var body: some View {
        NavigationStack {
            Group {
                if !loaded {
                    ProgressView().tint(TLColor.accentText)
                } else if people.isEmpty {
                    Text(kind == .followers
                        ? String(localized: "Chưa có người theo dõi nào.")
                        : String(localized: "Chưa theo dõi ai."))
                        .font(TLFont.sans(14))
                        .foregroundStyle(TLColor.fg3)
                        .padding(.top, 40)
                } else {
                    List(people) { person in
                        if let username = person.username?.nonEmpty {
                            NavigationLink {
                                PlayerProfileView(username: username)
                            } label: {
                                row(person)
                            }
                            .listRowBackground(TLColor.surface)
                        } else {
                            row(person)
                                .listRowBackground(TLColor.surface)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(TLColor.bg)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Đóng") { dismiss() }
                        .foregroundStyle(TLColor.accentText)
                }
            }
            .task {
                people = (try? await ProfileRepository().followList(userID: userID, kind: kind)) ?? []
                loaded = true
            }
        }
    }

    private func row(_ person: FollowPerson) -> some View {
        HStack(spacing: 10) {
            Group {
                if let urlString = person.avatarURL?.nonEmpty, let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            Circle().fill(TLColor.surface2)
                        }
                    }
                } else {
                    Circle().fill(TLColor.surface2)
                        .overlay(
                            Text(String(person.label.prefix(1)).uppercased())
                                .font(TLFont.serif(15))
                                .foregroundStyle(TLColor.fg3)
                        )
                }
            }
            .frame(width: 38, height: 38)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text(person.label)
                        .font(TLFont.sans(14, .semibold))
                        .foregroundStyle(TLColor.fg)
                        .lineLimit(1)
                    if person.isVerified == true {
                        VerifiedBadge(size: 14)
                    }
                }
                if let username = person.username?.nonEmpty {
                    Text("@\(username)")
                        .font(TLFont.sans(12))
                        .foregroundStyle(TLColor.fg3)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
    }
}
