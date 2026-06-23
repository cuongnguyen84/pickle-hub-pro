import SwiftUI

/// Native blog reader — fetches `content_html` and renders it in-app (no Safari)
/// via ArticleWebView with The Line dark styling.
struct BlogReaderView: View {
    let slug: String
    let title: String

    @State private var detail: BlogPostDetail?
    @State private var phase: Phase = .loading

    private let repo = HomeRepository()

    private enum Phase: Equatable { case loading, loaded, failed(String) }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                ProgressView().tint(TLColor.accentText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                VStack(spacing: 10) {
                    Text("Không tải được bài viết").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
                    Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
                    Button("Thử lại") { Task { await load() } }.foregroundStyle(TLColor.accentText)
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .loaded:
                if let detail {
                    ArticleWebView(bodyHTML: bodyHTML(detail)).ignoresSafeArea(edges: .bottom)
                }
            }
        }
        .background(TLColor.bg)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func bodyHTML(_ detail: BlogPostDetail) -> String {
        var html = ""
        if let cover = detail.coverImageURL?.nonEmpty {
            html += "<img src=\"\(cover)\" alt=\"\">"
        }
        if let tag = detail.category?.nonEmpty {
            html += "<p style=\"color:#bdee5c;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin:8px 0 0\">\(tag)</p>"
        }
        html += "<h1>\(detail.title)</h1>"
        html += detail.contentHtml
        return html
    }

    private func load() async {
        phase = .loading
        do {
            detail = try await repo.post(slug: slug)
            phase = detail == nil ? .failed("Không tìm thấy bài viết.") : .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}
