import SwiftUI

// MARK: - Time helpers

enum LiveTime {
    private static let clockFmt: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "vi_VN"); f.dateFormat = "HH:mm"; return f
    }()
    private static let dayFmt: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "vi_VN"); f.dateFormat = "EEE dd.MM"; return f
    }()

    static func clock(_ date: Date) -> String { clockFmt.string(from: date) }

    /// Two-line countdown box for the schedule row.
    static func countdownBox(_ date: Date, now: Date = Date()) -> (top: String, bottom: String, soon: Bool) {
        let minutes = Int(date.timeIntervalSince(now) / 60)
        if minutes <= 60 && minutes >= 0 {
            return ("CÒN", "\(max(0, minutes))'", true)
        }
        if Calendar.current.isDateInToday(date) { return ("HÔM NAY", clock(date), false) }
        if Calendar.current.isDateInTomorrow(date) { return ("MAI", clock(date), false) }
        return (dayFmt.string(from: date).uppercased(), clock(date), false)
    }

    static func remainingMinutes(_ progress: WatchProgress) -> String {
        let m = Int((progress.remainingSeconds / 60).rounded())
        return "▸ Còn \(max(1, m)) phút"
    }
}

// MARK: - Court SVG-style placeholder (when no thumbnail)

private struct CourtPlaceholder: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                LinearGradient(colors: [Color(hue: 0.54, saturation: 0.34, brightness: 0.18),
                                        Color(hue: 0.47, saturation: 0.36, brightness: 0.11)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                Path { p in
                    let rect = CGRect(x: w * 0.12, y: h * 0.14, width: w * 0.76, height: h * 0.72)
                    p.addRect(rect)
                    p.move(to: CGPoint(x: w * 0.5, y: rect.minY)); p.addLine(to: CGPoint(x: w * 0.5, y: rect.maxY))
                    p.move(to: CGPoint(x: w * 0.3, y: rect.minY)); p.addLine(to: CGPoint(x: w * 0.3, y: rect.maxY))
                    p.move(to: CGPoint(x: w * 0.7, y: rect.minY)); p.addLine(to: CGPoint(x: w * 0.7, y: rect.maxY))
                }
                .stroke(Color.white.opacity(0.16), lineWidth: 1.3)
            }
        }
    }
}

private struct Thumb: View {
    let url: URL?
    var body: some View {
        ZStack {
            if let url {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { CourtPlaceholder() }
            } else { CourtPlaceholder() }
        }
        .clipped()
    }
}

// MARK: - Badges

struct LiveBadge: View {
    let reduceMotion: Bool
    var compact = false
    var body: some View {
        HStack(spacing: 5) {
            BlinkDot(reduceMotion: reduceMotion, size: compact ? 5 : 6)
            Text("LIVE").font(TLFont.mono(compact ? 8 : 9.5, .bold)).tracking(1.4).foregroundStyle(.white)
        }
        .padding(.horizontal, compact ? 7 : 9).padding(.vertical, compact ? 3 : 5)
        .background(TLColor.live.opacity(0.95), in: RoundedRectangle(cornerRadius: compact ? 5 : 7))
        .accessibilityLabel("Đang phát trực tiếp")
    }
}

private struct BlinkDot: View {
    let reduceMotion: Bool
    var size: CGFloat = 6
    @State private var on = true
    var body: some View {
        Circle().fill(.white).frame(width: size, height: size)
            .opacity(reduceMotion ? 1 : (on ? 1 : 0.35))
            .onAppear { if !reduceMotion { withAnimation(.easeInOut(duration: 0.75).repeatForever(autoreverses: true)) { on = false } } }
    }
}

private struct ScheduledBadge: View {
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(TLColor.gold).frame(width: 6, height: 6)
            Text("SẮP DIỄN RA").font(TLFont.mono(9, .bold)).tracking(1).foregroundStyle(.white)
        }
        .padding(.horizontal, 9).padding(.vertical, 5)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 7))
    }
}

