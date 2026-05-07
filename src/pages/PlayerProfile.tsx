import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { usePlayerProfile } from "@/hooks/social/usePlayerProfile";
import { usePlayerStats } from "@/hooks/social/usePlayerStats";
import { usePlayerMatchHistory } from "@/hooks/social/usePlayerMatchHistory";
import { useDuprRatingHistory } from "@/hooks/social/useDuprRatingHistory";
import { PlayerHeroCard } from "@/components/social/player/PlayerHeroCard";
import { PlayerStats } from "@/components/social/player/PlayerStats";
import { DuprRatingChart } from "@/components/social/player/DuprRatingChart";
import { MatchHistoryTabs } from "@/components/social/player/MatchHistoryTabs";

const JSONLD_ID = "player-profile-jsonld";

const PlayerProfile = () => {
  const { username } = useParams<{ username: string }>();
  const profileQuery = usePlayerProfile(username);
  const statsQuery = usePlayerStats(username);
  const matchesQuery = usePlayerMatchHistory(profileQuery.data?.id);
  const historyQuery = useDuprRatingHistory(profileQuery.data?.id);

  // ─── JSON-LD Person schema ───────────────────────────────────────────────
  // Inserted via DOM (matches MatchPage pattern) so bot prerender + view-
  // source see the structured data without needing react-helmet-async.
  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;

    const existing = document.getElementById(JSONLD_ID);
    if (existing) existing.remove();

    const url = `https://www.thepicklehub.net/nguoi-choi/${profile.username}`;
    const props: Array<{ "@type": "PropertyValue"; name: string; value: number }> = [];
    if (profile.dupr_doubles != null) {
      props.push({
        "@type": "PropertyValue",
        name: "DUPR Doubles Rating",
        value: profile.dupr_doubles,
      });
    }
    if (profile.dupr_singles != null) {
      props.push({
        "@type": "PropertyValue",
        name: "DUPR Singles Rating",
        value: profile.dupr_singles,
      });
    }

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: profile.display_name ?? profile.username,
      alternateName: profile.username,
      url,
      knowsAbout: "Pickleball",
    };
    if (profile.avatar_url) jsonLd.image = profile.avatar_url;
    if (profile.city) {
      jsonLd.address = {
        "@type": "PostalAddress",
        addressLocality: profile.city,
        addressCountry: profile.country ?? "VN",
      };
    }
    if (props.length > 0) jsonLd.additionalProperty = props;

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = JSONLD_ID;
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById(JSONLD_ID);
      if (el) el.remove();
    };
  }, [profileQuery.data]);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (profileQuery.isLoading) {
    return (
      <TheLineLayout title="Đang tải hồ sơ" noindex>
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </TheLineLayout>
    );
  }

  // ─── 404: missing or ghost ───────────────────────────────────────────────
  const profile = profileQuery.data;
  if (!profile) {
    return (
      <TheLineLayout
        title="Không tìm thấy người chơi"
        description="Hồ sơ người chơi không tồn tại trên ThePickleHub."
        noindex
      >
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">Không tìm thấy người chơi</h1>
          <p className="text-sm text-muted-foreground">
            Username "{username}" chưa có ai dùng, hoặc hồ sơ đã bị ẩn.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Về trang chủ</Link>
          </Button>
        </div>
      </TheLineLayout>
    );
  }

  const heroDescription = buildMetaDescription(profile, statsQuery.data);
  const pageTitle = profile.dupr_doubles
    ? `${profile.display_name ?? profile.username} (@${profile.username}) — DUPR ${profile.dupr_doubles}`
    : `${profile.display_name ?? profile.username} (@${profile.username})`;

  return (
    <TheLineLayout title={pageTitle} description={heroDescription}>
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <PlayerHeroCard player={profile} />
        <PlayerStats stats={statsQuery.data} loading={statsQuery.isLoading} />
        <DuprRatingChart
          history={historyQuery.data ?? []}
          loading={historyQuery.isLoading}
        />
        <MatchHistoryTabs
          playerId={profile.id}
          followersCount={statsQuery.data?.followers_count ?? 0}
          followingCount={statsQuery.data?.following_count ?? 0}
          matchesQuery={matchesQuery}
        />
      </div>
    </TheLineLayout>
  );
};

function buildMetaDescription(
  profile: { display_name: string | null; username: string; city: string | null; dupr_doubles: number | null },
  stats: { wins?: number; losses?: number } | null | undefined,
): string {
  const name = profile.display_name ?? profile.username;
  const where = profile.city ? `tại ${profile.city}` : "";
  const rating = profile.dupr_doubles
    ? ` với DUPR ${profile.dupr_doubles}`
    : "";
  const record =
    stats && (stats.wins || stats.losses)
      ? ` ${stats.wins ?? 0}W-${stats.losses ?? 0}L trên ThePickleHub.`
      : "";
  return `${name} là pickleball player${where ? ` ${where}` : ""}${rating}.${record}`.trim();
}

export default PlayerProfile;
