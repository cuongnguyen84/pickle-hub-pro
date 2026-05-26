// ============================================================================
// /match/new — three-step mobile-first match logging flow
// ----------------------------------------------------------------------------
// Step 1: Pick opponents (inline pickers — search expands at the row)
// Step 2: Enter scores
// Step 3: Review + club picker + submit → match_proposal (pending_verify)
// ============================================================================

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X, ArrowLeft, Check, Search, Plus } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDuprClubs } from "@/hooks/useDuprClubs";
import { useRecentOpponents } from "@/hooks/useRecentOpponents";
import { useDuprUserSearch } from "@/hooks/useDuprUserSearch";
import { useDuprConnection } from "@/hooks/useDuprConnection";

type Step = 1 | 2 | 3;
type Slot = "a2" | "b1" | "b2";

interface PickedPlayer {
  player_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
}

const LAST_CLUB_KEY = "tph.match-new.last-club-id";

export default function MatchNew() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const vi = language === "vi";
  const userId = user?.id ?? null;

  const { data: conn } = useDuprConnection();
  const clubs = useDuprClubs();
  const recent = useRecentOpponents(userId);

  const [step, setStep] = useState<Step>(1);
  const [teamA2, setTeamA2] = useState<PickedPlayer | null>(null);
  const [teamB1, setTeamB1] = useState<PickedPlayer | null>(null);
  const [teamB2, setTeamB2] = useState<PickedPlayer | null>(null);

  const [g1a, setG1a] = useState<number>(11);
  const [g1b, setG1b] = useState<number>(7);
  const [g2a, setG2a] = useState<number | "">("");
  const [g2b, setG2b] = useState<number | "">("");
  const [g3a, setG3a] = useState<number | "">("");
  const [g3b, setG3b] = useState<number | "">("");
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);

  const [clubId, setClubId] = useState<number | "">(() => {
    try {
      const v = localStorage.getItem(LAST_CLUB_KEY);
      return v ? Number(v) : "";
    } catch {
      return "";
    }
  });
  const [submitting, setSubmitting] = useState(false);

  const isDoubles = !!(teamA2 && teamB2);

  const excludeIds = useMemo(() => {
    const ids = new Set<string>();
    if (userId) ids.add(userId);
    [teamA2, teamB1, teamB2].forEach((p) => p && ids.add(p.player_id));
    return ids;
  }, [userId, teamA2, teamB1, teamB2]);

  const pickPlayer = (slot: Slot, p: PickedPlayer) => {
    if (slot === "a2") setTeamA2(p);
    if (slot === "b1") setTeamB1(p);
    if (slot === "b2") setTeamB2(p);
  };

  const removePlayer = (slot: Slot) => {
    if (slot === "a2") setTeamA2(null);
    if (slot === "b1") setTeamB1(null);
    if (slot === "b2") setTeamB2(null);
  };

  const submit = async () => {
    if (!user || !teamB1) return;

    // Codex P1 fix: doubles needs partners on BOTH sides. If the wizard
    // ever lets the user pick teamA2 without teamB2 (or vice-versa), the
    // payload becomes singles-format + 2-player team, which the backend
    // rejects with `singles_needs_one_player_per_side`. Block early with
    // a clear toast instead of silently failing at submit.
    const wantsDoubles = !!(teamA2 || teamB2);
    if (wantsDoubles && (!teamA2 || !teamB2)) {
      toast({
        variant: "destructive",
        title: vi ? "Thiếu partner" : "Missing partner",
        description: vi
          ? "Doubles cần partner ở cả 2 đội. Chọn partner cho đội còn lại, hoặc xoá partner để chuyển về singles."
          : "Doubles needs a partner on both sides. Pick a partner for the other team, or remove the partner to fall back to singles.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const team_a_player_ids = teamA2 ? [user.id, teamA2.player_id] : [user.id];
      const team_b_player_ids = teamB2 ? [teamB1.player_id, teamB2.player_id] : [teamB1.player_id];
      const team_a_scores = [g1a];
      const team_b_scores = [g1b];
      if (show2 && g2a !== "" && g2b !== "") {
        team_a_scores.push(Number(g2a));
        team_b_scores.push(Number(g2b));
      }
      if (show3 && g3a !== "" && g3b !== "") {
        team_a_scores.push(Number(g3a));
        team_b_scores.push(Number(g3b));
      }
      const { data, error } = await supabase.functions.invoke("match-proposal", {
        body: {
          action: "create",
          format: isDoubles ? "DOUBLES" : "SINGLES",
          match_date: new Date().toISOString().slice(0, 10),
          club_id: clubId === "" ? null : Number(clubId),
          team_a_player_ids,
          team_b_player_ids,
          team_a_scores,
          team_b_scores,
        },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        let detail = error.message;
        if (ctx) {
          try {
            const body = await ctx.clone().json();
            detail = body.error ?? body.code ?? detail;
          } catch { /* keep */ }
        }
        throw new Error(detail);
      }
      if (clubId !== "") {
        try { localStorage.setItem(LAST_CLUB_KEY, String(clubId)); } catch { /* ignore */ }
      }
      toast({
        title: vi ? "Đã gửi" : "Sent",
        description: vi ? "Đối thủ sẽ nhận thông báo xác nhận." : "Your opponent has been notified.",
      });
      qc.invalidateQueries({ queryKey: ["match-proposals"] });
      // Clean redirect to /match — the page itself defaults to the
      // "Đợi confirm" tab and has its own "+ Log trận mới" entry point.
      // Skip ?tab= / ?just= so the URL stays readable.
      navigate("/match");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: vi ? "Lỗi" : "Submit failed", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Guards ─────────────────────────────────────────────────────────
  if (authLoading) {
    return <TheLineLayout><div style={{ padding: 48 }}><Loader2 className="h-5 w-5 animate-spin" /></div></TheLineLayout>;
  }
  if (!user) {
    return (
      <TheLineLayout>
        <div style={{ padding: 48 }}>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
            {vi ? "Cần đăng nhập" : "Sign in required"}
          </h1>
        </div>
      </TheLineLayout>
    );
  }
  if (!conn?.ssoConnected) {
    return (
      <TheLineLayout>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 40, lineHeight: 1, margin: "0 0 16px" }}>
            {vi ? "Kết nối DUPR trước" : "Connect DUPR first"}
          </h1>
          <p style={{ color: "var(--tl-fg-2)", margin: "0 0 24px", lineHeight: 1.55 }}>
            {vi
              ? "Để log trận và đẩy kết quả lên DUPR, anh cần kết nối DUPR một lần. Mất ~30 giây."
              : "To log matches and push results to DUPR, you need to connect once. Takes ~30 seconds."}
          </p>
          <button type="button" className="tl-btn primary" onClick={() => navigate("/dupr")}>
            {vi ? "Mở Cài đặt DUPR →" : "Open DUPR settings →"}
          </button>
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 20px 80px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          {step > 1 ? (
            <button
              type="button"
              aria-label={vi ? "Quay lại" : "Back"}
              onClick={() => setStep((s) => (s - 1) as Step)}
              style={{ background: "transparent", border: "none", color: "var(--tl-fg-2)", padding: 8, cursor: "pointer" }}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span style={{ width: 36 }} />
          )}
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-fg-3)" }}>
            {vi ? `Bước ${step} / 3` : `Step ${step} / 3`}
          </span>
          <button
            type="button"
            aria-label={vi ? "Đóng" : "Close"}
            onClick={() => navigate(-1)}
            style={{ background: "transparent", border: "none", color: "var(--tl-fg-3)", padding: 8, cursor: "pointer" }}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div style={{ display: "flex", gap: 6, margin: "0 0 28px" }}>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              style={{ height: 3, flex: 1, background: i <= step ? "var(--tl-green)" : "var(--tl-border)", borderRadius: 1.5 }}
            />
          ))}
        </div>

        {step === 1 && (
          <Step1
            vi={vi}
            self={{
              player_id: user.id,
              display_name: user.user_metadata?.display_name ?? user.email ?? "",
              email: user.email ?? "",
              username: null,
            }}
            teamA2={teamA2}
            teamB1={teamB1}
            teamB2={teamB2}
            recents={recent.data ?? []}
            excludeIds={excludeIds}
            onPick={pickPlayer}
            onRemove={removePlayer}
            isDoubles={isDoubles}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <Step2
            vi={vi}
            self={user.user_metadata?.display_name ?? user.email ?? "You"}
            teamA2Name={teamA2?.display_name ?? teamA2?.email ?? null}
            teamB1Name={teamB1?.display_name ?? teamB1?.email ?? "Opponent"}
            teamB2Name={teamB2?.display_name ?? teamB2?.email ?? null}
            isDoubles={isDoubles}
            g1a={g1a} g1b={g1b}
            g2a={g2a} g2b={g2b}
            g3a={g3a} g3b={g3b}
            show2={show2} show3={show3}
            onChange={(field, value) => {
              if (field === "g1a") setG1a(value as number);
              if (field === "g1b") setG1b(value as number);
              if (field === "g2a") setG2a(value);
              if (field === "g2b") setG2b(value);
              if (field === "g3a") setG3a(value);
              if (field === "g3b") setG3b(value);
            }}
            onAdd2={() => setShow2(true)}
            onAdd3={() => setShow3(true)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3
            vi={vi}
            isDoubles={isDoubles}
            self={user.user_metadata?.display_name ?? user.email ?? "You"}
            teamA2Name={teamA2?.display_name ?? teamA2?.email ?? null}
            teamB1Name={teamB1?.display_name ?? teamB1?.email ?? "Opponent"}
            teamB2Name={teamB2?.display_name ?? teamB2?.email ?? null}
            scoresA={[g1a, ...(show2 && g2a !== "" ? [Number(g2a)] : []), ...(show3 && g3a !== "" ? [Number(g3a)] : [])]}
            scoresB={[g1b, ...(show2 && g2b !== "" ? [Number(g2b)] : []), ...(show3 && g3b !== "" ? [Number(g3b)] : [])]}
            clubs={clubs.submitterClubs.length > 0 ? clubs.submitterClubs : clubs.clubs}
            clubId={clubId}
            setClubId={setClubId}
            submitting={submitting}
            onSubmit={submit}
          />
        )}
      </div>
    </TheLineLayout>
  );
}