private struct DurationTag: View {
    let text: String
    var body: some View {
        Text(text).font(TLFont.mono(9, .semibold)).foregroundStyle(.white)
            .padding(.horizontal, 6).padding(.vertical, 2.5)
            .background(.black.opacity(0.7), in: RoundedRectangle(cornerRadius: 4))
    }
}

// MARK: - Hero (main court)

struct LiveHeroCard: View {
    let stream: LivestreamSummary
    let reduceMotion: Bool

    var body: some View {
        VStack(spacing: 0) {
            mediaLink
            footer
        }
        .background(TLColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        .padding(.horizontal, 22)
    }

    @ViewBuilder
    private var mediaLink: some View {
        if stream.isLive, let url = stream.playbackURL {
            NavigationLink { VideoPlayerScreen(url: url, title: stream.displayTitle) } label: { media }
                .buttonStyle(.plain)
        } else {
            media
        }
    }

    private var media: some View {
        ZStack {
            Thumb(url: stream.thumbURL).aspectRatio(16.0 / 9.0, contentMode: .fit)
            LinearGradient(colors: [.clear, .black.opacity(0.45)], startPoint: .center, endPoint: .bottom)
            VStack {
                HStack(alignment: .top) {
                    if stream.isLive { LiveBadge(reduceMotion: reduceMotion) } else { ScheduledBadge() }
                    Spacer()
                }
                Spacer()
            }
            .padding(13)
            if stream.isLive {
                Circle().fill(.white.opacity(0.15)).frame(width: 60, height: 60)
                    .overlay(Circle().strokeBorder(.white.opacity(0.32), lineWidth: 1))
                    .overlay(Image(systemName: "play.fill").font(.system(size: 20)).foregroundStyle(.white).offset(x: 1))
                    .background(.ultraThinMaterial, in: Circle())
                    .accessibilityHidden(true)
            }
        }
        .aspectRatio(16.0 / 9.0, contentMode: .fit)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(stream.displayTitle).font(TLFont.serif(19)).foregroundStyle(TLColor.fg).lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
            if let meta = stream.orgName {
                Text(meta.uppercased()).font(TLFont.mono(10.5)).tracking(0.5).foregroundStyle(TLColor.fg3)
            } else if let d = stream.scheduledDate, !stream.isLive {
                Text(LiveTime.clock(d).uppercased()).font(TLFont.mono(10.5)).tracking(0.5).foregroundStyle(TLColor.fg3)
            }
            HStack(spacing: 10) {
                if stream.isLive, let url = stream.playbackURL {
                    NavigationLink { VideoPlayerScreen(url: url, title: stream.displayTitle) } label: {
                        Label("Xem ngay", systemImage: "play.fill")
                            .font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentInk)
                            .frame(maxWidth: .infinity).padding(.vertical, 11)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain)
                } else if !stream.isLive {
                    ReminderButton(stream: stream, style: .filled)
                }
                ShareLink(item: WebRoutes.live(id: stream.id)) {
                    Image(systemName: "square.and.arrow.up").font(.system(size: 15))
                        .foregroundStyle(TLColor.accentText)
                        .frame(width: 46, height: 44)
                        .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
                }
                .accessibilityLabel("Chia sẻ")
            }
        }
        .padding(15)
    }
}

// MARK: - Live court rail card

struct LiveCourtCard: View {
    let stream: LivestreamSummary
    let reduceMotion: Bool

