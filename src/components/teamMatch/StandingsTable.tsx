import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, Medal, Award } from 'lucide-react';
import { useTeamMatchMatches } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

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

export function StandingsTable({ tournamentId }: StandingsTableProps) {
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: teams, isLoading: isLoadingTeams } = useTeamMatchTeams(tournamentId);

  if (isLoadingMatches || isLoadingTeams) {
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

  const approvedTeams = teams?.filter(t => t.status === 'approved') || [];

  if (approvedTeams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Chưa có đội nào tham gia</p>
          <p className="text-sm mt-1">Duyệt đội để xem bảng xếp hạng</p>
        </CardContent>
      </Card>
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
    // Primary: Wins
    if (b.won !== a.won) return b.won - a.won;
    // Secondary: Game difference
    const gameDiffA = a.gamesWon - a.gamesLost;
    const gameDiffB = b.gamesWon - b.gamesLost;
    if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
    // Tertiary: Points difference
    return b.pointsDiff - a.pointsDiff;
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center font-medium">{rank}</span>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Bảng xếp hạng
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
             <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center px-1">#</TableHead>
                <TableHead className="px-2">Đội</TableHead>
                <TableHead className="text-center w-8 px-1" title="Số trận thắng">T</TableHead>
                <TableHead className="text-center w-8 px-1" title="Số trận thua">B</TableHead>
                <TableHead className="text-center w-8 px-1" title="Điểm (Thắng = 1đ)">Đ</TableHead>
                <TableHead className="text-center w-14 px-1" title="Hiệu số ván thắng - thua">Ván</TableHead>
                <TableHead className="text-center w-12 px-1" title="Hiệu số điểm">+/-</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((standing, index) => (
                <TableRow 
                  key={standing.team.id}
                  className={index < 3 ? 'bg-primary/5' : ''}
                >
                  <TableCell className="text-center px-1">
                    <div className="flex justify-center">
                      {getRankIcon(index + 1)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap px-2">
                    {standing.team.team_name}
                  </TableCell>
                  <TableCell className="text-center text-green-600 font-medium px-1">
                    {standing.won}
                  </TableCell>
                  <TableCell className="text-center text-red-500 px-1">
                    {standing.lost}
                  </TableCell>
                  <TableCell className="text-center font-bold text-primary px-1">
                    {standing.won}
                  </TableCell>
                  <TableCell className="text-center text-sm whitespace-nowrap px-1">
                    {standing.gamesWon}-{standing.gamesLost}
                  </TableCell>
                  <TableCell className={`text-center font-medium whitespace-nowrap px-1 ${standing.pointsDiff > 0 ? 'text-green-600' : standing.pointsDiff < 0 ? 'text-red-500' : ''}`}>
                    {standing.pointsDiff > 0 ? '+' : ''}{standing.pointsDiff}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Legend */}
        <div className="p-3 border-t text-xs text-muted-foreground flex flex-wrap gap-2">
          <span><strong>T</strong> = Thắng</span>
          <span><strong>B</strong> = Thua</span>
          <span><strong>Đ</strong> = Điểm</span>
          <span><strong>+/-</strong> = Hiệu số</span>
        </div>
      </CardContent>
    </Card>
  );
}
