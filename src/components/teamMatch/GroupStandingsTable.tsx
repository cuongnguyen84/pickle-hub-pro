import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, CheckCircle2, Star } from 'lucide-react';
import { useTeamMatchMatches } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchGroups } from '@/hooks/useTeamMatchGroups';
import { useMemo } from 'react';
import { useI18n } from '@/i18n';

interface GroupStandingsTableProps {
  tournamentId: string;
  topPerGroup?: number;
  wildcardCount?: number;
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
  isQualified?: boolean;
  isWildcard?: boolean;
}

// ─── W2.4c shared tokens (mirror StandingsTable.tsx) ─────────────────────
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

export function GroupStandingsTable({
  tournamentId,
  topPerGroup = 2,
  wildcardCount = 0,
}: GroupStandingsTableProps) {
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: teams, isLoading: isLoadingTeams } = useTeamMatchTeams(tournamentId);
  const { data: groups, isLoading: isLoadingGroups } = useTeamMatchGroups(tournamentId);
  const { language } = useI18n();

  const txt = {
    topPerGroup: (n: number) =>
      language === 'vi' ? `Top ${n}/bảng vào playoff` : `Top ${n}/group advance to playoff`,
    wildcardLabel: (n: number) =>
      language === 'vi' ? `${n} wildcard` : `${n} wildcard`,
    emptyTitle: language === 'vi' ? 'Chưa chia bảng' : 'No groups yet',
    emptyHint: language === 'vi' ? 'Chia bảng để xem bảng xếp hạng' : 'Create groups to view standings',
    standingsFor: (name: string) =>
      language === 'vi' ? `Xếp hạng ${name}` : `${name} standings`,
    emptyGroup: language === 'vi' ? 'Chưa có đội nào trong bảng này' : 'No teams in this group yet',
    colTeam: language === 'vi' ? 'Đội' : 'Team',
    colPlayed: language === 'vi' ? 'Đ' : 'P',
    colWon: language === 'vi' ? 'T' : 'W',
    colLost: language === 'vi' ? 'B' : 'L',
    colGames: language === 'vi' ? 'Ván' : 'Games',
    colDiff: '+/-',
    legend: language === 'vi'
      ? [
          { mark: 'Đ', meaning: 'Đã đấu' },
          { mark: 'T', meaning: 'Thắng' },
          { mark: 'B', meaning: 'Thua' },
        ]
      : [
          { mark: 'P', meaning: 'Played' },
          { mark: 'W', meaning: 'Won' },
          { mark: 'L', meaning: 'Lost' },
        ],
  };

  // Calculate standings per group
  const standingsByGroup = useMemo(() => {
    if (!teams || !matches || !groups) return new Map<string, TeamStanding[]>();

    const result = new Map<string, TeamStanding[]>();
    const approvedTeams = teams.filter(t => t.status === 'approved');

    // Initialize standings per group
    groups.forEach(group => {
      const teamsInGroup = approvedTeams.filter(t => (t as any).group_id === group.id);
      const standingsMap = new Map<string, TeamStanding>();

      teamsInGroup.forEach(team => {
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

      // Process completed matches in this group
      const groupMatches = matches.filter(m =>
        m.group_id === group.id &&
        !m.is_playoff &&
        m.status === 'completed' &&
        m.winner_team_id
      );

      groupMatches.forEach(match => {
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

      // Sort by wins, game diff, point diff
      const sortedStandings = Array.from(standingsMap.values()).sort((a, b) => {
        if (b.won !== a.won) return b.won - a.won;
        const gameDiffA = a.gamesWon - a.gamesLost;
        const gameDiffB = b.gamesWon - b.gamesLost;
        if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
        return b.pointsDiff - a.pointsDiff;
      });

      // Mark qualified teams
      sortedStandings.forEach((standing, index) => {
        standing.isQualified = index < topPerGroup;
      });

      result.set(group.id, sortedStandings);
    });

    // Handle wildcards across all groups
    if (wildcardCount > 0) {
      const allNonQualified: { standing: TeamStanding; groupId: string }[] = [];

      result.forEach((standings, groupId) => {
        standings.forEach((standing, index) => {
          if (index >= topPerGroup) {
            allNonQualified.push({ standing, groupId });
          }
        });
      });

      // Sort by performance
      allNonQualified.sort((a, b) => {
        if (b.standing.won !== a.standing.won) return b.standing.won - a.standing.won;
        const gameDiffA = a.standing.gamesWon - a.standing.gamesLost;
        const gameDiffB = b.standing.gamesWon - b.standing.gamesLost;
        if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
        return b.standing.pointsDiff - a.standing.pointsDiff;
      });

      // Mark wildcards
      allNonQualified.slice(0, wildcardCount).forEach(({ standing }) => {
        standing.isWildcard = true;
      });
    }

    return result;
  }, [teams, matches, groups, topPerGroup, wildcardCount]);

  if (isLoadingMatches || isLoadingTeams || isLoadingGroups) {
    return (
      <div style={{ ...surfaceCard, padding: 16 }}>
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
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

  const sortedGroups = [...groups].sort((a, b) => a.display_order - b.display_order);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Legend banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          ...surfaceCard,
        }}
      >
        <span style={{ ...statusPillBase, background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }}>
          <CheckCircle2 className="h-3 w-3" />
          {txt.topPerGroup(topPerGroup)}
        </span>
        {wildcardCount > 0 && (
          <span style={{ ...statusPillBase, background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' }}>
            <Star className="h-3 w-3" />
            {txt.wildcardLabel(wildcardCount)}
          </span>
        )}
      </div>

      <Tabs defaultValue={sortedGroups[0]?.id} className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
          {sortedGroups.map((group) => (
            <TabsTrigger key={group.id} value={group.id} className="flex-1 min-w-[100px]">
              {group.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {sortedGroups.map((group) => (
          <TabsContent key={group.id} value={group.id} className="mt-4">
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
                <h3 style={sectionTitle}>{txt.standingsFor(group.name)}</h3>
              </header>
              <StandingsTableContent
                standings={standingsByGroup.get(group.id) || []}
                txt={txt}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface StandingsContentTxt {
  emptyGroup: string;
  colTeam: string;
  colPlayed: string;
  colWon: string;
  colLost: string;
  colGames: string;
  colDiff: string;
  legend: { mark: string; meaning: string }[];
}

function StandingsTableContent({
  standings,
  txt,
}: {
  standings: TeamStanding[];
  txt: StandingsContentTxt;
}) {
  if (standings.length === 0) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--tl-fg-3)',
          fontSize: 13,
        }}
      >
        {txt.emptyGroup}
      </div>
    );
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: 'center', width: 44 }}>#</th>
              <th style={headStyle}>{txt.colTeam}</th>
              <th style={{ ...headStyle, textAlign: 'center', width: 44 }}>{txt.colPlayed}</th>
              <th style={{ ...headStyle, textAlign: 'center', width: 44 }}>{txt.colWon}</th>
              <th style={{ ...headStyle, textAlign: 'center', width: 44 }}>{txt.colLost}</th>
              <th style={{ ...headStyle, textAlign: 'center', width: 72 }}>{txt.colGames}</th>
              <th style={{ ...headStyle, textAlign: 'center', width: 60 }}>{txt.colDiff}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => {
              const rank = index + 1;
              const rowBg = standing.isQualified
                ? 'var(--tl-green-glow)'
                : standing.isWildcard
                  ? 'rgba(233, 182, 73, 0.10)'
                  : 'transparent';

              const rankColor = standing.isQualified
                ? 'var(--tl-green)'
                : standing.isWildcard
                  ? 'var(--tl-gold)'
                  : 'var(--tl-fg)';

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
                      color: rankColor,
                    }}
                  >
                    {rank}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: 'Instrument Serif, serif',
                          fontStyle: 'italic',
                          fontSize: 17,
                          letterSpacing: '-0.01em',
                          color: 'var(--tl-fg)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {standing.team.team_name}
                      </span>
                      {standing.isQualified && (
                        <CheckCircle2
                          className="h-3 w-3 flex-shrink-0"
                          style={{ color: 'var(--tl-green)' }}
                        />
                      )}
                      {standing.isWildcard && (
                        <Star
                          className="h-3 w-3 flex-shrink-0"
                          style={{ color: 'var(--tl-gold)' }}
                        />
                      )}
                    </div>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--tl-fg-2)' }}>
                    {standing.played}
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
                  <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--tl-fg-2)' }}>
                    {standing.gamesWon}-{standing.gamesLost}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontWeight: 600,
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
    </>
  );
}
