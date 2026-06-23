import SwiftUI

/// Editorial blog story card (cover, tag, serif title, excerpt, byline). Shared
/// by the Home feature section and the full blog list.
struct StoryCard: View {
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

/// Tappable story card pushing the native blog reader.
struct StoryLink: View {
    let post: BlogPostSummary

    var body: some View {
        NavigationLink {
            BlogDetailView(blog: post.asFeedBlog, publishedAt: FeedDate.parse(post.publishedAt ?? ""))
        } label: {
            StoryCard(post: post)
        }
        .buttonStyle(.plain)
    }
}

/// Full-width "Xem thêm →" button label used at the foot of Home sections.
struct HomeSeeMore: View {
    let label: String

    var body: some View {
        HStack(spacing: 6) {
            Text(label)
            Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold))
        }
        .font(TLFont.mono(11, .semibold))
        .textCase(.uppercase)
        .tracking(0.6)
        .foregroundStyle(TLColor.accentText)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 13)
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(TLColor.border2, lineWidth: 1)
        )
    }
}

extension BlogPostSummary {
    var asFeedBlog: FeedBlog {
        FeedBlog(slug: slug, title: title, excerpt: excerpt, coverImageURL: coverImageURL, category: tag)
    }
}
