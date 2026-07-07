import SwiftUI

/// Native destination for ANY livestream tap. Live (or ended with recording)
/// → straight into the player; scheduled → native waiting room (thumbnail,
/// countdown, reminder) that polls every 20s and swaps to the player the
/// moment the stream goes live. Replaces the old Safari fallback.
struct LiveWatchScreen: View {
    let stream: LivestreamSummary

    @State private var refreshed: LivestreamSummary?
    private var s: LivestreamSummary { refreshed ?? stream }
    private let repo = LiveRepository()

    var body: some View {
        if let url = s.playbackURL, s.isLive || s.isEnded {
            VideoPlayerScreen(url: url, title: s.displayTitle,
                              progressKey: s.isEnded ? s.id.uuidString : nil,
                              livestreamID: s.id)
        } else {
            waitingRoom
        }
    }

    private var waitingRoom: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                thumb
                VStack(alignment: .leading, spacing: 10) {
                    Text("SẮP PHÁT SÓNG")
                        .font(TLFont.mono(10, .bold)).tracking(1.4)
                        .foregroundStyle(TLColor.accentText)
                    Text(s.displayTitle)
                        .font(TLFont.serif(22)).foregroundStyle(TLColor.fg)
                        .fixedSize(horizontal: false, vertical: true)
                    if let org = s.orgName {
                        Text(org.uppercased()).font(TLFont.mono(10.5)).tracking(0.5).foregroundStyle(TLColor.fg3)
                    }
                    if let d = s.scheduledDate {
                        let box = LiveTime.countdownBox(d)
                        Text("\(box.top) \(box.bottom)")
                            .font(TLFont.mono(13, .bold))
                            .foregroundStyle(box.soon ? TLColor.accentText : TLColor.fg2)
                    }
                    Text("Màn hình sẽ tự chuyển sang trực tiếp khi phát sóng.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    HStack(spacing: 10) {
                        ReminderButton(stream: s, style: .filled)
                        ShareLink(item: WebRoutes.live(id: s.id)) {
                            Image(systemName: "square.and.arrow.up").font(.system(size: 15))
                                .foregroundStyle(TLColor.accentText)
                                .frame(width: 46, height: 44)
                                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
                        }
                        .accessibilityLabel("Chia sẻ")
                    }
                    .padding(.top, 4)
                }
                .padding(.horizontal, 18)
            }
            .padding(.bottom, 32)
        }
        .background(TLColor.bg)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(20))
                if let fresh = try? await repo.stream(id: stream.id) { refreshed = fresh }
            }
        }
    }

    private var thumb: some View {
        ZStack {
            if let url = s.thumbURL {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.black.opacity(0.3) }
            } else {
                Color.black.opacity(0.3)
            }
        }
        .aspectRatio(16.0 / 9.0, contentMode: .fit)
        .clipped()
        .overlay(alignment: .topLeading) {
            HStack(spacing: 5) {
                Circle().fill(TLColor.gold).frame(width: 6, height: 6)
                Text("SẮP DIỄN RA").font(TLFont.mono(9, .bold)).tracking(1).foregroundStyle(.white)
            }
            .padding(.horizontal, 9).padding(.vertical, 5)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 7))
            .padding(13)
        }
    }
}