// ─── Step 1: pick opponents (inline pickers) ──────────────────────────
function Step1(props: {
  vi: boolean;
  self: PickedPlayer;
  teamA2: PickedPlayer | null;
  teamB1: PickedPlayer | null;
  teamB2: PickedPlayer | null;
  recents: Array<{ player_id: string; display_name: string | null; email: string; username: string | null }>;
  excludeIds: Set<string>;
  onPick: (slot: Slot, p: PickedPlayer) => void;
  onRemove: (slot: Slot) => void;
  isDoubles: boolean;
  onContinue: () => void;
}) {
  const { vi } = props;
  const canContinue = !!props.teamB1;
  const continueLabel = props.isDoubles
    ? (vi ? "Tiếp tục — đôi 2v2" : "Continue — doubles 2v2")
    : props.teamB1
      ? (vi ? "Tiếp tục — đơn 1v1" : "Continue — singles 1v1")
      : (vi ? "Tiếp tục" : "Continue");

  return (
    <>
      <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 32px" }}>
        {vi ? <>Đối thủ của<br />anh là <i>ai?</i></> : <>Who are<br />your <i>opponents?</i></>}
      </h1>

      <Group label={vi ? "Bên anh · Team A" : "Your side · Team A"}>
        <SelectedRow
          self
          name={props.self.display_name ?? props.self.email}
          subtitle={vi ? "Bạn" : "You"}
        />
        <SlotRow
          vi={vi}
          slot="a2"
          picked={props.teamA2}
          addLabel={vi ? "Thêm partner (doubles)" : "Add partner (doubles)"}
          recents={props.recents}
          excludeIds={props.excludeIds}
          onPick={(p) => props.onPick("a2", p)}
          onRemove={() => props.onRemove("a2")}
        />
      </Group>

      <Group label={vi ? "Bên kia · Team B" : "Other side · Team B"}>
        <SlotRow
          vi={vi}
          slot="b1"
          picked={props.teamB1}
          addLabel={vi ? "Chọn đối thủ" : "Pick opponent"}
          recents={props.recents}
          excludeIds={props.excludeIds}
          onPick={(p) => props.onPick("b1", p)}
          onRemove={() => props.onRemove("b1")}
        />
        {props.teamA2 && (
          <SlotRow
            vi={vi}
            slot="b2"
            picked={props.teamB2}
            addLabel={vi ? "Đối thủ thứ 2" : "Second opponent"}
            recents={props.recents}
            excludeIds={props.excludeIds}
            onPick={(p) => props.onPick("b2", p)}
            onRemove={() => props.onRemove("b2")}
          />
        )}
      </Group>

      <div style={{ marginTop: 32 }}>
        <button
          type="button"
          className="tl-btn primary"
          disabled={!canContinue}
          onClick={props.onContinue}
          style={{ width: "100%", padding: 18, fontSize: 12, opacity: canContinue ? 1 : 0.5 }}
        >
          {continueLabel}
        </button>
      </div>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-fg-3)", margin: "0 0 8px" }}>
        {label}
      </div>
      {children}
    </section>
  );
}

