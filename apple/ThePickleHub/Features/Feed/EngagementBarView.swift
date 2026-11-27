import SwiftUI

/// The engagement bar under every feed card, the native twin of the
/// web `FeedEngagementBar` (PR #1136): a kudos heart and a comment chip
/// in the match cards' visual language, with the comment thread
/// expanding inline. Guests see the counts; writing requires sign-in.
struct EngagementBarView: View {
    let target: EngagementTarget
    let store: EngagementStore
    let isSignedIn: Bool
    let currentUserID: UUID?

    @State private var expanded = false
    @State private var showSignInAlert = false

    private var counts: EngagementCounts { store.counts(for: target) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 18) {
                Button {
                    if isSignedIn {
                        Task { await store.toggleKudos(target: target) }
                    } else {
                        showSignInAlert = true
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: counts.viewerKudoed ? "heart.fill" : "heart")
                            .font(.system(size: 16))
                        if counts.kudos > 0 {
                            Text("\(counts.kudos)")
                                .font(TLFont.serif(14))
                                .monospacedDigit()
                        }
                    }
                    .foregroundStyle(counts.viewerKudoed ? TLColor.accentText : TLColor.fg3)
                    .frame(minHeight: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(counts.viewerKudoed ? "Bỏ thả tim" : "Thả tim")

                Button {
                    expanded.toggle()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "bubble.left")
                            .font(.system(size: 15))
                        if counts.comments > 0 {
                            Text("\(counts.comments)")
                                .font(TLFont.serif(14))
                                .monospacedDigit()
                        }
                        Text("Bình luận")
                            .font(TLFont.sans(13))
                    }
                    .foregroundStyle(expanded ? TLColor.fg : TLColor.fg3)
                    .frame(minHeight: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)
            }

            if expanded {
                Divider().overlay(TLColor.border)
                TargetCommentThreadView(
                    target: target,
                    store: store,
                    isSignedIn: isSignedIn,
                    currentUserID: currentUserID
                )
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
        .alert("Cần đăng nhập", isPresented: $showSignInAlert) {
            Button("Đã hiểu", role: .cancel) {}
        } message: {
            Text("Bạn cần đăng nhập để thả tim và viết bình luận.")
        }
    }
}
