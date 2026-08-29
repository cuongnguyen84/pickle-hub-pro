import SwiftUI

/// Shared native reader shell for blog + news. The feed only carries the
/// excerpt/summary (not the full HTML body), so the screen presents a native
/// hero + intro and hands off to the in-app browser for the full read.
struct ArticleDetailView: View {
    struct Eyebrow {
        let kicker: String          // "BÀI VIẾT" / "TIN"
        let meta: [String]          // ["13 giờ trước", "The Dink Pickleball"]
        var aiTranslated = false
    }

    let imageURL: String?
    let eyebrow: Eyebrow
    let title: String
    let bodyText: String?
    let readURL: URL
    let readLabel: LocalizedStringKey           // "Đọc bài đầy đủ" / "Đọc bài gốc"

    @State private var showWeb = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let imageURL, let url = URL(string: imageURL) {
                    FeedThumbnail(url: url, aspect: 16.0 / 9.0)
                }

                FeedEyebrow {
                    ForEach(Array(eyebrow.meta.enumerated()), id: \.offset) { index, part in
                        if index > 0 { EyebrowText.dot }
                        EyebrowText.label(part)
                    }
                    EyebrowText.dot
                    EyebrowText.accent(eyebrow.kicker)
                    if eyebrow.aiTranslated {
                        EyebrowText.dot
                        Text("AI").foregroundStyle(TLColor.gold)
                    }
                }

                Text(title)
                    .font(TLFont.serif(32))
                    .foregroundStyle(TLColor.fg)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)

                if let bodyText = bodyText?.nonEmpty {
                    Text(bodyText)
                        .font(TLFont.sans(16))
                        .foregroundStyle(TLColor.fg2)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }

                TLPrimaryButton(title: readLabel) { showWeb = true }
                    .padding(.top, 4)
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showWeb) {
            SafariView(url: readURL).ignoresSafeArea()
        }
    }
}

struct NewsDetailView: View {
    let news: FeedNews
    let publishedAt: Date?

    @State private var detail: NewsArticleDetail?
    @State private var phase: Phase = .loading

    private let repo = FeedRepository()
    private enum Phase: Equatable { case loading, loaded, failed(String) }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                ProgressView().tint(TLColor.accentText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                VStack(spacing: 10) {
                    Text("Không tải được bài viết")
                        .font(TLFont.sans(16, .semibold))
                        .foregroundStyle(TLColor.fg)
                    Text(message)
                        .font(TLFont.sans(12))
                        .foregroundStyle(TLColor.fg3)
                        .multilineTextAlignment(.center)
                    Button("Thử lại") { Task { await load() } }
                        .foregroundStyle(TLColor.accentText)
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .loaded:
                if let detail {
                    ArticleWebView(bodyHTML: bodyHTML(detail))
                        .ignoresSafeArea(edges: .bottom)
                }
            }
        }
        .background(TLColor.bg)
        .navigationTitle(news.title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func bodyHTML(_ detail: NewsArticleDetail) -> String {
        var html = ""
        if let image = detail.imageURL?.nonEmpty,
           let url = WebRoutes.asset(image),
           url.scheme?.lowercased() == "https" {
            html += "<img src=\"\(ArticleHTML.escapeText(url.absoluteString))\" alt=\"\">"
        }

        let source = detail.source?.nonEmpty ?? news.source?.nonEmpty
        let meta = [source, detail.category?.nonEmpty].compactMap { $0 }
        if !meta.isEmpty {
            html += "<p style=\"color:#bdee5c;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin:8px 0 0\">\(ArticleHTML.escapeText(meta.joined(separator: " · ")))</p>"
        }
        html += "<h1>\(ArticleHTML.escapeText(detail.title))</h1>"

        if let content = detail.contentHTML?.nonEmpty {
            html += content
        } else {
            html += "<p>\(ArticleHTML.escapeText(detail.summary))</p>"
        }
        return html
    }

    private func load() async {
        phase = .loading
        do {
            detail = try await repo.newsArticle(slug: news.slug, language: news.language)
            phase = detail == nil ? .failed("Không tìm thấy bài viết.") : .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}
