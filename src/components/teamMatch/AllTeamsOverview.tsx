import { Users, Check, Clock, ClipboardList, X } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchMatches } from '@/hooks/useTeamMatchMatches';
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

interface AllTeamsOverviewProps {
  teams: TeamMatchTeam[];
  tournamentId: string;
  maxRosterSize: number;
}

function TeamLineupStatus({
  teamId,
  tournamentId,
  lineupLabel,
  lineupDoneLabel,
}: {
  teamId: string;
  tournamentId: string;
  lineupLabel: string;
  lineupDoneLabel: string;
}) {
  const { data: matches } = useTeamMatchMatches(tournamentId);

  if (!matches || matches.length === 0) return null;

  // Check lineup status across all matches for this team
  const teamMatches = matches.filter(
    m => m.team_a_id === teamId || m.team_b_id === teamId
  );

  if (teamMatches.length === 0) return null;

  // Count submitted lineups
  const submittedCount = teamMatches.reduce((count, match) => {
    const isTeamA = match.team_a_id === teamId;
    const isSubmitted = isTeamA ? match.lineup_a_submitted : match.lineup_b_submitted;
    return count + (isSubmitted ? 1 : 0);
  }, 0);

  const allSubmitted = submittedCount === teamMatches.length;

  return (
    <span
      style={{
        ...statusPillBase,
        ...(allSubmitted
          ? { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }
          : { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' }),
      }}
    >
      <ClipboardList className="h-3 w-3" />
      {allSubmitted ? lineupDoneLabel : `${lineupLabel}: ${submittedCount}/${teamMatches.length}`}
    </span>
  );
}

function TeamRosterCount({ teamId, maxRosterSize }: { teamId: string; maxRosterSize: number }) {
  const { roster } = useTeamMatchTeam(teamId);
  const count = roster.length;
  const isFull = count >= maxRosterSize;

  return (
    <span
      style={{
        ...statusPillBase,
        ...(isFull
          ? { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }
          : { background: 'var(--tl-surface)', color: 'var(--tl-fg-2)', border: '1px solid var(--tl-border)' }),
      }}
    >
      <Users className="h-3 w-3" />
      {count}/{maxRosterSize}
    </span>
  );
}

export function AllTeamsOverview({ teams, tournamentId, maxRosterSize }: AllTeamsOverviewProps) {
  const { t, language } = useI18n();
  const c = t.teamMatchComponents;

  const STATUS_LABELS: Record<StatusKind, string> = {
    pending: c.statusPending,
    approved: c.statusApproved,
    rejected: c.statusRejected,
  };

  const txt = {
    teamListTitle: c.teamListTitle,
    lineupShort: language === 'vi' ? 'Line up' : 'Lineup',
    lineupDone: c.lineupDone,
    noTeams: c.noTeams,
  };

  // Filter out rejected teams
  const visibleTeams = teams.filter(t => t.status !== 'rejected');

  if (visibleTeams.length === 0) {
    return (
      <div style={{ ...surfaceCard, padding: 32 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '24px 16px' }}>
          <span className="tl-empty-card-mark">
            <Users className="h-6 w-6" />
          </span>
          <span className="tl-empty-card-label">{txt.noTeams}</span>
        </div>
      </div>
    );
  }

  return (
    <section style={{ ...surfaceCard, padding: 16 }}>
      <header style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users className="h-4 w-4" style={{ color: 'var(--tl-fg-2)' }} />
        <h3 style={sectionTitle}>{txt.teamListTitle} ({visibleTeams.length})</h3>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleTeams.map((team) => {
          const kind = team.status as StatusKind;
          return (
            <div
              key={team.id}
              onMouseEnter={onRowEnter}
              onMouseLeave={onRowLeave}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                gap: 12,
                borderRadius: 'var(--tl-radius)',
                border: '1px solid var(--tl-border)',
                background: 'transparent',
                transition: 'background 0.15s',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ ...inlineTeamName, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {team.team_name}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <TeamRosterCount teamId={team.id} maxRosterSize={maxRosterSize} />

                <span style={{ ...statusPillBase, ...statusPillStyle(kind) }}>
                  {team.status === 'approved' && <Check className="h-3 w-3" />}
                  {team.status === 'pending' && <Clock className="h-3 w-3" />}
                  {team.status === 'rejected' && <X className="h-3 w-3" />}
                  {STATUS_LABELS[kind]}
                </span>

                <TeamLineupStatus
                  teamId={team.id}
                  tournamentId={tournamentId}
                  lineupLabel={txt.lineupShort}
                  lineupDoneLabel={txt.lineupDone}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
