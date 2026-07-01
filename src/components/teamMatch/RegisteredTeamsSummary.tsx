import { Users, Check, Clock, UserCheck, AlertCircle, X, Loader2, Play, UserPlus } from 'lucide-react';
import { TeamMatchTeam, TeamMatchRosterMember, useTeamMatchTeamManagement, useUserMembership } from '@/hooks/useTeamMatchTeams';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';

// ─── W2.4b shared tokens (mirror MatchList/PlayoffBracket from #103) ─────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const inlineTeamName: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 17,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

const subLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  letterSpacing: '0.04em',
  color: 'var(--tl-fg-3)',
};

const statusPillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '3px 9px',
  borderRadius: 4,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

type StatusKind = 'approved' | 'pending' | 'rejected';

function statusPillStyle(kind: StatusKind): React.CSSProperties {
  if (kind === 'approved') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (kind === 'pending') return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
  return { background: 'rgba(255, 65, 54, 0.10)', color: 'var(--tl-live)' };
}

function onRowEnter(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
}
function onRowLeave(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

interface RegisteredTeamsSummaryProps {
  teams: TeamMatchTeam[];
  maxRosterSize: number;
  isOwner: boolean;
  tournamentId: string;
  hasMatches?: boolean;
  onTeamClick?: (team: TeamMatchTeam) => void;
  onGenerateMatches?: () => void;
}

export function RegisteredTeamsSummary({
  teams,
  maxRosterSize,
  isOwner,
  tournamentId,
  hasMatches,
  onTeamClick,
  onGenerateMatches,
}: RegisteredTeamsSummaryProps) {
  const { updateTeamStatus, isUpdatingStatus } = useTeamMatchTeamManagement();
  const { user } = useAuth();
  const { data: membership } = useUserMembership(tournamentId);
  const { t, language } = useI18n();
  const c = t.teamMatchComponents;

  // Anyone not already on a team (incl. the organizer) can request to join an
  // approved team they don't captain. The button just opens the detail sheet;
  // TeamJoinPanel there handles gender/DUPR/confirm.
  const canRequestJoin = (team: TeamMatchTeam) =>
    !!user &&
    !membership &&
    team.status === 'approved' &&
    team.captain_user_id !== user.id;

  const STATUS_LABELS: Record<StatusKind, string> = {
    pending: c.statusPending,
    approved: c.statusApproved,
    rejected: c.statusRejected,
  };

  const txt = {
    captainPrefix: language === 'vi' ? 'Đội trưởng' : 'Captain',
    captainUnknown: language === 'vi' ? 'Chưa rõ' : 'N/A',
    addPlayer: language === 'vi' ? '+VĐV' : '+Player',
    teamsRegisteredTitle: language === 'vi' ? 'Đội đã đăng ký' : 'Registered teams',
    approvedStat: language === 'vi' ? 'đã duyệt' : 'approved',
    pendingStat: language === 'vi' ? 'chờ duyệt' : 'pending',
    rejectedStat: language === 'vi' ? 'từ chối' : 'rejected',
    generateScheduleBtn: language === 'vi' ? 'Tạo lịch thi đấu' : 'Create schedule',
    teamsLabel: language === 'vi' ? 'đội' : 'teams',
    needsReview: language === 'vi' ? 'Cần duyệt' : 'Needs review',
    approvedSection: language === 'vi' ? 'Đã duyệt' : 'Approved',
    awaitingApproval: language === 'vi' ? 'Đang chờ duyệt' : 'Awaiting approval',
    emptyTitle: language === 'vi' ? 'Chưa có đội nào đăng ký' : 'No teams registered yet',
    requestJoin: language === 'vi' ? 'Yêu cầu tham gia' : 'Request to join',
  };

  // Fetch all rosters for the teams
  const { data: allRosters } = useQuery({
    queryKey: ['team-match-all-rosters', teams.map(t => t.id).join(',')],
    queryFn: async () => {
      if (teams.length === 0) return {};

      const { data, error } = await supabase
        .from('team_match_roster')
        .select('*')
        .in('team_id', teams.map(t => t.id));

      if (error) throw error;

      // Group by team_id
      const grouped: Record<string, TeamMatchRosterMember[]> = {};
      (data as TeamMatchRosterMember[]).forEach(member => {
        if (!grouped[member.team_id]) {
          grouped[member.team_id] = [];
        }
        grouped[member.team_id].push(member);
      });
      return grouped;
    },
    enabled: teams.length > 0,
  });

  // Group teams by status for display
  const pendingTeams = teams.filter(t => t.status === 'pending');
  const approvedTeams = teams.filter(t => t.status === 'approved');
  const rejectedTeams = teams.filter(t => t.status === 'rejected');

  const getTeamRoster = (teamId: string) => allRosters?.[teamId] || [];

  const getCaptainName = (teamId: string) => {
    const roster = getTeamRoster(teamId);
    const captain = roster.find(m => m.is_captain);
    return captain?.player_name || txt.captainUnknown;
  };

  const getRosterCount = (teamId: string) => {
    return getTeamRoster(teamId).length;
  };

  const isRosterFull = (teamId: string) => {
    return getRosterCount(teamId) >= maxRosterSize;
  };

  const handleApprove = async (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    await updateTeamStatus({ teamId, status: 'approved', tournamentId });
  };

  const handleReject = async (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    await updateTeamStatus({ teamId, status: 'rejected', tournamentId });
  };

  if (teams.length === 0 || (!isOwner && approvedTeams.length === 0)) {
    return (
      <div style={{ ...surfaceCard, padding: 32 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '24px 16px' }}>
          <span className="tl-empty-card-mark">
            <Users className="h-6 w-6" />
          </span>
          <span className="tl-empty-card-label">{txt.emptyTitle}</span>
        </div>
      </div>
    );
  }

  const renderTeamRow = (team: TeamMatchTeam) => {
    const rosterCount = getRosterCount(team.id);
    const isFull = isRosterFull(team.id);
    const kind = team.status as StatusKind;

    return (
      <div
        key={team.id}
        onMouseEnter={onRowEnter}
        onMouseLeave={onRowLeave}
        onClick={() => onTeamClick?.(team)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          gap: 8,
          borderRadius: 'var(--tl-radius)',
          border: '1px solid var(--tl-border)',
          background: 'transparent',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--tl-surface)',
              border: '1px solid var(--tl-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--tl-fg-2)',
            }}
          >
            <Users className="h-4 w-4" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...inlineTeamName, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {team.team_name}
            </p>
            <p style={{ ...subLabel, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {txt.captainPrefix}: {getCaptainName(team.id)}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Prominent request-to-join (opens detail sheet to confirm).
              Shown for players AND the organizer, when they can still join. */}
          {canRequestJoin(team) && (
            <button
              type="button"
              className="tl-btn green"
              style={{ padding: '8px 14px', fontSize: 13, flexShrink: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onTeamClick?.(team);
              }}
            >
              <UserPlus className="h-4 w-4" />
              {txt.requestJoin}
            </button>
          )}

          {/* Add members button for incomplete rosters - BTC only */}
          {isOwner && !isFull && (
            <button
              type="button"
              className="tl-btn"
              style={{
                padding: '4px 9px',
                fontSize: 11,
                background: 'rgba(233, 182, 73, 0.10)',
                color: 'var(--tl-gold)',
                borderColor: 'rgba(233, 182, 73, 0.35)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTeamClick?.(team);
              }}
            >
              <UserPlus className="h-3 w-3" />
              {txt.addPlayer} ({rosterCount}/{maxRosterSize})
            </button>
          )}

          {/* Full roster badge — BTC only */}
          {isOwner && isFull && (
            <span style={{ ...statusPillBase, background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }}>
              <UserCheck className="h-3 w-3" />
              {rosterCount}/{maxRosterSize}
            </span>
          )}

          {/* Status pill — BTC only; players just see name + captain + join */}
          {isOwner && (
            <span style={{ ...statusPillBase, ...statusPillStyle(kind) }}>
              {team.status === 'approved' && <Check className="h-3 w-3" />}
              {team.status === 'pending' && <Clock className="h-3 w-3" />}
              {team.status === 'rejected' && <X className="h-3 w-3" />}
              {STATUS_LABELS[kind]}
            </span>
          )}

          {/* Approve/Reject actions for owner */}
          {isOwner && team.status === 'pending' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <button
                type="button"
                className="tl-btn"
                style={{ padding: '5px 7px', color: 'var(--tl-green)', borderColor: 'var(--tl-green-dim)' }}
                onClick={(e) => handleApprove(e, team.id)}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                className="tl-btn"
                style={{ padding: '5px 7px', color: 'var(--tl-live)', borderColor: 'rgba(255, 65, 54, 0.35)' }}
                onClick={(e) => handleReject(e, team.id)}
                disabled={isUpdatingStatus}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Re-approve action for rejected teams */}
          {isOwner && team.status === 'rejected' && (
            <button
              type="button"
              className="tl-btn"
              style={{ padding: '5px 7px', color: 'var(--tl-green)', borderColor: 'var(--tl-green-dim)', marginLeft: 4 }}
              onClick={(e) => handleApprove(e, team.id)}
              disabled={isUpdatingStatus}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section style={{ ...surfaceCard, padding: 16 }}>
      <header style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users className="h-4 w-4" style={{ color: 'var(--tl-fg-2)' }} />
        <h3 style={sectionTitle}>{txt.teamsRegisteredTitle} ({isOwner ? teams.length : approvedTeams.length})</h3>
      </header>

      {/* Summary stats — BTC only */}
      {isOwner && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-green-glow)',
            color: 'var(--tl-green)',
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 12,
          }}
        >
          <Check className="h-4 w-4" />
          <span>{approvedTeams.length} {txt.approvedStat}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--tl-radius)',
            background: 'rgba(233, 182, 73, 0.12)',
            color: 'var(--tl-gold)',
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 12,
          }}
        >
          <Clock className="h-4 w-4" />
          <span>{pendingTeams.length} {txt.pendingStat}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-surface)',
            color: 'var(--tl-fg-3)',
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 12,
          }}
        >
          <AlertCircle className="h-4 w-4" />
          <span>{rejectedTeams.length} {txt.rejectedStat}</span>
        </div>
      </div>
      )}

      {/* Quick action: Generate matches button for BTC */}
      {isOwner && !hasMatches && approvedTeams.length >= 2 && onGenerateMatches && (
        <button
          type="button"
          className="tl-btn green"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', marginBottom: 14 }}
          onClick={onGenerateMatches}
        >
          <Play className="h-4 w-4" />
          {txt.generateScheduleBtn} ({approvedTeams.length} {txt.teamsLabel})
        </button>
      )}

      {/* Team list - show pending first for owner, then approved */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {isOwner && pendingTeams.length > 0 && (
          <>
            <p style={{ ...fieldLabel, margin: '4px 0' }}>{txt.needsReview}</p>
            {pendingTeams.map(renderTeamRow)}
          </>
        )}

        {approvedTeams.length > 0 && (
          <>
            {isOwner && pendingTeams.length > 0 && (
              <p style={{ ...fieldLabel, margin: '12px 0 4px' }}>{txt.approvedSection}</p>
            )}
            {approvedTeams.map(renderTeamRow)}
          </>
        )}

      </div>
    </section>
  );
}
