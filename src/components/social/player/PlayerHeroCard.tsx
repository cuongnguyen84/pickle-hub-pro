import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { PlayerProfile } from "@/hooks/social/usePlayerProfile";

interface PlayerHeroCardProps {
  player: PlayerProfile;
}

const SKILL_BADGES: Record<
  string,
  { label: string; cls: string }
> = {
  beginner: {
    label: "Người mới",
    cls: "bg-muted text-muted-foreground",
  },
  intermediate: {
    label: "Trung bình",
    cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  advanced: {
    label: "Khá",
    cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  pro: {
    label: "Chuyên nghiệp",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

export function PlayerHeroCard({ player }: PlayerHeroCardProps) {
  const { toast } = useToast();
  const [favoriteVenue, setFavoriteVenue] = useState<{
    name: string;
    slug: string;
  } | null>(null);

  // Resolve favorite_venue_id → venue name for the "Sân hay chơi" pill.
  useEffect(() => {
    if (!player.favorite_venue_id) {
      setFavoriteVenue(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("venues")
        .select("name, name_vi, slug")
        .eq("id", player.favorite_venue_id)
        .maybeSingle();
      if (cancelled || !data) return;
      setFavoriteVenue({
        name: data.name_vi || data.name,
        slug: data.slug,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [player.favorite_venue_id]);

  const handleShare = async () => {
    const url = `https://www.thepicklehub.net/nguoi-choi/${player.username}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${player.display_name ?? player.username} | ThePickleHub`,
          url,
        });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Đã sao chép link hồ sơ" });
    } catch {
      toast({
        variant: "destructive",
        title: "Không thể sao chép",
        description: url,
      });
    }
  };

  const skill = player.skill_level ? SKILL_BADGES[player.skill_level] : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6">
      <div className="flex items-start gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted shadow-md">
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={player.display_name ?? player.username ?? ""}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {(player.display_name ?? player.username ?? "?")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold leading-tight">
            <span className="truncate">
              {player.display_name ?? player.username}
            </span>
            {player.is_verified && (
              <BadgeCheck
                className="h-5 w-5 shrink-0 text-blue-500"
                aria-label="Đã xác thực"
              />
            )}
            {player.is_pro && (
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                PRO
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">@{player.username}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {skill && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${skill.cls}`}
              >
                {skill.label}
              </span>
            )}
            {player.city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {player.city}
              </span>
            )}
          </div>

          {favoriteVenue && (
            <p className="mt-3 text-sm text-muted-foreground">
              Sân hay chơi:{" "}
              <Link
                to={`/san/${favoriteVenue.slug}`}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {favoriteVenue.name}
              </Link>
            </p>
          )}

          {player.bio && (
            <p className="mt-3 text-sm text-foreground/90">{player.bio}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="gap-1.5"
        >
          <Share2 className="h-4 w-4" />
          Chia sẻ
        </Button>
        {/* Phase 3C will replace this slot with a real FollowButton. */}
        <Button variant="default" size="sm" disabled className="gap-1.5">
          + Theo dõi
        </Button>
      </div>
    </section>
  );
}
