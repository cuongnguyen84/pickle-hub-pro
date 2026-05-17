// ============================================================================
// /dupr — DUPR RaaS integration dashboard
// ----------------------------------------------------------------------------
// One-stop page showing every backend touchpoint of the DUPR partnership:
//   - Connection (SSO link / disconnect, profile + rating)
//   - Entitlements (BASIC/PREMIUM/VERIFIED + refresh)
//   - Clubs (memberships + role + refresh)
//   - Match submit form (create / update / delete, lifecycle in table below)
//   - Recently submitted matches
//
// Used by DUPR reviewers + ourselves during integration. Once flows are
// wired into the real product pages, this becomes /admin-only.
// ============================================================================

import { useMemo, useState } from "react";
import { Loader2, RefreshCw, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useDuprConnection } from "@/hooks/useDuprConnection";
import { useDuprEntitlements } from "@/hooks/useDuprEntitlements";
import { useDuprClubs } from "@/hooks/useDuprClubs";
import { DuprConnectButton } from "@/components/dupr/DuprConnectButton";

// ─── small UI primitives — keep page self-contained ──────────────────────────

function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-md border"
      style={{
        borderColor: "var(--tl-border)",
        background: "var(--tl-bg-2)",
        padding: 20,
        marginBottom: 20,
      }}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--tl-fg)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: "var(--tl-fg-3)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Pill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
      style={{
        borderColor: ok ? "rgba(34,197,94,0.4)" : "var(--tl-border)",
        color: ok ? "rgb(34,197,94)" : "var(--tl-fg-3)",
        background: ok ? "rgba(34,197,94,0.08)" : "transparent",
      }}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1 text-sm">
      <div style={{ color: "var(--tl-fg-3)" }}>{k}</div>
      <div style={{ color: "var(--tl-fg)" }}>{v ?? "—"}</div>
    </div>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

