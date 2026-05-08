import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { FollowButton } from "@/components/social/FollowButton";
import type { PlayerProfile } from "@/hooks/social/usePlayerProfile";
import type { PlayerStatsRow } from "@/hooks/social/usePlayerStats";

interface PlayerHeroCardProps {
  player: PlayerProfile;
  /** Optional — when present, renders the IG-style stat strip + form ribbon. */
  stats?: PlayerStatsRow | null;
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
export function PlayerHeroCard({ player, stats }: PlayerHeroCardProps) {
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

  // Inline IG/FB-style stat strip data — displayed under @handle.
  const followers = stats?.followers_count ?? 0;
  const following = stats?.following_count ?? 0;
  const matches = stats?.total_matches ?? 0;
  const formStr = (stats?.last_5_form ?? "").slice(0, 5);
  const hasAnyMatches = matches > 0 || formStr.length > 0;

  return (
    <header className="tl-page-head" style={{ padding: "40px 0 32px" }}>
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
          gap: 32,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 60%", minWidth: 260 }}>
          <h1
            style={{
              marginBottom: 14,
              fontSize: "clamp(48px, 7vw, 96px)",
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
            }}
          >
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
              marginBottom: 16,
            }}
          >
            {meta}
          </p>

          {/* IG/FB-style stat strip — italic green numbers + serif labels */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: 14,
              fontFamily: "'Instrument Serif', serif",
              fontSize: 18,
              color: "var(--tl-fg-2)",
              borderTop: "1px solid var(--tl-border)",
              paddingTop: 16,
              marginBottom: hasAnyMatches ? 12 : 16,
            }}
          >
            <StatPill
              n={followers}
              label={language === "vi" ? "người theo dõi" : "followers"}
            />
            <StatSep />
            <StatPill
              n={following}
              label={language === "vi" ? "đang theo dõi" : "following"}
            />
            <StatSep />
            <StatPill
              n={matches}
              label={language === "vi" ? "trận đấu" : "matches"}
            />
          </div>

          {/* Form ribbon — 5 horizontal bands inline (replaces stat-card) */}
          {hasAnyMatches && (
            <FormRibbon form={formStr} language={language} />
          )}

          {favoriteVenue && (
            <p
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 18,
                color: "var(--tl-fg-2)",
                margin: "16px 0 0",
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

          <div className="tl-hero-ctas" style={{ marginTop: 28 }}>
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
            <FollowButton
              targetUserId={player.id}
              targetUsername={player.username ?? undefined}
              variant="default"
              size="md"
            />
          </div>
        </div>

        {/* Avatar — 140×140 with double-ring frame */}
        <div
          style={{
            flex: "0 0 auto",
            width: 152,
            height: 152,
            padding: 5,
            borderRadius: "50%",
            border: "1px solid var(--tl-border)",
            background:
              "linear-gradient(135deg, var(--tl-green-glow, rgba(0,185,107,0.12)) 0%, transparent 70%)",
          }}
        >
        <div
          style={{
            width: "100%",
            height: "100%",
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
      </div>
    </header>
  );
}

/** Inline IG-style stat: italic green number + lowercase serif label. */
function StatPill({ n, label }: { n: number; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 26,
          lineHeight: 1,
          color: "var(--tl-green)",
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {n}
      </span>
      <span style={{ color: "var(--tl-fg-3)", fontSize: 16 }}>{label}</span>
    </span>
  );
}

function StatSep() {
  return (
    <span aria-hidden="true" style={{ color: "var(--tl-fg-4)" }}>
      ·
    </span>
  );
}

/** Horizontal 5-band form ribbon. W=green / L=red / idle=border. */
function FormRibbon({
  form,
  language,
}: {
  form: string;
  language: "vi" | "en";
}) {
  const cells = form.padEnd(5, "·").slice(0, 5).split("");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 4,
      }}
    >
      <span
        className="tl-caps"
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "var(--tl-fg-3)",
        }}
      >
        {language === "vi" ? "PHONG ĐỘ" : "FORM"}
      </span>
      <div
        style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
        role="img"
        aria-label={
          language === "vi"
            ? `5 trận gần nhất: ${form || "chưa có"}`
            : `Last 5 matches: ${form || "no data"}`
        }
      >
        {cells.map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 18,
              height: 4,
              borderRadius: 1,
              background:
                c === "W"
                  ? "var(--tl-green)"
                  : c === "L"
                    ? "var(--tl-red, #ef4444)"
                    : "var(--tl-border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
