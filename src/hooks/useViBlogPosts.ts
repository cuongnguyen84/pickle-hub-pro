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

// Public: fetch published posts for blog index
export function usePublishedViBlogPosts() {
  return useQuery({
    queryKey: ["vi-blog-posts", "published"],
    queryFn: async () => {
      const { data, error } = await (supabase as ReturnType<typeof supabase["from"]>)
        .from("vi_blog_posts")
        .select("id, slug, title, excerpt, cover_image_url, category, published_at, tags")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data as Pick<ViBlogPost, "id" | "slug" | "title" | "excerpt" | "cover_image_url" | "category" | "published_at" | "tags">[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Public: fetch single published post by slug
export function useViBlogPostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["vi-blog-post", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await (supabase as ReturnType<typeof supabase["from"]>)
        .from("vi_blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();
      if (error) throw error;
      return data as ViBlogPost;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

// Admin: fetch all posts (including drafts)
export function useAdminViBlogPosts() {
  return useQuery({
    queryKey: ["vi-blog-posts", "admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as ReturnType<typeof supabase["from"]>)
        .from("vi_blog_posts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ViBlogPost[];
    },
  });
}

// Admin: fetch single post by id
export function useAdminViBlogPostById(id: string | undefined) {
  return useQuery({
    queryKey: ["vi-blog-post", "admin", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as ReturnType<typeof supabase["from"]>)
        .from("vi_blog_posts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ViBlogPost;
    },
    enabled: !!id,
  });
}

// Admin: create post
export function useCreateViBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: ViBlogPostInsert) => {
      const { data, error } = await (supabase as ReturnType<typeof supabase["from"]>)
        .from("vi_blog_posts")
        .insert(post)
        .select()
        .single();
      if (error) throw error;
      return data as ViBlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vi-blog-posts"] });
    },
  });
}

// Admin: update post
export function useUpdateViBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ViBlogPostUpdate) => {
      const { data, error } = await (supabase as ReturnType<typeof supabase["from"]>)
        .from("vi_blog_posts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ViBlogPost;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vi-blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["vi-blog-post", data.slug] });
      queryClient.invalidateQueries({ queryKey: ["vi-blog-post", "admin", data.id] });
    },
  });
}

// Admin: delete post
export function useDeleteViBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as ReturnType<typeof supabase["from"]>)
        .from("vi_blog_posts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vi-blog-posts"] });
    },
  });
}
