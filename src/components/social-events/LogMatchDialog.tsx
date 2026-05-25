// ============================================================================
// LogMatchDialog — organizer-only form to log a club match.
// ----------------------------------------------------------------------------
// Restyled in the TheLine vocabulary (Login.tsx is the canonical reference):
//   - Instrument Serif italic for the title
//   - Geist Mono uppercase eyebrow labels
//   - Inputs are transparent with a 1px bottom border, no rounded corners
//   - Section dividers are 1px lines, no shadcn Cards
//   - tl-btn / tl-btn.primary for the action row
//
// Functionality is unchanged: calls log_club_match RPC (migration
// 20260525120000) which atomically inserts a `matches` row + per-team
// `match_participants` rows. Player picker is constrained to the active
// member roster of the club so we never tag a non-member.
// ============================================================================

import { useMemo, useState, type CSSProperties } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import {
  useClubEligiblePlayers,
  useLogClubMatch,
  type ClubPlayerRole,
  type MatchFormat,
} from "@/hooks/useClubMatches";

interface Props {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PickerOption {
  id: string;
  label: string;
  role: ClubPlayerRole;
}

function roleSuffix(role: ClubPlayerRole, lang: "vi" | "en"): string {
  if (lang === "vi") {
    return role === "creator"
      ? " · Người tạo"
      : role === "manager"
        ? " · Quản lý"
        : "";
  }
  return role === "creator"
    ? " · Creator"
    : role === "manager"
      ? " · Manager"
      : "";
}

const MAX_GAMES = 5;
const DEFAULT_GAMES = 3;

function todayLocalDatetimeString(): string {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
}

// ─── Shared TheLine inline style primitives ───────────────────────────────

const labelStyle: CSSProperties = {
  display: "block",
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--tl-fg-3)",
  marginBottom: 8,
};

const fieldStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--tl-border)",
  borderRadius: 0,
  padding: "10px 0",
  fontSize: 15,
  fontFamily: "inherit",
  color: "var(--tl-fg)",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
};

