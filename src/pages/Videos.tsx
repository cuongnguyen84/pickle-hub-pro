import { MainLayout } from "@/components/layout";
import { ContentCard, SectionHeader } from "@/components/content";
import { useI18n } from "@/i18n";

const mockVideos = [
  { id: "1", title: "Hướng dẫn kỹ thuật dink cơ bản cho người mới", duration: 845, views: 12500, organizationName: "PB Academy" },
  { id: "2", title: "Top 10 pha rally đỉnh cao tháng 12/2024", duration: 623, views: 8900, organizationName: "VN Pickleball" },
  { id: "3", title: "Phỏng vấn nhà vô địch Nguyễn Văn A", duration: 1245, views: 5600, organizationName: "Sports TV" },
  { id: "4", title: "Chiến thuật đôi nam: Stacking và Switching", duration: 1890, views: 4200, organizationName: "PB Academy" },
  { id: "5", title: "Giải Pickleball Toàn quốc 2024 - Highlights", duration: 956, views: 15600, organizationName: "VN Pickleball" },
  { id: "6", title: "Bí quyết luyện tập hiệu quả tại nhà", duration: 1120, views: 7800, organizationName: "PB Academy" },
];

const Videos = () => {
  const { t } = useI18n();

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-8">{t.nav.videos}</h1>

        <section className="mb-12">
          <SectionHeader title={t.home.sections.latestVideos} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {mockVideos.map((video) => (
              <ContentCard key={video.id} {...video} />
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default Videos;
