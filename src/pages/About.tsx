import { Link } from "react-router-dom";
import { TheLineLayout } from "@/components/layout";
import { useI18n } from "@/i18n";

const About = () => {
  const { language } = useI18n();
  const vi = language === "vi";
  return (
    <TheLineLayout
      // Kept byte-for-byte in step with renderAbout in
      // functions/_lib/render/static-pages.ts — the bot path and the human
      // path must not describe the same page differently.
      title={vi ? "Về ThePickleHub — Nền tảng pickleball song ngữ" : "About ThePickleHub — Bilingual Pickleball Platform"}
      description={vi
        ? "ThePickleHub — nền tảng pickleball song ngữ Việt–Anh: phần mềm giải đấu miễn phí, livestream, xếp hạng DUPR, danh bạ sân."
        : "ThePickleHub is Vietnam's bilingual pickleball platform: free tournament software, livestreams, DUPR rankings, a court directory and news. Based in HCMC."}
    >
      <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground-secondary">
        <h1 className="mb-8 text-3xl font-bold text-foreground">{vi ? "Về ThePickleHub" : "About ThePickleHub"}</h1>
        <div className="space-y-8 leading-relaxed">
          <section><h2 className="mb-3 text-xl font-semibold text-foreground">{vi ? "Chúng tôi làm gì" : "What we do"}</h2><p>{vi ? "ThePickleHub tập hợp công cụ quản lý giải đấu miễn phí, lịch và kết quả, livestream, video, tin tức, bảng xếp hạng DUPR, danh bạ sân và hoạt động cộng đồng trong một nền tảng Việt–Anh." : "ThePickleHub brings together free tournament tools, schedules and results, livestreams, video, news, DUPR rankings, court discovery, and community events in one Vietnamese–English platform."}</p></section>
          <section><h2 className="mb-3 text-xl font-semibold text-foreground">{vi ? "Chúng tôi phục vụ ai" : "Who we serve"}</h2><p>{vi ? "Nền tảng dành cho người chơi, câu lạc bộ và ban tổ chức. Đội ngũ đặt tại TP.HCM và tập trung đặc biệt vào hệ sinh thái pickleball Việt Nam và châu Á." : "The platform serves players, clubs, and tournament organizers. Our team is based in Ho Chi Minh City with a particular focus on pickleball in Vietnam and across Asia."}</p></section>
          <section><h2 className="mb-3 text-xl font-semibold text-foreground">{vi ? "Nguyên tắc biên tập" : "Editorial principles"}</h2><p>{vi ? "Chúng tôi ưu tiên thông tin có nguồn, cập nhật rõ ràng và nội dung hữu ích từ trải nghiệm thực tế của cộng đồng địa phương." : "We prioritize sourced information, transparent updates, and useful coverage grounded in the first-hand experience of the local community."}</p></section>
          <p><Link className="text-primary hover:underline" to={vi ? "/vi/contact" : "/contact"}>{vi ? "Liên hệ đội ngũ" : "Contact the team"}</Link></p>
        </div>
      </main>
    </TheLineLayout>
  );
};

export default About;
