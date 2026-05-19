import { Skeleton } from '@/components/ui/skeleton';
import { Trophy } from 'lucide-react';
import { useTeamMatchMatches } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useI18n } from '@/i18n';

interface StandingsTableProps {
  tournamentId: string;
}

interface TeamStanding {
  team: TeamMatchTeam;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
}

// ─── W2.4c shared tokens (mirror MatchList/PlayoffBracket from #103,
//     TeamMatchOverviewTab/RegisteredTeamsSummary from #107) ─────────────
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

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

const headStyle: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-3)',
  padding: '10px 12px',
  textAlign: 'left',
  borderBottom: '1px solid var(--tl-border)',
  whiteSpace: 'nowrap',
};

const cellStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: 13,
  color: 'var(--tl-fg)',
  borderBottom: '1px solid var(--tl-border)',
  fontVariantNumeric: 'tabular-nums',
  verticalAlign: 'middle',
};

export function StandingsTable({ tournamentId }: StandingsTableProps) {
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: teams, isLoading: isLoadingTeams } = useTeamMatchTeams(tournamentId);
  const { language } = useI18n();

  const txt = {
    standingsTitle: language === 'vi' ? 'Bảng xếp hạng' : 'Standings',
    emptyTitle: language === 'vi' ? 'Chưa có đội nào tham gia' : 'No teams yet',
    emptyHint: language === 'vi' ? 'Duyệt đội để xem bảng xếp hạng' : 'Approve teams to view standings',
    colRank: '#',
    colTeam: language === 'vi' ? 'Đội' : 'Team',
    colWon: language === 'vi' ? 'T' : 'W',
    colLost: language === 'vi' ? 'B' : 'L',
    colPoints: language === 'vi' ? 'Đ' : 'Pts',
    colGames: language === 'vi' ? 'Ván' : 'Games',
    colDiff: '+/-',
    titleWon: language === 'vi' ? 'Số trận thắng' : 'Matches won',
    titleLost: language === 'vi' ? 'Số trận thua' : 'Matches lost',
    titlePoints: language === 'vi' ? 'Điểm (Thắng = 1đ)' : 'Points (Win = 1pt)',
    titleGames: language === 'vi' ? 'Hiệu số ván thắng - thua' : 'Games won - lost',
    titleDiff: language === 'vi' ? 'Hiệu số điểm' : 'Point differential',
    legend: language === 'vi'
      ? [
          { mark: 'T', meaning: 'Thắng' },
          { mark: 'B', meaning: 'Thua' },
          { mark: 'Đ', meaning: 'Điểm' },
          { mark: '+/-', meaning: 'Hiệu số' },
        ]
      : [
          { mark: 'W', meaning: 'Won' },
          { mark: 'L', meaning: 'Lost' },
          { mark: 'Pts', meaning: 'Points' },
          { mark: '+/-', meaning: 'Differential' },
        ],
  };

  if (isLoadingMatches || isLoadingTeams) {
    return (
      <div style={{ ...surfaceCard, padding: 16 }}>
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const approvedTeams = teams?.filter(t => t.status === 'approved') || [];

  if (approvedTeams.length === 0) {
    return (
      <div style={{ ...surfaceCard, padding: 32 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '24px 16px' }}>
          <span className="tl-empty-card-mark">
            <Trophy className="h-6 w-6" />
          </span>
          <span className="tl-empty-card-label">{txt.emptyTitle}</span>
          <span className="tl-empty-card-hint">{txt.emptyHint}</span>
        </div>
      </div>
    );
  }

  // Calculate standings from matches
  const standingsMap = new Map<string, TeamStanding>();

  // Initialize all approved teams
  approvedTeams.forEach(team => {
    standingsMap.set(team.id, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      gamesWon: 0,
      gamesLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
    });
  });

  // Process completed matches
  matches?.forEach(match => {
    if (match.status !== 'completed' || !match.winner_team_id) return;
    if (!match.team_a_id || !match.team_b_id) return;

    const teamA = standingsMap.get(match.team_a_id);
    const teamB = standingsMap.get(match.team_b_id);

    if (teamA) {
      teamA.played++;
      teamA.gamesWon += match.games_won_a;
      teamA.gamesLost += match.games_won_b;
      teamA.pointsFor += match.total_points_a;
      teamA.pointsAgainst += match.total_points_b;
      teamA.pointsDiff = teamA.pointsFor - teamA.pointsAgainst;

      if (match.winner_team_id === match.team_a_id) {
        teamA.won++;
      } else {
        teamA.lost++;
      }
    }

    if (teamB) {
      teamB.played++;
      teamB.gamesWon += match.games_won_b;
      teamB.gamesLost += match.games_won_a;
      teamB.pointsFor += match.total_points_b;
      teamB.pointsAgainst += match.total_points_a;
      teamB.pointsDiff = teamB.pointsFor - teamB.pointsAgainst;

      if (match.winner_team_id === match.team_b_id) {
        teamB.won++;
      } else {
        teamB.lost++;
      }
    }
  });

  // Sort standings: by wins desc, then game diff, then points diff
  const standings = Array.from(standingsMap.values()).sort((a, b) => {
    if (b.won !== a.won) return b.won - a.won;
    const gameDiffA = a.gamesWon - a.gamesLost;
    const gameDiffB = b.gamesWon - b.gamesLost;
    if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
    return b.pointsDiff - a.pointsDiff;
  });

  return (
    <div style={{ ...surfaceCard, padding: 0 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 16px',
          borderBottom: '1px solid var(--tl-border)',
        }}
      >
        <Trophy className="h-4 w-4" style={{ color: 'var(--tl-fg-2)' }} />
        <h3 style={sectionTitle}>{txt.standingsTitle}</h3>
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: 'center', width: 44 }}>{txt.colRank}</th>
              <th style={headStyle}>{txt.colTeam}</th>
              <th style={{ ...headStyle, textAlign: 'center', width: 44 }} title={txt.titleWon}>
                {txt.colWon}
              </th>
              <th style={{ ...headStyle, textAlign: 'center', width: 44 }} title={txt.titleLost}>
                {txt.colLost}
              </th>
              <th style={{ ...headStyle, textAlign: 'center', width: 56 }} title={txt.titlePoints}>
                {txt.colPoints}
              </th>
              <th style={{ ...headStyle, textAlign: 'center', width: 72 }} title={txt.titleGames}>
                {txt.colGames}
              </th>
              <th style={{ ...headStyle, textAlign: 'center', width: 60 }} title={txt.titleDiff}>
                {txt.colDiff}
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => {
              const rank = index + 1;
              const isFirst = rank === 1;
              const isTop3 = rank <= 3;
              const rowBg = isFirst
                ? 'var(--tl-green-glow)'
                : isTop3
                  ? 'var(--tl-bg)'
                  : 'transparent';
              const diffColor =
                standing.pointsDiff > 0
                  ? 'var(--tl-green)'
                  : standing.pointsDiff < 0
                    ? 'var(--tl-fg-3)'
                    : 'var(--tl-fg-2)';

              return (
                <tr key={standing.team.id} style={{ background: rowBg }}>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      fontWeight: 600,
                      color: isFirst ? 'var(--tl-green)' : 'var(--tl-fg)',
                    }}
                  >
                    {rank}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      fontFamily: 'Instrument Serif, serif',
                      fontStyle: 'italic',
                      fontSize: 17,
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {standing.team.team_name}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontWeight: 600,
                      color: 'var(--tl-green)',
                    }}
                  >
                    {standing.won}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--tl-fg-3)' }}>
                    {standing.lost}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontWeight: 700,
                      color: 'var(--tl-fg)',
                    }}
                  >
                    {standing.won}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      color: 'var(--tl-fg-2)',
                    }}
                  >
                    {standing.gamesWon}-{standing.gamesLost}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: diffColor,
                    }}
                  >
                    {standing.pointsDiff > 0 ? '+' : ''}
                    {standing.pointsDiff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--tl-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          ...fieldLabel,
        }}
      >
        {txt.legend.map(({ mark, meaning }) => (
          <span key={mark}>
            <strong style={{ color: 'var(--tl-fg)' }}>{mark}</strong> = {meaning}
          </span>
        ))}
      </div>
    </div>
  );
}
