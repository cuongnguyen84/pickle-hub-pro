import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gamepad2, Trophy, Clock, Play, ClipboardList, Check, AlertTriangle, Edit } from 'lucide-react';
import { useTeamMatchMatches, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';

interface MatchListProps {
  tournamentId: string;
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onStartRound?: (roundNumber: number) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
}

const STATUS_CONFIG = {
  pending: { label: 'Chưa bắt đầu', color: 'bg-muted text-muted-foreground', icon: Clock },
  lineup: { label: 'Đang line up', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: ClipboardList },
  in_progress: { label: 'Đang diễn ra', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Play },
  completed: { label: 'Đã kết thúc', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: Trophy },
};

export function MatchList({ tournamentId, userTeamId, isOwner, canEditScores, onMatchClick, onLineupClick, onStartRound, onScoreMatch }: MatchListProps) {
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

  // Group matches by round - filter out playoff matches (they have round_number 0 or null and is_playoff = true)
  const roundRobinMatches = matches.filter(m => !m.is_playoff);
  
  const matchesByRound = roundRobinMatches.reduce((acc, match) => {
    const round = match.round_number || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, TeamMatchMatch[]>);

  // Filter out round 0 (should not exist for round robin)
  const rounds = Object.keys(matchesByRound).map(Number).filter(r => r > 0).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {rounds.map((round) => {
        const roundMatches = matchesByRound[round];
        
        // Check if all teams in this round have submitted lineups
        const allLineupsSubmitted = roundMatches.every(match => 
          match.lineup_a_submitted && match.lineup_b_submitted
        );
        
        // Check if any match in round is started
        const roundStarted = roundMatches.some(match => 
          match.status === 'in_progress' || match.status === 'completed'
        );
        
        // Find teams missing lineup
        const missingLineups: string[] = [];
        roundMatches.forEach(match => {
          if (!match.lineup_a_submitted && match.team_a) {
            missingLineups.push((match.team_a as any)?.team_name || 'Team A');
          }
          if (!match.lineup_b_submitted && match.team_b) {
            missingLineups.push((match.team_b as any)?.team_name || 'Team B');
          }
        });

        return (
          <div key={round}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Vòng {round}</h3>
              
              {/* BTC Start Round Button */}
              {isOwner && !roundStarted && (
                <div className="flex items-center gap-2">
                  {allLineupsSubmitted ? (
                    <Button 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => onStartRound?.(round)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Bắt đầu vòng {round}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      <Clock className="h-3 w-3 mr-1" />
                      Chờ line up
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            {/* Warning for BTC if lineups missing */}
            {isOwner && !roundStarted && missingLineups.length > 0 && (
              <Alert className="mb-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Chưa line up: {missingLineups.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {roundMatches.map((match) => {
                const config = STATUS_CONFIG[match.status] || STATUS_CONFIG.pending;
                const StatusIcon = config.icon;
                const isMyMatch = userTeamId && (match.team_a_id === userTeamId || match.team_b_id === userTeamId);
                
                // Determine if captain needs to lineup
                const isTeamA = match.team_a_id === userTeamId;
                const myLineupSubmitted = isMyMatch && (isTeamA ? match.lineup_a_submitted : match.lineup_b_submitted);
                const needsLineup = isMyMatch && !myLineupSubmitted && match.status !== 'completed' && !roundStarted;
                
                // BTC can lineup for either team if not yet submitted
                const canBTCLineupA = isOwner && !match.lineup_a_submitted && match.status !== 'completed';
                const canBTCLineupB = isOwner && !match.lineup_b_submitted && match.status !== 'completed';
                
                return (
                  <Card 
                    key={match.id} 
                    className={`cursor-pointer hover:border-primary/50 transition-colors ${isMyMatch ? 'border-primary/30 bg-primary/5' : ''}`}
                    onClick={() => onMatchClick?.(match)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            {/* Team A */}
                            <div className={`flex-1 text-right ${match.winner_team_id === match.team_a_id ? 'font-bold' : ''} ${match.team_a_id === userTeamId ? 'text-primary' : ''}`}>
                              <span className="text-base">
                                {(match.team_a as any)?.team_name || 'TBD'}
                              </span>
                              {match.lineup_a_submitted && (
                                <Check className="h-3 w-3 inline-block ml-1 text-green-600" />
                              )}
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
                            <div className={`flex-1 ${match.winner_team_id === match.team_b_id ? 'font-bold' : ''} ${match.team_b_id === userTeamId ? 'text-primary' : ''}`}>
                              {match.lineup_b_submitted && (
                                <Check className="h-3 w-3 inline-block mr-1 text-green-600" />
                              )}
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
                          
                          {/* Captain's own lineup button */}
                          {needsLineup && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLineupClick?.(match, userTeamId);
                              }}
                            >
                              <ClipboardList className="h-3 w-3 mr-1" />
                              Line up
                            </Button>
                          )}
                          
                          {/* Captain's lineup done badge */}
                          {!needsLineup && myLineupSubmitted && !roundStarted && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              <Check className="h-3 w-3 mr-1" />
                              Đã line up
                            </Badge>
                          )}
                          
                          {/* BTC lineup buttons for both teams */}
                          {isOwner && !isMyMatch && (
                            <div className="flex gap-1">
                              {canBTCLineupA && match.team_a_id && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLineupClick?.(match, match.team_a_id!);
                                  }}
                                >
                                  <ClipboardList className="h-3 w-3 mr-1" />
                                  A
                                </Button>
                              )}
                              {canBTCLineupB && match.team_b_id && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLineupClick?.(match, match.team_b_id!);
                                  }}
                                >
                                  <ClipboardList className="h-3 w-3 mr-1" />
                                  B
                                </Button>
                              )}
                            </div>
                          )}
                          
                          {/* Referee Score Button */}
                          {canEditScores && (match.status === 'in_progress' || match.status === 'completed') && (
                            <Button 
                              variant="default" 
                              size="sm"
                              className="bg-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScoreMatch?.(match);
                              }}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Chấm
                            </Button>
                          )}
                          
                          {/* Show detail button */}
                          {!needsLineup && !myLineupSubmitted && !canEditScores && (!isOwner || (!canBTCLineupA && !canBTCLineupB)) && (
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              onMatchClick?.(match);
                            }}>
                              Chi tiết
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
