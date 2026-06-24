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
    let readLabel: String           // "Đọc bài đầy đủ" / "Đọc bài gốc"

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

    var body: some View {
        // The article body IS rendered natively (summary). The CTA links out to
        // the ORIGINAL source for the full read (copyright/fair-use), mirroring
        // the web "Đọc toàn bộ bài viết tại {source}" button. Falls back to the
        // app's own news page if no external source_url.
        let external = news.sourceURL?.nonEmpty.flatMap { URL(string: $0) }
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
            readURL: external ?? WebRoutes.news(slug: news.slug, language: news.language),
            readLabel: news.source?.nonEmpty.map { "Đọc toàn bộ tại \($0)" } ?? "Đọc bài gốc"
        )
    }
}
