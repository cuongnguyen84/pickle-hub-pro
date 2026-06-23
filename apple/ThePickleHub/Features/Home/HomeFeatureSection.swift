import SwiftUI

/// "Tuần này. N°NN" — the lead editorial feature feed. Shows the 3 newest VI
/// blog posts, then a "Xem thêm" link to the full list.
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

            ForEach(posts.prefix(3)) { post in
                StoryLink(post: post)
            }

            NavigationLink {
                BlogListView()
            } label: {
                HomeSeeMore(label: "Xem thêm bài viết")
            }
            .buttonStyle(.plain)
        }
    }
}
