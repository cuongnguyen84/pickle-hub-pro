import type { CSSProperties } from "react";
import { Mail, Users, Globe2, Trophy, Megaphone } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { useI18n } from "@/i18n";

const CONTACT_EMAIL = "thecuong@gmail.com";

interface RateRow {
  product: string;
  detail: string;
  price: string;
}

interface AdvertiseCopy {
  title: string;
  description: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimary: string;
  whyTitle: string;
  why: string[];
  audienceTitle: string;
  audience: { label: string; value: string }[];
  audienceNote: string;
  inventoryTitle: string;
  inventoryNote: string;
  cols: { product: string; detail: string; price: string };
  rates: RateRow[];
  closingTitle: string;
  closingBody: string;
  emailButton: string;
}

const EN: AdvertiseCopy = {
  title: "Advertise with ThePickleHub",
  description: "Reach an engaged, bilingual pickleball audience across Vietnam and Asia — sponsorships, branded content, and market-entry packages.",
  heroKicker: "Partner with us",
  heroTitle: "Reach the heart of Asia's pickleball boom",
  heroSubtitle: "ThePickleHub is the bilingual (Vietnamese + English) home for pickleball in Vietnam and Asia — news, tournaments, livestreams and community. Put your brand in front of players, organisers and fans the US media giants don't reach.",
  ctaPrimary: "Request the media kit",
  whyTitle: "Why partner with ThePickleHub",
  why: [
    "The only serious bilingual pickleball platform built for Vietnam and the wider Asia market.",
    "On-the-ground coverage of PPA Tour Asia events through our Newsport relationship.",
    "Engaged community: tournaments, livestream, news and a social feed — not just a blog.",
    "Global reach for brands wanting to enter Asia, plus a loyal local Vietnamese audience.",
  ],
  audienceTitle: "Audience snapshot",
  audience: [
    { label: "Registered members", value: "~1,670" },
    { label: "Languages", value: "VI + EN" },
    { label: "Primary markets", value: "Vietnam + Asia" },
    { label: "Tour coverage", value: "PPA Tour Asia" },
  ],
  audienceNote: "Up-to-date traffic, newsletter and engagement figures are shared in the full media kit on request.",
  inventoryTitle: "Inventory & sponsorship",
  inventoryNote: "Rates are set per campaign while we build out our packages — contact us for a custom quote and the current rate card.",
  cols: { product: "Placement", detail: "What it is", price: "Rate" },
  rates: [
    { product: "Newsletter sponsorship", detail: "Sponsor slot in our weekly bilingual newsletter", price: "Contact" },
    { product: "Sponsored article", detail: "Branded post or tournament recap, clearly labelled", price: "Contact" },
    { product: "Display / banner", detail: "On-site placements across high-traffic pages", price: "Contact" },
    { product: "Livestream sponsorship", detail: "Title or segment sponsor on event broadcasts", price: "Contact" },
    { product: "Asia market-entry package", detail: "Bundled content + newsletter + social for brands entering Asia", price: "Contact" },
  ],
  closingTitle: "Let's talk",
  closingBody: "Tell us your goals and budget and we'll put together a package that fits.",
  emailButton: "Email us",
};

const VI: AdvertiseCopy = {
  title: "Quảng cáo cùng ThePickleHub",
  description: "Tiếp cận cộng đồng pickleball song ngữ, gắn kết tại Việt Nam và châu Á — tài trợ, nội dung thương hiệu và gói thâm nhập thị trường.",
  heroKicker: "Hợp tác cùng chúng tôi",
  heroTitle: "Chạm tới trung tâm cơn bùng nổ pickleball châu Á",
  heroSubtitle: "ThePickleHub là ngôi nhà song ngữ (Việt + Anh) của pickleball tại Việt Nam và châu Á — tin tức, giải đấu, livestream và cộng đồng. Đưa thương hiệu của bạn đến với người chơi, nhà tổ chức và fan mà các ông lớn truyền thông Mỹ không chạm tới.",
  ctaPrimary: "Nhận media kit",
  whyTitle: "Vì sao hợp tác với ThePickleHub",
  why: [
    "Nền tảng pickleball song ngữ nghiêm túc duy nhất xây cho Việt Nam và thị trường châu Á.",
    "Đưa tin tại chỗ các sự kiện PPA Tour Asia qua quan hệ đối tác với Newsport.",
    "Cộng đồng gắn kết: giải đấu, livestream, tin tức và bảng tin xã hội — không chỉ là blog.",
    "Tiếp cận toàn cầu cho thương hiệu muốn vào châu Á, cùng audience Việt trung thành.",
  ],
  audienceTitle: "Tổng quan audience",
  audience: [
    { label: "Thành viên đã đăng ký", value: "~1.670" },
    { label: "Ngôn ngữ", value: "Việt + Anh" },
    { label: "Thị trường chính", value: "Việt Nam + châu Á" },
    { label: "Đưa tin giải", value: "PPA Tour Asia" },
  ],
  audienceNote: "Số liệu traffic, newsletter và mức độ tương tác mới nhất được chia sẻ trong media kit đầy đủ khi bạn yêu cầu.",
  inventoryTitle: "Hạng mục & tài trợ",
  inventoryNote: "Giá tính theo từng chiến dịch trong giai đoạn chúng tôi hoàn thiện các gói — liên hệ để nhận báo giá riêng và bảng giá hiện tại.",
  cols: { product: "Vị trí", detail: "Mô tả", price: "Giá" },
  rates: [
    { product: "Tài trợ newsletter", detail: "Slot tài trợ trong bản tin song ngữ hàng tuần", price: "Liên hệ" },
    { product: "Bài viết tài trợ", detail: "Bài thương hiệu hoặc recap giải đấu, gắn nhãn rõ ràng", price: "Liên hệ" },
    { product: "Display / banner", detail: "Vị trí hiển thị trên các trang nhiều traffic", price: "Liên hệ" },
    { product: "Tài trợ livestream", detail: "Nhà tài trợ chính hoặc theo phân đoạn trong buổi phát", price: "Liên hệ" },
    { product: "Gói thâm nhập châu Á", detail: "Combo nội dung + newsletter + social cho thương hiệu vào châu Á", price: "Liên hệ" },
  ],
  closingTitle: "Cùng trao đổi nhé",
  closingBody: "Cho chúng tôi biết mục tiêu và ngân sách, chúng tôi sẽ đề xuất gói phù hợp.",
  emailButton: "Gửi email",
};

