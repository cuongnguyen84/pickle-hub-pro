import SwiftUI

/// "Tuần này. N°NN" — the lead editorial feature feed (VI blog posts).
struct HomeFeatureSection: View {
    let posts: [BlogPostSummary]

    private var isoWeek: Int {
        Calendar(identifier: .iso8601).component(.weekOfYear, from: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                HomeSectionHeader(title: "Tuần này.", emphasis: "N°\(isoWeek)")
                Text("Phóng sự dài kỳ — phóng viên, HLV, và những người có mặt khi câu chuyện diễn ra.")
                    .font(TLFont.sans(14))
                    .foregroundStyle(TLColor.fg3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ForEach(posts) { post in
                NavigationLink {
                    BlogDetailView(blog: post.asFeedBlog, publishedAt: FeedDate.parse(post.publishedAt ?? ""))
                } label: {
                    StoryCard(post: post)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct StoryCard: View {
    let post: BlogPostSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let urlString = post.coverImageURL, let url = WebRoutes.asset(urlString) {
                FeedThumbnail(
                    url: url,
                    aspect: 16.0 / 9.0,
                    overlay: post.tag.map { tag in
                        AnyView(
                            VStack {
                                HStack {
                                    Text(tag.uppercased())
                                        .font(TLFont.mono(9, .semibold))
                                        .tracking(0.6)
                                        .foregroundStyle(TLColor.accentInk)
                                        .padding(.horizontal, 7).padding(.vertical, 3)
                                        .background(TLColor.accent, in: Capsule())
                                    Spacer()
                                }
                                Spacer()
                            }
                            .padding(10)
                        )
                    }
                )
            }

            Text(post.title)
                .font(TLFont.serif(24))
                .foregroundStyle(TLColor.fg)
                .lineSpacing(1)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)

            if let excerpt = post.excerpt?.nonEmpty {
                Text(excerpt)
                    .font(TLFont.sans(15))
                    .foregroundStyle(TLColor.fg2)
                    .lineSpacing(3)
                    .lineLimit(2)
            }

            Text("The PickleHub · \(FeedDate.relative(FeedDate.parse(post.publishedAt ?? "")))")
                .font(TLFont.mono(10))
                .foregroundStyle(TLColor.fg4)
        }
        .feedCard()
    }
}

extension BlogPostSummary {
    var asFeedBlog: FeedBlog {
        FeedBlog(slug: slug, title: title, excerpt: excerpt, coverImageURL: coverImageURL, category: tag)
    }
}
