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

            if let urlString = blog.coverImageURL, let url = URL(string: urlString) {
                FeedThumbnail(url: url, aspect: 16.0 / 9.0)
            }

            Text(blog.title)
                .font(.system(.title2, design: .serif).italic())
                .foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)

            if let excerpt = blog.excerpt?.nonEmpty {
                Text(excerpt)
                    .font(.subheadline)
                    .foregroundStyle(TLColor.fg2)
                    .lineLimit(3)
            }
        }
        .feedCard()
    }
}