const sectionStyle: CSSProperties = {
  padding: "20px 0",
  borderTop: "1px solid var(--tl-border)",
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const sectionLabelStyle: CSSProperties = {
  ...labelStyle,
  marginBottom: 0,
};

const scoreCellStyle: CSSProperties = {
  width: 56,
  textAlign: "center",
  fontFamily: "'Geist Mono', monospace",
  fontSize: 16,
  background: "transparent",
  border: "1px solid var(--tl-border)",
  borderRadius: 6,
  padding: "8px 4px",
  color: "var(--tl-fg)",
  outline: "none",
};

export function LogMatchDialog({ clubId, open, onOpenChange, onSuccess }: Props) {
  const { t, language } = useI18n();
  const m = t.socialEvents.matches;

  // Eligible roster = creator + managers + active members. The log_club_match
  // RPC accepts any of these via is_club_organizer / is_club_member checks,
  // so the picker must surface them all (not just the club_members rows).
  const { players, isLoading: membersLoading } = useClubEligiblePlayers(clubId);
  const memberOptions = useMemo<PickerOption[]>(
    () =>
      players.map((row) => ({
        id: row.profile_id,
        label: (row.display_name?.trim() || "—") + roleSuffix(row.role, language),
        role: row.role,
      })),
    [players, language],
  );

  // Form state.
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [playedAt, setPlayedAt] = useState<string>(todayLocalDatetimeString);
  const [teamA, setTeamA] = useState<string[]>(["", ""]);
  const [teamB, setTeamB] = useState<string[]>(["", ""]);
  const [scores, setScores] = useState<{ a: string; b: string }[]>(
    () => Array.from({ length: DEFAULT_GAMES }, () => ({ a: "", b: "" })),
  );
  const [notes, setNotes] = useState("");

  const teamSize = format === "singles" ? 1 : 2;

  const logMatch = useLogClubMatch(clubId);

  function resetForm() {
    setFormat("doubles");
    setPlayedAt(todayLocalDatetimeString());
    setTeamA(["", ""]);
    setTeamB(["", ""]);
    setScores(Array.from({ length: DEFAULT_GAMES }, () => ({ a: "", b: "" })));
    setNotes("");
  }

  function handleFormatChange(next: MatchFormat) {
    setFormat(next);
    const size = next === "singles" ? 1 : 2;
    setTeamA((prev) => {
      const arr = [...prev];
      arr.length = size;
      for (let i = 0; i < size; i++) arr[i] = arr[i] ?? "";
      return arr;
    });
    setTeamB((prev) => {
      const arr = [...prev];
      arr.length = size;
      for (let i = 0; i < size; i++) arr[i] = arr[i] ?? "";
      return arr;
    });
  }

  function setPlayer(
    team: "a" | "b",
    index: number,
    profileId: string,
  ): void {
    const setter = team === "a" ? setTeamA : setTeamB;
    setter((prev) => {
      const arr = [...prev];
      arr[index] = profileId;
      return arr;
    });
  }

  function addGame(): void {
    if (scores.length >= MAX_GAMES) return;
    setScores((prev) => [...prev, { a: "", b: "" }]);
  }

  function removeGame(index: number): void {
    if (scores.length <= 1) return;
    setScores((prev) => prev.filter((_, i) => i !== index));
  }

  function updateScore(index: number, team: "a" | "b", value: string): void {
    setScores((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [team]: value };
      return arr;
    });
  }

  function validateForm(): string | null {
    if (teamA.slice(0, teamSize).some((id) => !id)) return m.errMissingPlayers;
    if (teamB.slice(0, teamSize).some((id) => !id)) return m.errMissingPlayers;

    const all = [...teamA.slice(0, teamSize), ...teamB.slice(0, teamSize)];
    if (new Set(all).size !== all.length) return m.errDuplicatePlayer;

    for (const game of scores) {
      if (game.a === "" || game.b === "") return m.errIncompleteScore;
      const a = Number(game.a);
      const b = Number(game.b);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
        return m.errInvalidScore;
      }
    }
    return null;
  }

  async function handleSubmit(): Promise<void> {
    const err = validateForm();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    try {
      await logMatch.mutateAsync({
        format,
        playedAt: new Date(playedAt).toISOString(),
        teamAScore: scores.map((g) => Number(g.a)),
        teamBScore: scores.map((g) => Number(g.b)),
        teamAPlayers: teamA.slice(0, teamSize),
        teamBPlayers: teamB.slice(0, teamSize),
        notes: notes.trim() || undefined,
      });
      toast({ title: m.logSuccess });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const msg =
        code === "player_not_in_club"
          ? m.errPlayerNotInClub
          : code === "duplicate_player"
            ? m.errDuplicatePlayer
            : code === "team_size_mismatch"
              ? m.errMissingPlayers
              : code === "not_authorized"
                ? t.socialEvents.managers.errNotAuthorized
                : m.logError;
      toast({ title: msg, variant: "destructive" });
    }
  }

  function renderPlayerPicker(team: "a" | "b", index: number): JSX.Element {
    const value = (team === "a" ? teamA : teamB)[index] ?? "";
    return (
      <select
        key={`${team}-${index}`}
        value={value}
        onChange={(e) => setPlayer(team, index, e.target.value)}
        style={fieldStyle}
        aria-label={`${team === "a" ? m.teamA : m.teamB} ${index + 1}`}
      >
        <option value="">{m.selectPlayer}</option>
        {memberOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[92vh] overflow-y-auto p-0 border-0"
        style={{
          background: "var(--tl-bg)",
          color: "var(--tl-fg)",
          borderRadius: 14,
        }}
      >
        <VisuallyHidden>
          <DialogTitle>{m.logDialogTitle}</DialogTitle>
          <DialogDescription>{m.logDialogDesc}</DialogDescription>
        </VisuallyHidden>

        <div style={{ padding: "28px 26px 22px" }}>
          {/* Eyebrow + serif title — matches Login.tsx hero treatment */}
          <div className="tl-eyebrow" style={{ marginBottom: 10 }}>
            <span className="pip" />
            <span>{m.logCta.toUpperCase()}</span>
          </div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 30,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              margin: "0 0 8px",
              color: "var(--tl-fg)",
            }}
          >
            {m.logDialogTitle}.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--tl-fg-3)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {m.logDialogDesc}
          </p>
        </div>

        <div style={{ padding: "0 26px" }}>
          {/* Format + datetime */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
              paddingBottom: 4,
            }}
          >
            <div>
              <label htmlFor="lm-format" style={labelStyle}>
                {m.format}
              </label>
              <select
                id="lm-format"
                value={format}
                onChange={(e) => handleFormatChange(e.target.value as MatchFormat)}
                style={fieldStyle}
              >
                <option value="singles">{m.formatSingles}</option>
                <option value="doubles">{m.formatDoubles}</option>
                <option value="mixed">{m.formatMixed}</option>
              </select>
            </div>
            <div>
              <label htmlFor="lm-played-at" style={labelStyle}>
                {m.playedAt}
              </label>
              <input
                id="lm-played-at"
                type="datetime-local"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>

          {/* Teams */}
          <div style={sectionStyle}>
            {membersLoading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "12px 0",
                }}
              >
                <Loader2
                  className="h-5 w-5 animate-spin"
                  style={{ color: "var(--tl-fg-3)" }}
                />
              </div>
            ) : memberOptions.length === 0 ? (
              <p
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "var(--tl-fg-3)",
                  margin: 0,
                }}
              >
                {m.noActiveMembers}
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 18,
                }}
              >
                <div>
                  <div style={labelStyle}>{m.teamA}</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {Array.from({ length: teamSize }).map((_, i) =>
                      renderPlayerPicker("a", i),
                    )}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>{m.teamB}</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {Array.from({ length: teamSize }).map((_, i) =>
                      renderPlayerPicker("b", i),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scores */}
          <div style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <span style={sectionLabelStyle}>{m.scores}</span>
              <button
                type="button"
                onClick={addGame}
                disabled={scores.length >= MAX_GAMES}
                className="tl-btn"
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  opacity: scores.length >= MAX_GAMES ? 0.4 : 1,
                }}
              >
                <Plus className="h-3 w-3" /> {m.addGame}
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {scores.map((g, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 11,
                      color: "var(--tl-fg-4)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      width: 52,
                      flexShrink: 0,
                    }}
                  >
                    {m.game} {i + 1}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={g.a}
                    onChange={(e) => updateScore(i, "a", e.target.value)}
                    placeholder="A"
                    style={scoreCellStyle}
                  />
                  <span style={{ color: "var(--tl-fg-4)", fontSize: 16 }}>—</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={g.b}
                    onChange={(e) => updateScore(i, "b", e.target.value)}
                    placeholder="B"
                    style={scoreCellStyle}
                  />
                  {scores.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGame(i)}
                      aria-label="Remove game"
                      style={{
                        marginLeft: "auto",
                        background: "transparent",
                        border: "none",
                        color: "var(--tl-fg-4)",
                        cursor: "pointer",
                        padding: 4,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={sectionStyle}>
            <label htmlFor="lm-notes" style={labelStyle}>
              {m.notesOptional}
            </label>
            <textarea
              id="lm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={m.notesPlaceholder}
              rows={2}
              maxLength={500}
              style={{
                ...fieldStyle,
                resize: "vertical",
                minHeight: 60,
              }}
            />
          </div>
        </div>

        {/* Action row — also separated by a top border to keep rhythm */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "16px 26px 24px",
            borderTop: "1px solid var(--tl-border)",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="tl-btn"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={logMatch.isPending || memberOptions.length === 0}
            className="tl-btn green"
            style={{
              opacity:
                logMatch.isPending || memberOptions.length === 0 ? 0.6 : 1,
            }}
          >
            {logMatch.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {m.logSubmit}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
