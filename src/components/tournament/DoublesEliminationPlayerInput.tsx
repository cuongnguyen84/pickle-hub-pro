// ============================================================================
// DoublesEliminationPlayerInput — dual-mode player slot for setup wizard
// ----------------------------------------------------------------------------
// DUPR Phase 1 (2026-05-29). Each team has 2 players; each slot can be:
//   - "text" mode (default): free-text name, no profile link, no DUPR
//   - "member" mode: search ThePickleHub members via useDuprUserSearch, pick
//     one → bind to profiles.id, display DUPR badge + lock name
//
// The toggle is per-slot so a team can have 1 linked + 1 text player (common:
// captain searches themselves, types partner's name offline).
// ============================================================================

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, UserCircle2, Loader2 } from "lucide-react";
import { useDuprUserSearch, type DuprSearchHit } from "@/hooks/useDuprUserSearch";
import { useI18n } from "@/i18n";

export interface PlayerSlot {
  /** Display name. Either typed or copied from profile. */
  name: string;
  /** Profile id when linked. Null in text mode. */
  user_id: string | null;
  /** Cached DUPR doubles (for setup preview only; DB authoritative is profile). */
  dupr_doubles: number | null;
}

interface Props {
  value: PlayerSlot;
  onChange: (next: PlayerSlot) => void;
  placeholder?: string;
  /** Profile ids already linked elsewhere — excluded from search dropdown. */
  excludeUserIds?: string[];
  /** When true the search button is hidden — used for legacy/locked rows. */
  disableSearch?: boolean;
}

export function DoublesEliminationPlayerInput({
  value,
  onChange,
  placeholder,
  excludeUserIds = [],
  disableSearch = false,
}: Props) {
  const { language } = useI18n();
  const vi = language === "vi";
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, isFetching } = useDuprUserSearch(query, {
    excludeUserIds,
    limit: 8,
  });

  const linked = value.user_id != null;

  function clearLink() {
    onChange({ name: "", user_id: null, dupr_doubles: null });
    setSearchOpen(false);
    setQuery("");
  }

  function pickHit(hit: DuprSearchHit) {
    if (!hit.user_id) return; // only internal hits with profile id can link
    onChange({
      name: hit.full_name,
      user_id: hit.user_id,
      dupr_doubles: hit.doubles_rating,
    });
    setSearchOpen(false);
    setQuery("");
  }

  // Linked state — locked input + DUPR chip + unlink button
  if (linked) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "rgba(34,197,94,0.06)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: "var(--tl-radius)",
          fontSize: 13,
          minHeight: 36,
        }}
      >
        <UserCircle2 className="w-4 h-4" style={{ color: "var(--tl-green)", flexShrink: 0 }} />
        <span style={{ flex: 1, color: "var(--tl-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value.name}
        </span>
        {value.dupr_doubles != null && (
          <span
            style={{
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 11,
              color: "var(--tl-green)",
              fontVariantNumeric: "tabular-nums",
              padding: "2px 6px",
              background: "rgba(34,197,94,0.12)",
              borderRadius: 4,
            }}
          >
            DUPR {value.dupr_doubles.toFixed(2)}
          </span>
        )}
        <button
          type="button"
          onClick={clearLink}
          aria-label={vi ? "Bỏ liên kết" : "Unlink"}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--tl-fg-3)",
            padding: 2,
            display: "flex",
            alignItems: "center",
          }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Text mode with optional search dropdown
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Input
          placeholder={placeholder ?? (vi ? "Tên VĐV" : "Player name")}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          style={{ flex: 1 }}
        />
        {!disableSearch && (
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={vi ? "Tìm member" : "Search member"}
            title={vi ? "Tìm member ThePickleHub để liên kết DUPR" : "Find ThePickleHub member to link DUPR"}
            className="tl-btn"
            style={{ padding: "8px 10px", fontSize: 12 }}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {searchOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--tl-bg-elev)",
            border: "1px solid var(--tl-border)",
            borderRadius: "var(--tl-radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            padding: 8,
          }}
        >
          <Input
            autoFocus
            placeholder={vi ? "Gõ ≥ 2 ký tự để tìm…" : "Type ≥ 2 chars to search…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          {isFetching && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--tl-fg-3)", fontSize: 12, padding: 6 }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {vi ? "Đang tìm…" : "Searching…"}
            </div>
          )}
          {!isFetching && query.trim().length >= 2 && (data?.hits ?? []).length === 0 && (
            <div style={{ color: "var(--tl-fg-3)", fontSize: 12, padding: 6 }}>
              {vi ? "Không tìm thấy member nào." : "No members found."}
            </div>
          )}
          <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {(data?.hits ?? []).map((hit, idx) => {
              const canLink = hit.user_id != null;
              return (
                <button
                  key={`${hit.user_id ?? hit.dupr_id ?? idx}`}
                  type="button"
                  onClick={() => pickHit(hit)}
                  disabled={!canLink}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: "1px solid var(--tl-border)",
                    borderRadius: "var(--tl-radius)",
                    background: canLink ? "var(--tl-bg)" : "var(--tl-surface)",
                    cursor: canLink ? "pointer" : "not-allowed",
                    opacity: canLink ? 1 : 0.55,
                    textAlign: "left",
                  }}
                  title={!canLink ? (vi ? "Member này chưa có tài khoản ThePickleHub — không thể liên kết." : "This member has no ThePickleHub account — cannot link.") : undefined}
                >
                  <UserCircle2 className="w-4 h-4" style={{ color: "var(--tl-fg-3)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--tl-fg)" }}>{hit.full_name}</span>
                  {hit.doubles_rating != null && (
                    <span
                      style={{
                        fontFamily: "Geist Mono, ui-monospace, monospace",
                        fontSize: 11,
                        color: "var(--tl-green)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      D {hit.doubles_rating.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
