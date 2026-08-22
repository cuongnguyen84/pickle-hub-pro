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

    private let repository = FeedRepository()
    private enum Phase: Equatable { case loading, loaded, failed(String) }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                ProgressView()
                    .tint(TLColor.accentText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel("Đang tải bài viết")
            case .loaded:
                if let detail {
                    ArticleWebView(bodyHTML: NewsArticleHTML.body(detail))
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    fallbackReader
                }
            case .failed(let message):
                TLErrorState(title: "Không tải được bài viết", message: message) {
                    Task { await load() }
                }
            }
        }
        .background(TLColor.bg)
        .navigationTitle(news.source?.nonEmpty ?? "Tin tức")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: news.slug) { await load() }
    }

    /// Keeps the old summary + web handoff available only when the published
    /// row has no full editorial body (legacy data), never during normal reads.
    private var fallbackReader: some View {
        ArticleDetailView(
            imageURL: news.imageURL,
            eyebrow: .init(
                kicker: "TIN",
                meta: [FeedDate.relative(publishedAt), news.source?.nonEmpty]
                    .compactMap { $0 }.filter { !$0.isEmpty },
                aiTranslated: news.aiTranslated
            ),
            title: news.title,
            bodyText: news.summary,
            readURL: WebRoutes.news(slug: news.slug, language: news.language),
            readLabel: "Đọc trên ThePickleHub"
        )
    }

    private func load() async {
        phase = .loading
        do {
            detail = try await repository.newsDetail(slug: news.slug, language: news.language)
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Builds the trusted editorial fragment consumed by `ArticleWebView`. Every
/// database metadata value is escaped; only `contentHtml` remains markup, as it
/// is produced by the protected editorial pipeline and rendered under a strict
/// no-script/no-frame CSP.
enum NewsArticleHTML {
    static func body(_ detail: NewsArticleDetail) -> String {
        var html = "<article class=\"news-article\">"
        if let image = detail.imageURL?.nonEmpty,
           let url = WebRoutes.asset(image),
           url.scheme?.lowercased() == "https" {
            html += "<img class=\"hero\" src=\"\(ArticleHTML.escapeText(url.absoluteString))\" alt=\"\">"
        }

        let publishedDate = detail.publishedAt.flatMap { FeedDate.parse($0) }
        let relative = publishedDate.map { FeedDate.relative($0) } ?? ""
        let metadata = [relative.nonEmpty, detail.source?.nonEmpty]
            .compactMap { $0 }
            .map { ArticleHTML.escapeText($0.uppercased()) }
        html += "<p class=\"eyebrow\">\(metadata.joined(separator: " &nbsp;·&nbsp; "))"
        if !metadata.isEmpty { html += " &nbsp;·&nbsp; " }
        html += "<span>TIN</span>"
        if detail.aiTranslated { html += " &nbsp;·&nbsp; <b>AI</b>" }
        html += "</p>"
        html += "<h1 class=\"headline\">\(ArticleHTML.escapeText(detail.title))</h1>"
        if let summary = detail.summary?.nonEmpty {
            html += "<p class=\"dek\">\(ArticleHTML.escapeText(summary))</p>"
        }
        html += "<div class=\"article-body\">\(detail.contentHtml)</div></article>"
        return html
    }
}
