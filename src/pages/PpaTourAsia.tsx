import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { blogTeasers } from "@/content/blog/teasers";
import {
  eventPhase,
  formatEventDates,
  metaFromRow,
  type ProTourEventRow,
} from "@/content/pro-tour-events";

type ViBlogPost = {
  slug: string;
  title: string;
  published_at: string;
  alternate_en_slug: string | null;
};

type VietnamTournament = {
  slug: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

function articleKind(slug: string, tags: string[], vi: boolean) {
  if (slug.endsWith("-results") || tags.includes("results")) {
    return vi ? "Kết quả" : "Results";
  }
  if (slug.endsWith("-schedule") || tags.includes("schedule")) {
    return vi ? "Lịch thi đấu" : "Schedule";
  }
  if (slug.endsWith("-preview") || tags.includes("preview")) {
    return vi ? "Giới thiệu" : "Preview";
  }
  if (
    slug.endsWith("-recap") ||
    slug.endsWith("-post-analysis") ||
    tags.includes("recap") ||
    tags.includes("post-analysis")
  ) {
    return vi ? "Tổng kết & phân tích" : "Recap & analysis";
  }
  if (tags.includes("guide")) {
    return vi ? "Cẩm nang" : "Guide";
  }
  return vi ? "Bài viết" : "Article";
}

function phaseLabel(phase: string, vi: boolean) {
  if (phase === "upcoming") return vi ? "Sắp diễn ra" : "Upcoming";
  if (phase === "live") return vi ? "Đang diễn ra" : "Live";
  return vi ? "Đã kết thúc" : "Finished";
}

function dateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  return start ?? end ?? "";
}

