/**
 * Bot prerender for /ppa-tour-asia and its Vietnamese counterpart.
 */

import { blogMetadata } from "../../../src/content/blog/metadata";
import {
  eventPhase,
  formatEventDates,
  metaFromRow,
  type ProTourEventRow,
} from "../../../src/content/pro-tour-events";
import { buildHtml, htmlResponse } from "../html";
import type { SupabaseClient } from "../supabase";
import { breadcrumb, escapeHtml, type Lang } from "../utils";

const PPA_TAG = "ppa tour asia";

const kindLabels = {
  results: { en: "Results", vi: "Kết quả" },
  schedule: { en: "Schedule", vi: "Lịch thi đấu" },
  preview: { en: "Preview", vi: "Giới thiệu" },
  recap: { en: "Recap/Analysis", vi: "Tổng kết & phân tích" },
  guide: { en: "Guide", vi: "Cẩm nang" },
  article: { en: "Article", vi: "Bài viết" },
};

const statusLabels = {
  upcoming: { en: "Upcoming", vi: "Sắp diễn ra" },
  live: { en: "Live", vi: "Đang diễn ra" },
  finished: { en: "Finished", vi: "Đã kết thúc" },
};

type CoveragePost = {
  title: string;
  href: string;
  date: string;
  kind: keyof typeof kindLabels;
};

type VietnamesePostRow = {
  slug: string;
  title: string;
  published_at: string;
  alternate_en_slug: string | null;
};

type VietnamTournamentRow = {
  slug: string;
  name: string;
  start_date: string;
  end_date: string | null;
};

function postKind(slug: string, tags: readonly string[]): CoveragePost["kind"] {
  if (slug.endsWith("-results") || tags.includes("results")) return "results";
  if (slug.endsWith("-schedule")) return "schedule";
  if (slug.endsWith("-preview")) return "preview";
  if (slug.endsWith("-recap") || slug.endsWith("-post-analysis")) return "recap";
  if (tags.includes("guide")) return "guide";
  return "article";
}

