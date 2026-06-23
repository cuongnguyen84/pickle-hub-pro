import SwiftUI

/// Editorial blog entry in the timeline. Serif italic title echoes the web
/// Instrument Serif treatment.
struct FeedBlogCard: View {
    let blog: FeedBlog
    let publishedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            FeedEyebrow {
                EyebrowText.time(publishedAt)
                if let category = blog.category?.nonEmpty {
                    EyebrowText.dot
                    EyebrowText.label(category.uppercased())
                }
                EyebrowText.dot
                EyebrowText.accent("BÀI VIẾT")
            }

            if let urlString = blog.coverImageURL, let url = WebRoutes.asset(urlString) {
                FeedThumbnail(url: url, aspect: 16.0 / 9.0)
            }

            Text(blog.title)
                .font(TLFont.serif(27))
                .foregroundStyle(TLColor.fg)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)

            if let excerpt = blog.excerpt?.nonEmpty {
                Text(excerpt)
                    .font(TLFont.sans(15))
                    .foregroundStyle(TLColor.fg2)
                    .lineSpacing(3)
                    .lineLimit(3)
            }
        }
        .feedCard()
    }
}
