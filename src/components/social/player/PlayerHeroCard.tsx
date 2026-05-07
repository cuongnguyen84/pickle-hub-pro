import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { PlayerProfile } from "@/hooks/social/usePlayerProfile";

interface PlayerHeroCardProps {
  player: PlayerProfile;
}

const SKILL_LABELS_VI: Record<string, string> = {
  beginner: "Người mới",
  intermediate: "Trung bình",
  advanced: "Khá",
  pro: "Chuyên nghiệp",
};
const SKILL_LABELS_EN: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "Pro",
};

/**
 * Editorial hero matching TheLine aesthetic. No card border — uses tl-page-head
 * pattern (italic serif h1 + tl-eyebrow tag + dim metadata line). Avatar floats
 * top-right on desktop, on top on mobile.
 */
export function PlayerHeroCard({ player }: PlayerHeroCardProps) {
  const { toast } = useToast();
  const { language } = useI18n();
  const [favoriteVenue, setFavoriteVenue] = useState<{
    name: string;
    slug: string;
  } | null>(null);

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
      toast({
        title:
          language === "vi"
            ? "Đã sao chép link hồ sơ"
            : "Profile link copied",
      });
    } catch {
      toast({
        variant: "destructive",
        title: language === "vi" ? "Không thể sao chép" : "Couldn't copy",
        description: url,
      });
    }
  };

  const skillMap = language === "vi" ? SKILL_LABELS_VI : SKILL_LABELS_EN;
  const skillLabel = player.skill_level ? skillMap[player.skill_level] : null;
  const displayName = player.display_name ?? player.username ?? "";
  const meta = [
    player.username && `@${player.username}`,
    player.city,
    skillLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="tl-page-head" style={{ padding: "32px 0 28px" }}>
      <div className="tl-eyebrow" aria-hidden="true">
        <span className="pip" />
        <span>{language === "vi" ? "NGƯỜI CHƠI" : "PLAYER"}</span>
        {player.dupr_doubles != null && (
          <>
            <span className="sep">·</span>
            <span>DUPR {player.dupr_doubles.toFixed(2)}</span>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 60%", minWidth: 240 }}>
          <h1 style={{ marginBottom: 12 }}>
            <span style={{ display: "inline" }}>{displayName}</span>
            {player.is_verified && (
              <BadgeCheck
                className="ml-2 inline h-6 w-6"
                style={{ color: "var(--tl-green)", verticalAlign: "middle" }}
                aria-label={language === "vi" ? "Đã xác thực" : "Verified"}
              />
            )}
            {player.is_pro && (
              <span
                className="ml-2 align-middle inline-block rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-widest"
                style={{
                  background: "var(--tl-cream, rgba(245, 228, 198, 0.12))",
                  color: "var(--tl-fg)",
                  verticalAlign: "middle",
                }}
              >
                PRO
              </span>
            )}
          </h1>
          <p
            className="tl-caps"
            style={{
              color: "var(--tl-fg-3)",
              fontSize: 12,
              fontFamily: "'Geist Mono', monospace",
              marginBottom: 8,
            }}
          >
            {meta}
          </p>
          {favoriteVenue && (
            <p
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 18,
                color: "var(--tl-fg-2)",
                margin: "12px 0 0",
              }}
            >
              {language === "vi" ? "Sân hay chơi:" : "Home court:"}{" "}
              <Link
                to={`/san/${favoriteVenue.slug}`}
                style={{
                  color: "var(--tl-fg)",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {favoriteVenue.name}
              </Link>
            </p>
          )}
          {player.bio && (
            <p
              style={{
                color: "var(--tl-fg-2)",
                fontSize: 15,
                lineHeight: 1.55,
                margin: "16px 0 0",
                maxWidth: "54ch",
              }}
            >
              {player.bio}
            </p>
          )}

          <div className="tl-hero-ctas" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="tl-btn"
              onClick={handleShare}
              aria-label={
                language === "vi" ? "Chia sẻ hồ sơ" : "Share profile"
              }
            >
              <Share2 className="h-4 w-4" />
              {language === "vi" ? "Chia sẻ" : "Share"}
            </button>
            <button
              type="button"
              className="tl-btn primary"
              disabled
              title="Phase 3C — coming soon"
            >
              {language === "vi" ? "+ Theo dõi" : "+ Follow"}
            </button>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            width: 120,
            height: 120,
            borderRadius: "50%",
            overflow: "hidden",
            border: "1px solid var(--tl-border)",
            background: "var(--tl-surface, rgba(255,255,255,0.04))",
          }}
        >
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="eager"
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 48,
                color: "var(--tl-fg-3)",
              }}
            >
              {(displayName || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
