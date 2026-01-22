import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Play, Check, ClipboardList, Radio, Edit } from 'lucide-react';
import { TeamMatchMatch } from '@/hooks/useTeamMatchMatches';

interface PlayoffBracketProps {
  matches: TeamMatchMatch[];
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
  isSingleElimination?: boolean;
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Chung kết',
  2: 'Bán kết',
  3: 'Tứ kết',
  4: 'Vòng 1/8',
  5: 'Vòng 1/16',
};

const STATUS_CONFIG = {
  pending: { label: 'Chưa đấu', color: 'bg-muted text-muted-foreground', icon: Clock },
  lineup: { label: 'Đang line up', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
  in_progress: { label: 'LIVE', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: Radio, isLive: true },
  completed: { label: 'Hoàn thành', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: Check },
};

export function PlayoffBracket({ matches, userTeamId, isOwner, canEditScores, onMatchClick, onLineupClick, onScoreMatch, isSingleElimination }: PlayoffBracketProps) {
  // Group playoff matches by round - separate third-place match (round 0)
  const allPlayoffMatches = matches.filter(m => m.is_playoff);
  const thirdPlaceMatch = allPlayoffMatches.find(m => (m as any).is_third_place === true || m.playoff_round === 0);
  const regularPlayoffMatches = allPlayoffMatches.filter(m => (m as any).is_third_place !== true && m.playoff_round !== 0);
  
  const matchesByRound = regularPlayoffMatches
    .reduce((acc, match) => {
      const round = match.playoff_round || 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    }, {} as Record<number, TeamMatchMatch[]>);

  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => b - a); // Higher round = earlier stage

  if (allPlayoffMatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{isSingleElimination ? 'Chưa có Bracket' : 'Chưa có vòng Playoff'}</p>
          <p className="text-sm mt-1">
            {isSingleElimination 
              ? 'Tạo bracket để bắt đầu thi đấu loại trực tiếp'
              : 'Hoàn thành vòng tròn để tạo Playoff'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Find the champion (winner of round 1 = final)
  const finalMatch = matchesByRound[1]?.[0];
  const champion = finalMatch?.winner_team_id 
    ? (finalMatch.winner_team_id === finalMatch.team_a_id 
        ? (finalMatch.team_a as any)?.team_name 
        : (finalMatch.team_b as any)?.team_name)
    : null;

  return (
    <div className="space-y-6">
      {/* Champion banner */}
      {champion && (
        <Card className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/50">
          <CardContent className="py-4 text-center">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <h3 className="text-lg font-bold">Vô địch: {champion}</h3>
          </CardContent>
        </Card>
      )}

      {/* Bracket display */}
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max p-2">
          {rounds.map((round) => {
            const roundMatches = matchesByRound[round];
            const roundName = ROUND_NAMES[round] || `Vòng ${round}`;
            
            return (
              <div key={round} className="flex flex-col gap-4 min-w-[240px]">
                <h4 className="text-sm font-semibold text-center text-muted-foreground">
                  {roundName}
                </h4>
                
                <div className="flex flex-col gap-4 justify-around flex-1">
                  {roundMatches
                    .sort((a, b) => (a.bracket_position || 0) - (b.bracket_position || 0))
                    .map((match) => {
                      const config = STATUS_CONFIG[match.status] || STATUS_CONFIG.pending;
                      const isMyMatch = userTeamId && (match.team_a_id === userTeamId || match.team_b_id === userTeamId);
                      const matchStarted = match.status === 'in_progress' || match.status === 'completed';
                      const hasBothTeams = match.team_a_id && match.team_b_id;
                      
                      // Check lineup needs for each team
                      const needsLineupA = hasBothTeams && !match.lineup_a_submitted && !matchStarted;
                      const needsLineupB = hasBothTeams && !match.lineup_b_submitted && !matchStarted;
                      
                      // Captain can lineup their own team, BTC can lineup any team
                      const canLineupA = needsLineupA && (isOwner || match.team_a_id === userTeamId);
                      const canLineupB = needsLineupB && (isOwner || match.team_b_id === userTeamId);
                      
                      return (
                        <Card 
                          key={match.id}
                          className={`cursor-pointer hover:border-primary/50 transition-colors ${isMyMatch ? 'border-primary/30 bg-primary/5' : ''}`}
                          onClick={() => onMatchClick?.(match)}
                        >
                          <CardContent className="p-3 space-y-2">
                            {/* Team A */}
                            <div className={`flex justify-between items-center p-2 rounded ${
                              match.winner_team_id === match.team_a_id 
                                ? 'bg-green-500/10 font-medium' 
                                : 'bg-muted/50'
                            }`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`text-sm truncate ${match.team_a_id === userTeamId ? 'text-primary font-medium' : ''}`}>
                                  {(match.team_a as any)?.team_name || 'TBD'}
                                </span>
                                {match.lineup_a_submitted && (
                                  <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${
                                  match.winner_team_id === match.team_a_id ? 'text-green-600' : ''
                                }`}>
                                  {match.games_won_a}
                                </span>
                                {canLineupA && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onLineupClick?.(match, match.team_a_id!);
                                    }}
                                  >
                                    <ClipboardList className="h-3 w-3 mr-1" />
                                    {isOwner ? 'A' : 'Line up'}
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {/* Team B */}
                            <div className={`flex justify-between items-center p-2 rounded ${
                              match.winner_team_id === match.team_b_id 
                                ? 'bg-green-500/10 font-medium' 
                                : 'bg-muted/50'
                            }`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`text-sm truncate ${match.team_b_id === userTeamId ? 'text-primary font-medium' : ''}`}>
                                  {(match.team_b as any)?.team_name || 'TBD'}
                                </span>
                                {match.lineup_b_submitted && (
                                  <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${
                                  match.winner_team_id === match.team_b_id ? 'text-green-600' : ''
                                }`}>
                                  {match.games_won_b}
                                </span>
                                {canLineupB && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onLineupClick?.(match, match.team_b_id!);
                                    }}
                                  >
                                    <ClipboardList className="h-3 w-3 mr-1" />
                                    {isOwner ? 'B' : 'Line up'}
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {/* Status */}
                            <div className="flex justify-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${config.color} ${match.status === 'in_progress' ? 'animate-pulse' : ''}`}
                              >
                                <config.icon className={`h-3 w-3 mr-1 ${match.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                                {config.label}
                              </Badge>
                              {canEditScores && (match.status === 'in_progress' || match.status === 'completed') && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-6 text-xs px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onScoreMatch?.(match);
                                  }}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Chấm
                                </Button>
                              )}
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
      </div>

      {/* Third-place match */}
      {thirdPlaceMatch && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-center text-muted-foreground mb-3">
            Tranh hạng 3
          </h4>
          {(() => {
            const match = thirdPlaceMatch;
            const config = STATUS_CONFIG[match.status] || STATUS_CONFIG.pending;
            const isMyMatch = userTeamId && (match.team_a_id === userTeamId || match.team_b_id === userTeamId);
            const matchStarted = match.status === 'in_progress' || match.status === 'completed';
            const hasBothTeams = match.team_a_id && match.team_b_id;
            
            const needsLineupA = hasBothTeams && !match.lineup_a_submitted && !matchStarted;
            const needsLineupB = hasBothTeams && !match.lineup_b_submitted && !matchStarted;
            const canLineupA = needsLineupA && (isOwner || match.team_a_id === userTeamId);
            const canLineupB = needsLineupB && (isOwner || match.team_b_id === userTeamId);

            return (
              <Card 
                className={`max-w-[280px] mx-auto cursor-pointer hover:border-primary/50 transition-colors border-amber-500/30 ${isMyMatch ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => onMatchClick?.(match)}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Team A */}
                  <div className={`flex justify-between items-center p-2 rounded ${
                    match.winner_team_id === match.team_a_id 
                      ? 'bg-amber-500/10 font-medium' 
                      : 'bg-muted/50'
                  }`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-sm truncate ${match.team_a_id === userTeamId ? 'text-primary font-medium' : ''}`}>
                        {(match.team_a as any)?.team_name || 'Đợi BK'}
                      </span>
                      {match.lineup_a_submitted && (
                        <Check className="h-3 w-3 text-amber-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        match.winner_team_id === match.team_a_id ? 'text-amber-600' : ''
                      }`}>
                        {match.games_won_a}
                      </span>
                      {canLineupA && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLineupClick?.(match, match.team_a_id!);
                          }}
                        >
                          <ClipboardList className="h-3 w-3 mr-1" />
                          {isOwner ? 'A' : 'Line up'}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Team B */}
                  <div className={`flex justify-between items-center p-2 rounded ${
                    match.winner_team_id === match.team_b_id 
                      ? 'bg-amber-500/10 font-medium' 
                      : 'bg-muted/50'
                  }`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-sm truncate ${match.team_b_id === userTeamId ? 'text-primary font-medium' : ''}`}>
                        {(match.team_b as any)?.team_name || 'Đợi BK'}
                      </span>
                      {match.lineup_b_submitted && (
                        <Check className="h-3 w-3 text-amber-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        match.winner_team_id === match.team_b_id ? 'text-amber-600' : ''
                      }`}>
                        {match.games_won_b}
                      </span>
                      {canLineupB && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLineupClick?.(match, match.team_b_id!);
                          }}
                        >
                          <ClipboardList className="h-3 w-3 mr-1" />
                          {isOwner ? 'B' : 'Line up'}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Status */}
                  <div className="flex justify-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${config.color} ${match.status === 'in_progress' ? 'animate-pulse' : ''}`}
                    >
                      <config.icon className={`h-3 w-3 mr-1 ${match.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                      {config.label}
                    </Badge>
                    {canEditScores && (match.status === 'in_progress' || match.status === 'completed') && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 text-xs px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onScoreMatch?.(match);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Chấm
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
}