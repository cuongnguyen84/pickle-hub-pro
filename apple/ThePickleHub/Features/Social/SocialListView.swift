import SwiftUI

@Observable
final class SocialListViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    var phase: Phase = .loading
    var events: [SocialEvent] = []
    private let repo = SocialRepository()
    private var loaded = false

    @MainActor
    func load() async {
        if loaded { return }
        phase = .loading
        do {
            events = try await repo.upcomingEvents()
            loaded = true
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func reload() async {
        loaded = false
        await load()
    }
}

/// Social tab — upcoming public pickup-game / meetup events.
struct SocialListView: View {
    @State private var model = SocialListViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                content.padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 24)
            }
            .background(TLColor.bg)
            .navigationTitle("Social")
            .navigationBarTitleDisplayMode(.large)
            .task { await model.load() }
            .refreshable { await model.reload() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).padding(.top, 60)
        case .failed(let message):
            errorState(message)
        case .loaded where model.events.isEmpty:
            emptyState
        case .loaded:
            LazyVStack(spacing: 14) {
                ForEach(model.events) { event in
                    NavigationLink {
                        SocialDetailView(event: event)
                    } label: {
                        SocialEventCard(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Chưa có sự kiện sắp tới")
                .font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text("Các buổi chơi cộng đồng sẽ hiện ở đây.")
                .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.top, 60)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar.badge.exclamationmark").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được sự kiện").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.reload() } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

/// Editorial event card: when label, title, location, and a meta chip row.
private struct SocialEventCard: View {
    let event: SocialEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let when = event.whenLabel {
                Text(when)
                    .font(TLFont.mono(10, .semibold)).tracking(0.6).textCase(.uppercase)
                    .foregroundStyle(TLColor.accentText)
            }
            Text(event.title)
                .font(TLFont.serif(22)).foregroundStyle(TLColor.fg).lineLimit(2)
            if let location = event.locationText?.nonEmpty {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2).lineLimit(2)
            }
            HStack(spacing: 8) {
                chip(event.priceLabel)
                if let level = event.levelLabel { chip(level) }
                if let max = event.maxPlayers { chip("\(max) chỗ") }
            }
        }
        .feedCard()
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(TLFont.mono(10, .medium)).tracking(0.4)
            .foregroundStyle(TLColor.fg2)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(TLColor.surface2, in: Capsule())
            .overlay(Capsule().strokeBorder(TLColor.border, lineWidth: 1))
    }
}
