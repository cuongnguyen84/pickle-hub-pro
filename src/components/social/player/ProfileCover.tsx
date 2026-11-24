import { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { coverPalette } from "@/lib/social/cover-palette";

/**
 * Profile cover band for /nguoi-choi/:username (2026-11-24 redesign).
 * Shows the uploaded cover_url when present; otherwise generates a
 * deterministic default from the username: a two-tone gradient from a
 * curated palette, a faint pickleball-court line pattern, and the
 * display-name initial as a watermark - so an empty profile still
 * looks designed, never like a grey placeholder box.
 */

interface ProfileCoverProps {
  coverUrl?: string | null;
  username?: string | null;
  displayName: string;
  /** Owner viewing their own profile: show the change-cover control. */
  isOwn?: boolean;
  onUploadCover?: (file: File) => void;
  uploadingCover?: boolean;
}

export function ProfileCover({
  coverUrl,
  username,
  displayName,
  isOwn,
  onUploadCover,
  uploadingCover,
}: ProfileCoverProps) {
  const { language } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [from, to] = coverPalette(username ?? displayName ?? "?");
  const initial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "3 / 1",
        minHeight: 140,
        maxHeight: 300,
        borderRadius: 14,
        overflow: "hidden",
        background: `linear-gradient(120deg, ${from} 0%, ${to} 130%)`,
      }}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          loading="eager"
        />
      ) : (
        <>
          {/* Court-line pattern: border, service boxes, center circle. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1200 400"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <g
              fill="none"
              stroke="rgba(255,255,255,0.20)"
              strokeWidth="3"
            >
              <rect x="30" y="30" width="1140" height="340" rx="6" />
              <line x1="600" y1="30" x2="600" y2="370" />
              <line x1="430" y1="30" x2="430" y2="370" />
              <line x1="770" y1="30" x2="770" y2="370" />
              <circle cx="600" cy="200" r="86" />
            </g>
          </svg>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 28,
              bottom: -38,
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 190,
              lineHeight: 1,
              color: "rgba(255,255,255,0.13)",
              userSelect: "none",
            }}
          >
            {initial}
          </span>
        </>
      )}

      {isOwn && onUploadCover && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingCover}
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(0,0,0,0.45)",
              color: "#fff",
              fontSize: 12.5,
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            {uploadingCover ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {language === "vi" ? "Đổi ảnh bìa" : "Change cover"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadCover(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
