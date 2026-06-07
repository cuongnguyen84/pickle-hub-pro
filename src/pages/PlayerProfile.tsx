import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import { usePlayerProfile } from "@/hooks/social/usePlayerProfile";
import { usePlayerStats } from "@/hooks/social/usePlayerStats";
import { usePlayerMatchHistory } from "@/hooks/social/usePlayerMatchHistory";
import { useDuprRatingHistory } from "@/hooks/social/useDuprRatingHistory";
import { PlayerHeroCard } from "@/components/social/player/PlayerHeroCard";
import { PlayerStats } from "@/components/social/player/PlayerStats";
import { DuprRatingChart } from "@/components/social/player/DuprRatingChart";
import { MatchHistoryTabs } from "@/components/social/player/MatchHistoryTabs";
import { PlayersNearRating } from "@/components/social/PlayersNearRating";

const JSONLD_ID = "player-profile-jsonld";

const PlayerProfile = () => {
  const { language } = useI18n();
  const { username: slugFromUrl } = useParams<{ username: string }>();
  // PR79 Phase 2F follow-up — the URL param is a SLUG that can be
  // either the human-readable username OR the 8-/12-char hex
  // profile_slug. usePlayerProfile resolves both shapes; downstream
  // hooks (usePlayerStats RPC + the JSON-LD URL) need the canonical
  // username, so we read it back off the resolved profile row.
  const profileQuery = usePlayerProfile(slugFromUrl);
  const resolvedUsername = profileQuery.data?.username ?? null;
  const statsQuery = usePlayerStats(resolvedUsername ?? undefined);
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
      <TheLineLayout
        title={language === "vi" ? "Đang tải hồ sơ" : "Loading profile"}
        noindex
      >
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
    const notFoundTitle =
      language === "vi" ? "Không tìm thấy người chơi" : "Player not found";
    const notFoundDesc =
      language === "vi"
        ? "Hồ sơ người chơi không tồn tại trên ThePickleHub."
        : "Player profile does not exist on ThePickleHub.";
    return (
      <TheLineLayout title={notFoundTitle} description={notFoundDesc} noindex>
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">{notFoundTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {language === "vi"
              ? `Username "${slugFromUrl}" chưa có ai dùng, hoặc hồ sơ đã bị ẩn.`
              : `Username "${slugFromUrl}" isn't claimed yet, or the profile is hidden.`}
          </p>
          <Button asChild variant="outline">
            <Link to="/">
              {language === "vi" ? "Về trang chủ" : "Back home"}
            </Link>
          </Button>
        </div>
      </TheLineLayout>
    );
  }

  const heroDescription = buildMetaDescription(profile, statsQuery.data, language);
  const pageTitle = profile.dupr_doubles
    ? `${profile.display_name ?? profile.username} (@${profile.username}) — DUPR ${profile.dupr_doubles}`
    : `${profile.display_name ?? profile.username} (@${profile.username})`;

  return (
    <TheLineLayout title={pageTitle} description={heroDescription}>
      <div className="tl-shell" style={{ paddingBottom: 56 }}>
        <nav className="tl-breadcrumb">
          <Link to="/">{language === "vi" ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">@{profile.username}</span>
        </nav>
        <PlayerHeroCard player={profile} stats={statsQuery.data} />
        <PlayerStats stats={statsQuery.data} loading={statsQuery.isLoading} />
        <DuprRatingChart
          history={historyQuery.data ?? []}
          loading={historyQuery.isLoading}
        />
        {/* Sprint A12 — "Players near my rating" appears between chart and
            match history. Hidden automatically when profile has no DUPR. */}
        <div style={{ marginTop: 24 }}>
          <PlayersNearRating
            targetRating={profile.dupr_doubles}
            excludeUserId={profile.id}
            window={0.3}
            limit={8}
          />
        </div>
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
  language: "vi" | "en",
): string {
  const name = profile.display_name ?? profile.username;
  const recordText =
    stats && (stats.wins || stats.losses)
      ? ` ${stats.wins ?? 0}W-${stats.losses ?? 0}L`
      : "";
  if (language === "vi") {
    const where = profile.city ? ` tại ${profile.city}` : "";
    const rating = profile.dupr_doubles ? ` với DUPR ${profile.dupr_doubles}` : "";
    const trail = recordText ? `${recordText} trên ThePickleHub.` : "";
    return `${name} là pickleball player${where}${rating}.${trail}`.trim();
  }
  const where = profile.city ? ` based in ${profile.city}` : "";
  const rating = profile.dupr_doubles ? ` with a DUPR of ${profile.dupr_doubles}` : "";
  const trail = recordText ? `${recordText} on ThePickleHub.` : "";
  return `${name} is a pickleball player${where}${rating}.${trail}`.trim();
}

export default PlayerProfile;
