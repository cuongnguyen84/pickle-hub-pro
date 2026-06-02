// ============================================================================
// ClubDisputeResolver — organizer surface for resolving disputed club matches.
// ----------------------------------------------------------------------------
// Rendered on /clb/:slug above the matches list. Visible only to club
// organizers/managers when their club has disputed matches. Reuses the
// list_resolvable_disputes RPC (club-scoped for organizers) + the
// useResolveMatchDispute hook (accept | edit → verified + DUPR push).
// Renders nothing when there is nothing to resolve.
// ============================================================================

import { useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import {
  useResolvableDisputes,
  useResolveMatchDispute,
  type ResolvableDispute,
} from "@/hooks/useDisputes";

interface Props {
  clubId: string;
  isOrganizer: boolean;
}

const eyebrow: CSSProperties = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--tl-fg-3)",
};

const cardStyle: CSSProperties = {
  background: "var(--tl-surface)",
  border: "1px solid var(--tl-border)",
  borderRadius: 14,
  padding: 16,
};

export function ClubDisputeResolver({ clubId, isOrganizer }: Props) {
  const { language } = useI18n();
  const vi = language === "vi";
  const { disputes } = useResolvableDisputes();
  const clubDisputes = disputes.filter((d) => d.club_id === clubId);

  if (!isOrganizer || clubDisputes.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <div className="tl-eyebrow" style={{ marginBottom: 8 }}>
        <span className="pip" style={{ background: "var(--tl-live, #ef4444)" }} />
        <span>{vi ? "Tranh chấp cần xử lý" : "Disputes to resolve"}</span>
      </div>
      <h3
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: 24,
          margin: "0 0 14px",
          color: "var(--tl-fg)",
        }}
      >
        {vi ? "Trọng tài CLB." : "Club referee."}
      </h3>
      <div style={{ display: "grid", gap: 12 }}>
        {clubDisputes.map((d) => (
          <DisputeRow key={d.id} dispute={d} vi={vi} />
        ))}
      </div>
    </section>
  );
}

function teamNames(players: ResolvableDispute["team_a_players"]): string {
  return players.map((p) => p.display_name ?? "—").join(" / ") || "—";
}

function DisputeRow({ dispute, vi }: { dispute: ResolvableDispute; vi: boolean }) {
  const resolve = useResolveMatchDispute();
  const [editing, setEditing] = useState(false);
  const [aScores, setAScores] = useState<number[]>(dispute.team_a_score);
  const [bScores, setBScores] = useState<number[]>(dispute.team_b_score);
  const busy = resolve.isPending;

  function done(res: Awaited<ReturnType<typeof resolve.mutateAsync>>) {
    const dupr = res.dupr;
    toast({
      title: vi ? "Đã xử lý tranh chấp" : "Dispute resolved",
      description:
        dupr.ok && dupr.matchCode
          ? vi ? `Đã gửi DUPR · ${dupr.matchCode}` : `Sent to DUPR · ${dupr.matchCode}`
          : dupr.skipped
            ? vi ? "Đã xác nhận (chưa gửi DUPR — thiếu DUPR ID)." : "Verified (no DUPR ID)."
            : vi ? `Đã xác nhận. Gửi DUPR lỗi: ${dupr.reason ?? ""}` : `Verified. DUPR failed: ${dupr.reason ?? ""}`,
    });
  }

  function fail(e: unknown) {
    toast({
      variant: "destructive",
      title: vi ? "Lỗi" : "Failed",
      description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
  }

  async function accept() {
    try {
      done(await resolve.mutateAsync({ dispute, action: "accept" }));
    } catch (e) {
      fail(e);
    }
  }

  async function saveEdit() {
    try {
      const res = await resolve.mutateAsync({
        dispute,
        action: "edit",
        teamAScore: aScores,
        teamBScore: bScores,
      });
      setEditing(false);
      done(res);
    } catch (e) {
      fail(e);
    }
  }

  const setAt = (arr: number[], i: number, v: number) =>
    arr.map((x, idx) => (idx === i ? v : x));

  return (
    <article style={cardStyle}>
      <div style={{ ...eyebrow, display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "var(--tl-live, #ef4444)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle style={{ width: 12, height: 12 }} />
          {vi ? "Tranh chấp" : "Disputed"} · {dispute.format}
        </span>
        <span>{new Date(dispute.played_at).toLocaleDateString(vi ? "vi-VN" : "en-US")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--tl-fg)", fontWeight: dispute.winning_team === "a" ? 600 : 400, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {teamNames(dispute.team_a_players)}
        </span>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {aScores.map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" min={0} value={aScores[i]} onChange={(e) => setAScores(setAt(aScores, i, Number(e.target.value)))} style={scoreInput} />
                <span style={{ color: "var(--tl-fg-3)" }}>–</span>
                <input type="number" min={0} value={bScores[i]} onChange={(e) => setBScores(setAt(bScores, i, Number(e.target.value)))} style={scoreInput} />
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 18, color: "var(--tl-fg)", whiteSpace: "nowrap" }}>
            {dispute.team_a_score.join(" ")} <span style={{ color: "var(--tl-fg-3)" }}>–</span> {dispute.team_b_score.join(" ")}
          </span>
        )}
        <span style={{ textAlign: "right", color: "var(--tl-fg)", fontWeight: dispute.winning_team === "b" ? 600 : 400, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {teamNames(dispute.team_b_players)}
        </span>
      </div>

      {dispute.dispute_reasons.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--tl-fg-2)", lineHeight: 1.5 }}>
          {dispute.dispute_reasons.map((r, i) => (
            <div key={i}>
              <strong style={{ color: "var(--tl-fg)" }}>{r.name ?? "—"}</strong>
              {r.reason ? `: ${r.reason}` : ` — ${vi ? "không nêu lý do" : "no reason"}`}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        {editing ? (
          <>
            <button type="button" className="tl-btn" disabled={busy} onClick={() => setEditing(false)}>
              <X style={{ width: 14, height: 14 }} /> {vi ? "Huỷ" : "Cancel"}
            </button>
            <button type="button" className="tl-btn primary" disabled={busy} onClick={saveEdit} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
              {vi ? "Lưu & xác nhận" : "Save & verify"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="tl-btn" disabled={busy} onClick={() => setEditing(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Pencil style={{ width: 14, height: 14 }} /> {vi ? "Sửa tỉ số" : "Edit score"}
            </button>
            <button type="button" className="tl-btn primary" disabled={busy} onClick={accept} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
              {vi ? "Chấp nhận tỉ số" : "Accept score"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

const scoreInput: CSSProperties = {
  width: 48,
  height: 32,
  textAlign: "center",
  fontFamily: "'Geist Mono', monospace",
  background: "var(--tl-bg)",
  border: "1px solid var(--tl-border)",
  borderRadius: 6,
  color: "var(--tl-fg)",
};
