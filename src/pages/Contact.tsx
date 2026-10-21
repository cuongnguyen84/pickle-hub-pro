import { TheLineLayout } from "@/components/layout";
import { useI18n } from "@/i18n";

const Contact = () => {
  const { language } = useI18n();
  const vi = language === "vi";
  return (
    <TheLineLayout
      title={vi ? "Liên hệ ThePickleHub" : "Contact ThePickleHub"}
      description={vi ? "Hỗ trợ, nội dung, giải đấu và hợp tác." : "Support, editorial, tournaments, and partnerships."}
    >
      <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground-secondary">
        <h1 className="mb-8 text-3xl font-bold text-foreground">{vi ? "Liên hệ ThePickleHub" : "Contact ThePickleHub"}</h1>
        <div className="space-y-8 leading-relaxed">
          <section><h2 className="mb-3 text-xl font-semibold text-foreground">{vi ? "Hỗ trợ và phản hồi" : "Support and feedback"}</h2><p>{vi ? "Chúng tôi hỗ trợ người chơi, câu lạc bộ và ban tổ chức về tài khoản, công cụ giải đấu, livestream, nội dung và thông tin công khai trên nền tảng. Khi báo lỗi, vui lòng gửi URL, thiết bị và các bước dẫn đến lỗi." : "We help players, clubs, and organizers with accounts, tournament tools, livestreams, editorial content, and public information. When reporting a problem, include the URL, device, and steps that produced it."}</p></section>
          <section><h2 className="mb-3 text-xl font-semibold text-foreground">{vi ? "Nội dung và hợp tác" : "Editorial and partnerships"}</h2><p>{vi ? "Ban tổ chức, câu lạc bộ, vận động viên và đối tác truyền thông có thể gửi lịch thi đấu, yêu cầu chỉnh sửa, thông cáo hoặc đề xuất hợp tác." : "Organizers, clubs, athletes, and media partners may send schedule updates, correction requests, press information, or partnership proposals."}</p></section>
          <section><h2 className="mb-3 text-xl font-semibold text-foreground">{vi ? "Email" : "Email"}</h2><p><a className="text-primary hover:underline" href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a></p><p className="mt-2">{vi ? "Đội ngũ vận hành tại TP.HCM, Việt Nam. Không gửi mật khẩu hoặc mã đăng nhập qua email." : "The team operates from Ho Chi Minh City, Vietnam. Do not send passwords or login codes by email."}</p></section>
        </div>
      </main>
    </TheLineLayout>
  );
};

export default Contact;