const ICONS = [Megaphone, Globe2, Trophy, Users];

const cardBase: CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--tl-border)",
  background: "var(--tl-surface)",
};
const sectionH: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 20,
  fontWeight: 700,
  color: "var(--tl-fg)",
  letterSpacing: "-0.01em",
};
const th: CSSProperties = { padding: "12px 16px", fontWeight: 600, color: "var(--tl-fg)", fontSize: 13 };
const td: CSSProperties = { padding: "12px 16px", fontSize: 14 };
const ctaBtn: CSSProperties = { textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 };

export default function AdvertisePage() {
  const { language } = useI18n();
  const c = language === "vi" ? VI : EN;
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    language === "vi" ? "Hợp tác quảng cáo với ThePickleHub" : "Advertise with ThePickleHub",
  )}`;

  return (
    <TheLineLayout title={c.title} description={c.description} active="home">
      <div className="tl-shell" style={{ maxWidth: 1080, margin: "0 auto", paddingBottom: 80 }}>
        {/* Hero */}
        <header className="tl-page-head">
          <div className="kicker">◆ {c.heroKicker}</div>
          <h1>{c.heroTitle}</h1>
          <p>{c.heroSubtitle}</p>
          <div style={{ marginTop: 24 }}>
            <a href={mailto} className="tl-btn green" style={ctaBtn}>
              <Mail style={{ width: 16, height: 16 }} /> {c.ctaPrimary} →
            </a>
          </div>
        </header>

        {/* Why */}
        <section style={{ marginTop: 44 }}>
          <h2 style={sectionH}>{c.whyTitle}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {c.why.map((item, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <div key={item.slice(0, 24)} style={{ ...cardBase, display: "flex", gap: 12, alignItems: "flex-start", padding: 16 }}>
                  <Icon style={{ width: 20, height: 20, color: "var(--tl-green)", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, color: "var(--tl-fg-2)", fontSize: 14.5, lineHeight: 1.55 }}>{item}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Audience */}
        <section style={{ marginTop: 44 }}>
          <h2 style={sectionH}>{c.audienceTitle}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
            {c.audience.map((stat) => (
              <div key={stat.label} style={{ ...cardBase, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--tl-green)" }}>{stat.value}</div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--tl-fg-3)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: 12.5, fontStyle: "italic", color: "var(--tl-fg-3)" }}>{c.audienceNote}</p>
        </section>

        {/* Inventory & rates */}
        <section style={{ marginTop: 44 }}>
          <h2 style={sectionH}>{c.inventoryTitle}</h2>
          <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid var(--tl-border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--tl-surface)" }}>
                  <th style={th}>{c.cols.product}</th>
                  <th style={th}>{c.cols.detail}</th>
                  <th style={{ ...th, textAlign: "right" }}>{c.cols.price}</th>
                </tr>
              </thead>
              <tbody>
                {c.rates.map((row) => (
                  <tr key={row.product} style={{ borderTop: "1px solid var(--tl-border)" }}>
                    <td style={{ ...td, color: "var(--tl-fg)", fontWeight: 500 }}>{row.product}</td>
                    <td style={{ ...td, color: "var(--tl-fg-2)" }}>{row.detail}</td>
                    <td style={{ ...td, textAlign: "right", color: "var(--tl-fg-2)" }}>{row.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 12, fontSize: 12.5, fontStyle: "italic", color: "var(--tl-fg-3)" }}>{c.inventoryNote}</p>
        </section>

        {/* Closing CTA */}
        <section style={{ ...cardBase, marginTop: 44, padding: 28, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "var(--tl-fg)" }}>{c.closingTitle}</h2>
          <p style={{ margin: "0 0 20px", color: "var(--tl-fg-2)", fontSize: 14.5 }}>{c.closingBody}</p>
          <a href={mailto} className="tl-btn green" style={ctaBtn}>
            <Mail style={{ width: 16, height: 16 }} /> {c.emailButton} · {CONTACT_EMAIL}
          </a>
        </section>
      </div>
    </TheLineLayout>
  );
}
