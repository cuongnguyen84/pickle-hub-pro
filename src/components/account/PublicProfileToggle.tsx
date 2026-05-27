// ============================================================================
// PublicProfileToggle — opt-in switch for /nguoi-choi/:username visibility
// ----------------------------------------------------------------------------
// Sprint A3 (2026-05-27).
//
// Reads + writes profiles.is_public_profile via Supabase directly (no edge
// function needed — RLS allows owner UPDATE). After flip, invalidates
// react-query caches that filter on this column so other tabs / open
// surfaces refresh.
//
// Privacy-first copy: explains exactly what flipping does, lists what's
// shown vs hidden, links to /nguoi-choi/:username preview before commit.
// ============================================================================

import { useState } from "react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Loader2, Eye, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function PublicProfileToggle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useI18n();
  const qc = useQueryClient();
  const vi = language === "vi";

  const [saving, setSaving] = useState(false);

  // Read current value + username for preview link.
  const { data: profile, isLoading } = useQuery({
    queryKey: ["account-public-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("is_public_profile, username")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (!user) return null;
  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPublic = profile.is_public_profile === true;

  async function handleToggle(next: boolean) {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_public_profile: next })
        .eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["account-public-profile", user.id] });
      qc.invalidateQueries({ queryKey: ["player-profile"], exact: false });
      qc.invalidateQueries({ queryKey: ["rankings-vietnam"], exact: false });
      qc.invalidateQueries({ queryKey: ["players-near-rating"], exact: false });
      toast({
        title: next
          ? vi
            ? "Profile đang công khai"
            : "Profile is now public"
          : vi
            ? "Profile đã ẩn"
            : "Profile is now private",
        description: next
          ? vi
            ? "Mọi người có thể xem hồ sơ và DUPR của bạn."
            : "Anyone can view your profile and DUPR rating."
          : vi
            ? "Chỉ bạn xem được hồ sơ. Hồ sơ sẽ biến mất khỏi bảng xếp hạng và tìm kiếm."
            : "Only you can see your profile. It's removed from rankings and search.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: vi ? "Không thể cập nhật" : "Update failed",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-foreground-secondary" />
            <h3 className="text-sm font-medium">
              {vi ? "Hiển thị profile công khai" : "Public profile"}
            </h3>
          </div>
          <p className="text-xs text-foreground-muted leading-relaxed">
            {isPublic
              ? vi
                ? "Profile của bạn xuất hiện trên bảng xếp hạng Việt Nam, gợi ý người chơi gần rating, và sitemap để Google index."
                : "Your profile appears on the Vietnam leaderboard, near-rating suggestions, and Google sitemap."
              : vi
                ? "Profile của bạn bị ẩn khỏi mọi trang công khai. Bật để xuất hiện trên bảng xếp hạng."
                : "Your profile is hidden from all public surfaces. Enable to appear on the leaderboard."}
          </p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={handleToggle}
          disabled={saving}
          aria-label={vi ? "Hiển thị profile công khai" : "Public profile"}
        />
      </div>

      {profile.username && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Link
            to={`/nguoi-choi/${profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            {vi ? "Xem profile của bạn" : "Preview your profile"}
            <ExternalLink className="h-3 w-3" />
          </Link>
          <span className="text-xs text-foreground-muted">
            /nguoi-choi/{profile.username}
          </span>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-foreground-muted">
        {vi
          ? "Profile công khai gồm: tên hiển thị, ảnh đại diện, thành phố, DUPR singles/doubles, lịch sử rating, và lịch sử trận đấu công khai. KHÔNG bao gồm: email, số điện thoại, lịch sử trận đấu private."
          : "Public profile includes: display name, avatar, city, DUPR singles/doubles, rating history, and public matches. Does NOT include: email, phone, private match history."}
      </p>
    </div>
  );
}
