import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { VerifiedBadge } from "@/components/social/VerifiedBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { useFollowList } from "@/hooks/social/useFollow";
import { FollowButton } from "@/components/social/FollowButton";

/**
 * Followers / following list opened from the profile stat row
 * (2026-11-24 redesign PR-2). Rows link to each user's profile;
 * social_follows is public-read so guests can browse the list too.
 */
export function FollowListDialog({
  userId,
  kind,
  open,
  onOpenChange,
}: {
  userId: string;
  kind: "followers" | "following";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { language } = useI18n();
  const { data, isLoading } = useFollowList(userId, kind, open);

  const title =
    kind === "followers"
      ? language === "vi"
        ? "Người theo dõi"
        : "Followers"
      : language === "vi"
        ? "Đang theo dõi"
        : "Following";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !data || data.length === 0 ? (
            <p
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 16,
                color: "var(--tl-fg-3)",
                padding: "16px 0",
                margin: 0,
                textAlign: "center",
              }}
            >
              {language === "vi" ? "Chưa có ai trong danh sách này." : "No one here yet."}
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.map((p) => {
                const name = p.display_name ?? p.username ?? "";
                const row = (
                  <>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        overflow: "hidden",
                        flex: "0 0 auto",
                        background: "var(--tl-surface, rgba(255,255,255,0.05))",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      ) : (
                        <span
                          style={{
                            fontFamily: "'Instrument Serif', serif",
                            fontStyle: "italic",
                            fontSize: 17,
                            color: "var(--tl-fg-3)",
                          }}
                        >
                          {(name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 14,
                          fontWeight: 550,
                          color: "var(--tl-fg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                        {p.is_verified && <VerifiedBadge size={16} />}
                      </span>
                      {p.username && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 12.5,
                            color: "var(--tl-fg-3)",
                            fontFamily: "'Geist Mono', monospace",
                          }}
                        >
                          @{p.username}
                        </span>
                      )}
                    </span>
                  </>
                );
                const rowStyle: React.CSSProperties = {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 4px",
                  textDecoration: "none",
                };
                return (
                  <li
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      borderTop: "1px solid var(--tl-border)",
                    }}
                  >
                    {p.username ? (
                      <Link
                        to={`/nguoi-choi/${p.username}`}
                        onClick={() => onOpenChange(false)}
                        style={{ ...rowStyle, flex: 1, minWidth: 0 }}
                      >
                        {row}
                      </Link>
                    ) : (
                      <span style={{ ...rowStyle, flex: 1, minWidth: 0 }}>{row}</span>
                    )}
                    <FollowButton
                      targetUserId={p.id}
                      targetUsername={p.username ?? undefined}
                      variant="compact"
                      size="sm"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
