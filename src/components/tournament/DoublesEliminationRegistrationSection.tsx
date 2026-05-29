// ============================================================================
// DoublesEliminationRegistrationSection — public self-registration UI
// ----------------------------------------------------------------------------
// Sprint E.3 (2026-05-29). Mounted on DoublesEliminationView when
// tournament.status === 'registration_open'. Three parallel surfaces:
//
//   1. Progress card — N / capacity registered, days since open.
//   2. Registration form — auth user picks partner via DuprUserSearch,
//      submits via RPC register_team_for_doubles_elimination. RPC enforces
//      DUPR range + dedupe + capacity; we just localize the error code.
//   3. Teams already registered — list with cancel button for own row;
//      organizer also gets "Close registration + generate bracket" button
//      once at capacity.
// ============================================================================

import { useState, useMemo, useEffect } from "react";
import { Sparkles, Users, Loader2, UserCircle2, X, Trophy, Lock, ChevronRight, Trash2, ShieldCheck, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { useDuprUserSearch, type DuprSearchHit } from "@/hooks/useDuprUserSearch";
import { useDoublesElimination, type Tournament, type Team } from "@/hooks/useDoublesElimination";
import { DuprConnectButton } from "@/components/dupr/DuprConnectButton";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

// Sprint E.4 (2026-05-29). Map of profile id -> dupr_doubles (with singles
// fallback) used to render per-player DUPR in the registered teams list.
type PerPlayerDupr = Map<string, { rating: number | null; isApprox: boolean }>;

function usePlayerDuprRatings(teams: Team[]): PerPlayerDupr {
  const [map, setMap] = useState<PerPlayerDupr>(new Map());
  // Stable key derived from sorted user ids — refetch only when the set changes.
  const userIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) {
      if (t.player1_user_id) set.add(t.player1_user_id);
      if (t.player2_user_id) set.add(t.player2_user_id);
    }
    return Array.from(set).sort();
  }, [teams]);
  const key = userIds.join(',');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (userIds.length === 0) {
        if (!cancelled) setMap(new Map());
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, dupr_singles, dupr_doubles')
        .in('id', userIds);
      if (cancelled) return;
      const next: PerPlayerDupr = new Map();
      for (const row of (data ?? []) as Array<{ id: string; dupr_singles: number | null; dupr_doubles: number | null }>) {
        const primary = row.dupr_doubles;
        const fallback = row.dupr_singles;
        const rating = primary ?? fallback ?? null;
        const isApprox = primary == null && fallback != null;
        next.set(row.id, { rating, isApprox });
      }
      setMap(next);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

interface Props {
  tournament: Tournament;
  teams: Team[];
  onRefresh: () => void | Promise<void>;
  onBracketReady: () => void | Promise<void>;
}

export function DoublesEliminationRegistrationSection({
  tournament,
  teams,
  onRefresh,
  onBracketReady,
}: Props) {
  const { user } = useAuth();
  const { language } = useI18n();
  const { toast } = useToast();
  const vi = language === "vi";
  const { data: conn, isLoading: connLoading } = useDuprConnection();
  const { registerTeam, cancelTeamRegistration, organizerAddTeam, organizerRemoveTeam, closeRegistration, generateBracket, loading } = useDoublesElimination();

  // Pick the row for the current user (either slot) so we can show cancel UI.
  const myTeam = useMemo(() => {
    if (!user) return null;
    return teams.find(t => t.player1_user_id === user.id || t.player2_user_id === user.id) ?? null;
  }, [user, teams]);

  const isOrganizer = !!user && user.id === tournament.creator_user_id;
  const isFull = teams.length >= tournament.team_count;
  const capacityPct = Math.round((teams.length / tournament.team_count) * 100);
  const playerDupr = usePlayerDuprRatings(teams);

  // Sprint E.4 (2026-05-29). Organizer-specific delete handler — bound here
  // so RegisteredTeamsList stays a pure presenter component.
  const handleOrganizerRemove = async (team: Team) => {
    const ok = window.confirm(
      vi
        ? `Xóa đội "${team.team_name}"? Hành động không thể hoàn tác.`
        : `Remove team "${team.team_name}"? This cannot be undone.`,
    );
    if (!ok) return;
    const res = await organizerRemoveTeam(tournament.id, team.id);
    if (res.success) {
      toast({ title: vi ? 'Đã xoá đội' : 'Team removed' });
      await onRefresh();
    } else {
      toast({
        title: vi ? 'Không xoá được' : 'Remove failed',
        description: localizeError(res.error, vi),
        variant: 'destructive',
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
      {/* Progress card */}
      <ProgressCard
        registered={teams.length}
        capacity={tournament.team_count}
        capacityPct={capacityPct}
        isFull={isFull}
        vi={vi}
      />

      {/* Registration form OR locked notice */}
      {isOrganizer ? (
        // Sprint E.4 + E.5 (2026-05-29). BTC view: notice + manual-add panel.
        // No DUPR connect prompt, no self-registration form.
        <>
          <NoticeCard tone="info" vi={vi}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
              <span>
                {vi
                  ? 'Bạn là BTC — quản lý danh sách đội đăng ký bên dưới.'
                  : 'You are the organizer — manage the registered teams below.'}
              </span>
            </div>
          </NoticeCard>
          {!isFull && (
            <OrganizerAddTeamPanel
              tournament={tournament}
              loading={loading}
              excludeUserIds={collectAllRegisteredUserIds(teams)}
              vi={vi}
              onSubmit={async (p1, p2, teamName) => {
                const res = await organizerAddTeam(tournament.id, p1, p2, teamName);
                if (res.success) {
                  toast({
                    title: vi
                      ? `Đã thêm đội · DUPR avg ${res.duprAvg?.toFixed(2) ?? '?'}`
                      : `Team added · DUPR avg ${res.duprAvg?.toFixed(2) ?? '?'}`,
                  });
                  await onRefresh();
                  return true;
                }
                toast({
                  title: vi ? 'Thêm đội thất bại' : 'Add team failed',
                  description: localizeError(res.error, vi),
                  variant: 'destructive',
                });
                return false;
              }}
            />
          )}
        </>
      ) : !user ? (
        <NoticeCard tone="info" vi={vi}>
          {vi ? "Đăng nhập để đăng ký đội." : "Sign in to register a team."}
        </NoticeCard>
      ) : connLoading ? (
        <NoticeCard tone="info" vi={vi}>
          <Loader2 className="w-4 h-4 animate-spin" /> {vi ? "Đang kiểm tra DUPR…" : "Checking DUPR…"}
        </NoticeCard>
      ) : !conn?.ssoConnected ? (
        <NoticeCard tone="warn" vi={vi}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              {vi
                ? "Giải này yêu cầu liên kết DUPR. Hãy kết nối DUPR rồi quay lại."
                : "This tournament requires DUPR. Connect DUPR then come back."}
            </div>
            <DuprConnectButton />
          </div>
        </NoticeCard>
      ) : myTeam ? (
        <MyRegistrationCard
          team={myTeam}
          vi={vi}
          loading={loading}
          onCancel={async () => {
            const res = await cancelTeamRegistration(tournament.id);
            if (res.success) {
              toast({ title: vi ? "Đã huỷ đăng ký" : "Registration cancelled" });
              await onRefresh();
            } else {
              toast({
                title: vi ? "Không huỷ được" : "Cancel failed",
                description: localizeError(res.error, vi),
                variant: "destructive",
              });
            }
          }}
        />
      ) : isFull ? (
        <NoticeCard tone="info" vi={vi}>
          {vi ? "Đã đủ đội. Đợi ban tổ chức bắt đầu giải." : "Registration full. Waiting for organizer to start."}
        </NoticeCard>
      ) : (
        <RegistrationForm
          tournament={tournament}
          vi={vi}
          loading={loading}
          excludeUserIds={collectAllRegisteredUserIds(teams)}
          onSubmit={async (partnerUserId, teamName) => {
            const res = await registerTeam(tournament.id, partnerUserId, teamName);
            if (res.success) {
              toast({
                title: vi
                  ? `Đăng ký thành công · DUPR avg ${res.duprAvg?.toFixed(2) ?? "?"}`
                  : `Registered · DUPR avg ${res.duprAvg?.toFixed(2) ?? "?"}`,
              });
              await onRefresh();
            } else {
              toast({
                title: vi ? "Đăng ký thất bại" : "Registration failed",
                description: localizeError(res.error, vi),
                variant: "destructive",
              });
            }
          }}
        />
      )}

      {/* Organizer close button (only at capacity) */}
      {isOrganizer && isFull && (
        <button
          type="button"
          className="tl-btn green"
          disabled={loading}
          onClick={async () => {
            const res = await closeRegistration(tournament.id);
            if (!res.success) {
              toast({
                title: vi ? "Không đóng được" : "Close failed",
                description: localizeError(res.error, vi),
                variant: "destructive",
              });
              return;
            }
            // Frontend completes the workflow by generating R1 matches using
            // the seeds that close_doubles_elimination_registration just wrote.
            const br = await generateBracket(tournament.id, [], "manual");
            if (!br.success) {
              toast({
                title: vi ? "Lỗi tạo bracket" : "Bracket error",
                description: br.error,
                variant: "destructive",
              });
              return;
            }
            toast({ title: vi ? "Đã tạo bracket" : "Bracket ready" });
            await onBracketReady();
          }}
          style={{ alignSelf: "flex-end", padding: "10px 20px" }}
        >
          {vi ? "Đóng đăng ký + tạo bracket" : "Close registration + generate bracket"}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Registered teams list */}
      <RegisteredTeamsList
        teams={teams}
        myUserId={user?.id ?? null}
        vi={vi}
        playerDupr={playerDupr}
        isOrganizer={isOrganizer}
        onOrganizerRemove={handleOrganizerRemove}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressCard({
  registered,
  capacity,
  capacityPct,
  isFull,
  vi,
}: {
  registered: number;
  capacity: number;
  capacityPct: number;
  isFull: boolean;
  vi: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--tl-bg-elev)",
        border: "1px solid var(--tl-border)",
        borderRadius: "var(--tl-radius-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
          <span style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, letterSpacing: "0.08em", color: "var(--tl-green)", textTransform: "uppercase" }}>
            {vi ? "Đăng ký đang mở" : "Registration open"}
          </span>
        </div>
        <span style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 12, color: "var(--tl-fg-3)", fontVariantNumeric: "tabular-nums" }}>
          {registered} / {capacity} {vi ? "đội" : "teams"}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--tl-bg)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--tl-border)" }}>
        <div
          style={{
            width: `${Math.min(100, capacityPct)}%`,
            height: "100%",
            background: isFull ? "var(--tl-green)" : "rgba(34,197,94,0.6)",
            transition: "width 200ms ease",
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--tl-fg-3)", lineHeight: 1.5 }}>
        {isFull
          ? (vi ? "Đã đủ đội. Ban tổ chức sẽ chốt và tạo bracket." : "Capacity reached. Organizer will close + generate bracket.")
          : (vi ? "Hãy đăng ký đội của bạn (2 VĐV đã liên kết DUPR)." : "Register your team (2 players with linked DUPR).")}
      </p>
    </div>
  );
}

function MyRegistrationCard({
  team,
  vi,
  loading,
  onCancel,
}: {
  team: Team;
  vi: boolean;
  loading: boolean;
  onCancel: () => Promise<void>;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(34,197,94,0.06)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: "var(--tl-radius-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Trophy className="w-5 h-5" style={{ color: "var(--tl-green)" }} />
        <div>
          <div style={{ fontFamily: "Instrument Serif, serif", fontStyle: "italic", fontSize: 18, color: "var(--tl-fg)" }}>
            {team.team_name}
          </div>
          <div style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, color: "var(--tl-fg-3)", marginTop: 2 }}>
            {vi ? "Đội của bạn" : "Your team"}
            {team.dupr_avg_rating != null && (
              <span style={{ color: "var(--tl-green)", marginLeft: 8 }}>· DUPR {team.dupr_avg_rating.toFixed(2)}</span>
            )}
          </div>
        </div>
      </div>
      <button type="button" className="tl-btn" disabled={loading} onClick={onCancel}>
        <X className="w-3.5 h-3.5" />
        {vi ? "Huỷ đăng ký" : "Cancel"}
      </button>
    </div>
  );
}

