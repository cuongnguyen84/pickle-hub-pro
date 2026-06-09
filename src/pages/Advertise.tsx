import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Users, Globe2, Trophy, Megaphone } from "lucide-react";
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
  back: string;
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
  back: "Go home",
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
  back: "Về trang chủ",
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

export default function AdvertisePage() {
  const { language } = useI18n();
  const c = language === "vi" ? VI : EN;
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    language === "vi" ? "Hợp tác quảng cáo với ThePickleHub" : "Advertise with ThePickleHub",
  )}`;

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

        <main className="container mx-auto max-w-4xl px-4 py-10">
          {/* Hero */}
          <section className="mb-12">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">{c.heroKicker}</p>
            <h1 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">{c.heroTitle}</h1>
            <p className="max-w-2xl text-base leading-relaxed text-foreground-secondary">{c.heroSubtitle}</p>
            <a
              href={mailto}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Mail className="h-4 w-4" />
              {c.ctaPrimary}
            </a>
          </section>

          {/* Why */}
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-foreground">{c.whyTitle}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {c.why.map((item, i) => {
                const Icon = ICONS[i % ICONS.length];
                return (
                  <div key={item.slice(0, 24)} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed text-foreground-secondary">{item}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Audience */}
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-foreground">{c.audienceTitle}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {c.audience.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{stat.value}</div>
                  <div className="mt-1 text-xs text-foreground-secondary">{stat.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs italic text-muted-foreground">{c.audienceNote}</p>
          </section>

          {/* Inventory & rates */}
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-foreground">{c.inventoryTitle}</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-muted/50 text-foreground">
                    <th className="px-4 py-3 font-semibold">{c.cols.product}</th>
                    <th className="px-4 py-3 font-semibold">{c.cols.detail}</th>
                    <th className="px-4 py-3 text-right font-semibold">{c.cols.price}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rates.map((row) => (
                    <tr key={row.product} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">{row.product}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.detail}</td>
                      <td className="px-4 py-3 text-right text-foreground-secondary">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs italic text-muted-foreground">{c.inventoryNote}</p>
          </section>

          {/* Closing CTA */}
          <section className="rounded-xl border border-border bg-card p-6 text-center">
            <h2 className="mb-2 text-xl font-bold text-foreground">{c.closingTitle}</h2>
            <p className="mb-5 text-sm text-foreground-secondary">{c.closingBody}</p>
            <a
              href={mailto}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Mail className="h-4 w-4" />
              {c.emailButton} · {CONTACT_EMAIL}
            </a>
          </section>
        </main>
      </div>
    </TheLineLayout>
  );
}
