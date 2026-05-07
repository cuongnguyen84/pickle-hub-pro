// ============================================================================
// MatchPage — Sprint 2 Phase 3B.1
// ----------------------------------------------------------------------------
// Public match permalink at /tran-dau/:slug. Logged-out viewable (RLS
// matches.is_public read policy). Logged-in participants see verify CTAs.
//
// SEO: client-side useEffect updates document.title + meta + injects
// JSON-LD SportsEvent. Server-side prerender for bot UA lives in
// functions/_lib/render/match.ts (CF Pages Functions middleware).
// ============================================================================

import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Loader2, ChevronLeft } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { useMatch } from "@/hooks/social";
import MatchHeader from "@/components/social/match/MatchHeader";
import MatchScoreboard from "@/components/social/match/MatchScoreboard";
import MatchVerifyBanner from "@/components/social/match/MatchVerifyBanner";
import MatchActions from "@/components/social/match/MatchActions";
import type { MatchDetail } from "@/hooks/social";

const SITE = "https://www.thepicklehub.net";

const fmtScoreCompact = (a: number[], b: number[]) =>
  a.map((s, i) => `${s}-${b[i] ?? 0}`).join(" ");

const fmtDateVN = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return iso; }
};

function buildSeo(match: MatchDetail) {
  const teamA = match.participants.filter((p) => p.team === "a");
  const teamB = match.participants.filter((p) => p.team === "b");
  const p1Name = teamA[0]?.display_name ?? teamA[0]?.username ?? "?";
  const p2Name = teamB[0]?.display_name ?? teamB[0]?.username ?? "?";
  const score = fmtScoreCompact(match.team_a_score, match.team_b_score);
  const date = fmtDateVN(match.played_at);
  const venue = match.venue_name ?? "";
  const title = `${p1Name} vs ${p2Name}, ${score} — ${venue}, ${date} | ThePickleHub`;
  const fmtLabel = match.format === "singles" ? "Đơn" : match.format === "mixed" ? "Đôi nam-nữ" : "Đôi";
  const description =
    `Trận pickleball ${fmtLabel} ngày ${date}${venue ? ` tại ${venue}` : ""}, kết quả ${score}.`;
  const winnerName =
    match.winning_team === "a" ? p1Name : p2Name;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${p1Name} vs ${p2Name}`,
    sport: "Pickleball",
    startDate: match.played_at,
    location: venue
      ? {
          "@type": "SportsActivityLocation",
          name: venue,
          address: match.venue_city ?? "",
        }
      : undefined,
    competitor: [
      { "@type": "Person", name: p1Name },
      { "@type": "Person", name: p2Name },
    ],
    winner: { "@type": "Person", name: winnerName },
  };
  return { title, description, jsonLd };
}

const JSONLD_ID = "match-jsonld";

function applyClientSeo(match: MatchDetail) {
  const { title, description, jsonLd } = buildSeo(match);
  const url = `${SITE}/tran-dau/${match.slug}`;
  document.title = title;

  const ensureMeta = (selector: string, attrs: Record<string, string>) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      for (const [k, v] of Object.entries(attrs)) {
        if (k !== "content") el.setAttribute(k, v);
      }
      document.head.appendChild(el);
    }
    if (attrs.content !== undefined) el.setAttribute("content", attrs.content);
  };

  ensureMeta('meta[name="description"]', { name: "description", content: description });
  ensureMeta('meta[property="og:title"]', { property: "og:title", content: title });
  ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
  ensureMeta('meta[property="og:url"]', { property: "og:url", content: url });
  ensureMeta('meta[property="og:type"]', { property: "og:type", content: "article" });
  // OG image — Phase 3B.3 og-image-match function (Cloudflare proxy at /og/match/{slug}.png)
  const ogImage = `${SITE}/og/match/${encodeURIComponent(match.slug)}.png`;
  ensureMeta('meta[property="og:image"]', { property: "og:image", content: ogImage });
  ensureMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "1200" });
  ensureMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "630" });
  ensureMeta('meta[property="og:image:type"]', { property: "og:image:type", content: "image/png" });
  ensureMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: ogImage });
  ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });

  // Canonical
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  // JSON-LD (replace existing if any)
  const existing = document.getElementById(JSONLD_ID);
  if (existing) existing.remove();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = JSONLD_ID;
  script.text = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}

const MatchPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: match, isLoading, error } = useMatch(slug);

  useEffect(() => {
    if (match) applyClientSeo(match);
    return () => {
      const existing = document.getElementById(JSONLD_ID);
      if (existing) existing.remove();
    };
  }, [match]);

  if (slug === "moi") {
    // Redirect to wizard route
    return <Navigate to="/tran-dau/moi" replace />;
  }

  if (isLoading) {
    return (
      <TheLineLayout title="Đang tải trận đấu" noindex>
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-social-primary" />
        </div>
      </TheLineLayout>
    );
  }

  if (error || !match) {
    return (
      <TheLineLayout
        title="Không tìm thấy trận đấu"
        description="Trận này có thể đã bị xóa hoặc URL không đúng."
        noindex
      >
        <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-bold">Không tìm thấy trận đấu</h1>
          <p className="text-sm text-muted-foreground">
            Trận này có thể đã bị xóa hoặc URL không đúng.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Về trang chủ</Link>
          </Button>
        </div>
      </TheLineLayout>
    );
  }

  // For the success branch we still want TheLineLayout's DynamicMeta to set
  // the canonical title + description before JS hydration finishes; the
  // post-mount applyClientSeo() useEffect then refines OG image / canonical /
  // JSON-LD with match-specific values that DynamicMeta doesn't cover.
  const seo = buildSeo(match);
  // buildSeo's title already ends with " | ThePickleHub"; DynamicMeta would
  // append the same suffix, doubling it. Strip before passing.
  const titleNoSuffix = seo.title.replace(/ \| ThePickleHub$/, "");

  return (
    <TheLineLayout title={titleNoSuffix} description={seo.description}>
      <div className="bg-social-bg-elevated dark:bg-social-neutral-900">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 md:py-8">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
              <Link to="/">
                <ChevronLeft className="h-4 w-4" />
                Trang chủ
              </Link>
            </Button>
          </div>
          <MatchHeader match={match} />
          <MatchScoreboard match={match} />
          <MatchVerifyBanner match={match} />
          <MatchActions match={match} />
          {match.notes && (
            <div className="rounded-xl border bg-card p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Ghi chú
              </div>
              <p className="whitespace-pre-wrap">{match.notes}</p>
            </div>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default MatchPage;
