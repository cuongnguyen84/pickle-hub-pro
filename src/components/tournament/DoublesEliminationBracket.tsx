import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Trophy, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Match, Team } from '@/hooks/useDoublesElimination';

interface DoublesEliminationBracketProps {
  matches: Match[];
  teams: Team[];
  onMatchClick?: (matchId: string) => void;
}

const DoublesEliminationBracket = ({ matches, teams, onMatchClick }: DoublesEliminationBracketProps) => {
  const getTeam = (id: string | null): Team | undefined => 
    id ? teams.find(t => t.id === id) : undefined;

  const formatTeamName = (team: Team | undefined): string => {
    if (!team) return 'TBD';
    if (team.seed) {
      return `(${team.seed}) ${team.team_name}`;
    }
    return team.team_name;
  };

  // Group matches by round for horizontal display - Loser R2 shown alongside R1
  const { rounds, champion, loserMatches, thirdPlaceMatch } = useMemo(() => {
    if (matches.length === 0) return { rounds: [], champion: null, loserMatches: [], thirdPlaceMatch: null };

    // Separate R1 winner matches and R2 loser matches
    const r1Matches = matches.filter(m => m.round_number === 1 && m.bracket_type === 'winner');
    const r2LoserMatches = matches.filter(m => m.round_number === 2 && m.bracket_type === 'loser');
    
    // Main bracket: R3+ matches
    const mainBracketMatches = matches.filter(m => 
      (m.round_number >= 3 && (m.bracket_type === 'merged' || m.bracket_type === 'single')) ||
      m.round_type === 'final'
    ).filter(m => m.round_type !== 'third_place');
    
    const thirdPlaceMatch = matches.find(m => m.round_type === 'third_place');

    // Group main bracket by round
    const roundMap = new Map<number, Match[]>();
    
    // Add R1 Winner matches
    if (r1Matches.length > 0) {
      roundMap.set(1, r1Matches.sort((a, b) => a.match_number - b.match_number));
    }
    
    // R3+ matches
    mainBracketMatches.forEach(match => {
      const round = match.round_number;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(match);
    });

    // Sort matches within each round by match number
    roundMap.forEach((roundMatches) => {
      roundMatches.sort((a, b) => a.match_number - b.match_number);
    });

    // Build rounds array
    const roundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const roundsArray = roundNumbers.map(roundNum => {
      const roundMatches = roundMap.get(roundNum) || [];
      return { 
        roundNumber: roundNum, 
        matches: roundMatches,
        roundType: roundMatches[0]?.round_type || 'elimination'
      };
    });

    // Find champion
    const finalMatch = matches.find(m => m.round_type === 'final');
    const champion = finalMatch?.winner_id ? getTeam(finalMatch.winner_id) : null;

    return { 
      rounds: roundsArray, 
      champion,
      loserMatches: r2LoserMatches.sort((a, b) => a.match_number - b.match_number),
      thirdPlaceMatch
    };
  }, [matches, teams]);

  const getRoundLabel = (roundType: string, matchCount: number): string => {
    switch (roundType) {
      case 'winner_r1': return 'Vòng 1 (Winner)';
      case 'merge_r3': return 'Vòng 3 (Merge)';
      case 'quarterfinal': return 'Tứ kết';
      case 'semifinal': return 'Bán kết';
      case 'final': return 'Chung kết';
      case 'elimination':
        if (matchCount === 1) return 'Chung kết';
        if (matchCount === 2) return 'Bán kết';
        if (matchCount <= 4) return 'Tứ kết';
        if (matchCount <= 8) return 'Vòng 16';
        return `Vòng ${matchCount * 2}`;
      default: return `Vòng ${roundType}`;
    }
  };

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chưa có bracket. Hãy hoàn tất cài đặt để tạo bracket.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Champion Banner */}
      {champion && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-8 h-8 text-primary" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Vô địch</div>
                <div className="text-2xl font-bold text-primary">{formatTeamName(champion)}</div>
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Round 1 + Loser Bracket R2 side by side */}
      {rounds.find(r => r.roundNumber === 1) && (
        <div className="mb-8">
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-8 min-w-max items-start">
              {/* R1 Winner Matches */}
              <div className="flex flex-col min-w-[280px]">
                <div className="text-center mb-4">
                  <Badge variant="outline" className="px-4 py-1 bg-green-50 dark:bg-green-950/30 border-green-300">
                    Vòng 1 - Winner
                    <span className="ml-2 opacity-70">
                      ({rounds.find(r => r.roundNumber === 1)?.matches.length || 0})
                    </span>
                  </Badge>
                </div>
                <div className="flex flex-col gap-3">
                  {rounds.find(r => r.roundNumber === 1)?.matches.map((match) => (
                    <BracketMatchCard
                      key={match.id}
                      match={match}
                      teamA={getTeam(match.team_a_id)}
                      teamB={getTeam(match.team_b_id)}
                      formatTeamName={formatTeamName}
                      isFinal={false}
                      onClick={() => onMatchClick?.(match.id)}
                    />
                  ))}
                </div>
              </div>

              {/* R2 Loser Matches - shown alongside R1 */}
              {loserMatches.length > 0 && (
                <div className="flex flex-col min-w-[280px]">
                  <div className="text-center mb-4">
                    <Badge variant="secondary" className="px-4 py-1 bg-orange-50 dark:bg-orange-950/30 border-orange-300">
                      Vòng 2 - Loser Bracket
                      <span className="ml-2 opacity-70">({loserMatches.length})</span>
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {loserMatches.map((match) => {
                      const sourceA = match.source_a as { type: string; match_index?: number } | null;
                      const sourceB = match.source_b as { type: string; match_index?: number } | null;
                      const matchANum = sourceA?.match_index !== undefined ? sourceA.match_index + 1 : '?';
                      const matchBNum = sourceB?.match_index !== undefined ? sourceB.match_index + 1 : '?';
                      
                      return (
                        <LoserBracketCard
                          key={match.id}
                          match={match}
                          teamA={getTeam(match.team_a_id)}
                          teamB={getTeam(match.team_b_id)}
                          formatTeamName={formatTeamName}
                          sourceAMatchNum={matchANum}
                          sourceBMatchNum={matchBNum}
                          onClick={() => onMatchClick?.(match.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Bracket R3+ - Horizontal Scroll */}
      {rounds.filter(r => r.roundNumber >= 3).length > 0 && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-6 min-w-max items-stretch">
            {rounds.filter(r => r.roundNumber >= 3).map((round, roundIdx) => (
              <div key={round.roundNumber} className="flex flex-col min-w-[260px]">
                {/* Round Header */}
                <div className="text-center mb-4">
                  <Badge 
                    variant={round.roundType === 'final' ? "default" : "outline"} 
                    className={cn(
                      "px-4 py-1",
                      round.roundType === 'final' && "bg-primary"
                    )}
                  >
                    {round.roundType === 'final' && <Trophy className="w-3 h-3 mr-1" />}
                    {getRoundLabel(round.roundType, round.matches.length)}
                    <span className="ml-2 opacity-70">({round.matches.length})</span>
                  </Badge>
                </div>

                {/* Matches in this round - with spacing that increases each round */}
                <div 
                  className="flex flex-col flex-1"
                  style={{
                    justifyContent: 'space-around',
                    gap: roundIdx === 0 ? '0.75rem' : `${Math.pow(2, roundIdx) * 1.5}rem`
                  }}
                >
                  {round.matches.map((match) => (
                    <BracketMatchCard
                      key={match.id}
                      match={match}
                      teamA={getTeam(match.team_a_id)}
                      teamB={getTeam(match.team_b_id)}
                      formatTeamName={formatTeamName}
                      isFinal={match.round_type === 'final'}
                      onClick={() => onMatchClick?.(match.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loser Bracket section removed - now shown alongside R1 above */}

      {/* Third Place Match */}
      {matches.find(m => m.round_type === 'third_place') && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-4">Tranh hạng 3</h3>
          {(() => {
            const match = matches.find(m => m.round_type === 'third_place')!;
            return (
              <BracketMatchCard
                match={match}
                teamA={getTeam(match.team_a_id)}
                teamB={getTeam(match.team_b_id)}
                formatTeamName={formatTeamName}
                isFinal={false}
                onClick={() => onMatchClick?.(match.id)}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Loser Bracket Card - shows source matches
interface LoserBracketCardProps {
  match: Match;
  teamA: Team | undefined;
  teamB: Team | undefined;
  formatTeamName: (team: Team | undefined) => string;
  sourceAMatchNum: number | string;
  sourceBMatchNum: number | string;
  onClick?: () => void;
}

const LoserBracketCard = ({
  match,
  teamA,
  teamB,
  formatTeamName,
  sourceAMatchNum,
  sourceBMatchNum,
  onClick
}: LoserBracketCardProps) => {
  const navigate = useNavigate();
  
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const isAWinner = match.winner_id === match.team_a_id && isCompleted;
  const isBWinner = match.winner_id === match.team_b_id && isCompleted;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/tools/doubles-elimination/match/${match.id}/score`);
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all cursor-pointer hover:border-orange-400/50 border-orange-200/50 dark:border-orange-800/50",
        isCompleted && "opacity-90",
        isLive && "border-red-500/50 ring-2 ring-red-500/20"
      )}
      onClick={handleClick}
    >
      {/* Match header */}
      <div className={cn(
        "px-3 py-1.5 border-b flex items-center justify-between",
        isLive ? "bg-red-50 dark:bg-red-950/30" : "bg-orange-50/50 dark:bg-orange-950/30"
      )}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Trận {match.match_number}</span>
          {match.court_number && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
              Sân {match.court_number}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isLive && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1 h-4 animate-pulse">
              <Radio className="w-2 h-2 mr-0.5" />
              LIVE
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">
              Xong
            </Badge>
          )}
        </div>
      </div>
      
      {/* Teams */}
      <div className="divide-y divide-border/50">
        {/* Team A Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 transition-colors",
            isAWinner && "bg-primary/10 border-l-2 border-primary",
            !teamA && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            {teamA ? (
              <div className={cn(
                "font-medium text-sm truncate",
                isAWinner && "text-primary"
              )}>
                {formatTeamName(teamA)}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm italic">
                Thua trận {sourceAMatchNum}
              </div>
            )}
          </div>
          
          {/* Score A */}
          <div className={cn(
            "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
            isAWinner ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {match.best_of > 1 ? match.games_won_a : match.score_a}
          </div>
          
          {isAWinner && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
        
        {/* Team B Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 transition-colors",
            isBWinner && "bg-primary/10 border-l-2 border-primary",
            !teamB && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            {teamB ? (
              <div className={cn(
                "font-medium text-sm truncate",
                isBWinner && "text-primary"
              )}>
                {formatTeamName(teamB)}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm italic">
                Thua trận {sourceBMatchNum}
              </div>
            )}
          </div>
          
          {/* Score B */}
          <div className={cn(
            "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
            isBWinner ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {match.best_of > 1 ? match.games_won_b : match.score_b}
          </div>
          
          {isBWinner && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
      </div>

      {/* Game scores for BO3/BO5 */}
      {match.best_of > 1 && match.games && Array.isArray(match.games) && (match.games as any[]).length > 0 && (
        <div className="px-3 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground text-center">
          {(match.games as any[]).map((g: any, i: number) => (
            <span key={i}>
              {i > 0 && ' | '}
              <span className={g.winner === 'a' ? 'text-primary font-medium' : ''}>{g.score_a}</span>
              -
              <span className={g.winner === 'b' ? 'text-primary font-medium' : ''}>{g.score_b}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
};

interface BracketMatchCardProps {
  match: Match;
  teamA: Team | undefined;
  teamB: Team | undefined;
  formatTeamName: (team: Team | undefined) => string;
  isFinal: boolean;
  onClick?: () => void;
}

const BracketMatchCard = ({ 
  match, 
  teamA, 
  teamB, 
  formatTeamName,
  isFinal,
  onClick
}: BracketMatchCardProps) => {
  const navigate = useNavigate();
  
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const isAWinner = match.winner_id === match.team_a_id && isCompleted;
  const isBWinner = match.winner_id === match.team_b_id && isCompleted;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/tools/doubles-elimination/match/${match.id}/score`);
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all cursor-pointer hover:border-primary/50",
        isFinal && "border-primary/30 shadow-lg ring-2 ring-primary/10",
        isCompleted && "opacity-90",
        isLive && "border-red-500/50 ring-2 ring-red-500/20"
      )}
      onClick={handleClick}
    >
      {/* Match header */}
      <div className={cn(
        "px-3 py-1.5 border-b flex items-center justify-between",
        isLive ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/30"
      )}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Trận {match.match_number}</span>
          {match.court_number && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
              Sân {match.court_number}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isLive && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1 h-4 animate-pulse">
              <Radio className="w-2 h-2 mr-0.5" />
              LIVE
            </Badge>
          )}
          {isFinal && (
            <Badge variant="default" className="text-xs py-0">
              <Trophy className="w-3 h-3 mr-1" />
              CK
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">
              Xong
            </Badge>
          )}
        </div>
      </div>
      
      {/* Teams */}
      <div className="divide-y divide-border/50">
        {/* Team A Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 transition-colors",
            isAWinner && "bg-primary/10 border-l-2 border-primary",
            !teamA && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className={cn(
              "font-medium text-sm truncate",
              isAWinner && "text-primary",
              !teamA && "text-muted-foreground italic"
            )}>
              {formatTeamName(teamA)}
            </div>
            {teamA?.player1_name && (
              <div className="text-xs text-muted-foreground truncate">
                {teamA.player1_name}
              </div>
            )}
          </div>
          
          {/* Score A */}
          <div className={cn(
            "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
            isAWinner ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {match.best_of > 1 ? match.games_won_a : match.score_a}
          </div>
          
          {isAWinner && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
        
        {/* Team B Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 transition-colors",
            isBWinner && "bg-primary/10 border-l-2 border-primary",
            !teamB && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className={cn(
              "font-medium text-sm truncate",
              isBWinner && "text-primary",
              !teamB && "text-muted-foreground italic"
            )}>
              {formatTeamName(teamB)}
            </div>
            {teamB?.player1_name && (
              <div className="text-xs text-muted-foreground truncate">
                {teamB.player1_name}
              </div>
            )}
          </div>
          
          {/* Score B */}
          <div className={cn(
            "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
            isBWinner ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {match.best_of > 1 ? match.games_won_b : match.score_b}
          </div>
          
          {isBWinner && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
      </div>

      {/* Game scores for BO3/BO5 */}
      {match.best_of > 1 && match.games && Array.isArray(match.games) && (match.games as any[]).length > 0 && (
        <div className="px-3 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground text-center">
          {(match.games as any[]).map((g: any, i: number) => (
            <span key={i}>
              {i > 0 && ' | '}
              <span className={g.winner === 'a' ? 'text-primary font-medium' : ''}>{g.score_a}</span>
              -
              <span className={g.winner === 'b' ? 'text-primary font-medium' : ''}>{g.score_b}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
};

export default DoublesEliminationBracket;
