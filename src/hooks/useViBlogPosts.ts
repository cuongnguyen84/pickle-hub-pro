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
  } = {},
): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
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
      viBlogFetch<Pick<ViBlogPost, "id" | "slug" | "title" | "excerpt" | "cover_image_url" | "category" | "published_at" | "tags">[]>(
        "?select=id,slug,title,excerpt,cover_image_url,category,published_at,tags&status=eq.published&order=published_at.desc",
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useViBlogPostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["vi-blog-post", slug],
    queryFn: () =>
      viBlogFetch<ViBlogPost>(
        `?slug=eq.${encodeURIComponent(slug!)}&status=eq.published`,
        { single: true },
      ),
    enabled: !!slug,
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
