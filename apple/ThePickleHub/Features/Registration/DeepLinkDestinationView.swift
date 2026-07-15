import SwiftUI

// ============================================================================
// DeepLinkDestinationView — đích của một DeepLink, present dạng sheet từ
// ThePickleHubApp.onOpenURL. Mỗi case tự load dữ liệu cần thiết.
// ============================================================================

struct DeepLinkDestinationView: View {
    let link: DeepLink

    var body: some View {
        NavigationStack {
            switch link {
            case .registration(let token):
                PlayerRegistrationView(token: token)
            case .joinInvite(let code):
                JoinInviteLoaderView(code: code)
            case .socialEvent(let slug):
                SocialEventLoaderView(slug: slug)
            case .livestream(let id):
                LivestreamLoaderView(id: id)
            }
        }
    }
}

/// `/live/:id` (notification tap) → load stream → LiveWatchScreen.
private struct LivestreamLoaderView: View {
    let id: UUID
    @State private var stream: LivestreamSummary?
    @State private var loaded = false

    var body: some View {
        Group {
            if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else if let stream {
                LiveWatchScreen(stream: stream)
            } else {
                TLEmptyState(icon: "dot.radiowaves.up.forward", title: "Không tìm thấy livestream",
                             subtitle: "Buổi phát không tồn tại hoặc đã bị gỡ.")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            stream = (try? await LiveRepository().stream(id: id)) ?? nil
            loaded = true
        }
    }
}

/// `/join/:code` → tra lời mời → mở giải QuickTable tương ứng.
private struct JoinInviteLoaderView: View {
    let code: String
    @State private var result: (shareID: String, name: String)?
    @State private var loaded = false
    private let repo = QuickTableRepository()

    var body: some View {
        Group {
            if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else if let result {
                VStack(spacing: 14) {
                    Image(systemName: "person.2.fill").font(.system(size: 34)).foregroundStyle(TLColor.accentText)
                    Text("Luồng ghép đôi đã đổi").font(TLFont.serif(22)).foregroundStyle(TLColor.fg)
                    Text("Ghép đôi giờ làm trực tiếp trong trang giải: đăng ký, xem danh sách VĐV rồi bấm \"Ghép đôi\".")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
                        .multilineTextAlignment(.center).padding(.horizontal, 24)
                    NavigationLink {
                        QuickTableDetailView(shareID: result.shareID, fallbackName: result.name)
                    } label: {
                        Text("Mở giải: \(result.name)")
                            .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 24).padding(.vertical, 12)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                TLEmptyState(icon: "link.badge.plus", title: "Lời mời không hợp lệ",
                             subtitle: "Link mời đã hết hạn hoặc không tồn tại.")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .navigationTitle("Tham gia đội")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            result = await repo.tableForInvite(code: code)
            loaded = true
        }
    }
}

/// `/social/:slug` → load sự kiện → SocialDetailView.
private struct SocialEventLoaderView: View {
    let slug: String
    @State private var event: SocialEvent?
    @State private var loaded = false
    private let repo = SocialRepository()

    var body: some View {
        Group {
            if !loaded {
                ProgressView().tint(TLColor.accentText)
            } else if let event {
                SocialDetailView(event: event)
            } else {
                TLEmptyState(icon: "calendar.badge.exclamationmark", title: "Không tìm thấy sự kiện",
                             subtitle: "Sự kiện không tồn tại hoặc đã bị gỡ.")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .task {
            event = try? await repo.event(slug: slug)
            loaded = true
        }
    }
}
