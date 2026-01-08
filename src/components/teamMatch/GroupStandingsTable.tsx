import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, Medal, Award, CheckCircle2, Star } from 'lucide-react';
import { useTeamMatchMatches } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchGroups } from '@/hooks/useTeamMatchGroups';
import { useMemo } from 'react';

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

export function GroupStandingsTable({ 
  tournamentId, 
  topPerGroup = 2,
  wildcardCount = 0,
}: GroupStandingsTableProps) {
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: teams, isLoading: isLoadingTeams } = useTeamMatchTeams(tournamentId);
  const { data: groups, isLoading: isLoadingGroups } = useTeamMatchGroups(tournamentId);

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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Chưa chia bảng</p>
          <p className="text-sm mt-1">Chia bảng để xem bảng xếp hạng</p>
        </CardContent>
      </Card>
    );
  }

  const sortedGroups = [...groups].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span>Top {topPerGroup}/bảng vào playoff</span>
        {wildcardCount > 0 && (
          <>
            <span className="mx-2">•</span>
            <Star className="h-4 w-4 text-yellow-500" />
            <span>{wildcardCount} wildcard</span>
          </>
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Xếp hạng {group.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <StandingsTableContent 
                  standings={standingsByGroup.get(group.id) || []} 
                  topPerGroup={topPerGroup}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StandingsTableContent({ 
  standings,
  topPerGroup,
}: { 
  standings: TeamStanding[];
  topPerGroup: number;
}) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 2:
        return <Medal className="h-4 w-4 text-gray-400" />;
      case 3:
        return <Award className="h-4 w-4 text-amber-600" />;
      default:
        return <span className="w-4 text-center text-sm font-medium">{rank}</span>;
    }
  };

  if (standings.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Chưa có đội nào trong bảng này
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Đội</TableHead>
              <TableHead className="text-center w-10">Đ</TableHead>
              <TableHead className="text-center w-10">T</TableHead>
              <TableHead className="text-center w-10">B</TableHead>
              <TableHead className="text-center w-16">Ván</TableHead>
              <TableHead className="text-center w-12">+/-</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((standing, index) => (
              <TableRow 
                key={standing.team.id}
                className={standing.isQualified ? 'bg-green-500/10' : standing.isWildcard ? 'bg-yellow-500/10' : ''}
              >
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    {getRankIcon(index + 1)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{standing.team.team_name}</span>
                    {standing.isQualified && (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    )}
                    {standing.isWildcard && (
                      <Star className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm">{standing.played}</TableCell>
                <TableCell className="text-center text-sm text-green-600 font-medium">
                  {standing.won}
                </TableCell>
                <TableCell className="text-center text-sm text-red-500">
                  {standing.lost}
                </TableCell>
                <TableCell className="text-center text-xs">
                  {standing.gamesWon}-{standing.gamesLost}
                </TableCell>
                <TableCell className={`text-center text-sm font-medium ${standing.pointsDiff > 0 ? 'text-green-600' : standing.pointsDiff < 0 ? 'text-red-500' : ''}`}>
                  {standing.pointsDiff > 0 ? '+' : ''}{standing.pointsDiff}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Legend */}
      <div className="p-3 border-t text-xs text-muted-foreground flex flex-wrap gap-3">
        <span><strong>Đ</strong> = Đã đấu</span>
        <span><strong>T</strong> = Thắng</span>
        <span><strong>B</strong> = Thua</span>
      </div>
    </>
  );
}