export default function PpaTourAsia() {
  const { language } = useI18n();
  const vi = language === "vi";

  const metadataPosts = blogTeasers
    .filter((post) => post.tags.includes("ppa tour asia"))
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

  const { data: viPosts, isLoading: viPostsLoading } = useQuery<ViBlogPost[]>({
    queryKey: ["ppa-tour-asia-vi-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vi_blog_posts")
        .select("slug, title, published_at, alternate_en_slug")
        .eq("status", "published")
        .contains("tags", ["ppa tour asia"])
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) {
        console.error("PpaTourAsia: Vietnamese articles fetch error", error);
        return [];
      }
      return (data as ViBlogPost[]) ?? [];
    },
    enabled: vi,
    staleTime: 60_000,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<ProTourEventRow[]>({
    queryKey: ["ppa-tour-asia-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_tour_events")
        .select("*")
        .eq("tour", "PPA Tour Asia")
        .order("start_date", { ascending: false });
      if (error) {
        console.error("PpaTourAsia: events fetch error", error);
        return [];
      }
      return (data as ProTourEventRow[]) ?? [];
    },
    staleTime: 60_000,
  });

  const { data: tournaments, isLoading: tournamentsLoading } = useQuery<VietnamTournament[]>({
    queryKey: ["ppa-tour-asia-vietnam-tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("slug, name, start_date, end_date")
        .like("slug", "d-joy%")
        .order("start_date", { ascending: false });
      if (error) {
        console.error("PpaTourAsia: Vietnam tournaments fetch error", error);
        return [];
      }
      return (data as VietnamTournament[]) ?? [];
    },
    staleTime: 60_000,
  });

  const metadataBySlug = new Map(metadataPosts.map((post) => [post.slug, post]));
  const articles =
    vi && (viPosts?.length ?? 0) > 0
      ? viPosts!.map((post) => {
          const twin = post.alternate_en_slug ? metadataBySlug.get(post.alternate_en_slug) : undefined;
          return {
            slug: post.slug,
            title: post.title,
            publishedDate: post.published_at.slice(0, 10),
            kind: articleKind(twin?.slug ?? post.slug, twin?.tags ?? [], true),
            href: `/vi/blog/${post.slug}`,
          };
        })
      : metadataPosts.map((post) => ({
          slug: post.slug,
          title: vi ? post.titleVi : post.titleEn,
          publishedDate: post.publishedDate,
          kind: articleKind(post.slug, post.tags, vi),
          href: `/blog/${post.slug}`,
        }));

  const isLoading =
    eventsLoading || tournamentsLoading || (vi && viPostsLoading);
  const eventRows = events ?? [];
  const tournamentRows = tournaments ?? [];
  const title = vi
    ? "PPA Tour Asia: kết quả, lịch thi đấu và tin tức"
    : "PPA Tour Asia results, schedule and coverage";
  const description = vi
    ? `Theo dõi ${eventRows.length} sự kiện PPA Tour Asia, ${articles.length} bài viết và ${tournamentRows.length} giải đấu tại Việt Nam.`
    : `Follow ${eventRows.length} PPA Tour Asia events, ${articles.length} articles and ${tournamentRows.length} Vietnam tournaments.`;

  return (
    <TheLineLayout
      title={`${title} | ThePickleHub`}
      description={description}
      active="live"
    >
      <div
        className="tl-shell"
        style={{ paddingBottom: 80, maxWidth: 1080, margin: "0 auto" }}
      >
        <p className="mb-3 text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            {vi ? "Trang chủ" : "Home"}
          </Link>
          {" / "}
          <span>PPA Tour Asia</span>
        </p>

        <header className="tl-page-head">
          <div className="kicker">◆ PPA Tour Asia</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {eventRows.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-4 text-xl font-semibold">
                  {vi ? "Sự kiện PPA Tour Asia" : "PPA Tour Asia events"}
                </h2>
                <div className="divide-y divide-border border-y border-border">
                  {eventRows.map((event) => {
                    const meta = metaFromRow(event);
                    const phase = eventPhase(meta);
                    const name = vi
                      ? meta.nameVi ?? meta.nameEn
                      : meta.nameEn ?? meta.nameVi;
                    return (
                      <div
                        key={event.slug}
                        className="grid gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                      >
                        <div>
                          <Link
                            to={`/live/pro/${event.slug}`}
                            className="font-medium hover:underline"
                          >
                            {name}
                          </Link>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatEventDates(meta, vi ? "vi" : "en")}
                            {event.city ? ` · ${event.city}` : ""}
                            {event.tier ? ` · ${event.tier}` : ""}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {phaseLabel(phase, vi)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {articles.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-4 text-xl font-semibold">
                  {vi ? "Tin tức và bài viết" : "News and articles"}
                </h2>
                <ul className="divide-y divide-border border-y border-border">
                  {articles.map((article) => (
                    <li
                      key={article.slug}
                      className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <Link
                        to={article.href}
                        className="min-w-0 flex-1 font-medium hover:underline"
                      >
                        {article.title}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {article.kind}
                      </span>
                      <time className="text-sm text-muted-foreground">
                        {article.publishedDate}
                      </time>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tournamentRows.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-4 text-xl font-semibold">
                  {vi ? "Giải đấu tại Việt Nam" : "Vietnam tournaments"}
                </h2>
                <div className="divide-y divide-border border-y border-border">
                  {tournamentRows.map((tournament) => {
                    const now = new Date().toISOString().slice(0, 10);
                    const phase =
                      tournament.start_date && tournament.start_date > now
                        ? "upcoming"
                        : tournament.end_date && tournament.end_date < now
                          ? "finished"
                          : "live";
                    return (
                      <div
                        key={tournament.slug}
                        className="grid gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6"
                      >
                        <Link
                          to={`/tournament/${tournament.slug}`}
                          className="font-medium hover:underline"
                        >
                          {tournament.name}
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          {dateRange(tournament.start_date, tournament.end_date)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {phaseLabel(phase, vi)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5 text-sm">
          <Link to="/live" className="text-muted-foreground hover:underline">
            {vi ? "Trực tiếp" : "Live scores"}
          </Link>
          <Link
            to="/rankings/ppa-tour"
            className="text-muted-foreground hover:underline"
          >
            {vi ? "Bảng xếp hạng PPA" : "PPA rankings"}
          </Link>
          <Link
            to={vi ? "/vi/blog" : "/blog"}
            className="text-muted-foreground hover:underline"
          >
            {vi ? "Tin tức" : "Blog"}
          </Link>
        </nav>
      </div>
    </TheLineLayout>
  );
}