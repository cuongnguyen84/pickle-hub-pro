import type { CSSProperties } from "react";
import { TheLineLayout } from "@/components/layout";
import { useI18n } from "@/i18n";

const CONTACT_EMAIL = "thecuong@gmail.com";

interface DisclosureCopy {
  title: string;
  description: string;
  kicker: string;
  heading: string;
  body: string[];
  contactLabel: string;
}

const EN: DisclosureCopy = {
  title: "Affiliate Disclosure | ThePickleHub",
  description: "How ThePickleHub uses affiliate links and earns commissions.",
  kicker: "Transparency",
  heading: "Affiliate Disclosure",
  body: [
    "ThePickleHub participates in affiliate programs. Some links on this site — particularly in gear reviews and buying guides — are affiliate links. If you click one and make a purchase, we may earn a commission at no additional cost to you.",
    "Affiliate commissions help fund the writing, tournament coverage, and tools we provide for free to the Vietnamese and Asian pickleball community.",
    "We only recommend products and brands we believe in. A product is never featured, ranked higher, or rated better simply because it pays a commission. Our editorial opinions are our own.",
    "All affiliate links are marked with the rel=\"sponsored\" attribute, in line with Google and FTC guidance.",
  ],
  contactLabel: "Questions about this policy?",
};

const VI: DisclosureCopy = {
  title: "Tiết lộ Affiliate | ThePickleHub",
  description: "Cách ThePickleHub sử dụng link affiliate và nhận hoa hồng.",
  kicker: "Minh bạch",
  heading: "Tiết lộ Affiliate",
  body: [
    "ThePickleHub có tham gia các chương trình affiliate. Một số link trên trang — đặc biệt trong các bài đánh giá thiết bị và hướng dẫn mua hàng — là link affiliate. Nếu bạn bấm vào và mua hàng, chúng tôi có thể nhận hoa hồng mà bạn không phải trả thêm bất kỳ khoản nào.",
    "Hoa hồng affiliate giúp chúng tôi duy trì việc viết bài, đưa tin giải đấu và cung cấp miễn phí các công cụ cho cộng đồng pickleball Việt Nam và châu Á.",
    "Chúng tôi chỉ giới thiệu những sản phẩm và thương hiệu mình tin tưởng. Không sản phẩm nào được ưu tiên, xếp hạng cao hơn hay đánh giá tốt hơn chỉ vì trả hoa hồng. Quan điểm biên tập là của riêng chúng tôi.",
    "Mọi link affiliate đều được gắn thuộc tính rel=\"sponsored\" theo đúng hướng dẫn của Google và FTC.",
  ],
  contactLabel: "Có thắc mắc về chính sách này?",
};

const para: CSSProperties = { margin: 0, color: "var(--tl-fg-2)", fontSize: 16, lineHeight: 1.65 };

export default function AffiliateDisclosurePage() {
  const { language } = useI18n();
  const c = language === "vi" ? VI : EN;

  return (
    <TheLineLayout title={c.title} description={c.description} active="home">
      <div className="tl-shell" style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 80 }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {c.kicker}</div>
          <h1>{c.heading}</h1>
        </header>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          {c.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} style={para}>{paragraph}</p>
          ))}
          <p style={{ ...para, marginTop: 8 }}>
            {c.contactLabel}{" "}
            <a style={{ color: "var(--tl-green)", textDecoration: "underline" }} href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </TheLineLayout>
  );
}
