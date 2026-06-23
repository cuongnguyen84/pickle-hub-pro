import SwiftUI

/// SwiftUI port of `src/components/profile/RatingCard.tsx` — the dark "credential"
/// with a giant hero DUPR numeral on a green glow, plus share actions.
struct RatingCardView: View {
    let profile: Profile
    var isOwn = false

    private var profileURL: URL {
        URL(string: "https://www.thepicklehub.net/nguoi-choi/\(profile.resolvedUsername)")!
    }

    private var hasDoubles: Bool { profile.duprDoubles != nil }
    private var hasSingles: Bool { profile.duprSingles != nil }

    private var heroLabel: String { hasDoubles ? "ĐÔI" : "ĐƠN" }
    private var heroValue: String { fmt(hasDoubles ? profile.duprDoubles : profile.duprSingles) }
    private var secLabel: String { hasDoubles ? "ĐƠN" : "ĐÔI" }
    private var secValue: String {
        hasDoubles ? fmt(profile.duprSingles) : (hasSingles ? fmt(profile.duprDoubles) : "—")
    }

    var body: some View {
        VStack(spacing: 0) {
            credentialFace
            actions
        }
        .clipShape(RoundedRectangle(cornerRadius: TLRadius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.xl, style: .continuous)
                .strokeBorder(TLColor.green.opacity(0.15), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.4), radius: 18, y: 10)
    }

    // MARK: Dark face

    private var credentialFace: some View {
        ZStack(alignment: .topLeading) {
            Color(hex: 0x09090B) // zinc-950

            // green glow, bottom-right
            Circle()
                .fill(TLColor.green.opacity(0.25))
                .frame(width: 288, height: 288)
                .blur(radius: 60)
                .offset(x: 150, y: 150)

            // top accent rule
            LinearGradient(
                colors: [Color(hex: 0x34D399), Color(hex: 0x059669)],
                startPoint: .leading, endPoint: .trailing
            )
            .frame(width: 176, height: 6)

            VStack(alignment: .leading, spacing: 20) {
                brandRow
                identityAndHero
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 28)
        }
        .frame(maxWidth: .infinity)
        .clipped()
    }

    private var brandRow: some View {
        HStack {
            HStack(spacing: 8) {
                Circle().fill(Color(hex: 0x34D399)).frame(width: 10, height: 10)
                Text("ThePickleHub").font(.subheadline.weight(.bold)).foregroundStyle(TLColor.fg)
            }
            Spacer()
            Text("DUPR")
                .font(.caption2.weight(.bold))
                .tracking(3)
                .foregroundStyle(Color(hex: 0x34D399))
        }
    }

    private var identityAndHero: some View {
        HStack(alignment: .bottom, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                avatar.padding(.bottom, 8)
                Text(profile.resolvedDisplayName)
                    .font(.title.weight(.black))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                Text("@\(profile.resolvedUsername)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(hex: 0xA1A1AA))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            heroBlock
        }
    }

    private var avatar: some View {
        Group {
            if let urlString = profile.avatarURL, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color(hex: 0x18181B)
                }
            } else {
                Text(String(profile.resolvedDisplayName.prefix(1)).uppercased())
                    .font(.title3.weight(.black))
                    .foregroundStyle(Color(hex: 0x34D399))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(hex: 0x18181B))
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Color(hex: 0x34D399), lineWidth: 2))
    }

    @ViewBuilder
    private var heroBlock: some View {
        if profile.isUnrated {
            VStack(alignment: .trailing, spacing: 2) {
                Text("DUPR").font(.caption2.weight(.bold)).tracking(2).foregroundStyle(Color(hex: 0x34D399))
                Text("Chưa xếp hạng").font(.title2.weight(.black)).foregroundStyle(TLColor.fg)
            }
        } else {
            VStack(alignment: .trailing, spacing: 2) {
                Text(heroLabel).font(.caption2.weight(.bold)).tracking(2).foregroundStyle(Color(hex: 0x34D399))
                Text(heroValue)
                    .font(.system(size: 60, weight: .black, design: .monospaced))
                    .foregroundStyle(TLColor.fg)
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                HStack(spacing: 4) {
                    Text(secLabel).font(.subheadline.weight(.semibold)).tracking(1.5).foregroundStyle(Color(hex: 0xA1A1AA))
                    Text(secValue).font(.subheadline.weight(.semibold)).foregroundStyle(Color(hex: 0xE4E4E7))
                }
            }
        }
    }

    // MARK: Actions

    private var actions: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ShareLink(item: profileURL) {
                    actionLabel("Chia sẻ", system: "square.and.arrow.up", filled: true)
                }
                Button { UIPasteboard.general.url = profileURL } label: {
                    actionLabel("Copy link", system: "doc.on.doc", filled: false)
                }
            }
            Button {
                let fb = "https://www.facebook.com/sharer/sharer.php?u=\(profileURL.absoluteString)"
                if let url = URL(string: fb) { UIApplication.shared.open(url) }
            } label: {
                actionLabel("Facebook", system: "f.square.fill", filled: false)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .background(TLColor.surface)
    }

    private func actionLabel(_ title: String, system: String, filled: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: system)
            Text(title).fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 11)
        .foregroundStyle(filled ? TLColor.bg : TLColor.fg)
        .background(filled ? TLColor.green : TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(filled ? .clear : TLColor.border, lineWidth: 1)
        )
    }

    private func fmt(_ v: Double?) -> String {
        guard let v else { return "—" }
        return String(format: "%.2f", v)
    }
}
