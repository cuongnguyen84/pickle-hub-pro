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

import { useState, useMemo } from "react";
import { Sparkles, Users, Loader2, UserCircle2, X, Trophy, Lock, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { useDuprUserSearch, type DuprSearchHit } from "@/hooks/useDuprUserSearch";
import { useDoublesElimination, type Tournament, type Team } from "@/hooks/useDoublesElimination";
import { DuprConnectButton } from "@/components/dupr/DuprConnectButton";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

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
  const { registerTeam, cancelTeamRegistration, closeRegistration, generateBracket, loading } = useDoublesElimination();

  // Pick the row for the current user (either slot) so we can show cancel UI.
  const myTeam = useMemo(() => {
    if (!user) return null;
    return teams.find(t => t.player1_user_id === user.id || t.player2_user_id === user.id) ?? null;
  }, [user, teams]);

  const isOrganizer = !!user && user.id === tournament.creator_user_id;
  const isFull = teams.length >= tournament.team_count;
  const capacityPct = Math.round((teams.length / tournament.team_count) * 100);

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
      {!user ? (
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
      <RegisteredTeamsList teams={teams} myUserId={user?.id ?? null} vi={vi} />
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
}: {
  teams: Team[];
  myUserId: string | null;
  vi: boolean;
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
          return (
            <div
              key={team.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "8px 12px",
                background: mine ? "rgba(34,197,94,0.06)" : "var(--tl-bg)",
                border: `1px solid ${mine ? "rgba(34,197,94,0.3)" : "var(--tl-border)"}`,
                borderRadius: "var(--tl-radius)",
                fontSize: 13.5,
              }}
            >
              <span style={{ color: "var(--tl-fg)" }}>{team.team_name}</span>
              {team.dupr_avg_rating != null && (
                <span style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 11, color: "var(--tl-green)", fontVariantNumeric: "tabular-nums" }}>
                  DUPR {team.dupr_avg_rating.toFixed(2)}
                  {team.dupr_seed_source === "approx" && (
                    <span style={{ color: "rgb(96,165,250)", marginLeft: 4 }}>·{vi ? "ước tính" : "approx"}</span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
  };
  const pair = map[code];
  if (!pair) return code;
  return vi ? pair[0] : pair[1];
}