    var body: some View {
        link {
            VStack(alignment: .leading, spacing: 9) {
                ZStack(alignment: .topLeading) {
                    Thumb(url: stream.thumbURL).frame(width: 212, height: 120)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    LiveBadge(reduceMotion: reduceMotion, compact: true).padding(9)
                }
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
                Text(stream.displayTitle).font(TLFont.sans(13.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(2)
                if let meta = stream.orgName {
                    Text(meta.uppercased()).font(TLFont.mono(9.5)).tracking(0.4).foregroundStyle(TLColor.fg3).lineLimit(1)
                }
            }
            .frame(width: 212, alignment: .leading)
        }
    }

    @ViewBuilder
    private func link<L: View>(@ViewBuilder _ label: () -> L) -> some View {
        if let url = stream.playbackURL {
            NavigationLink { VideoPlayerScreen(url: url, title: stream.displayTitle) } label: { label() }.buttonStyle(.plain)
        } else { label() }
    }
}

// MARK: - Schedule row (upcoming + reminder)

struct ScheduleRow: View {
    let stream: LivestreamSummary

    var body: some View {
        HStack(spacing: 13) {
            countdownBox
            VStack(alignment: .leading, spacing: 4) {
                Text(stream.displayTitle).font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(2)
                Text(metaLine).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3).lineLimit(1)
            }
            Spacer(minLength: 6)
            ReminderButton(stream: stream, style: .outline)
        }
        .padding(13)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var metaLine: String {
        var parts: [String] = []
        if let d = stream.scheduledDate { parts.append(LiveTime.clock(d)) }
        if let org = stream.orgName { parts.append(org.uppercased()) }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private var countdownBox: some View {
        let box = stream.scheduledDate.map { LiveTime.countdownBox($0) } ?? (top: "LỊCH", bottom: "—", soon: false)
        VStack(spacing: 1) {
            Text(box.top).font(TLFont.mono(8.5)).foregroundStyle(TLColor.fg3)
            Text(box.bottom).font(TLFont.mono(12, .bold)).foregroundStyle(box.soon ? TLColor.accentText : TLColor.fg)
        }
        .frame(width: 48, height: 48)
        .background((box.soon ? TLColor.accent.opacity(0.09) : TLColor.bg), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(box.soon ? TLColor.accent.opacity(0.2) : TLColor.border, lineWidth: 1))
    }
}

// MARK: - Reminder button (local notification)

struct ReminderButton: View {
    let stream: LivestreamSummary
    enum Style { case outline, filled }
    let style: Style

    @State private var isSet = false
    @State private var busy = false

    var body: some View {
        Button {
            guard let start = stream.scheduledDate else { return }
            busy = true
            Task {
                let now = await LiveReminderStore.shared.toggle(id: stream.id, title: stream.displayTitle, startAt: start)
                isSet = now
                if now { Haptics.success() } else { Haptics.light() }
                busy = false
            }
        } label: {
            HStack(spacing: 5) {
                if busy { ProgressView().controlSize(.mini).tint(TLColor.accentText) }
                else { Image(systemName: isSet ? "checkmark" : "bell").font(.system(size: 10, weight: .bold)) }
                Text(isSet ? "ĐÃ ĐẶT" : "NHẮC TÔI").font(TLFont.mono(9.5, .semibold)).tracking(0.6)
            }
            .foregroundStyle(label)
            .padding(.horizontal, style == .filled ? 16 : 11)
            .padding(.vertical, style == .filled ? 12 : 7)
            .frame(maxWidth: style == .filled ? .infinity : nil)
            .background(background, in: style == .filled ? AnyShape(RoundedRectangle(cornerRadius: 12)) : AnyShape(Capsule()))
            .overlay(borderShape)
        }
        .buttonStyle(.plain).disabled(busy)
        .onAppear { isSet = LiveReminderStore.shared.isSet(stream.id) }
        .accessibilityLabel(isSet ? "Đã đặt nhắc" : "Đặt nhắc tôi")
    }

    private var label: Color { isSet ? TLColor.accentText : (style == .filled ? TLColor.accentText : TLColor.accentText) }
    private var background: Color { isSet ? TLColor.accent.opacity(0.14) : (style == .filled ? TLColor.accent.opacity(0.1) : .clear) }
    @ViewBuilder private var borderShape: some View {
        if style == .filled {
            RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.accent.opacity(0.4), lineWidth: 1)
        } else {
            Capsule().strokeBorder(TLColor.accent.opacity(isSet ? 0.4 : 0.3), lineWidth: 1)
        }
    }
}

// MARK: - Replay row + continue card + video row

struct ReplayRow: View {
    let stream: LivestreamSummary

    private var progress: WatchProgress? {
        WatchProgressStore.get(stream.id.uuidString)
    }

    var body: some View {
        link {
            HStack(spacing: 13) {
                ZStack(alignment: .bottom) {
                    Thumb(url: stream.thumbURL).frame(width: 138, height: 80)
                        .overlay(alignment: .center) {
                            Image(systemName: "play.circle.fill").font(.system(size: 24)).foregroundStyle(.white.opacity(0.9))
                        }
                    if let p = progress, p.fraction > 0 {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Rectangle().fill(.white.opacity(0.18))
                                Rectangle().fill(TLColor.accent).frame(width: geo.size.width * p.fraction)
                            }
                        }
                        .frame(height: 3).frame(maxHeight: .infinity, alignment: .bottom)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 6) {
                    Text(stream.displayTitle).font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(2)
                    Text((stream.orgName ?? "THEPICKLEHUB").uppercased()).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                    if let p = progress, p.isResumable {
                        Text(LiveTime.remainingMinutes(p)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.accentText)
                    } else if let d = stream.endedDate {
                        Text(FeedDate.relative(d).uppercased()).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder
    private func link<L: View>(@ViewBuilder _ label: () -> L) -> some View {
        if let url = stream.playbackURL {
            NavigationLink { VideoPlayerScreen(url: url, title: stream.displayTitle, progressKey: stream.id.uuidString) } label: { label() }
                .buttonStyle(.plain)
        } else { label() }
    }
}

struct ContinueCard: View {
    let item: (id: String, title: String, thumb: URL?, url: URL?, progress: WatchProgress)

    var body: some View {
        link {
            VStack(alignment: .leading, spacing: 9) {
                ZStack(alignment: .bottom) {
                    Thumb(url: item.thumb).frame(width: 212, height: 120)
                        .overlay(alignment: .center) {
                            Image(systemName: "play.circle.fill").font(.system(size: 26)).foregroundStyle(.white.opacity(0.9))
                        }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Rectangle().fill(.white.opacity(0.18))
                            Rectangle().fill(TLColor.accent).frame(width: geo.size.width * item.progress.fraction)
                        }
                    }
                    .frame(height: 3).frame(maxHeight: .infinity, alignment: .bottom)
                }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
                Text(item.title).font(TLFont.sans(13.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(2)
                Text(LiveTime.remainingMinutes(item.progress)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.accentText)
            }
            .frame(width: 212, alignment: .leading)
        }
    }

    @ViewBuilder
    private func link<L: View>(@ViewBuilder _ label: () -> L) -> some View {
        if let url = item.url {
            NavigationLink { VideoPlayerScreen(url: url, title: item.title, progressKey: item.id) } label: { label() }
                .buttonStyle(.plain)
        } else { label() }
    }
}

struct VideoRow: View {
    let video: VideoSummary

    var body: some View {
        if let url = video.playbackURL {
            NavigationLink { VideoPlayerScreen(url: url, title: video.title, progressKey: video.id.uuidString) } label: { row }
                .buttonStyle(.plain)
        } else { row }
    }

    private var row: some View {
        HStack(spacing: 13) {
            ZStack(alignment: .bottomTrailing) {
                Thumb(url: video.thumbURL).frame(width: 138, height: 80)
                    .overlay(alignment: .center) {
                        Image(systemName: "play.circle.fill").font(.system(size: 24)).foregroundStyle(.white.opacity(0.9))
                    }
                if let d = video.durationText { DurationTag(text: d).padding(5) }
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text(video.title).font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(2)
                Text((video.orgName ?? "THEPICKLEHUB").uppercased()).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
            }
            Spacer(minLength: 0)
        }
    }
}
