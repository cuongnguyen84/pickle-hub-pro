import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Calendar, Crown, MapPin, Plus, Sparkles, Trophy } from "lucide-react";
import { displayChampionName } from "@/lib/championDisplay";
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
    bg: "var(--tl-blue-glow)",
    fg: "var(--tl-blue)",
  },
  playoff: {
    labelVi: "Playoff",
    labelEn: "Playoff",
    bg: "var(--tl-gold-glow)",
    fg: "var(--tl-gold)",
  },
  completed: {
    labelVi: "Đã kết thúc",
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
      className={isFeatured
        ? "group transition duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
        : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        padding: 20,
        borderRadius: "var(--tl-radius-lg)",
        background: isFeatured
          ? "radial-gradient(circle at 100% 0%, rgba(233, 182, 73, 0.13), transparent 36%), var(--tl-bg-elev)"
          : "var(--tl-bg-elev)",
        border: `1px solid ${isFeatured ? "rgba(233, 182, 73, 0.35)" : "var(--tl-border)"}`,
        boxShadow: isFeatured ? "0 18px 50px rgba(0, 0, 0, 0.12)" : undefined,
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

      {isFeatured && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 6,
            padding: "4px 9px",
            borderRadius: 999,
            background: "rgba(233, 182, 73, 0.1)",
            border: "1px solid rgba(233, 182, 73, 0.25)",
            color: "var(--tl-gold)",
            fontFamily: "Geist Mono, ui-monospace, monospace",
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {isVi ? "Giải tổng nổi bật" : "Featured multi-event"}
        </span>
      )}

      {/* Header — clickable to parent page */}
      <button
        type="button"
        onClick={handleHeaderClick}
        className="w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-gold)] focus-visible:ring-offset-2"
        style={{
          cursor: "pointer",
          border: 0,
          padding: 0,
          background: "transparent",
          color: "inherit",
        }}
      >
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
      </button>

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
            // Champion thay thế pill trạng thái trên row sub-event; per sub-event,
            // không tổng hợp cấp card cha (4 nội dung thi đấu = 4 nhà vô địch).
            const champion = displayChampionName(se.champion_name);
            return (
              <button
                type="button"
                key={se.id}
                onClick={(e) => handleSubEventClick(e, se.share_id)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-gold)]"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  minHeight: 44,
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
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
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span
                    style={{
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
                  {champion && (
                    <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                      <Crown size={12} aria-hidden="true" style={{ color: "var(--tl-fg-3)", flexShrink: 0, alignSelf: "center" }} />
                      <span
                        style={{
                          fontFamily: "Geist Mono, ui-monospace, monospace",
                          fontSize: 10,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "var(--tl-fg-3)",
                          flexShrink: 0,
                        }}
                      >
                        {isVi ? "Vô địch:" : "Champion:"}
                      </span>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "var(--tl-fg)",
                          minWidth: 0,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {champion}
                      </span>
                    </span>
                  )}
                </span>
                {config && !champion && (
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
              </button>
            );
          })}

          {remaining > 0 && (
            <button
              type="button"
              onClick={handleHeaderClick}
              className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-green)]"
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
                border: 0,
                background: "transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tl-green)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tl-fg-3)"; }}
            >
              {pt.moreEvents
                ? pt.moreEvents.replace("{count}", String(remaining))
                : `+ ${remaining} more`}
            </button>
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

      {isFeatured && (
        <button
          type="button"
          className="mt-auto inline-flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-[rgba(233,182,73,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-gold)]"
          style={{
            borderColor: "rgba(233, 182, 73, 0.28)",
            color: "var(--tl-gold)",
          }}
          onClick={handleHeaderClick}
        >
          {t.tournament.viewTournament}
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default ParentTournamentCard;
