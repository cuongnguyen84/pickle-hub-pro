import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, MessageCircle, Pencil, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useProfilePosts } from "@/hooks/social/useProfilePosts";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { supabase } from "@/integrations/supabase/client";
import { FollowButton } from "@/components/social/FollowButton";
import { ProfileCover } from "./ProfileCover";
import { FollowListDialog } from "./FollowListDialog";
import type { PlayerProfile } from "@/hooks/social/usePlayerProfile";
import type { PlayerStatsRow } from "@/hooks/social/usePlayerStats";

interface PlayerHeroCardProps {
  player: PlayerProfile;
  /** Optional — when present, renders the stat strip + form ribbon. */
  stats?: PlayerStatsRow | null;
  /** The viewer owns this profile (drives cover edit + action row). */
  isOwn?: boolean;
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
 * Social-style profile hero (2026-11-24 redesign): cover band with the
 * avatar overlapping its bottom edge, identity block (name + verified
 * tick + @username, bio, compact meta, DUPR chip), a stat row
 * (followers / following / posts / matches) and a prominent action row
 * - Edit + Share for the owner, Follow + Message + Share for visitors.
 * Athlete data (form ribbon, home court) is preserved from the
 * previous editorial hero.
 */
export function PlayerHeroCard({ player, stats, isOwn }: PlayerHeroCardProps) {
  const { toast } = useToast();
  const { language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { uploadCover } = useUserProfile();
  const postsQuery = useProfilePosts(player.id);
  const [favoriteVenue, setFavoriteVenue] = useState<{
    name: string;
    slug: string;
  } | null>(null);
  const [dmBusy, setDmBusy] = useState(false);
  const [followListKind, setFollowListKind] = useState<
    "followers" | "following" | null
  >(null);

  useEffect(() => {
    const venueId = player.favorite_venue_id;
    if (!venueId) {
      setFavoriteVenue(null);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("venues")
        .select("name, name_vi, slug")
        .eq("id", venueId)
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

  const handleMessage = async () => {
    if (!user) {
      navigate(buildLoginRedirect(`/nguoi-choi/${player.username}`));
      return;
    }
    if (user.id === player.id || dmBusy) return;
    setDmBusy(true);
    const { data, error } = await supabase.rpc("get_or_create_dm", {
      p_other: player.id,
    });
    setDmBusy(false);
    if (error || !data) {
      toast({
        title:
          language === "vi"
            ? "Không mở được cuộc trò chuyện"
            : "Could not open chat",
        variant: "destructive",
      });
      return;
    }
    navigate(`/tin-nhan?c=${data}`);
  };

  const skillMap = language === "vi" ? SKILL_LABELS_VI : SKILL_LABELS_EN;
  const skillLabel = player.skill_level ? skillMap[player.skill_level] : null;
  const displayName = player.display_name ?? player.username ?? "";
  const joined = player.created_at
    ? new Date(player.created_at).toLocaleDateString(
        language === "vi" ? "vi-VN" : "en-US",
        { month: "short", year: "numeric" },
      )
    : null;
  const meta = [
    player.city,
    skillLabel,
    joined &&
      (language === "vi" ? `Tham gia ${joined}` : `Joined ${joined}`),
  ]
    .filter(Boolean)
    .join(" · ");

  const followers = stats?.followers_count ?? 0;
  const following = stats?.following_count ?? 0;
  const matches = stats?.total_matches ?? 0;
  const posts = postsQuery.data?.total ?? 0;
  const formStr = (stats?.last_5_form ?? "").slice(0, 5);
  const hasAnyMatches = matches > 0 || formStr.length > 0;

  return (
    <header style={{ paddingTop: 20 }}>
      <ProfileCover
        coverUrl={player.cover_url}
        username={player.username}
        displayName={displayName}
        isOwn={!!isOwn}
        onUploadCover={(f) => uploadCover.mutate(f)}
        uploadingCover={uploadCover.isPending}
      />

      {/* Avatar row - avatar overlaps the cover; actions sit right. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          padding: "0 8px",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            marginTop: -70,
            padding: 5,
            borderRadius: "50%",
            border: "1px solid var(--tl-border)",
            background:
              "linear-gradient(135deg, var(--tl-green-glow, rgba(0,185,107,0.12)) 0%, var(--tl-bg) 72%)",
            flex: "0 0 auto",
            position: "relative",
            zIndex: 1,
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
                  fontSize: 52,
                  color: "var(--tl-fg-3)",
                }}
              >
                {(displayName || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            paddingTop: 12,
          }}
        >
          {isOwn ? (
            <>
              <Button asChild variant="default">
                <Link to="/account">
                  <Pencil className="h-4 w-4" />
                  {language === "vi" ? "Chỉnh sửa hồ sơ" : "Edit profile"}
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                {language === "vi" ? "Chia sẻ" : "Share"}
              </Button>
            </>
          ) : (
            <>
              <FollowButton
                targetUserId={player.id}
                targetUsername={player.username ?? undefined}
                variant="default"
                size="md"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleMessage}
                disabled={dmBusy}
              >
                <MessageCircle className="h-4 w-4" />
                {language === "vi" ? "Nhắn tin" : "Message"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleShare}
                aria-label={language === "vi" ? "Chia sẻ hồ sơ" : "Share profile"}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Identity block */}
      <div style={{ padding: "10px 8px 0" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(30px, 4.5vw, 44px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
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
          style={{
            color: "var(--tl-fg-3)",
            fontSize: 13.5,
            fontFamily: "'Geist Mono', monospace",
            margin: "6px 0 0",
          }}
        >
          @{player.username}
          {player.dupr_doubles != null && (
            <span
              style={{
                marginLeft: 10,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid var(--tl-border)",
                color: "var(--tl-fg-2)",
                fontSize: 11.5,
              }}
            >
              DUPR {player.dupr_doubles.toFixed(2)}
            </span>
          )}
        </p>

        {player.bio && (
          <p
            style={{
              color: "var(--tl-fg)",
              fontSize: 15,
              lineHeight: 1.55,
              margin: "12px 0 0",
              maxWidth: "62ch",
            }}
          >
            {player.bio}
          </p>
        )}
        {meta && (
          <p style={{ color: "var(--tl-fg-3)", fontSize: 13, margin: "8px 0 0" }}>
            {meta}
          </p>
        )}
        {favoriteVenue && (
          <p
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 16,
              color: "var(--tl-fg-2)",
              margin: "8px 0 0",
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

        {/* Stat row - followers / following / posts / matches. The two
            follow counts open their user lists (FollowListDialog). */}
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
            paddingTop: 14,
            marginTop: 16,
          }}
        >
          <StatPill
            n={followers}
            label={language === "vi" ? "người theo dõi" : "followers"}
            onClick={() => setFollowListKind("followers")}
          />
          <StatSep />
          <StatPill
            n={following}
            label={language === "vi" ? "đang theo dõi" : "following"}
            onClick={() => setFollowListKind("following")}
          />
          <StatSep />
          <StatPill
            n={posts}
            label={language === "vi" ? "bài viết" : "posts"}
          />
          <StatSep />
          <StatPill
            n={matches}
            label={language === "vi" ? "trận đấu" : "matches"}
          />
        </div>

        {hasAnyMatches && (
          <div style={{ marginTop: 10 }}>
            <FormRibbon form={formStr} language={language} />
          </div>
        )}
      </div>

      <FollowListDialog
        userId={player.id}
        kind={followListKind ?? "followers"}
        open={followListKind !== null}
        onOpenChange={(o) => {
          if (!o) setFollowListKind(null);
        }}
      />
    </header>
  );
}

/** Inline IG-style stat: italic green number + lowercase serif label.
 *  With onClick it renders as a button in the same typography (the
 *  follow counts open their lists). */
function StatPill({
  n,
  label,
  onClick,
}: {
  n: number;
  label: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 24,
          lineHeight: 1,
          color: "var(--tl-green)",
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {n}
      </span>
      <span style={{ color: "var(--tl-fg-3)", fontSize: 15 }}>{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          font: "inherit",
        }}
      >
        {inner}
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      {inner}
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
