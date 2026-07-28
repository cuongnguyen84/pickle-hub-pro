import SwiftUI

/// One lifecycle for every native Bracket Lab detail screen:
/// initial load, 15-second safety polling, pull-to-refresh and realtime cleanup.
private struct TournamentDetailLifecycleModifier: ViewModifier {
    let identity: String
    let pollInterval: Duration
    let isPollingPaused: @MainActor () -> Bool
    let load: @MainActor () async -> Void
    let stop: @MainActor () async -> Void

    func body(content: Content) -> some View {
        content
            .task(id: identity) {
                await load()
                while !Task.isCancelled {
                    do {
                        try await Task.sleep(for: pollInterval)
                    } catch is CancellationError {
                        break
                    } catch {
                        continue
                    }
                    guard !Task.isCancelled else { break }
                    if !isPollingPaused() {
                        await load()
                    }
                }
            }
            .refreshable {
                await load()
            }
            .onDisappear {
                Task { await stop() }
            }
    }
}

extension View {
    func tournamentDetailLifecycle(
        id: String,
        pollInterval: Duration = .seconds(15),
        isPollingPaused: @escaping @MainActor () -> Bool = { false },
        load: @escaping @MainActor () async -> Void,
        stop: @escaping @MainActor () async -> Void
    ) -> some View {
        modifier(TournamentDetailLifecycleModifier(
            identity: id,
            pollInterval: pollInterval,
            isPollingPaused: isPollingPaused,
            load: load,
            stop: stop
        ))
    }
}

struct TournamentShareButton: View {
    let url: URL

    var body: some View {
        ShareLink(item: url) {
            Image(systemName: "square.and.arrow.up")
                .foregroundStyle(TLColor.accentText)
        }
        .accessibilityLabel("Chia sẻ giải đấu")
    }
}

struct TournamentScoreRetryMessage: View {
    let message: String

    var body: some View {
        Text("\(message)\nĐiểm vừa nhập vẫn được giữ. Kiểm tra mạng rồi bấm Thử lại.")
            .font(TLFont.sans(12))
            .foregroundStyle(TLColor.live)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(TLColor.live.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}
