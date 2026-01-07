import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Gamepad2, Trophy, Clock, Play } from 'lucide-react';
import { useTeamMatchMatches, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';

interface MatchListProps {
  tournamentId: string;
  onMatchClick?: (match: TeamMatchMatch) => void;
}

const STATUS_CONFIG = {
  pending: { label: 'Chưa bắt đầu', color: 'bg-muted text-muted-foreground', icon: Clock },
  in_progress: { label: 'Đang diễn ra', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Play },
  completed: { label: 'Đã kết thúc', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: Trophy },
};

export function MatchList({ tournamentId, onMatchClick }: MatchListProps) {
  const { data: matches, isLoading } = useTeamMatchMatches(tournamentId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Chưa có trận đấu nào</p>
          <p className="text-sm mt-1">Tạo lịch thi đấu để bắt đầu</p>
        </CardContent>
      </Card>
    );
  }

  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    const round = match.round_number || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, TeamMatchMatch[]>);

  const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <div key={round}>
          <h3 className="text-lg font-semibold mb-3">Vòng {round}</h3>
          <div className="space-y-3">
            {matchesByRound[round].map((match) => {
              const config = STATUS_CONFIG[match.status] || STATUS_CONFIG.pending;
              const StatusIcon = config.icon;
              
              return (
                <Card 
                  key={match.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onMatchClick?.(match)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          {/* Team A */}
                          <div className={`flex-1 text-right ${match.winner_team_id === match.team_a_id ? 'font-bold' : ''}`}>
                            <span className="text-base">
                              {(match.team_a as any)?.team_name || 'TBD'}
                            </span>
                          </div>
                          
                          {/* Score */}
                          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg min-w-[100px] justify-center">
                            <span className={`text-xl font-bold ${match.winner_team_id === match.team_a_id ? 'text-green-600' : ''}`}>
                              {match.games_won_a}
                            </span>
                            <span className="text-muted-foreground">-</span>
                            <span className={`text-xl font-bold ${match.winner_team_id === match.team_b_id ? 'text-green-600' : ''}`}>
                              {match.games_won_b}
                            </span>
                          </div>
                          
                          {/* Team B */}
                          <div className={`flex-1 ${match.winner_team_id === match.team_b_id ? 'font-bold' : ''}`}>
                            <span className="text-base">
                              {(match.team_b as any)?.team_name || 'TBD'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Points info */}
                        {match.status !== 'pending' && (
                          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Điểm: {match.total_points_a} - {match.total_points_b}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4 flex flex-col items-end gap-2">
                        <Badge variant="outline" className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          Chi tiết
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
