import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ViBlogPost {
  id: string;
  slug: string;
  title: string;
  meta_title: string;
  meta_description: string;
  excerpt: string | null;
  content_html: string;
  cover_image_url: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[] | null;
  focus_keyword: string | null;
  faq_items: FaqItem[] | null;
  related_post_slugs: string[] | null;
  alternate_en_slug: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export type ViBlogPostInsert = Omit<ViBlogPost, "id" | "created_at" | "updated_at">;
export type ViBlogPostUpdate = Partial<ViBlogPostInsert> & { id: string };

// Use REST API directly for non-typed table
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function viBlogFetch<T>(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    single?: boolean;
    publicRequest?: boolean;
  } = {},
): Promise<T> {
  // Published blog reads are public under RLS. Do not wait for Supabase Auth
  // to restore localStorage before starting a cold article request: that adds
  // an avoidable dependency ahead of the hero image/LCP. Admin mutations and
  // private reads retain the session-aware path.
  const session = options.publicRequest
    ? null
    : (await supabase.auth.getSession()).data.session;
  const authHeader = session?.access_token
    ? `Bearer ${session.access_token}`
    : `Bearer ${SUPABASE_KEY}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/vi_blog_posts${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(options.single ? { Accept: "application/vnd.pgrst.object+json" } : {}),
      ...(options.method === "POST" ? { Prefer: "return=representation" } : {}),
      ...(options.method === "PATCH" ? { Prefer: "return=representation" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || res.statusText);
  }

  if (options.method === "DELETE") return undefined as T;
  return res.json();
}

export function usePublishedViBlogPosts() {
  return useQuery({
    queryKey: ["vi-blog-posts", "published"],
    queryFn: () =>
      viBlogFetch<Pick<ViBlogPost, "id" | "slug" | "title" | "excerpt" | "cover_image_url" | "category" | "published_at" | "updated_at" | "tags">[]>(
        // updated_at rides along so listings can order by the later of the two
        // dates (see lib/blogOrder). The server order stays published_at so the
        // payload is deterministic; the effective-date sort happens client-side.
        "?select=id,slug,title,excerpt,cover_image_url,category,published_at,updated_at,tags&status=eq.published&order=published_at.desc",
      ),
    staleTime: 5 * 60 * 1000,
  });
}

// Every slug in vi_blog_posts is machine-generated from this class (verified
// 2026-07-27: 55/55 published rows match). Anything else came from a hand-typed
// or crafted URL and cannot name a real post, so refuse it before it reaches
// the query string rather than trying to neutralise it.
//
// This matters specifically because the lookup below uses PostgREST's `or=`
// grammar, where `,` and `()` are syntax. encodeURIComponent() does NOT escape
// parentheses — verified: encodeURIComponent("a)bad(x") === "a)bad(x" — so
// interpolating a raw path segment would let a visitor reshape the filter.
// escapePostgrestSearch() exists for the ilike-search call sites; for an
// exact-match key a closed character class is the stricter, simpler guard.
export const VI_SLUG_PATTERN = /^[a-z0-9-]+$/;

// A cold /vi/blog/:slug navigation causes App.tsx to request the route chunk
// before React mounts. ViBlogPost calls the preloader at module evaluation,
// so this one-shot promise starts the public CMS request while the remaining
// application modules are still evaluating. React Query consumes exactly the
// same promise on first render; subsequent refetches remain real network
// requests and keep React Query's normal freshness semantics.
const viBlogPreloads = new Map<string, Promise<ViBlogPost | null>>();

function requestPublishedViBlogPost(slug: string): Promise<ViBlogPost | null> {
  return viBlogFetch<ViBlogPost[]>(
    `?or=(slug.eq.${slug},alternate_en_slug.eq.${slug})&status=eq.published&limit=1`,
    { publicRequest: true },
  ).then((rows) => rows[0] ?? null);
}

export function preloadViBlogPostBySlug(slug: string | undefined): void {
  if (!slug || !VI_SLUG_PATTERN.test(slug) || viBlogPreloads.has(slug)) return;
  const request = requestPublishedViBlogPost(slug);
  viBlogPreloads.set(slug, request);
  // Register a rejection handler immediately: module-level preloading is
  // intentionally fire-and-forget, so a transient offline error must not
  // become an unhandled rejection before React Query mounts. Removing the
  // failed seed lets the hook perform its normal retry request.
  void request.catch(() => {
    if (viBlogPreloads.get(slug) === request) viBlogPreloads.delete(slug);
  });
}

export function fetchPublishedViBlogPostBySlug(slug: string): Promise<ViBlogPost | null> {
  const preload = viBlogPreloads.get(slug);
  if (preload) {
    viBlogPreloads.delete(slug);
    return preload;
  }
  return requestPublishedViBlogPost(slug);
}

export function useViBlogPostBySlug(slug: string | undefined) {
  const isWellFormed = !!slug && VI_SLUG_PATTERN.test(slug);
  return useQuery({
    queryKey: ["vi-blog-post", slug],
    // C1 (2026-07-27) — also match on alternate_en_slug so /vi/blog/<EN-slug>
    // resolves to the Vietnamese translation instead of dead-ending. Index.tsx
    // builds VI story hrefs from the EN metadata slug, so every homepage card
    // on /vi hit this path and rendered "Bài viết này không tồn tại".
    // ViBlogPost redirects to the canonical VI URL when the match came from
    // alternate_en_slug.
    //
    // `or=` yields at most one row: alternate_en_slug values are EN slugs, and
    // 0 of 53 published VI slugs collide with an EN slug (verified 2026-07-27),
    // so the two sides of the OR are disjoint.
    //
    // Returns an ARRAY, not `single: true`. With the pgrst.object+json Accept
    // header PostgREST answers 406 PGRST116 "The result contains 0 rows" for a
    // slug that does not exist (verified against prod), which viBlogFetch turns
    // into a thrown Error. That made a missing article indistinguishable from a
    // dead network — and once ViBlogPost started routing `error` to ErrorState,
    // a nonexistent post rendered "Lỗi kết nối — Thử lại", telling the reader
    // to retry a URL that can never work.
    //
    // Without the header the same query is a plain 200 `[]`, so absence is data
    // and only a real transport failure throws. Each branch now says the true
    // thing. Pinned by tests/human-path.spec.ts.
    queryFn: () => fetchPublishedViBlogPostBySlug(slug!),
    // Disabled for a malformed slug: react-query v5 reports isFetching false,
    // so ViBlogPost skips the skeleton and renders "không tìm thấy" — which is
    // the truthful answer for a slug that cannot exist.
    enabled: isWellFormed,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminViBlogPosts() {
  return useQuery({
    queryKey: ["vi-blog-posts", "admin"],
    queryFn: () =>
      viBlogFetch<ViBlogPost[]>("?select=*&order=updated_at.desc"),
  });
}

export function useAdminViBlogPostById(id: string | undefined) {
  return useQuery({
    queryKey: ["vi-blog-post", "admin", id],
    queryFn: () =>
      viBlogFetch<ViBlogPost>(`?id=eq.${encodeURIComponent(id!)}`, { single: true }),
    enabled: !!id,
  });
}

export function useCreateViBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: ViBlogPostInsert) =>
      viBlogFetch<ViBlogPost[]>("", { method: "POST", body: post }).then((arr) => arr[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vi-blog-posts"] });
    },
  });
}

export function useUpdateViBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: ViBlogPostUpdate) =>
      viBlogFetch<ViBlogPost[]>(`?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: updates,
      }).then((arr) => arr[0]),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vi-blog-posts"] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["vi-blog-post", data.slug] });
        queryClient.invalidateQueries({ queryKey: ["vi-blog-post", "admin", data.id] });
      }
    },
  });
}

export function useDeleteViBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      viBlogFetch<void>(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vi-blog-posts"] });
    },
  });
}
