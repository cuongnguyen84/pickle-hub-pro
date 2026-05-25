// ============================================================================
// /match — player-initiated match flow (PR6)
// ----------------------------------------------------------------------------
// Tabs:
//   - Create: pick club + format + opponents + scores → submit proposal
//   - Pending: matches awaiting MY confirm/dispute
//   - Queue: matches I can approve (club DIRECTOR/ORGANIZER)
//   - History: matches I'm a player in, with status
// ============================================================================

import { useMemo, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TheLineLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDuprClubs } from "@/hooks/useDuprClubs";

type Tab = "create" | "pending" | "queue" | "history";

interface ProposalRow {
  id: string;
  created_by: string;
  club_id: number | null;
  format: "SINGLES" | "DOUBLES";
  match_date: string;
  event: string | null;
  bracket: string | null;
  location: string | null;
  team_a_player_ids: string[];
  team_b_player_ids: string[];
  team_a_scores: number[];
  team_b_scores: number[];
  status: string;
  status_changed_at: string;
  dupr_match_code: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
}

interface ProfileMini {
  id: string;
  display_name: string | null;
  email: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function statusPill(status: string) {
  const map: Record<string, { label: string; ok: boolean | null }> = {
    pending_verify: { label: "PENDING VERIFY", ok: null },
    verified: { label: "VERIFIED", ok: null },
    disputed: { label: "DISPUTED", ok: false },
    approved: { label: "APPROVED", ok: true },
    submitted: { label: "SUBMITTED ⇧ DUPR", ok: true },
    rejected: { label: "REJECTED", ok: false },
  };
  const { label, ok } = map[status] ?? { label: status, ok: null };
  const color = ok === true
    ? "rgb(34,197,94)"
    : ok === false
      ? "rgb(239,68,68)"
      : "var(--tl-fg-3)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
      style={{ borderColor: "var(--tl-border)", color }}
    >
      {ok === true && <CheckCircle2 className="h-3 w-3" />}
      {ok === false && <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function fmtScore(a: number[], b: number[]) {
  return a.map((s, i) => `${s}-${b[i]}`).join(", ");
}

// ─── Player search input ────────────────────────────────────────────────────

function PlayerSearch({
  selected,
  onChange,
  placeholder,
  excludeIds = [],
}: {
  selected: ProfileMini | null;
  onChange: (p: ProfileMini | null) => void;
  placeholder?: string;
  excludeIds?: string[];
}) {
  const [q, setQ] = useState("");

  const results = useQuery({
    queryKey: ["profile-search", q],
    enabled: q.length >= 2 && !selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .or(`display_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      return (data ?? []).filter((p) => !excludeIds.includes((p as ProfileMini).id)) as ProfileMini[];
    },
  });

  if (selected) {
    return (
      <div
        className="flex items-center justify-between rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)" }}
      >
        <span>
          <span style={{ color: "var(--tl-fg)" }}>{selected.display_name ?? selected.email}</span>
          <span className="ml-2 text-xs" style={{ color: "var(--tl-fg-3)" }}>{selected.email}</span>
        </span>
        <button
          type="button"
          onClick={() => { onChange(null); setQ(""); }}
          aria-label="Clear"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? "Search by name or email"}
        className="w-full rounded border p-2 text-sm"
        style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
      />
      {q.length >= 2 && (
        <div
          className="mt-1 rounded border"
          style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg-2)" }}
        >
          {results.isLoading ? (
            <div className="p-2 text-xs" style={{ color: "var(--tl-fg-3)" }}>
              <Loader2 className="inline h-3 w-3 animate-spin" /> Searching…
            </div>
          ) : (results.data ?? []).length === 0 ? (
            <div className="p-2 text-xs" style={{ color: "var(--tl-fg-3)" }}>No match.</div>
          ) : (
            (results.data ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full px-2 py-1 text-left text-sm hover:bg-black/10"
                onClick={() => { onChange(p); setQ(""); }}
              >
                <span style={{ color: "var(--tl-fg)" }}>{p.display_name ?? p.email}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--tl-fg-3)" }}>{p.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Create ────────────────────────────────────────────────────────────

function CreateTab({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";
  const { toast } = useToast();
  const clubs = useDuprClubs();

  const [format, setFormat] = useState<"SINGLES" | "DOUBLES">("SINGLES");
  const [clubId, setClubId] = useState<number | "">("");
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [event, setEvent] = useState("Friendly");
  const [location, setLocation] = useState("");

  // Self auto-selected on team A.
  const [a1, setA1] = useState<ProfileMini | null>(null);
  const [a2, setA2] = useState<ProfileMini | null>(null);
  const [b1, setB1] = useState<ProfileMini | null>(null);
  const [b2, setB2] = useState<ProfileMini | null>(null);

  // Auto-fill self into a1 once we know who 'self' is.
  useMemo(() => {
    if (!a1 && user?.id && user?.email) {
      setA1({ id: user.id, display_name: null, email: user.email });
    }
    return null;
  }, [a1, user?.id, user?.email]);

  const [g1a, setG1a] = useState(11);
  const [g1b, setG1b] = useState(7);
  const [g2a, setG2a] = useState<number | "">("");
  const [g2b, setG2b] = useState<number | "">("");
  const [g3a, setG3a] = useState<number | "">("");
  const [g3b, setG3b] = useState<number | "">("");

  const [submitting, setSubmitting] = useState(false);

  const excludeIds = useMemo(
    () => [a1?.id, a2?.id, b1?.id, b2?.id].filter((x): x is string => !!x),
    [a1, a2, b1, b2],
  );

  const handleSubmit = async () => {
    // club_id is optional — empty means matchSource=PARTNER per DUPR FAQ.
    if (!a1 || !b1 || (format === "DOUBLES" && (!a2 || !b2))) {
      toast({ variant: "destructive", title: vi ? "Thiếu player" : "Missing players" });
      return;
    }
    const teamA = format === "DOUBLES" ? [a1.id, a2!.id] : [a1.id];
    const teamB = format === "DOUBLES" ? [b1.id, b2!.id] : [b1.id];
    const scoresA = [g1a, ...(g2a !== "" ? [Number(g2a)] : []), ...(g3a !== "" ? [Number(g3a)] : [])];
    const scoresB = [g1b, ...(g2b !== "" ? [Number(g2b)] : []), ...(g3b !== "" ? [Number(g3b)] : [])];
    if (scoresA.length !== scoresB.length) {
      toast({ variant: "destructive", title: vi ? "Số games không khớp" : "Score game count mismatch" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("match-proposal", {
        body: {
          action: "create",
          club_id: clubId === "" ? null : Number(clubId),
          format,
          match_date: matchDate,
          location,
          event,
          team_a_player_ids: teamA,
          team_b_player_ids: teamB,
          team_a_scores: scoresA,
          team_b_scores: scoresB,
        },
      });
      if (error) throw error;
      toast({
        title: vi ? "Đã tạo proposal" : "Proposal created",
        description: `id=${(data as { proposal_id: string }).proposal_id}`,
      });
      // Reset some fields for the next entry.
      setA2(null); setB1(null); setB2(null);
      setG1a(11); setG1b(7); setG2a(""); setG2b(""); setG3a(""); setG3b("");
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Submit failed", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const submitterClubs = clubs.submitterClubs.length > 0 ? clubs.submitterClubs : clubs.clubs;

  return (
    <div className="grid gap-4">
      <p className="text-sm" style={{ color: "var(--tl-fg-3)" }}>
        {vi
          ? "Tạo match. Sau khi tạo xong, đợi ít nhất 1 player team A + 1 player team B confirm, rồi club admin sẽ phê duyệt + gửi lên DUPR."
          : "Create a match. Once at least 1 player from each side confirms, the club admin can approve and push to DUPR."}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "SINGLES" | "DOUBLES")}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          >
            <option value="SINGLES">SINGLES</option>
            <option value="DOUBLES">DOUBLES</option>
          </select>
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Club (optional)
          <select
            value={String(clubId)}
            onChange={(e) => setClubId(e.target.value === "" ? "" : Number(e.target.value))}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          >
            <option value="">{vi ? "— Không club (PARTNER) —" : "— None (PARTNER) —"}</option>
            {submitterClubs.map((c) => (
              <option key={c.club_id} value={c.club_id}>
                {c.club_name} ({c.role})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Match date
          <input
            type="date" value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          />
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Location
          <input
            type="text" value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <fieldset className="rounded border p-3" style={{ borderColor: "var(--tl-border)" }}>
          <legend className="px-1 text-xs" style={{ color: "var(--tl-fg-3)" }}>Team A</legend>
          <div className="mb-2">
            <PlayerSearch selected={a1} onChange={setA1} excludeIds={excludeIds.filter(i => i !== a1?.id)} placeholder={vi ? "Player 1 (anh)" : "Player 1 (you)"} />
          </div>
          {format === "DOUBLES" && (
            <PlayerSearch selected={a2} onChange={setA2} excludeIds={excludeIds.filter(i => i !== a2?.id)} placeholder="Player 2" />
          )}
        </fieldset>
        <fieldset className="rounded border p-3" style={{ borderColor: "var(--tl-border)" }}>
          <legend className="px-1 text-xs" style={{ color: "var(--tl-fg-3)" }}>Team B</legend>
          <div className="mb-2">
            <PlayerSearch selected={b1} onChange={setB1} excludeIds={excludeIds.filter(i => i !== b1?.id)} placeholder="Player 1" />
          </div>
          {format === "DOUBLES" && (
            <PlayerSearch selected={b2} onChange={setB2} excludeIds={excludeIds.filter(i => i !== b2?.id)} placeholder="Player 2" />
          )}
        </fieldset>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="mb-1 text-xs" style={{ color: "var(--tl-fg-3)" }}>Game 1</div>
          <div className="flex gap-1">
            <input type="number" value={g1a} onChange={(e) => setG1a(Number(e.target.value))}
              className="w-full rounded border p-2 text-sm"
              style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
            <input type="number" value={g1b} onChange={(e) => setG1b(Number(e.target.value))}
              className="w-full rounded border p-2 text-sm"
              style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs" style={{ color: "var(--tl-fg-3)" }}>Game 2 (opt)</div>
          <div className="flex gap-1">
            <input type="number" value={g2a} onChange={(e) => setG2a(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded border p-2 text-sm"
              style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
            <input type="number" value={g2b} onChange={(e) => setG2b(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded border p-2 text-sm"
              style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs" style={{ color: "var(--tl-fg-3)" }}>Game 3 (opt)</div>
          <div className="flex gap-1">
            <input type="number" value={g3a} onChange={(e) => setG3a(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded border p-2 text-sm"
              style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
            <input type="number" value={g3b} onChange={(e) => setG3b(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded border p-2 text-sm"
              style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          </div>
        </div>
      </div>

      <button
        type="button"
        className="tl-btn primary"
        onClick={handleSubmit}
        disabled={submitting || clubs.loading}
      >
        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : (vi ? "Tạo proposal" : "Create proposal")}
      </button>
    </div>
  );
}

// ─── Tab: Pending (player verification) ─────────────────────────────────────

function ProposalCard({
  row,
  showActions,
  onAction,
}: {
  row: ProposalRow;
  showActions: ("verify" | "dispute" | "approve" | "reject")[];
  onAction: (action: string, reason?: string) => void;
}) {
  const { language } = useI18n();
  const vi = language === "vi";

  return (
    <div
      className="rounded border p-3 text-sm"
      style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg-2)" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <span className="font-mono text-xs" style={{ color: "var(--tl-fg-3)" }}>{row.id.slice(0, 8)}</span>
          <span className="ml-2">{row.format}</span>
          <span className="ml-2" style={{ color: "var(--tl-fg-3)" }}>{row.match_date}</span>
          <span className="ml-2" style={{ color: "var(--tl-fg-3)" }}>
            {row.club_id ? `club ${row.club_id}` : "PARTNER"}
          </span>
        </div>
        {statusPill(row.status)}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--tl-fg-3)" }}>
        <div>Team A: {row.team_a_player_ids.length} players</div>
        <div>Team B: {row.team_b_player_ids.length} players</div>
        <div>Score: <span style={{ color: "var(--tl-fg)" }}>{fmtScore(row.team_a_scores, row.team_b_scores)}</span></div>
        {row.dupr_match_code && (
          <div>matchCode: <span className="font-mono">{row.dupr_match_code}</span></div>
        )}
        {row.rejection_reason && (
          <div className="col-span-2" style={{ color: "rgb(239,68,68)" }}>
            {vi ? "Lý do reject" : "Reject reason"}: {row.rejection_reason}
          </div>
        )}
      </div>

      {showActions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {showActions.includes("verify") && (
            <button type="button" className="tl-btn primary" onClick={() => onAction("verify")}>
              {vi ? "Xác nhận" : "Confirm"}
            </button>
          )}
          {showActions.includes("dispute") && (
            <button
              type="button"
              className="tl-btn"
              onClick={() => {
                const reason = prompt(vi ? "Lý do dispute:" : "Dispute reason:");
                if (reason) onAction("dispute", reason);
              }}
            >
              {vi ? "Tranh chấp" : "Dispute"}
            </button>
          )}
          {showActions.includes("approve") && (
            <button type="button" className="tl-btn primary" onClick={() => onAction("approve")}>
              {vi ? "Approve + gửi DUPR" : "Approve + push to DUPR"}
            </button>
          )}
          {showActions.includes("reject") && (
            <button
              type="button"
              className="tl-btn"
              onClick={() => {
                const reason = prompt(vi ? "Lý do reject:" : "Reject reason:");
                if (reason) onAction("reject", reason);
              }}
            >
              {vi ? "Reject" : "Reject"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function useProposals(filter: "pending" | "queue" | "history") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["match-proposals", filter, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // RLS does the heavy lifting — we get back rows visible to us.
      let query = supabase
        .from("match_proposals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter === "pending") {
        query = query.eq("status", "pending_verify");
      } else if (filter === "queue") {
        query = query.eq("status", "verified");
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ProposalRow[];
    },
  });
}

function ListTab({ filter }: { filter: "pending" | "queue" | "history" }) {
  const { user } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";
  const { toast } = useToast();
  const q = useProposals(filter);
  const qc = useQueryClient();

  const callAction = async (proposalId: string, action: string, reason?: string) => {
    const { data, error } = await supabase.functions.invoke("match-proposal", {
      body: { action, proposal_id: proposalId, reason },
    });
    if (error) {
      // supabase-js wraps non-2xx as FunctionsHttpError with a Response on
      // error.context — pull the real error body so we don't surface the
      // generic "Edge Function returned a non-2xx status code".
      const ctx = (error as { context?: Response }).context;
      let detail = error.message;
      if (ctx) {
        try {
          const body = await ctx.clone().json();
          detail = body.error ?? body.code ?? body.message ?? JSON.stringify(body);
          if (body.details?.hint) detail += ` — ${body.details.hint}`;
        } catch { /* keep error.message */ }
      }
      toast({ variant: "destructive", title: action, description: detail });
    } else {
      toast({ title: action, description: JSON.stringify(data) });
      qc.invalidateQueries({ queryKey: ["match-proposals"] });
    }
  };

  if (q.isLoading) return <div className="text-sm" style={{ color: "var(--tl-fg-3)" }}><Loader2 className="inline h-3 w-3 animate-spin" /> Loading…</div>;
  if ((q.data ?? []).length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--tl-fg-3)" }}>
        {filter === "pending"
          ? (vi ? "Không có match nào đang đợi anh xác nhận." : "No matches awaiting your confirmation.")
          : filter === "queue"
            ? (vi ? "Không có match nào đợi anh approve." : "No matches awaiting your approval.")
            : (vi ? "Chưa có match nào." : "No matches yet.")}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <button type="button" className="tl-btn" onClick={() => q.refetch()}>
          <RefreshCw className={`h-3 w-3 ${q.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      {(q.data ?? []).map((row) => {
        const userId = user?.id;
        const isPlayer = userId
          ? row.team_a_player_ids.includes(userId) || row.team_b_player_ids.includes(userId)
          : false;
        const actions: ("verify" | "dispute" | "approve" | "reject")[] = [];
        if (filter === "pending" && isPlayer) {
          actions.push("verify", "dispute");
        }
        if (filter === "queue") {
          actions.push("approve", "reject");
        }
        return (
          <ProposalCard
            key={row.id}
            row={row}
            showActions={actions}
            onAction={(action, reason) => callAction(row.id, action, reason)}
          />
        );
      })}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

const TABS: { id: Tab; vi: string; en: string }[] = [
  { id: "create", vi: "Tạo match", en: "Create" },
  { id: "pending", vi: "Đợi confirm", en: "Pending" },
  { id: "queue", vi: "Đợi approve", en: "Queue" },
  { id: "history", vi: "Lịch sử", en: "History" },
];

export default function MatchPage() {
  const { user, loading } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("create");

  if (loading) {
    return <TheLineLayout><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></TheLineLayout>;
  }
  if (!user) {
    return (
      <TheLineLayout>
        <div className="mx-auto max-w-3xl p-6">
          <h1 className="text-2xl font-semibold">{vi ? "Cần đăng nhập" : "Sign in required"}</h1>
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--tl-fg)" }}>
            {vi ? "Match" : "Match"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--tl-fg-3)" }}>
            {vi
              ? "Tạo match — đối phương xác nhận tỉ số — club admin gửi lên DUPR."
              : "Players record matches, opponents confirm, club admins push to DUPR."}
          </p>
        </header>

        <div className="mb-4 flex gap-2 border-b" style={{ borderColor: "var(--tl-border)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); qc.invalidateQueries({ queryKey: ["match-proposals"] }); }}
              className={`px-3 py-2 text-sm ${tab === t.id ? "border-b-2" : ""}`}
              style={{
                color: tab === t.id ? "var(--tl-fg)" : "var(--tl-fg-3)",
                borderBottomColor: tab === t.id ? "var(--tl-fg)" : "transparent",
              }}
            >
              {vi ? t.vi : t.en}
            </button>
          ))}
        </div>

        {tab === "create" && <CreateTab onCreated={() => setTab("pending")} />}
        {tab === "pending" && <ListTab filter="pending" />}
        {tab === "queue" && <ListTab filter="queue" />}
        {tab === "history" && <ListTab filter="history" />}
      </div>
    </TheLineLayout>
  );
}