function NoticeCard({
  tone,
  vi,
  children,
}: {
  tone: "info" | "warn";
  vi: boolean;
  children: React.ReactNode;
}) {
  const bg = tone === "warn" ? "rgba(239,68,68,0.06)" : "rgba(59,130,246,0.06)";
  const border = tone === "warn" ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)";
  return (
    <div
      style={{
        padding: 14,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "var(--tl-radius-lg)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13.5,
        color: "var(--tl-fg-2)",
      }}
    >
      <Lock className="w-4 h-4" style={{ color: tone === "warn" ? "var(--tl-live)" : "rgb(96,165,250)" }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function RegistrationForm({
  tournament,
  vi,
  loading,
  excludeUserIds,
  onSubmit,
}: {
  tournament: Tournament;
  vi: boolean;
  loading: boolean;
  excludeUserIds: string[];
  onSubmit: (partnerUserId: string, teamName?: string) => Promise<void>;
}) {
  const [partner, setPartner] = useState<DuprSearchHit | null>(null);
  const [teamName, setTeamName] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { data, isFetching } = useDuprUserSearch(query, { excludeUserIds, limit: 8 });

  const range = useMemo(() => {
    if (tournament.min_dupr_rating != null && tournament.max_dupr_rating != null) {
      return `${tournament.min_dupr_rating.toFixed(2)} – ${tournament.max_dupr_rating.toFixed(2)}`;
    }
    if (tournament.min_dupr_rating != null) return `≥ ${tournament.min_dupr_rating.toFixed(2)}`;
    if (tournament.max_dupr_rating != null) return `≤ ${tournament.max_dupr_rating.toFixed(2)}`;
    return null;
  }, [tournament.min_dupr_rating, tournament.max_dupr_rating]);

  return (
    <div
      style={{
        padding: 18,
        background: "var(--tl-bg-elev)",
        border: "1px solid var(--tl-border)",
        borderRadius: "var(--tl-radius-lg)",
      }}
    >
      <div style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, letterSpacing: "0.08em", color: "var(--tl-green)", textTransform: "uppercase", marginBottom: 8 }}>
        ◆ {vi ? "Đăng ký đội" : "Register a team"}
      </div>
      <h3 style={{ fontFamily: "Instrument Serif, serif", fontStyle: "italic", fontSize: 22, margin: "0 0 14px", color: "var(--tl-fg)" }}>
        {vi ? "Chọn đồng đội" : "Pick your partner"}
      </h3>
      {range && (
        <p style={{ fontSize: 12.5, color: "var(--tl-fg-3)", margin: "0 0 14px", lineHeight: 1.5 }}>
          {vi ? "Khoảng DUPR cho phép" : "DUPR range"}: <strong style={{ color: "var(--tl-fg)" }}>{range}</strong>
        </p>
      )}

      {/* Partner picker */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        {partner ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "var(--tl-radius)",
              fontSize: 13.5,
            }}
          >
            <UserCircle2 className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
            <span style={{ flex: 1 }}>{partner.full_name}</span>
            {partner.doubles_rating != null && (
              <span style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, color: "var(--tl-green)" }}>
                DUPR {partner.doubles_rating.toFixed(2)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPartner(null)}
              aria-label={vi ? "Bỏ chọn" : "Unselect"}
              style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--tl-fg-3)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Input
              placeholder={vi ? "Tìm tên đồng đội (≥ 2 ký tự)" : "Search partner name (≥ 2 chars)"}
              value={query}
              onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              style={{ flex: 1 }}
            />
          </div>
        )}
        {!partner && searchOpen && query.trim().length >= 2 && (
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
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {isFetching && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--tl-fg-3)", fontSize: 12, padding: 6 }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {vi ? "Đang tìm…" : "Searching…"}
              </div>
            )}
            {!isFetching && (data?.hits ?? []).length === 0 && (
              <div style={{ color: "var(--tl-fg-3)", fontSize: 12, padding: 6 }}>
                {vi ? "Không thấy ai khớp." : "No matches."}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(data?.hits ?? []).map((hit, idx) => {
                const canLink = hit.user_id != null;
                return (
                  <button
                    key={`${hit.user_id ?? hit.dupr_id ?? idx}`}
                    type="button"
                    disabled={!canLink}
                    onClick={() => { setPartner(hit); setSearchOpen(false); setQuery(""); }}
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
                  >
                    <UserCircle2 className="w-4 h-4" style={{ color: "var(--tl-fg-3)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--tl-fg)" }}>{hit.full_name}</span>
                    {hit.doubles_rating != null && (
                      <span style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, color: "var(--tl-green)" }}>
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

      {/* Team name optional */}
      <Input
        placeholder={vi ? "Tên đội (tuỳ chọn — auto từ tên 2 VĐV)" : "Team name (optional — auto from players)"}
        value={teamName}
        onChange={e => setTeamName(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      <button
        type="button"
        className="tl-btn green"
        disabled={!partner || loading}
        onClick={async () => {
          if (!partner?.user_id) return;
          await onSubmit(partner.user_id, teamName.trim() || undefined);
          setPartner(null);
          setTeamName("");
        }}
        style={{ width: "100%", justifyContent: "center", padding: "10px 16px" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {vi ? "Xác nhận đăng ký" : "Confirm registration"}
      </button>
    </div>
  );
}

function RegisteredTeamsList({
  teams,
  myUserId,
  vi,
  playerDupr,
  isOrganizer,
  onOrganizerRemove,
}: {
  teams: Team[];
  myUserId: string | null;
  vi: boolean;
  playerDupr: PerPlayerDupr;
  isOrganizer: boolean;
  onOrganizerRemove: (team: Team) => void | Promise<void>;
}) {
  if (teams.length === 0) {
    return (
      <div style={{ padding: 14, color: "var(--tl-fg-3)", fontSize: 13, textAlign: "center" }}>
        {vi ? "Chưa có đội nào đăng ký." : "No teams yet."}
      </div>
    );
  }
  return (
    <div
      style={{
        padding: 16,
        background: "var(--tl-bg-elev)",
        border: "1px solid var(--tl-border)",
        borderRadius: "var(--tl-radius-lg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Users className="w-4 h-4" style={{ color: "var(--tl-fg-3)" }} />
        <span style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, letterSpacing: "0.08em", color: "var(--tl-fg-3)", textTransform: "uppercase" }}>
          {vi ? `Đội đã đăng ký · ${teams.length}` : `Registered teams · ${teams.length}`}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {teams.map(team => {
          const mine = !!myUserId && (team.player1_user_id === myUserId || team.player2_user_id === myUserId);
          const p1 = team.player1_user_id ? playerDupr.get(team.player1_user_id) : undefined;
          const p2 = team.player2_user_id ? playerDupr.get(team.player2_user_id) : undefined;
          return (
            <div
              key={team.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 12px",
                background: mine ? "rgba(34,197,94,0.06)" : "var(--tl-bg)",
                border: `1px solid ${mine ? "rgba(34,197,94,0.3)" : "var(--tl-border)"}`,
                borderRadius: "var(--tl-radius)",
                fontSize: 13.5,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", alignItems: "baseline" }}>
                  <PlayerName name={team.player1_name} dupr={p1?.rating ?? null} isApprox={p1?.isApprox ?? false} />
                  <span style={{ color: "var(--tl-fg-4)", fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11 }}>/</span>
                  <PlayerName name={team.player2_name ?? "—"} dupr={p2?.rating ?? null} isApprox={p2?.isApprox ?? false} />
                </div>
                {team.dupr_avg_rating != null && (
                  <div style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, color: "var(--tl-fg-3)", fontVariantNumeric: "tabular-nums" }}>
                    avg <span style={{ color: "var(--tl-green)" }}>{team.dupr_avg_rating.toFixed(2)}</span>
                    {team.dupr_seed_source === "approx" && (
                      <span style={{ color: "rgb(96,165,250)", marginLeft: 4 }}>·{vi ? "ước tính" : "approx"}</span>
                    )}
                  </div>
                )}
              </div>
              {isOrganizer && (
                <button
                  type="button"
                  className="tl-btn"
                  onClick={() => onOrganizerRemove(team)}
                  aria-label={vi ? "Xoá đội" : "Remove team"}
                  title={vi ? "Xoá đội (BTC)" : "Remove team (organizer)"}
                  style={{ padding: "6px 10px", fontSize: 12, color: "var(--tl-live)", borderColor: "rgba(239,68,68,0.3)" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sprint E.4 (2026-05-29) — inline player display: name + DUPR pill.
function PlayerName({ name, dupr, isApprox }: { name: string; dupr: number | null; isApprox: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "var(--tl-fg)" }}>{name}</span>
      {dupr != null ? (
        <span style={{
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 10.5,
          color: "var(--tl-green)",
          fontVariantNumeric: "tabular-nums",
          padding: "1px 6px",
          borderRadius: 4,
          background: "rgba(34,197,94,0.10)",
        }}>
          {dupr.toFixed(2)}{isApprox ? '*' : ''}
        </span>
      ) : (
        <span style={{
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 10.5,
          color: "var(--tl-fg-4)",
        }}>—</span>
      )}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectAllRegisteredUserIds(teams: Team[]): string[] {
  const ids: string[] = [];
  for (const t of teams) {
    if (t.player1_user_id) ids.push(t.player1_user_id);
    if (t.player2_user_id) ids.push(t.player2_user_id);
  }
  return ids;
}

function localizeError(code: string | undefined, vi: boolean): string {
  if (!code) return vi ? "Lỗi không xác định" : "Unknown error";
  const map: Record<string, [string, string]> = {
    AUTH_REQUIRED: ["Cần đăng nhập", "Sign in required"],
    INVALID_PARTNER: ["Đồng đội không hợp lệ", "Invalid partner"],
    TOURNAMENT_NOT_FOUND: ["Không tìm thấy giải", "Tournament not found"],
    REGISTRATION_CLOSED: ["Đăng ký đã đóng", "Registration is closed"],
    NOT_DUPR_TOURNAMENT: ["Giải này không dùng DUPR", "Not a DUPR tournament"],
    TOURNAMENT_FULL: ["Giải đã đủ đội", "Tournament is full"],
    ALREADY_REGISTERED: ["Bạn hoặc đồng đội đã đăng ký rồi", "You or your partner already registered"],
    MISSING_DUPR: ["Thiếu DUPR ở ít nhất 1 VĐV", "Missing DUPR for at least one player"],
    OUT_OF_RANGE: ["DUPR trung bình không nằm trong khoảng cho phép", "Average DUPR is outside the allowed range"],
    NOT_OWNER: ["Không có quyền", "Not the owner"],
    NOT_REGISTRATION_OPEN: ["Giải không ở trạng thái mở đăng ký", "Tournament is not registration_open"],
    NOT_FULL: ["Chưa đủ đội", "Not full yet"],
    INVALID_PLAYERS: ["Thiếu VĐV", "Players missing"],
    SAME_PLAYER: ["Hai VĐV trùng nhau", "Same player twice"],
    TEAM_NOT_FOUND: ["Không tìm thấy đội", "Team not found"],
  };
  const pair = map[code];
  if (!pair) return code;
  return vi ? pair[0] : pair[1];
}


// Sprint E.5 (2026-05-29) — inline manual-add form for BTC. Two
// DuprUserSearch slots + optional team_name. Stays collapsed by default
// to avoid stealing focus from the main 'registered teams' surface.
function OrganizerAddTeamPanel({
  tournament,
  loading,
  excludeUserIds,
  vi,
  onSubmit,
}: {
  tournament: Tournament;
  loading: boolean;
  excludeUserIds: string[];
  vi: boolean;
  onSubmit: (player1UserId: string, player2UserId: string, teamName?: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [p1, setP1] = useState<DuprSearchHit | null>(null);
  const [p2, setP2] = useState<DuprSearchHit | null>(null);
  const [teamName, setTeamName] = useState("");
  const exclude = useMemo(() => {
    const ids = [...excludeUserIds];
    if (p1?.user_id) ids.push(p1.user_id);
    if (p2?.user_id) ids.push(p2.user_id);
    return ids;
  }, [excludeUserIds, p1, p2]);

  const range = useMemo(() => {
    if (tournament.min_dupr_rating != null && tournament.max_dupr_rating != null) {
      return `${tournament.min_dupr_rating.toFixed(2)} – ${tournament.max_dupr_rating.toFixed(2)}`;
    }
    if (tournament.min_dupr_rating != null) return `≥ ${tournament.min_dupr_rating.toFixed(2)}`;
    if (tournament.max_dupr_rating != null) return `≤ ${tournament.max_dupr_rating.toFixed(2)}`;
    return null;
  }, [tournament.min_dupr_rating, tournament.max_dupr_rating]);

  if (!open) {
    return (
      <button
        type="button"
        className="tl-btn"
        onClick={() => setOpen(true)}
        style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: 13 }}
      >
        <Plus className="w-4 h-4" />
        {vi ? 'Thêm thủ công VĐV' : 'Add team manually'}
      </button>
    );
  }

  return (
    <div
      style={{
        padding: 18,
        background: 'var(--tl-bg-elev)',
        border: '1px solid var(--tl-border)',
        borderRadius: 'var(--tl-radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.08em', color: 'var(--tl-green)', textTransform: 'uppercase' }}>
            ◆ {vi ? 'BTC thêm đội' : 'Organizer add team'}
          </div>
          <h3 style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 20, margin: '4px 0 0', color: 'var(--tl-fg)' }}>
            {vi ? 'Tìm 2 VĐV đã có DUPR' : 'Find 2 players with DUPR'}
          </h3>
          {range && (
            <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: '6px 0 0', lineHeight: 1.5 }}>
              {vi ? 'Khoảng DUPR cho phép' : 'DUPR range'}: <strong style={{ color: 'var(--tl-fg)' }}>{range}</strong>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); setP1(null); setP2(null); setTeamName(''); }}
          aria-label={vi ? 'Đóng' : 'Close'}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--tl-fg-3)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <PlayerSearchSlot label={vi ? 'VĐV 1' : 'Player 1'} value={p1} onChange={setP1} excludeUserIds={exclude} vi={vi} />
      <PlayerSearchSlot label={vi ? 'VĐV 2' : 'Player 2'} value={p2} onChange={setP2} excludeUserIds={exclude} vi={vi} />

      <Input
        placeholder={vi ? 'Tên đội (tuỳ chọn — auto từ 2 VĐV)' : 'Team name (optional — auto from players)'}
        value={teamName}
        onChange={e => setTeamName(e.target.value)}
      />

      <button
        type="button"
        className="tl-btn green"
        disabled={!p1?.user_id || !p2?.user_id || loading}
        onClick={async () => {
          if (!p1?.user_id || !p2?.user_id) return;
          const ok = await onSubmit(p1.user_id, p2.user_id, teamName.trim() || undefined);
          if (ok) {
            setP1(null); setP2(null); setTeamName('');
            setOpen(false);
          }
        }}
        style={{ justifyContent: 'center', padding: '10px 16px' }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {vi ? 'Thêm vào danh sách' : 'Add to list'}
      </button>
    </div>
  );
}

// Sprint E.5 (2026-05-29) — single-slot player search with linked-card UX.
// Lifted from RegistrationForm so we can reuse it twice in the organizer panel.
function PlayerSearchSlot({
  label,
  value,
  onChange,
  excludeUserIds,
  vi,
}: {
  label: string;
  value: DuprSearchHit | null;
  onChange: (next: DuprSearchHit | null) => void;
  excludeUserIds: string[];
  vi: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useDuprUserSearch(query, { excludeUserIds, limit: 8 });

  if (value) {
    return (
      <div>
        <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--tl-fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>
          {label}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--tl-radius)',
            fontSize: 13.5,
          }}
        >
          <UserCircle2 className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
          <span style={{ flex: 1 }}>{value.full_name}</span>
          {value.doubles_rating != null && (
            <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: 'var(--tl-green)' }}>
              DUPR {value.doubles_rating.toFixed(2)}
            </span>
          )}
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(""); }}
            aria-label={vi ? 'Bỏ chọn' : 'Unselect'}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--tl-fg-3)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--tl-fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <Input
        placeholder={vi ? 'Tìm tên VĐV (≥ 2 ký tự)' : 'Search player name (≥ 2 chars)'}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            background: 'var(--tl-bg-elev)',
            border: '1px solid var(--tl-border)',
            borderRadius: 'var(--tl-radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: 8,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {isFetching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tl-fg-3)', fontSize: 12, padding: 6 }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {vi ? 'Đang tìm…' : 'Searching…'}
            </div>
          )}
          {!isFetching && (data?.hits ?? []).length === 0 && (
            <div style={{ color: 'var(--tl-fg-3)', fontSize: 12, padding: 6 }}>
              {vi ? 'Không thấy ai khớp.' : 'No matches.'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(data?.hits ?? []).map((hit, idx) => {
              const canLink = hit.user_id != null;
              return (
                <button
                  key={`${hit.user_id ?? hit.dupr_id ?? idx}`}
                  type="button"
                  disabled={!canLink}
                  onClick={() => { onChange(hit); setOpen(false); setQuery(""); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: '1px solid var(--tl-border)',
                    borderRadius: 'var(--tl-radius)',
                    background: canLink ? 'var(--tl-bg)' : 'var(--tl-surface)',
                    cursor: canLink ? 'pointer' : 'not-allowed',
                    opacity: canLink ? 1 : 0.55,
                    textAlign: 'left',
                  }}
                >
                  <UserCircle2 className="w-4 h-4" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--tl-fg)' }}>{hit.full_name}</span>
                  {hit.doubles_rating != null && (
                    <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: 'var(--tl-green)' }}>
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
