import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  created_at: string;
  // Onboarding progress (profiles table); used by the wizard resume logic.
  onboarding_step?: number | null;
  onboarding_completed_at?: string | null;
  // Public handle for /nguoi-choi/:username (header "View my profile").
  username?: string | null;
  // Profile cover photo (migration 20261124230000).
  cover_url?: string | null;
}

export function useUserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // NOTE: `email` is intentionally NOT selected from profiles — the PII
      // column lockdown (migration 20260706100000-ish) revokes the email column
      // from the authenticated role, so `select("*")` would fail. The user's own
      // email is available from the auth session instead. Kept in a variable
      // so the string is not parsed against the generated column types
      // (cover_url predates them).
      const PROFILE_COLS = "id, display_name, avatar_url, organization_id, created_at, onboarding_step, onboarding_completed_at, username, cover_url";
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLS)
        .eq("id", user.id)
        .single();

      if (error) throw error;
      // cover_url is not in the generated types yet (see PROFILE_COLS
      // note) - cast the row through unknown before shaping.
      const row = (data ?? {}) as unknown as Record<string, unknown>;
      return { ...row, email: user.email ?? "" } as unknown as UserProfile;
    },
    enabled: !!user?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Pick<UserProfile, "display_name" | "avatar_url">>) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Return only non-PII columns — `select()` (== select *) would trip the
      // email column lockdown for the authenticated role.
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select("id, display_name, avatar_url")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast({ title: "Đã cập nhật hồ sơ" });
    },
    onError: (error) => {
      toast({
        title: "Lỗi cập nhật hồ sơ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast({ title: "Đã cập nhật avatar" });
    },
    onError: (error) => {
      toast({
        title: "Lỗi tải avatar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cover photo upload - mirrors uploadAvatar (same "avatars" bucket),
  // stored under a cover- prefixed name and saved to profiles.cover_url.
  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/cover-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ cover_url: publicUrl } as never)
        .eq("id", user.id);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["player-profile"] });
      toast({ title: "Đã cập nhật ảnh bìa" });
    },
    onError: (error) => {
      toast({
        title: "Lỗi tải ảnh bìa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    profile,
    isLoading,
    updateProfile,
    uploadAvatar,
    uploadCover,
  };
}

// Hook to get any user's public profile info (for display in comments, chat, etc.)
export function usePublicUserInfo(userId: string | undefined) {
  return useQuery({
    queryKey: ["public-user-info", userId],
    queryFn: async () => {
      if (!userId) return null;

      // Get profile (use public_profiles view for other users)
      const { data: profile, error: profileError } = await supabase
        .from("public_profiles")
        .select("display_name, avatar_url")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Check if user is creator
      const { data: isCreator } = await supabase.rpc("is_user_creator", {
        _user_id: userId,
      });

      return {
        displayName: profile?.display_name,
        avatarUrl: profile?.avatar_url,
        isCreator: !!isCreator,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
