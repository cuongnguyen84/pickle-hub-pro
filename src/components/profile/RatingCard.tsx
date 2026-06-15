// ============================================================================
// RatingCard — shareable DUPR rating card (Phase B)
// ----------------------------------------------------------------------------
// On-screen twin of the og-image-player share image. Lets a player "khoe"
// their DUPR rating: copy link, native share (Zalo/Messenger), Facebook, or
// download the PNG. Shows the +/- change after the latest match when the
// rating history has a fresh snapshot; otherwise the delta is hidden (DUPR
// sync is async — decision locked with Cuong) and, for the profile owner,
// a "Connect DUPR" CTA is shown when no rating exists yet.
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

function fmt(v: number | null | undefined): string {
  return v != null ? v.toFixed(2) : "—";
}

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

  const doublesDelta = useMemo(() => latestDelta(history, "dupr_doubles"), [history]);
  const hasRating = duprSingles != null || duprDoubles != null;

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
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Branded card face — mirrors the og-image-player layout */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-7 text-white">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-90">
          <span>ThePickleHub</span>
          <span>DUPR</span>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/55 bg-white/20 text-2xl font-bold">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              displayName.trim().charAt(0).toUpperCase() || "?"
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xl font-bold">{displayName}</div>
            <div className="truncate text-sm opacity-80">@{username}</div>
          </div>
        </div>

        <div className="mt-6 flex items-end gap-8">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">{vi ? "Đôi" : "Doubles"}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold tabular-nums">{fmt(duprDoubles)}</span>
              {doublesDelta != null && (
                <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${doublesDelta > 0 ? "text-emerald-100" : "text-rose-100"}`}>
                  {doublesDelta > 0 ? "▲" : "▼"}
                  {doublesDelta > 0 ? "+" : ""}{doublesDelta}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">{vi ? "Đơn" : "Singles"}</div>
            <div className="font-mono text-4xl font-bold tabular-nums">{fmt(duprSingles)}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 px-5 py-4">
        {!hasRating && isOwn ? (
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
