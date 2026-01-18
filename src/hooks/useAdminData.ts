import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
type Video = Database["public"]["Tables"]["videos"]["Row"];
type Livestream = Database["public"]["Tables"]["livestreams"]["Row"];

// Stats hooks
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [orgsResult, videosResult, liveResult, viewsResult] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact" }),
        supabase.from("videos").select("id", { count: "exact" }).eq("status", "published"),
        supabase.from("livestreams").select("id", { count: "exact" }).eq("status", "live"),
        supabase
          .from("view_events")
          .select("id", { count: "exact" })
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        totalOrganizations: orgsResult.count || 0,
        totalPublishedVideos: videosResult.count || 0,
        totalLiveStreams: liveResult.count || 0,
        weeklyViews: viewsResult.count || 0,
      };
    },
  });
}

export function useRecentLivestreams(limit = 5) {
  return useQuery({
    queryKey: ["admin", "recent-livestreams", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestreams")
        .select("*, organizations(name, logo_url)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}

export function useRecentVideos(limit = 5) {
  return useQuery({
    queryKey: ["admin", "recent-videos", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*, organizations(name, logo_url)")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}

// Organizations hooks
export function useAdminOrganizations(search?: string) {
  return useQuery({
    queryKey: ["admin", "organizations", search],
    queryFn: async () => {
      let query = supabase.from("organizations").select("*").order("name");
      if (search) {
        query = query.ilike("name", `%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (org: Omit<Organization, "id" | "created_at">) => {
      const { data, error } = await supabase.from("organizations").insert(org).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Organization> & { id: string }) => {
      const { data, error } = await supabase.from("organizations").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organizations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

// Users hooks
export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*, organizations(id, name)")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("*");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      return profiles.map((profile) => ({
        ...profile,
        roles: roles.filter((r) => r.user_id === profile.id).map((r) => r.role),
      }));
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "viewer" | "creator" | "admin" }) => {
      // First, delete existing roles for this user
      const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Then insert the new role
      const { error: insertError } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAssignUserOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string; organizationId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ organization_id: organizationId }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

// Tournaments hooks
export function useAdminTournaments() {
  return useQuery({
    queryKey: ["admin", "tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tournament: Omit<Tournament, "id" | "created_at">) => {
      const { data, error } = await supabase.from("tournaments").insert(tournament).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tournaments"] });
    },
  });
}

export function useUpdateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tournament> & { id: string }) => {
      const { data, error } = await supabase.from("tournaments").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tournaments"] });
    },
  });
}

// Moderation hooks
export function useModerationVideos(filters?: { organizationId?: string; tournamentId?: string }) {
  return useQuery({
    queryKey: ["admin", "moderation", "videos", filters],
    queryFn: async () => {
      let query = supabase
        .from("videos")
        .select("*, organizations(id, name), tournaments(id, name)")
        .order("created_at", { ascending: false });

      if (filters?.organizationId) {
        query = query.eq("organization_id", filters.organizationId);
      }
      if (filters?.tournamentId) {
        query = query.eq("tournament_id", filters.tournamentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useModerationLivestreams(filters?: { organizationId?: string; tournamentId?: string }) {
  return useQuery({
    queryKey: ["admin", "moderation", "livestreams", filters],
    queryFn: async () => {
      let query = supabase
        .from("livestreams")
        .select("*, organizations(id, name), tournaments(id, name)")
        .order("created_at", { ascending: false });

      if (filters?.organizationId) {
        query = query.eq("organization_id", filters.organizationId);
      }
      if (filters?.tournamentId) {
        query = query.eq("tournament_id", filters.tournamentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateVideoStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" | "hidden" }) => {
      const { error } = await supabase.from("videos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation", "videos"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useUpdateLivestreamStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "scheduled" | "live" | "ended" }) => {
      const updates: { status: "scheduled" | "live" | "ended"; ended_at?: string } = { status };
      if (status === "ended") {
        updates.ended_at = new Date().toISOString();
      }
      const { error } = await supabase.from("livestreams").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation", "livestreams"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}
