import { MainLayout } from "@/components/layout";
import { LiveCard, SectionHeader, EmptyState } from "@/components/content";
import { useI18n } from "@/i18n";
import { Radio } from "lucide-react";

const mockLivestreams = [
  { id: "1", title: "Vietnam Pickleball Open 2024 - Chung kết nam đơn", viewerCount: 1234, organizationName: "VN Pickleball", status: "live" as const },
  { id: "2", title: "Giải Pickleball Hà Nội mở rộng - Bán kết", viewerCount: 856, organizationName: "Hanoi PB Club", status: "live" as const },
  { id: "3", title: "Giải đấu Đà Nẵng Open", scheduledAt: "20:00 hôm nay", organizationName: "DN Sports", status: "scheduled" as const },
];

const Live = () => {
  const { t } = useI18n();

  const liveNow = mockLivestreams.filter((s) => s.status === "live");
  const scheduled = mockLivestreams.filter((s) => s.status === "scheduled");

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-8">{t.nav.live}</h1>

        <section className="mb-12">
          <SectionHeader title={t.home.sections.liveNow} />
          {liveNow.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveNow.map((stream) => (
                <LiveCard key={stream.id} {...stream} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Radio} title={t.home.noLive} />
          )}
        </section>

        {scheduled.length > 0 && (
          <section>
            <SectionHeader title={t.live.scheduled} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {scheduled.map((stream) => (
                <LiveCard key={stream.id} {...stream} />
              ))}
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
};

export default Live;
