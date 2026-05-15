import { useNavigate } from "react-router-dom";
import { Trophy, Calendar, MapPin, Plus } from "lucide-react";
import { format } from "date-fns";
import type { ParentTournamentWithPreview } from "@/hooks/useParentTournament";
import { useI18n } from "@/i18n";

interface ParentTournamentCardProps {
  parent: ParentTournamentWithPreview;
  isOwner: boolean;
  variant?: "default" | "featured";
}

// Status pill colour map — token-driven so it tracks light/dark mode.
const STATUS_CONFIG: Record<
  string,
  { labelVi: string; labelEn: string; bg: string; fg: string }
> = {
  setup: {
    labelVi: "Sắp diễn",
    labelEn: "Upcoming",
    bg: "var(--tl-surface)",
    fg: "var(--tl-fg-3)",
  },
  group_stage: {
    labelVi: "Vòng bảng",
    labelEn: "Group stage",
    bg: "rgba(79, 155, 255, 0.12)",
    fg: "rgb(79, 155, 255)",
  },
  playoff: {
    labelVi: "Playoff",
    labelEn: "Playoff",
    bg: "rgba(233, 182, 73, 0.12)",
    fg: "var(--tl-gold)",
  },
  completed: {
    labelVi: "Hoàn thành",
    labelEn: "Completed",
    bg: "var(--tl-green-glow)",
    fg: "var(--tl-green)",
  },
};

const ParentTournamentCard = ({
  parent,
  isOwner,
  variant = "default",
}: ParentTournamentCardProps) => {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const isVi = language === "vi";
  const pt = t.quickTable.parentTournament;
  const isFeatured = variant === "featured";

  const handleHeaderClick = () => {
    navigate(`/tools/quick-tables/parent/${parent.share_id}`);
  };

  const handleSubEventClick = (e: React.MouseEvent, shareId: string) => {
    e.stopPropagation();
    navigate(`/tools/quick-tables/${shareId}`);
  };

  const handleAddEvent = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/tools/quick-tables?parentId=${parent.id}`);
  };

  const remaining = parent.subEventCount - parent.previewSubEvents.length;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        padding: 20,
        borderRadius: "var(--tl-radius-lg)",
        background: "var(--tl-bg-elev)",
        border: `1px solid ${isFeatured ? "rgba(233, 182, 73, 0.35)" : "var(--tl-border)"}`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Featured top accent rule (gold) */}
      {isFeatured && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, var(--tl-gold), color-mix(in srgb, var(--tl-gold) 60%, transparent), var(--tl-gold))",
          }}
        />
      )}

      {/* Banner image for featured */}
      {isFeatured && parent.banner_url && (
        <div style={{ margin: "-20px -20px 4px" }}>
          <img
            src={parent.banner_url}
            alt={parent.name}
            style={{
              width: "100%",
              aspectRatio: "3 / 1",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Header — clickable to parent page */}
      <div style={{ cursor: "pointer" }} onClick={handleHeaderClick}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Trophy
              className="w-5 h-5"
              style={{
                flexShrink: 0,
                color: isFeatured ? "var(--tl-gold)" : "var(--tl-green)",
                marginTop: 2,
              }}
            />
            <h3
              style={{
                fontFamily: "Instrument Serif, serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 22,
                letterSpacing: "-0.015em",
                lineHeight: 1.15,
                color: "var(--tl-fg)",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {parent.name}
            </h3>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              alignSelf: "flex-start",
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 10.5,
              fontWeight: 500,
              padding: "3px 10px",
              borderRadius: 999,
              background: isFeatured ? "rgba(233, 182, 73, 0.12)" : "var(--tl-green-glow)",
              color: isFeatured ? "var(--tl-gold)" : "var(--tl-green)",
              border: `1px solid ${isFeatured ? "rgba(233, 182, 73, 0.35)" : "rgba(0, 185, 107, 0.25)"}`,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {pt.subEventCount.replace("{count}", String(parent.subEventCount))}
          </span>
        </div>

        {/* Meta row */}
        {(parent.event_date || parent.location) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "4px 14px",
              marginTop: 10,
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 11,
              color: "var(--tl-fg-3)",
              letterSpacing: "0.02em",
            }}
          >
            {parent.event_date && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(parent.event_date), "dd/MM/yyyy")}
              </span>
            )}
            {parent.location && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MapPin className="w-3.5 h-3.5" />
                {parent.location}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          borderTop: `1px solid ${isFeatured ? "rgba(233, 182, 73, 0.18)" : "var(--tl-border)"}`,
        }}
      />

      {/* Sub-event preview list */}
      {parent.previewSubEvents.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {parent.previewSubEvents.map((se) => {
            const config = STATUS_CONFIG[se.status];
            return (
              <div
                key={se.id}
                onClick={(e) => handleSubEventClick(e, se.share_id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--tl-bg)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    color: "var(--tl-fg-4)",
                    fontFamily: "Geist Mono, ui-monospace, monospace",
                    fontSize: 13,
                  }}
                >
                  ◆
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: "var(--tl-fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {se.name}
                </span>
                {config && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: "Geist Mono, ui-monospace, monospace",
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: config.bg,
                      color: config.fg,
                    }}
                  >
                    {isVi ? config.labelVi : config.labelEn}
                  </span>
                )}
              </div>
            );
          })}

          {remaining > 0 && (
            <div
              onClick={handleHeaderClick}
              style={{
                fontFamily: "Geist Mono, ui-monospace, monospace",
                fontSize: 11,
                color: "var(--tl-fg-3)",
                textAlign: "center",
                paddingTop: 8,
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tl-green)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tl-fg-3)"; }}
            >
              {pt.moreEvents
                ? pt.moreEvents.replace("{count}", String(remaining))
                : `+ ${remaining} more`}
            </div>
          )}
        </div>
      ) : (
        // Empty state
        <div className="tl-empty-card" style={{ padding: "24px 16px" }}>
          <span className="tl-empty-card-mark">◌</span>
          <span className="tl-empty-card-label">
            {pt.noEventsYet || (isVi ? "Chưa có nội dung nào" : "No events yet")}
          </span>
          {isOwner && (
            <button
              type="button"
              className="tl-btn"
              onClick={handleAddEvent}
              style={{ marginTop: 12, padding: "6px 12px", fontSize: 12.5 }}
            >
              <Plus className="w-4 h-4" />
              {pt.addFirstEvent || pt.addSubEvent}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ParentTournamentCard;