function ConnectionSection() {
  const { language } = useI18n();
  const { toast } = useToast();
  const vi = language === "vi";
  const { data: conn, isLoading, refetch } = useDuprConnection();
  const qc = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm(vi ? "Ngắt kết nối DUPR?" : "Disconnect from DUPR?")) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("dupr-disconnect", { body: {} });
      if (error) throw error;
      toast({ title: vi ? "Đã ngắt kết nối" : "Disconnected" });
      qc.invalidateQueries({ queryKey: ["dupr-connection"] });
      qc.invalidateQueries({ queryKey: ["dupr"], exact: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Disconnect failed", description: msg });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Section
      title="1. Connection (SSO)"
      subtitle={vi
        ? "Trạng thái kết nối DUPR. Iframe SSO + xác thực server-side."
        : "DUPR connection state. Iframe SSO + server-side verification."}
      action={
        <button
          type="button"
          className="tl-btn"
          onClick={() => refetch()}
          disabled={isLoading}
          title="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tl-fg-3)" }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill ok={!!conn?.ssoConnected} label={conn?.ssoConnected ? "SSO connected" : "Not connected"} />
            {conn?.needsReconnect && <Pill ok={false} label="Pending reconnect" />}
          </div>

          <KV k="DUPR ID" v={conn?.duprId} />
          <KV k="Method" v={conn?.method ?? "—"} />
          <KV k="Singles" v={conn?.singles ?? "—"} />
          <KV k="Doubles" v={conn?.doubles ?? "—"} />
          <KV k="Connected at" v={conn?.connectedAt ? new Date(conn.connectedAt).toLocaleString() : "—"} />
          <KV
            k="DUPR profile"
            v={conn?.duprProfileUrl
              ? <a href={conn.duprProfileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              : "—"}
          />

          <div className="mt-4 flex gap-2">
            {!conn?.ssoConnected ? (
              <DuprConnectButton />
            ) : (
              <button
                type="button"
                className="tl-btn"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : (vi ? "Ngắt kết nối" : "Disconnect")}
              </button>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

function EntitlementsSection() {
  const { language } = useI18n();
  const vi = language === "vi";
  const ent = useDuprEntitlements();

  return (
    <Section
      title="2. Entitlements (User Gating)"
      subtitle={vi
        ? "Cache 24h từ POST /subscription/active. BASIC_L1 bắt buộc cho mọi action."
        : "24h cache from POST /subscription/active. BASIC_L1 required for any platform action."}
      action={
        <button
          type="button"
          className="tl-btn"
          onClick={() => ent.refresh()}
          disabled={ent.refreshing}
          title="Force refetch from DUPR"
        >
          <RefreshCw className={`h-3 w-3 ${ent.refreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {ent.loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tl-fg-3)" }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill ok={ent.hasBasic} label="BASIC_L1" />
            <Pill ok={ent.hasPremium} label="PREMIUM_L1" />
            <Pill ok={ent.hasVerified} label="VERIFIED_L1" />
          </div>

          {ent.payload ? (
            <>
              <KV k="Display name" v={ent.payload.display_name} />
              <KV k="Status" v={ent.payload.status} />
              <KV k="Fetched" v={new Date(ent.payload.fetched_at).toLocaleString()} />
              <KV k="Expires" v={new Date(ent.payload.expires_at).toLocaleString()} />
              <div className="mt-3 rounded border p-2 text-xs"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)" }}>
                <pre style={{ color: "var(--tl-fg)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(ent.payload.entitlements, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--tl-fg-3)" }}>
              {vi ? "Chưa có dữ liệu — kết nối DUPR trước." : "No data — connect DUPR first."}
            </p>
          )}
        </>
      )}
    </Section>
  );
}

function ClubsSection() {
  const { language } = useI18n();
  const vi = language === "vi";
  const clubs = useDuprClubs();

  return (
    <Section
      title="3. Clubs"
      subtitle={vi
        ? "DIRECTOR/ORGANIZER được submit match thay mặt club."
        : "DIRECTOR/ORGANIZER may submit matches on behalf of the club."}
      action={
        <button
          type="button"
          className="tl-btn"
          onClick={() => clubs.refresh()}
          disabled={clubs.refreshing}
        >
          <RefreshCw className={`h-3 w-3 ${clubs.refreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {clubs.loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tl-fg-3)" }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : clubs.clubs.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--tl-fg-3)" }}>
          {vi ? "Không thuộc club nào trên DUPR." : "Not a member of any DUPR club."}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--tl-fg-3)" }}>
              <th className="text-left font-normal pb-2">Club</th>
              <th className="text-left font-normal pb-2">Role</th>
              <th className="text-left font-normal pb-2">Club ID</th>
            </tr>
          </thead>
          <tbody>
            {clubs.clubs.map((c) => (
              <tr key={c.club_id} style={{ borderTop: "1px solid var(--tl-border)" }}>
                <td className="py-2">{c.club_name ?? "—"}</td>
                <td className="py-2">
                  <Pill
                    ok={c.role === "DIRECTOR" || c.role === "ORGANIZER"}
                    label={c.role}
                  />
                </td>
                <td className="py-2" style={{ color: "var(--tl-fg-3)" }}>{c.club_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function SubmitMatchSection() {
  const { language } = useI18n();
  const vi = language === "vi";
  const { toast } = useToast();
  const clubs = useDuprClubs();
  const qc = useQueryClient();

  const [format, setFormat] = useState<"SINGLES" | "DOUBLES">("SINGLES");
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [event, setEvent] = useState("ThePickleHub UAT test");
  const [bracket, setBracket] = useState("Open");
  const [location, setLocation] = useState("TP.HCM");
  const [clubId, setClubId] = useState<number | "">("");

  const [a1, setA1] = useState("YGONMK");
  const [a2, setA2] = useState("");
  const [b1, setB1] = useState("");
  const [b2, setB2] = useState("");

  const [g1a, setG1a] = useState(11);
  const [g1b, setG1b] = useState(7);
  const [g2a, setG2a] = useState<number | "">("");
  const [g2b, setG2b] = useState<number | "">("");

  const [internalId, setInternalId] = useState(() => `demo-${Date.now()}`);
  const [submitting, setSubmitting] = useState(false);
  const [lastResp, setLastResp] = useState<unknown>(null);

  const submitterClubs = clubs.submitterClubs;

  const handleSubmit = async () => {
    setSubmitting(true);
    setLastResp(null);
    try {
      const teamA: Record<string, unknown> = { player1: a1, game1: g1a };
      const teamB: Record<string, unknown> = { player1: b1, game1: g1b };
      if (format === "DOUBLES") {
        teamA.player2 = a2;
        teamB.player2 = b2;
      }
      if (g2a !== "") teamA.game2 = Number(g2a);
      if (g2b !== "") teamB.game2 = Number(g2b);

      const body: Record<string, unknown> = {
        action: "create",
        internal_source: "uat-dashboard",
        internal_match_id: internalId,
        match_date: matchDate,
        location,
        format,
        event,
        bracket,
        team_a: teamA,
        team_b: teamB,
      };
      if (clubId !== "") body.club_id = Number(clubId);

      const { data, error } = await supabase.functions.invoke("dupr-match-submit", { body });
      if (error) throw error;
      setLastResp(data);
      qc.invalidateQueries({ queryKey: ["dupr-submissions"] });
      toast({ title: vi ? "Đã gửi match" : "Match submitted", description: JSON.stringify(data) });
      setInternalId(`demo-${Date.now()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastResp({ error: msg });
      toast({ variant: "destructive", title: vi ? "Lỗi submit" : "Submit error", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section
      title="4. Submit match"
      subtitle={vi
        ? "Test gửi match lên DUPR. Cần role creator/admin + tất cả player có BASIC_L1."
        : "Test pushing a match to DUPR. Requires creator/admin role + every player has BASIC_L1."}
    >
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
          Match date
          <input
            type="date"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          />
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Event
          <input
            type="text"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          />
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Bracket
          <input
            type="text"
            value={bracket}
            onChange={(e) => setBracket(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          />
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Location
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          />
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Club (optional — matchSource=CLUB)
          <select
            value={String(clubId)}
            onChange={(e) => setClubId(e.target.value === "" ? "" : Number(e.target.value))}
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          >
            <option value="">— None (matchSource=PARTNER) —</option>
            {submitterClubs.map((c) => (
              <option key={c.club_id} value={c.club_id}>
                {c.club_name} ({c.role})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs" style={{ color: "var(--tl-fg-3)" }}>
          Internal match id
          <input
            type="text"
            value={internalId}
            onChange={(e) => setInternalId(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm font-mono"
            style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }}
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <fieldset className="rounded border p-3"
                  style={{ borderColor: "var(--tl-border)" }}>
          <legend className="px-1 text-xs" style={{ color: "var(--tl-fg-3)" }}>Team A</legend>
          <input type="text" placeholder="DUPR ID player 1" value={a1}
                 onChange={(e) => setA1(e.target.value.toUpperCase())}
                 className="mb-2 w-full rounded border p-2 text-sm font-mono"
                 style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          {format === "DOUBLES" && (
            <input type="text" placeholder="DUPR ID player 2" value={a2}
                   onChange={(e) => setA2(e.target.value.toUpperCase())}
                   className="mb-2 w-full rounded border p-2 text-sm font-mono"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          )}
          <div className="flex gap-2">
            <input type="number" placeholder="g1" value={g1a}
                   onChange={(e) => setG1a(Number(e.target.value))}
                   className="w-full rounded border p-2 text-sm"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
            <input type="number" placeholder="g2 (opt)" value={g2a}
                   onChange={(e) => setG2a(e.target.value === "" ? "" : Number(e.target.value))}
                   className="w-full rounded border p-2 text-sm"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          </div>
        </fieldset>

        <fieldset className="rounded border p-3"
                  style={{ borderColor: "var(--tl-border)" }}>
          <legend className="px-1 text-xs" style={{ color: "var(--tl-fg-3)" }}>Team B</legend>
          <input type="text" placeholder="DUPR ID player 1" value={b1}
                 onChange={(e) => setB1(e.target.value.toUpperCase())}
                 className="mb-2 w-full rounded border p-2 text-sm font-mono"
                 style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          {format === "DOUBLES" && (
            <input type="text" placeholder="DUPR ID player 2" value={b2}
                   onChange={(e) => setB2(e.target.value.toUpperCase())}
                   className="mb-2 w-full rounded border p-2 text-sm font-mono"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          )}
          <div className="flex gap-2">
            <input type="number" placeholder="g1" value={g1b}
                   onChange={(e) => setG1b(Number(e.target.value))}
                   className="w-full rounded border p-2 text-sm"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
            <input type="number" placeholder="g2 (opt)" value={g2b}
                   onChange={(e) => setG2b(e.target.value === "" ? "" : Number(e.target.value))}
                   className="w-full rounded border p-2 text-sm"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)", color: "var(--tl-fg)" }} />
          </div>
        </fieldset>
      </div>

      <button
        type="button"
        className="tl-btn primary mt-4"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : (vi ? "Gửi match lên DUPR" : "Submit match to DUPR")}
      </button>

      {lastResp != null && (
        <div className="mt-3 rounded border p-2 text-xs"
             style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)" }}>
          <pre style={{ color: "var(--tl-fg)", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(lastResp, null, 2)}
          </pre>
        </div>
      )}
    </Section>
  );
}

interface SubmissionRow {
  identifier: string;
  match_code: string;
  match_format: string;
  match_date: string;
  club_id: number | null;
  submitted_at: string;
  deleted_at: string | null;
}

function SubmissionsSection() {
  const { user } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["dupr-submissions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dupr_match_submissions")
        .select("identifier, match_code, match_format, match_date, club_id, submitted_at, deleted_at")
        .eq("submitted_by", user!.id)
        .order("submitted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SubmissionRow[];
    },
  });

  const handleDelete = async (row: SubmissionRow) => {
    if (!confirm(vi ? `Xoá match ${row.match_code}?` : `Delete match ${row.match_code}?`)) return;
    setBusyId(row.identifier);
    try {
      const [src, internalId] = (() => {
        const parts = row.identifier.split(":"); // tph:<src>:<id>
        return [parts[1], parts.slice(2).join(":")];
      })();
      const { data, error } = await supabase.functions.invoke("dupr-match-submit", {
        body: { action: "delete", internal_source: src, internal_match_id: internalId },
      });
      if (error) throw error;
      toast({ title: vi ? "Đã xoá" : "Deleted", description: JSON.stringify(data) });
      qc.invalidateQueries({ queryKey: ["dupr-submissions"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Delete failed", description: msg });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section
      title="5. Submitted matches"
      subtitle={vi
        ? "20 match gần nhất anh đã push lên DUPR. Xoá ở đây gọi DELETE /match/v1.0/delete."
        : "20 most recent matches you've pushed to DUPR. Delete here calls DELETE /match/v1.0/delete."}
      action={
        <button type="button" className="tl-btn" onClick={() => q.refetch()} disabled={q.isLoading}>
          <RefreshCw className={`h-3 w-3 ${q.isLoading ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tl-fg-3)" }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--tl-fg-3)" }}>
          {vi ? "Chưa có match nào." : "No matches submitted yet."}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--tl-fg-3)" }}>
              <th className="text-left font-normal pb-2">Date</th>
              <th className="text-left font-normal pb-2">Format</th>
              <th className="text-left font-normal pb-2">Club</th>
              <th className="text-left font-normal pb-2">matchCode</th>
              <th className="text-left font-normal pb-2">identifier</th>
              <th className="text-left font-normal pb-2">Status</th>
              <th className="text-right font-normal pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((row) => (
              <tr key={row.identifier} style={{ borderTop: "1px solid var(--tl-border)" }}>
                <td className="py-2">{row.match_date}</td>
                <td className="py-2">{row.match_format}</td>
                <td className="py-2" style={{ color: "var(--tl-fg-3)" }}>{row.club_id ?? "PARTNER"}</td>
                <td className="py-2 font-mono">{row.match_code}</td>
                <td className="py-2 font-mono text-xs" style={{ color: "var(--tl-fg-3)" }}>{row.identifier}</td>
                <td className="py-2">
                  <Pill ok={!row.deleted_at} label={row.deleted_at ? "DELETED" : "ACTIVE"} />
                </td>
                <td className="py-2 text-right">
                  {!row.deleted_at && (
                    <button
                      type="button"
                      className="tl-btn"
                      onClick={() => handleDelete(row)}
                      disabled={busyId === row.identifier}
                    >
                      {busyId === row.identifier ? <Loader2 className="h-3 w-3 animate-spin" /> : (vi ? "Xoá" : "Delete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DuprDashboard() {
  const { user, loading } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";

  const intro = useMemo(
    () =>
      vi
        ? "Trang test toàn bộ tích hợp DUPR RaaS — SSO, entitlements, clubs, match submit. Dùng để DUPR review + tự test."
        : "Test dashboard for the full DUPR RaaS integration — SSO, entitlements, clubs, match submit. Used for DUPR review + self-test.",
    [vi],
  );

  if (loading) {
    return (
      <TheLineLayout>
        <div className="mx-auto max-w-3xl p-6">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </TheLineLayout>
    );
  }

  if (!user) {
    return (
      <TheLineLayout>
        <div className="mx-auto max-w-3xl p-6">
          <h1 className="mb-3 text-2xl font-semibold">{vi ? "Cần đăng nhập" : "Sign in required"}</h1>
          <p style={{ color: "var(--tl-fg-3)" }}>
            {vi
              ? "Đăng nhập ThePickleHub rồi quay lại trang này."
              : "Sign in to ThePickleHub then come back."}
          </p>
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--tl-fg)" }}>
            DUPR Integration Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--tl-fg-3)" }}>
            {intro}
          </p>
        </header>

        <ConnectionSection />
        <EntitlementsSection />
        <ClubsSection />
        <SubmitMatchSection />
        <SubmissionsSection />
      </div>
    </TheLineLayout>
  );
}