async function queryRows<Row>(
  table: string,
  query: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Row[] | null> {
  try {
    const { data, error } = await query();
    if (error) throw error;
    return (data as Row[] | null) ?? [];
  } catch (error) {
    console.error(`Failed to load ${table} for the PPA Tour Asia hub`, error);
    return null;
  }
}

function todayInVietnam(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export async function renderPpaAsiaHub(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
): Promise<Response> {
  const vi = lang === "vi";
  const locale = vi ? "vi" : "en";
  const origin = siteUrl.replace(/\/+$/, "");
  const enUrl = `${origin}/ppa-tour-asia`;
  const viUrl = `${origin}/vi/ppa-tour-asia`;
  const homePath = vi ? "/vi" : "/";
  const homeLabel = vi ? "Trang chủ" : "Home";
  const hubLabel = "PPA Tour Asia";

  const [eventRows, vietnameseRows, tournamentRows] = await Promise.all([
    queryRows<ProTourEventRow>("pro_tour_events", () =>
      supabase
        .from("pro_tour_events")
        .select("*")
        .eq("tour", "PPA Tour Asia")
        .order("start_date", { ascending: false }),
    ),
    vi
      ? queryRows<VietnamesePostRow>("vi_blog_posts", () =>
          supabase
            .from("vi_blog_posts")
            .select("slug, title, published_at, alternate_en_slug")
            .eq("status", "published")
            .contains("tags", [PPA_TAG])
            .order("published_at", { ascending: false })
            .limit(30),
        )
      : null,
    queryRows<VietnamTournamentRow>("tournaments", () =>
      supabase
        .from("tournaments")
        .select("slug, name, start_date, end_date")
        .like("slug", "d-joy%")
        .order("start_date", { ascending: false }),
    ),
  ]);

  const events = (eventRows ?? []).map((row) => metaFromRow(row));
  const metadataPosts = blogMetadata
    .filter((post) => post.tags.includes(PPA_TAG))
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

  let posts: CoveragePost[];
  if (vietnameseRows !== null) {
    const metadataBySlug = new Map(blogMetadata.map((post) => [post.slug, post] as const));
    posts = vietnameseRows.map((row) => {
      const original = metadataBySlug.get(row.alternate_en_slug ?? row.slug);
      return {
        title: row.title,
        href: `/vi/blog/${row.slug}`,
        date: row.published_at.slice(0, 10),
        kind: postKind(original?.slug ?? row.slug, original?.tags ?? []),
      };
    });
  } else {
    posts = metadataPosts.map((post) => ({
      title: vi ? post.titleVi : post.titleEn,
      href: `/blog/${post.slug}`,
      date: post.publishedDate,
      kind: postKind(post.slug, post.tags),
    }));
  }

  const eventCount = events.length;
  const articleCount = posts.length;
  const eventNoun = eventCount === 1 ? "event" : "events";
  const articleNoun = articleCount === 1 ? "article" : "articles";
  const title = vi
    ? "Kết quả PPA Tour Asia | ThePickleHub"
    : "PPA Tour Asia Results & Coverage | ThePickleHub";
  const description = vi
    ? `Theo dõi PPA Tour Asia với ${eventCount} chặng đấu và ${articleCount} bài viết về kết quả, lịch thi đấu và phân tích.`
    : `Follow PPA Tour Asia with ${eventCount} ${eventNoun} and ${articleCount} ${articleNoun} covering results, schedules and analysis.`;
  const intro = vi
    ? `Trang tổng hợp giải pickleball PPA Tour Asia liệt kê ${eventCount} chặng đấu và ${articleCount} bài viết về kết quả, lịch thi đấu và phân tích.`
    : `This hub lists ${eventCount} ${eventNoun} on the PPA Tour Asia pickleball circuit and ${articleCount} ${articleNoun} covering results, schedules and analysis.`;

  const eventTable = events.length
    ? `<table>
<thead>
<tr>
<th scope="col">${vi ? "Chặng đấu" : "Event"}</th>
<th scope="col">${vi ? "Thời gian" : "Dates"}</th>
<th scope="col">${vi ? "Thành phố" : "City"}</th>
<th scope="col">${vi ? "Cấp giải" : "Tier"}</th>
<th scope="col">${vi ? "Trạng thái" : "Status"}</th>
</tr>
</thead>
<tbody>
${events
  .map((event) => {
    const href = `${vi ? "/vi" : ""}/live/pro/${event.slug}`;
    return `<tr>
<th scope="row"><a href="${escapeHtml(href)}">${escapeHtml(vi ? event.nameVi : event.nameEn)}</a></th>
<td>${escapeHtml(formatEventDates(event, locale))}</td>
<td>${escapeHtml(event.city)}</td>
<td>${escapeHtml(event.tier)}</td>
<td>${statusLabels[eventPhase(event)][locale]}</td>
</tr>`;
  })
  .join("\n")}
</tbody>
</table>`
    : `<p>${vi ? "Hiện chưa có chặng đấu nào được liệt kê." : "No events are currently listed."}</p>`;

  const coverageList = posts.length
    ? `<ul>
${posts
  .map(
    (post) =>
      `<li><a href="${escapeHtml(post.href)}">${escapeHtml(post.title)}</a> · ${escapeHtml(kindLabels[post.kind][locale])} · <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time></li>`,
  )
  .join("\n")}
</ul>`
    : `<p>${vi ? "Hiện chưa có bài viết nào được liệt kê." : "No articles are currently listed."}</p>`;

  const today = todayInVietnam();
  const tournamentItems = (tournamentRows ?? []).map((tournament) => {
    const start = tournament.start_date;
    const end = tournament.end_date ?? start;
    const status = today < start ? "upcoming" : today > end ? "finished" : "live";
    const dates = start === end ? start : `${start} - ${end}`;
    const href = `/tournament/${tournament.slug}`;

    return `<li><a href="${escapeHtml(href)}">${escapeHtml(tournament.name)}</a> · ${escapeHtml(dates)} · ${statusLabels[status][locale]}</li>`;
  });

  const bodyContent = `<article>
${breadcrumb([{ label: homeLabel, href: homePath }, { label: hubLabel }])}
<h1>${vi ? "PPA Tour Asia: kết quả, lịch thi đấu và tin tức" : "PPA Tour Asia results, schedule and coverage"}</h1>
<p>${escapeHtml(intro)}</p>
<section>
<h2>${vi ? "Các chặng đấu" : "Events"}</h2>
${eventTable}
</section>
<section>
<h2>${vi ? "Kết quả và bài viết" : "Results and coverage"}</h2>
${coverageList}
</section>
<section>
<h2>${vi ? "Giải đấu tại Việt Nam" : "Tournaments in Vietnam"}</h2>
${
  tournamentItems.length
    ? `<ul>\n${tournamentItems.join("\n")}\n</ul>`
    : `<p>${vi ? "Hiện chưa có giải đấu nào được liệt kê." : "No tournaments are currently listed."}</p>`
}
<p><a href="/tournaments">${vi ? "Xem tất cả giải đấu" : "Browse all tournaments"}</a></p>
</section>
<section>
<h2>${vi ? "Xem thêm" : "More"}</h2>
<ul>
<li><a href="/live">${vi ? "Tỉ số trực tiếp" : "Live scores"}</a></li>
<li><a href="/rankings/ppa-tour">${vi ? "Bảng xếp hạng PPA" : "PPA rankings"}</a></li>
<li><a href="${vi ? "/vi/blog" : "/blog"}">${vi ? "Bài viết" : "Blog"}</a></li>
</ul>
</section>
</article>`;

  const url = vi ? viUrl : enUrl;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        itemListElement: posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${origin}${post.href}`,
          name: post.title,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: homeLabel,
            item: `${origin}${homePath}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: hubLabel,
            item: url,
          },
        ],
      },
    ],
  };

  const html = buildHtml({
    title,
    description,
    url,
    siteUrl: origin,
    lang,
    alternates: [
      { hreflang: "en", href: enUrl },
      { hreflang: "vi", href: viUrl },
      { hreflang: "x-default", href: enUrl },
    ],
    type: "website",
    omitAutoHeader: true,
    bodyContent,
    jsonLd,
  });

  return htmlResponse(html);
}