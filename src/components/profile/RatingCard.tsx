// ============================================================================
// RatingCard — shareable DUPR rating card (Phase B, dark-luxury redesign)
// ----------------------------------------------------------------------------
// On-screen twin of the og-image-player share image: a dark "credential" with
// a giant hero DUPR numeral on a green glow, editorial identity, and share
// actions (native share for Zalo/Messenger, copy link, Facebook, download
// PNG). The +/- delta comes from the last two dupr_rating_history snapshots
// (hidden until DUPR syncs). "Connect DUPR" CTA when the owner has no rating.
// ============================================================================
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Share2, Download, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { trackInviteSent } from "@/utils/invite-events";
import type { DuprHistoryRow } from "@/hooks/social/useDuprRatingHistory";

interface RatingCardProps {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  duprSingles?: number | null;
  duprDoubles?: number | null;
  /** Optional ASC-sorted history; the last two snapshots yield the delta. */
  history?: DuprHistoryRow[];
  /** Owner-only affordances (Connect DUPR CTA). */
  isOwn?: boolean;
}

function latestDelta(history: DuprHistoryRow[] | undefined, key: "dupr_singles" | "dupr_doubles"): number | null {
  if (!history || history.length < 2) return null;
  const vals = history.map((h) => h[key]).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const delta = vals[vals.length - 1] - vals[vals.length - 2];
  return Math.abs(delta) < 0.005 ? null : Number(delta.toFixed(2));
}

const fmt = (v: number | null | undefined): string => (v != null ? v.toFixed(2) : "—");

export function RatingCard({
  username,
  displayName,
  avatarUrl,
  duprSingles,
  duprDoubles,
  history,
  isOwn,
}: RatingCardProps) {
  const { language } = useI18n();
  const vi = language === "vi";
  const { toast } = useToast();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.thepicklehub.net";
  const profileUrl = `${origin}/nguoi-choi/${username}`;
  const ogImageUrl = `${origin}/og/player/${username}.png`;

  const hasDoubles = duprDoubles != null;
  const hasSingles = duprSingles != null;
  const unrated = !hasDoubles && !hasSingles;
  const heroLabel = hasDoubles ? (vi ? "ĐÔI" : "DBL") : vi ? "ĐƠN" : "SGL";
  const heroValue = hasDoubles ? fmt(duprDoubles) : fmt(duprSingles);
  const secLabel = hasDoubles ? (vi ? "ĐƠN" : "SGL") : vi ? "ĐÔI" : "DBL";
  const secValue = hasDoubles ? fmt(duprSingles) : hasSingles ? fmt(duprDoubles) : "—";
  const deltaKey = hasDoubles ? "dupr_doubles" : "dupr_singles";
  const delta = useMemo(() => latestDelta(history, deltaKey), [history, deltaKey]);

  const shareText = vi
    ? `DUPR của tôi trên ThePickleHub: ${profileUrl}`
    : `My DUPR rating on ThePickleHub: ${profileUrl}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      trackInviteSent({ proposalId: `card:${username}`, channel: "card_copy" });
      toast({ title: vi ? "Đã copy link" : "Link copied" });
    } catch {
      toast({ variant: "destructive", title: vi ? "Không copy được" : "Copy failed" });
    }
  };

  const onShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "ThePickleHub", text: shareText, url: profileUrl });
        trackInviteSent({ proposalId: `card:${username}`, channel: "card_webshare" });
      } catch {
        /* dismissed */
      }
      return;
    }
    await onCopy();
  };

  const onFacebook = () => {
    trackInviteSent({ proposalId: `card:${username}`, channel: "card_facebook" });
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(ogImageUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `dupr-${username}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      trackInviteSent({ proposalId: `card:${username}`, channel: "card_download" });
    } catch {
      toast({ variant: "destructive", title: vi ? "Không tải được ảnh" : "Image download failed" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-500/15 shadow-xl">
      {/* ── Dark credential face (mirrors the OG image) ── */}
      <div className="relative overflow-hidden bg-zinc-950 px-6 py-7 text-zinc-50">
        {/* top accent rule */}
        <div className="absolute left-0 top-0 h-1.5 w-44 bg-gradient-to-r from-emerald-400 to-emerald-600" />
        {/* green glow */}
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-emerald-500/25 blur-3xl" />

        {/* brand + eyebrow */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="text-sm font-bold tracking-tight">ThePickleHub</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400">DUPR</span>
        </div>

        {/* identity + hero */}
        <div className="relative mt-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400 bg-zinc-900 text-lg font-black text-emerald-400">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (displayName.trim().charAt(0).toUpperCase() || "?")
              )}
            </div>
            <div className="truncate text-2xl font-black leading-none tracking-tight">{displayName}</div>
            <div className="mt-1 truncate text-sm font-semibold text-zinc-400">@{username}</div>
          </div>

          {unrated ? (
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">DUPR</div>
              <div className="text-2xl font-black leading-tight">{vi ? "Chưa xếp hạng" : "Unrated"}</div>
            </div>
          ) : (
            <div className="shrink-0 text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">{heroLabel}</span>
                {delta != null && (
                  <span className={`text-xs font-bold ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {delta > 0 ? "▲ +" : "▼ "}{delta}
                  </span>
                )}
              </div>
              <div className="font-mono text-6xl font-black leading-none tabular-nums">{heroValue}</div>
              <div className="mt-1 text-sm font-semibold text-zinc-400">
                <span className="tracking-[0.16em]">{secLabel}</span> <span className="text-zinc-200">{secValue}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions (theme surface for button legibility in both themes) ── */}
      <div className="space-y-3 bg-card px-5 py-4">
        {unrated && isOwn ? (
          <Button className="w-full" onClick={() => navigate("/dupr")}>
            {vi ? "Kết nối DUPR để hiện rating" : "Connect DUPR to show your rating"}
          </Button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="default" onClick={onShare}>
            <Share2 className="mr-1.5 h-4 w-4" />
            {vi ? "Chia sẻ" : "Share"}
          </Button>
          <Button variant="outline" onClick={onCopy}>
            <Copy className="mr-1.5 h-4 w-4" />
            {vi ? "Copy link" : "Copy link"}
          </Button>
          <Button variant="outline" onClick={onFacebook}>
            <Facebook className="mr-1.5 h-4 w-4" />
            Facebook
          </Button>
          <Button variant="outline" disabled={downloading} onClick={onDownload}>
            <Download className="mr-1.5 h-4 w-4" />
            {vi ? "Tải ảnh" : "Save image"}
          </Button>
        </div>
      </div>
    </section>
  );
}
