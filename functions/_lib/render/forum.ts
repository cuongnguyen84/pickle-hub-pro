/**
 * SSR render handlers — forum list, category, and post pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  buildTitle,
  buildMetaDescription,
  breadcrumb,
  bilingualHreflang,
  singleCanonicalHreflang,
  buildBreadcrumbJsonLd,
  type Lang,
} from "../utils";
import { buildListJsonLd } from "./shared";
import { render404 } from "./static-pages";

export async function renderForum(supabase: SupabaseClient, siteUrl: string, rawPath = "/forum", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: posts } = await supabase.from("forum_posts").select("id, title").eq("is_hidden", false).order("created_at", { ascending: false }).limit(20);
  const items = (posts || []).map((p) => `<li><a href="${siteUrl}/forum/post/${p.id}">${escapeHtml(p.title)}</a></li>`).join("");
  const listItems = (posts || []).map((p) => ({
    url: `${siteUrl}/forum/post/${p.id}`,
    name: p.title,
  }));

  const title = lang === "en"
    ? "Pickleball Forum — Vietnam Community | ThePickleHub"
    : "Diễn đàn Pickleball | ThePickleHub";
  const description = lang === "en"
    ? "The largest Vietnam pickleball forum: technique discussions, gear reviews, finding courts, and connecting with players. Join the ThePickleHub community."
    : "Diễn đàn pickleball Việt Nam lớn nhất - thảo luận kỹ thuật, review thiết bị, tìm sân chơi, kết nối VĐV. Tham gia cộng đồng pickleball ThePickleHub.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/forum`, `${siteUrl}/vi/forum`),
    jsonLd: buildListJsonLd(title, listItems),
    bodyContent: items ? `<h2>${lang === "en" ? "Recent posts" : "Bài viết mới"}</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

// SEO-1.3 (2026-05-28) — bots used to hit /forum/:categorySlug and
// fall through to render404. Now we render a real category page with
// the latest 20 posts so bots can index the category hub and crawl
// into individual /forum/post/:id threads. Single-canonical: same URL
// serves both locales (SPA toggles via i18n context).
export async function renderForumCategory(
  supabase: SupabaseClient,
  categorySlug: string,
  siteUrl: string,
  lang: Lang = "en",
): Promise<Response> {
  const { data: cat } = await supabase
    .from("forum_categories")
    .select("id, name, name_en, slug, description")
    .eq("slug", categorySlug)
    .single();

  if (!cat) return render404(`/forum/${categorySlug}`, siteUrl);

  const catName = lang === "en" && cat.name_en ? cat.name_en : cat.name;
  const title = buildTitle(catName, " | Pickleball Forum | ThePickleHub");
  const desc = buildMetaDescription(cat.description, {
    type: "forum-post",
    title: catName,
  });

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id, title, created_at")
    .eq("category_id", cat.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

  const pageUrl = `${siteUrl}/forum/${categorySlug}`;
  const items = (posts || [])
    .map(
      (p: { id: string; title: string }) =>
        `<li><a href="${siteUrl}/forum/post/${escapeHtml(p.id)}">${escapeHtml(p.title)}</a></li>`,
    )
    .join("");

  const crumbs = [
    { label: lang === "en" ? "Home" : "Trang chủ", href: siteUrl },
    { label: lang === "en" ? "Forum" : "Diễn đàn", href: `${siteUrl}/forum` },
    { label: catName },
  ];
  const bc = breadcrumb(crumbs);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: pageUrl,
    siteUrl,
    extraMeta: singleCanonicalHreflang(pageUrl, "vi"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ItemList",
          name: catName,
          numberOfItems: posts?.length ?? 0,
          itemListOrder: "https://schema.org/ItemListOrderDescending",
          itemListElement: (posts || []).map(
            (p: { id: string; title: string }, idx: number) => ({
              "@type": "ListItem",
              position: idx + 1,
              url: `${siteUrl}/forum/post/${p.id}`,
              name: p.title,
            }),
          ),
        },
        buildBreadcrumbJsonLd(crumbs),
      ],
    },
    bodyContent: `${bc}<h2>${escapeHtml(catName)}</h2>${
      items
        ? `<ul>${items}</ul>`
        : `<p>${lang === "en" ? "No posts in this category yet." : "Chưa có bài viết trong chuyên mục này."}</p>`
    }`,
    lang,
  }));
}

export async function renderForumPost(supabase: SupabaseClient, postId: string, siteUrl: string): Promise<Response> {
  const { data: post } = await supabase.from("forum_posts").select("id, title, content").eq("id", postId).eq("is_hidden", false).single();

  if (!post) return render404(`/forum/post/${postId}`, siteUrl);

  const rawDesc = (post.content || "").replace(/<[^>]*>/g, "").slice(0, 200);
  const desc = buildMetaDescription(rawDesc, { type: "forum-post", title: post.title });
  const title = buildTitle(post.title, "");

  const crumbs = [
    { label: "Trang chủ", href: siteUrl },
    { label: "Diễn đàn", href: `${siteUrl}/forum` },
    { label: post.title.length > 40 ? post.title.slice(0, 40) + "\u2026" : post.title },
  ];
  const bc = breadcrumb(crumbs);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/forum/post/${postId}`,
    siteUrl,
    lang: "vi",
    // SEO-1.2 — single-canonical hreflang triplet
    extraMeta: singleCanonicalHreflang(`${siteUrl}/forum/post/${postId}`, "vi"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "DiscussionForumPosting", headline: title, text: desc, url: `${siteUrl}/forum/post/${postId}` },
        buildBreadcrumbJsonLd(crumbs),
      ],
    },
    bodyContent: `${bc}<section><h2>Xem thêm</h2><ul><li><a href="${siteUrl}/forum">Quay lại diễn đàn</a></li><li><a href="${siteUrl}/blog">Đọc blog pickleball</a></li></ul></section>`,
  }));
}