function SelectedRow(props: { self?: boolean; name: string; subtitle: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "36px 1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 4px",
        borderBottom: "1px solid var(--tl-border)",
      }}
    >
      <Avatar name={props.name} />
      <div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 19, color: "var(--tl-green)", lineHeight: 1.1 }}>{props.name}</div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--tl-fg-3)", marginTop: 3 }}>{props.subtitle}</div>
      </div>
      <Check className="h-4 w-4" style={{ color: "var(--tl-green)" }} />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "1px solid var(--tl-border-strong)",
        background: "linear-gradient(135deg, #1f1f1c, #0a0a0a)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 14, color: "var(--tl-fg-2)",
      }}
    >
      {name?.charAt(0)?.toUpperCase() ?? "—"}
    </span>
  );
}

function SlotRow(props: {
  vi: boolean;
  slot: Slot;
  picked: PickedPlayer | null;
  addLabel: string;
  recents: Array<{ player_id: string; display_name: string | null; email: string; username: string | null }>;
  excludeIds: Set<string>;
  onPick: (p: PickedPlayer) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { vi } = props;

  // DUPR + internal merged search (replaces inline ILIKE on profiles).
  // Hook debounces 350ms internally, hits dupr-user-search edge function
  // which calls DUPR Partner /user/v1.0/search + merges with local
  // profiles, sorted: both > internal > dupr-only.
  const search = useDuprUserSearch(q, {
    excludeUserIds: Array.from(props.excludeIds),
    limit: 10,
  });

  // Picked state — render as selected row + small remove
  if (props.picked) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr auto",
          gap: 12,
          alignItems: "center",
          padding: "12px 4px",
          borderBottom: "1px solid var(--tl-border)",
        }}
      >
        <Avatar name={props.picked.display_name ?? props.picked.email} />
        <div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 19, color: "var(--tl-green)", lineHeight: 1.1 }}>
            {props.picked.display_name ?? props.picked.email}
          </div>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--tl-fg-3)", marginTop: 3 }}>
            {props.picked.username ? `@${props.picked.username}` : props.picked.email}
          </div>
        </div>
        <button
          type="button"
          onClick={props.onRemove}
          aria-label={vi ? "Bỏ chọn" : "Remove"}
          style={{ background: "transparent", border: "none", color: "var(--tl-fg-3)", padding: 6, cursor: "pointer" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Closed state — show "+ Add" button
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "14px 12px",
          border: "1px dashed var(--tl-border-strong)",
          color: "var(--tl-fg-2)",
          background: "transparent",
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          cursor: "pointer",
          borderRadius: 2,
          marginBottom: 8,
        }}
      >
        <Plus className="h-4 w-4" />
        <span>{props.addLabel}</span>
      </button>
    );
  }

  // Open — inline search + suggestions
  // When user types ≥2 chars → show DUPR+internal merged hits from edge fn.
  // When idle → show recent opponents from local DB.
  const candidates = q.trim().length >= 2
    ? (search.data?.hits ?? []).filter((h) => !h.user_id || !props.excludeIds.has(h.user_id))
    : props.recents.filter((p) => !props.excludeIds.has(p.player_id)).slice(0, 6);

  return (
    <div
      style={{
        border: "1px solid var(--tl-green-dim)",
        background: "var(--tl-green-glow)",
        borderRadius: 2,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-green)" }}>
          {props.addLabel}
        </span>
        <button
          type="button"
          onClick={() => { setOpen(false); setQ(""); }}
          aria-label={vi ? "Đóng" : "Cancel"}
          style={{ background: "transparent", border: "none", color: "var(--tl-fg-3)", padding: 4, cursor: "pointer" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid var(--tl-border-strong)",
          background: "var(--tl-bg)",
          borderRadius: 2,
          padding: "10px 12px",
          marginBottom: 10,
        }}
      >
        <Search className="h-4 w-4" style={{ color: "var(--tl-fg-3)" }} />
        <input
          type="text"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={vi ? "Tìm theo tên · email · @handle · DUPR ID" : "Search by name · email · @handle · DUPR ID"}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--tl-fg)",
            fontFamily: "'Geist Mono', monospace",
            fontSize: 13,
            outline: "none",
          }}
        />
      </label>

      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-fg-3)", margin: "4px 0 6px" }}>
        {q.trim().length >= 2
          ? (vi ? "Kết quả" : "Results")
          : (vi ? "Gần đây" : "Recent")}
      </div>

      {q.trim().length >= 2 && search.isLoading ? (
        <div style={{ padding: "8px 0", color: "var(--tl-fg-3)", fontSize: 13 }}>
          <Loader2 className="inline h-3 w-3 animate-spin" /> {vi ? "Đang tìm…" : "Searching…"}
        </div>
      ) : candidates.length === 0 ? (
        <div style={{ padding: "8px 0", color: "var(--tl-fg-3)", fontSize: 13 }}>
          {q.trim().length >= 2
            ? (vi ? "Không thấy. (Chỉ tìm được user đã ở ThePickleHub hoặc đã consent DUPR — pool DUPR còn nhỏ)" : "No matches. (Searches ThePickleHub users + DUPR consented users — DUPR pool is still small)")
            : (vi ? "Chưa có trận nào gần đây — gõ tên để tìm." : "No recent matches — search by name.")}
        </div>
      ) : (
        candidates.map((p, idx) => {
          // Three shapes possible:
          //   - RecentOpponent (idle): { player_id, display_name, email, username }
          //   - DuprSearchHit (search): { user_id, dupr_id, full_name, email, username, source, singles_rating, doubles_rating }
          const isHit = "full_name" in p;
          const id = isHit ? (p.user_id ?? "") : ("player_id" in p ? p.player_id : "");
          const display = isHit ? p.full_name : (p.display_name ?? p.email);
          const email = "email" in p ? p.email : null;
          const username = "username" in p ? p.username : null;
          const dupr_id = isHit ? p.dupr_id : null;
          const singles = isHit ? p.singles_rating : null;
          const doubles = isHit ? p.doubles_rating : null;
          const sourceTag = isHit ? p.source : null;
          // DUPR-only hit (no ThePickleHub account) — can't be picked as
          // opponent because match-proposal needs internal user_id. Show
          // disabled with helper text.
          const disabled = isHit && !p.user_id;
          return (
            <button
              key={id || `dupr-${dupr_id || idx}`}
              type="button"
              disabled={disabled}
              title={disabled ? (vi ? "User chưa kết nối ThePickleHub" : "User hasn't joined ThePickleHub yet") : undefined}
              onClick={() => {
                if (disabled || !id) return;
                props.onPick({
                  player_id: id,
                  display_name: display,
                  email: email ?? "",
                  username,
                });
                setOpen(false);
                setQ("");
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr auto",
                gap: 12,
                width: "100%",
                alignItems: "center",
                padding: "10px 4px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--tl-border)",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Avatar name={display} />
              <div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 18, color: disabled ? "var(--tl-fg-3)" : "var(--tl-fg)", lineHeight: 1.1 }}>
                  {display}
                  {dupr_id && (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--tl-fg-3)", marginLeft: 8, fontStyle: "normal", letterSpacing: "0.06em" }}>
                      {dupr_id}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--tl-fg-3)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span>{username ? `@${username}` : (email ?? "—")}</span>
                  {(singles != null || doubles != null) && (
                    <span style={{ color: "var(--tl-green)" }}>
                      DUPR {singles != null ? singles.toFixed(2) : "—"} / {doubles != null ? doubles.toFixed(2) : "—"}
                    </span>
                  )}
                  {sourceTag === "dupr" && (
                    <span style={{ color: "rgb(239,68,68)" }}>
                      {vi ? "Chưa có ThePickleHub" : "Not on ThePickleHub"}
                    </span>
                  )}
                  {!isHit && q.trim().length < 2 && <span>· {vi ? "gần đây" : "recent"}</span>}
                </div>
              </div>
              <Plus className="h-4 w-4" style={{ color: disabled ? "var(--tl-border)" : "var(--tl-fg-2)" }} />
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── Step 2: scores ───────────────────────────────────────────────────
function Step2(props: {
  vi: boolean;
  self: string;
  teamA2Name: string | null;
  teamB1Name: string;
  teamB2Name: string | null;
  isDoubles: boolean;
  g1a: number; g1b: number;
  g2a: number | ""; g2b: number | "";
  g3a: number | ""; g3b: number | "";
  show2: boolean;
  show3: boolean;
  onChange: (field: "g1a" | "g1b" | "g2a" | "g2b" | "g3a" | "g3b", value: number | "") => void;
  onAdd2: () => void;
  onAdd3: () => void;
  onContinue: () => void;
}) {
  const { vi } = props;
  const teamAWins = props.g1a > props.g1b;
  return (
    <>
      <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 24px" }}>
        {vi ? <>Tỉ số trận<br /><i>vừa rồi.</i></> : <>Final<br /><i>score.</i></>}
      </h1>

      <ScoreSet
        label={vi ? "Set 1" : "Game 1"}
        aName={props.isDoubles ? `${props.self} + ${props.teamA2Name}` : props.self}
        bName={props.isDoubles ? `${props.teamB1Name} + ${props.teamB2Name}` : props.teamB1Name}
        aScore={props.g1a} bScore={props.g1b}
        aWin={teamAWins} bWin={!teamAWins}
        onAChange={(v) => props.onChange("g1a", v)}
        onBChange={(v) => props.onChange("g1b", v)}
      />

      {props.show2 && (
        <ScoreSet
          label={vi ? "Set 2" : "Game 2"}
          aName={props.isDoubles ? `${props.self} + ${props.teamA2Name}` : props.self}
          bName={props.isDoubles ? `${props.teamB1Name} + ${props.teamB2Name}` : props.teamB1Name}
          aScore={typeof props.g2a === "number" ? props.g2a : 0}
          bScore={typeof props.g2b === "number" ? props.g2b : 0}
          aWin={(typeof props.g2a === "number" && typeof props.g2b === "number") ? props.g2a > props.g2b : false}
          bWin={(typeof props.g2a === "number" && typeof props.g2b === "number") ? props.g2b > props.g2a : false}
          onAChange={(v) => props.onChange("g2a", v)}
          onBChange={(v) => props.onChange("g2b", v)}
        />
      )}

      {props.show3 && (
        <ScoreSet
          label={vi ? "Set 3" : "Game 3"}
          aName={props.isDoubles ? `${props.self} + ${props.teamA2Name}` : props.self}
          bName={props.isDoubles ? `${props.teamB1Name} + ${props.teamB2Name}` : props.teamB1Name}
          aScore={typeof props.g3a === "number" ? props.g3a : 0}
          bScore={typeof props.g3b === "number" ? props.g3b : 0}
          aWin={(typeof props.g3a === "number" && typeof props.g3b === "number") ? props.g3a > props.g3b : false}
          bWin={(typeof props.g3a === "number" && typeof props.g3b === "number") ? props.g3b > props.g3a : false}
          onAChange={(v) => props.onChange("g3a", v)}
          onBChange={(v) => props.onChange("g3b", v)}
        />
      )}

      <div style={{ marginTop: 16 }}>
        {!props.show2 && (
          <button type="button" onClick={props.onAdd2} style={addSetStyle()}>+ {vi ? "Thêm set 2" : "Add game 2"}</button>
        )}
        {props.show2 && !props.show3 && (
          <button type="button" onClick={props.onAdd3} style={addSetStyle()}>+ {vi ? "Thêm set 3" : "Add game 3"}</button>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <button type="button" className="tl-btn primary" onClick={props.onContinue} style={{ width: "100%", padding: 18, fontSize: 12 }}>
          {vi ? "Tiếp tục — xem lại" : "Continue — review"}
        </button>
      </div>
    </>
  );
}

function ScoreSet(props: {
  label: string;
  aName: string;
  bName: string;
  aScore: number;
  bScore: number;
  aWin: boolean;
  bWin: boolean;
  onAChange: (v: number | "") => void;
  onBChange: (v: number | "") => void;
}) {
  const rowStyle = (): React.CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "1fr 96px",
    gap: 16,
    alignItems: "center",
    padding: "18px 0",
    borderBottom: "1px solid var(--tl-border)",
  });
  const inputStyle = (win: boolean): React.CSSProperties => ({
    border: "1px solid",
    borderColor: win ? "var(--tl-green-dim)" : "var(--tl-border-strong)",
    background: win ? "var(--tl-green-glow)" : "transparent",
    color: win ? "var(--tl-green)" : "var(--tl-fg)",
    fontFamily: "'Instrument Serif', serif",
    fontStyle: "italic",
    fontSize: 36,
    textAlign: "center",
    padding: "8px 0",
    borderRadius: 2,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    width: "100%",
    outline: "none",
  });
  const nameStyle = (win: boolean): React.CSSProperties => ({
    fontFamily: "'Instrument Serif', serif",
    fontStyle: "italic",
    fontSize: 18,
    lineHeight: 1.15,
    color: win ? "var(--tl-green)" : "var(--tl-fg)",
  });
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-fg-3)", margin: "8px 0" }}>{props.label}</div>
      <div style={rowStyle()}>
        <div style={nameStyle(props.aWin)}>{props.aName}</div>
        <input
          type="number" inputMode="numeric" min={0} max={50} value={props.aScore}
          onChange={(e) => props.onAChange(e.target.value === "" ? "" : Number(e.target.value))}
          style={inputStyle(props.aWin)}
        />
      </div>
      <div style={rowStyle()}>
        <div style={nameStyle(props.bWin)}>{props.bName}</div>
        <input
          type="number" inputMode="numeric" min={0} max={50} value={props.bScore}
          onChange={(e) => props.onBChange(e.target.value === "" ? "" : Number(e.target.value))}
          style={inputStyle(props.bWin)}
        />
      </div>
    </div>
  );
}

function addSetStyle(): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "center",
    padding: 14,
    fontFamily: "'Geist Mono', monospace",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "var(--tl-fg-2)",
    border: "1px dashed var(--tl-border-strong)",
    borderRadius: 2,
    background: "transparent",
    cursor: "pointer",
    marginBottom: 8,
  };
}

// ─── Step 3: review + submit ──────────────────────────────────────────
function Step3(props: {
  vi: boolean;
  isDoubles: boolean;
  self: string;
  teamA2Name: string | null;
  teamB1Name: string;
  teamB2Name: string | null;
  scoresA: number[];
  scoresB: number[];
  clubs: Array<{ club_id: number; club_name: string | null; role: string }>;
  clubId: number | "";
  setClubId: (v: number | "") => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const { vi } = props;
  const teamLine = props.isDoubles ? `${props.self} + ${props.teamA2Name}` : props.self;
  const oppLine = props.isDoubles ? `${props.teamB1Name} + ${props.teamB2Name}` : props.teamB1Name;
  const fmt = props.isDoubles ? "Doubles" : "Singles";
  let aWins = 0, bWins = 0;
  for (let i = 0; i < props.scoresA.length; i++) {
    if (props.scoresA[i] > props.scoresB[i]) aWins++;
    else if (props.scoresB[i] > props.scoresA[i]) bWins++;
  }
  const winningSide = aWins >= bWins ? "a" : "b";

  return (
    <>
      <h1 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 24px" }}>
        {vi ? <>Gửi cho<br />đối thủ <i>xác nhận.</i></> : <>Send for<br /><i>confirmation.</i></>}
      </h1>

      <SummaryRow k={vi ? "Định dạng" : "Format"} v={`${fmt} · 11 rally`} />
      <SummaryRow k={vi ? "Ngày" : "Date"} v={new Date().toLocaleString(vi ? "vi-VN" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
      <SummaryRow k={vi ? "Tỉ số" : "Score"} v={props.scoresA.map((s, i) => `${s}-${props.scoresB[i]}`).join(" · ")} big />
      <SummaryRow k={vi ? "Bạn" : "You"} v={`${teamLine} · ${winningSide === "a" ? (vi ? "thắng" : "won") : (vi ? "thua" : "lost")}`} />
      <SummaryRow k={vi ? "Đối thủ" : "Opponent"} v={oppLine} />

      <div style={{ margin: "20px 0", padding: 14, border: "1px solid var(--tl-border-strong)", borderRadius: 2 }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-fg-3)", marginBottom: 8 }}>
          {vi ? "Club (không bắt buộc)" : "Club (optional)"}
        </div>
        <select
          value={String(props.clubId)}
          onChange={(e) => props.setClubId(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ width: "100%", background: "transparent", color: "var(--tl-fg)", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 14, border: "none", outline: "none", padding: "4px 0" }}
        >
          <option value="">{vi ? "— Không club (PARTNER) —" : "— None (PARTNER) —"}</option>
          {props.clubs.map((c) => (
            <option key={c.club_id} value={c.club_id}>{c.club_name} ({c.role})</option>
          ))}
        </select>
      </div>

      <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-fg-3)", lineHeight: 1.6, margin: "16px 0 24px" }}>
        {vi
          ? "Đối thủ sẽ nhận thông báo để xác nhận tỉ số. Sau đó admin/Director duyệt và gửi DUPR."
          : "Your opponent will receive a notification to confirm. Then a club admin approves and pushes to DUPR."}
      </p>

      <button
        type="button"
        className="tl-btn primary"
        onClick={props.onSubmit}
        disabled={props.submitting}
        style={{ width: "100%", padding: 18, fontSize: 12 }}
      >
        {props.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : vi ? "Gửi xác nhận" : "Send"}
      </button>
    </>
  );
}

function SummaryRow({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--tl-border)", alignItems: "baseline" }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--tl-fg-3)" }}>{k}</div>
      <div style={{ fontFamily: big ? "'Instrument Serif', serif" : "'Bricolage Grotesque', system-ui, sans-serif", fontStyle: big ? "italic" : "normal", fontSize: big ? 26 : 14, lineHeight: big ? 1 : 1.5, color: "var(--tl-fg)" }}>{v}</div>
    </div>
  );
}
