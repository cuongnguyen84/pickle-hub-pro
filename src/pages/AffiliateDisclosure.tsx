import { Link } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { useI18n } from "@/i18n";

const COPY = {
  en: {
    title: "Affiliate Disclosure",
    description: "How ThePickleHub uses affiliate links and earns commissions.",
    back: "Go home",
    body: [
      "ThePickleHub participates in affiliate programs. Some links on this site — particularly in gear reviews and buying guides — are affiliate links. If you click one and make a purchase, we may earn a commission at no additional cost to you.",
      "Affiliate commissions help fund the writing, tournament coverage, and tools we provide for free to the Vietnamese and Asian pickleball community.",
      "We only recommend products and brands we believe in. A product is never featured, ranked higher, or rated better simply because it pays a commission. Our editorial opinions are our own.",
      "All affiliate links are marked with the rel=\"sponsored\" attribute, in line with Google and FTC guidance.",
    ],
    contactLabel: "Questions about this policy?",
    contactEmail: "thecuong@gmail.com",
  },
  vi: {
    title: "Tiết lộ Affiliate",
    description: "Cách ThePickleHub sử dụng link affiliate và nhận hoa hồng.",
    back: "Về trang chủ",
    body: [
      "ThePickleHub có tham gia các chương trình affiliate. Một số link trên trang — đặc biệt trong các bài đánh giá thiết bị và hướng dẫn mua hàng — là link affiliate. Nếu bạn bấm vào và mua hàng, chúng tôi có thể nhận hoa hồng mà bạn không phải trả thêm bất kỳ khoản nào.",
      "Hoa hồng affiliate giúp chúng tôi duy trì việc viết bài, đưa tin giải đấu và cung cấp miễn phí các công cụ cho cộng đồng pickleball Việt Nam và châu Á.",
      "Chúng tôi chỉ giới thiệu những sản phẩm và thương hiệu mình tin tưởng. Không sản phẩm nào được ưu tiên, xếp hạng cao hơn hay đánh giá tốt hơn chỉ vì trả hoa hồng. Quan điểm biên tập là của riêng chúng tôi.",
      "Mọi link affiliate đều được gắn thuộc tính rel=\"sponsored\" theo đúng hướng dẫn của Google và FTC.",
    ],
    contactLabel: "Có thắc mắc về chính sách này?",
    contactEmail: "thecuong@gmail.com",
  },
};

export default function AffiliateDisclosurePage() {
  const { language } = useI18n();
  const c = language === "vi" ? COPY.vi : COPY.en;

  return (
    <TheLineLayout title={c.title} description={c.description}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-14 items-center px-4">
            <Link to={language === "vi" ? "/vi" : "/"} className="inline-flex items-center gap-2 text-foreground-secondary transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">{c.back}</span>
            </Link>
          </div>
        </header>

        <main className="container mx-auto max-w-3xl px-4 py-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Info className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{c.title}</h1>
          </div>

          <div className="space-y-4 leading-relaxed text-foreground-secondary">
            {c.body.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
            <p className="pt-2">
              {c.contactLabel}{" "}
              <a className="text-primary underline underline-offset-2" href={`mailto:${c.contactEmail}`}>
                {c.contactEmail}
              </a>
            </p>
          </div>
        </main>
      </div>
    </TheLineLayout>
  );
}
