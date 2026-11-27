import SwiftUI

/// Community photo post (social_posts). Mirrors the web FeedPostCard:
/// community eyebrow with topic chip and pending state, author name, the
/// photo, then the caption. A post has no detail page in v1, so the card
/// is not a link.
struct FeedSocialPostCard: View {
    let post: FeedSocialPost
    let publishedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            FeedEyebrow {
                EyebrowText.time(publishedAt)
                EyebrowText.dot
                EyebrowText.accent("Cộng đồng")
                if let topicLabel = post.topicLabel {
                    EyebrowText.dot
                    EyebrowText.label(topicLabel)
                }
                if post.isPending {
                    EyebrowText.dot
                    Text("Đang chờ duyệt").foregroundStyle(TLColor.gold)
                }
            }

            // Author row (web #1128): avatar + name + verified seal.
            HStack(spacing: 8) {
                Group {
                    if let avatarURL = post.authorAvatarURL {
                        AsyncImage(url: avatarURL) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                Circle().fill(TLColor.surface2)
                            }
                        }
                    } else {
                        Circle().fill(TLColor.surface2)
                            .overlay(
                                Text(String(post.authorName.prefix(1)).uppercased())
                                    .font(TLFont.serif(13))
                                    .foregroundStyle(TLColor.fg3)
                            )
                    }
                }
                .frame(width: 28, height: 28)
                .clipShape(Circle())

                Text(post.authorName)
                    .font(TLFont.sans(15, .semibold))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                if post.authorVerified {
                    VerifiedBadge(size: 15)
                }
            }

            // Community photos arrive in any aspect (the create-post
            // pipeline caps the long edge at 1600px); 4:3 crops far less
            // aggressively than the 16:9 editorial thumbnails.
            FeedThumbnail(url: post.imageURL, aspect: 4.0 / 3.0)

            if let bodyText = post.body?.nonEmpty {
                Text(bodyText)
                    .font(TLFont.sans(15))
                    .foregroundStyle(TLColor.fg2)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .feedCard()
    }
}
