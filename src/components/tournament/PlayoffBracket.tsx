import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Crown, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BracketMatch {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  score1: number | null;
  score2: number | null;
  winner_id: string | null;
  status: 'pending' | 'completed';
  playoff_round: number | null;
  playoff_match_number: number | null;
  bracket_position: string | null;
  next_match_id: string | null;
  next_match_slot: number | null;
}

export interface BracketPlayer {
  id: string;
  name: string;
  team?: string | null;
  is_wildcard?: boolean | null;
  group_id?: string | null;
}

interface PlayoffBracketProps {
  matches: BracketMatch[];
  players: BracketPlayer[];
  canEdit: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
  groupNames?: Map<string, string>;
}

const PlayoffBracket = ({ matches, players, canEdit, onScoreUpdate, groupNames }: PlayoffBracketProps) => {
  const getPlayer = (id: string | null): BracketPlayer | undefined => 
    id ? players.find(p => p.id === id) : undefined;

  // Organize matches into rounds
  const { rounds, champion } = useMemo(() => {
    if (matches.length === 0) return { rounds: [], champion: null };

    // Group by playoff_round
    const roundMap = new Map<number, BracketMatch[]>();
    matches.forEach(match => {
      const round = match.playoff_round ?? 0;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(match);
    });

    // Sort matches within each round by match number
    roundMap.forEach((roundMatches) => {
      roundMatches.sort((a, b) => (a.playoff_match_number || 0) - (b.playoff_match_number || 0));
    });

    // Build rounds array sorted by round number
    const roundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const roundsArray = roundNumbers.map(roundNum => {
      const roundMatches = roundMap.get(roundNum) || [];
      const matchCount = roundMatches.length;
      
      let roundName = 'Vòng loại';
      if (matchCount === 1) roundName = 'Chung kết';
      else if (matchCount === 2) roundName = 'Bán kết';
      else if (matchCount <= 4) roundName = 'Tứ kết';
      else if (matchCount <= 8) roundName = 'Vòng 16';

      return { roundName, roundNumber: roundNum, matches: roundMatches };
    });

    // Find champion
    const lastRound = roundsArray[roundsArray.length - 1];
    const finalMatch = lastRound?.matches.length === 1 ? lastRound.matches[0] : null;
    const champion = finalMatch?.winner_id ? getPlayer(finalMatch.winner_id) : null;

    return { rounds: roundsArray, champion };
  }, [matches, players]);

  const getGroupName = (player: BracketPlayer | undefined): string => {
    if (!player?.group_id || !groupNames) return '';
    return groupNames.get(player.group_id) || '';
  };

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-foreground-muted">
          Chưa có trận playoff
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
                <div className="text-sm text-foreground-secondary">Nhà vô địch</div>
                <div className="text-2xl font-bold text-primary">{champion.name}</div>
                {champion.team && (
                  <div className="text-sm text-foreground-muted">{champion.team}</div>
                )}
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bracket Display - Horizontal Scroll */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-6 min-w-max items-stretch">
          {rounds.map((round, roundIdx) => (
            <div key={round.roundNumber} className="flex flex-col min-w-[260px]">
              {/* Round Header */}
              <div className="text-center mb-4">
                <Badge 
                  variant={round.matches.length === 1 ? "default" : "outline"} 
                  className={cn(
                    "px-4 py-1",
                    round.matches.length === 1 && "bg-primary"
                  )}
                >
                  {round.matches.length === 1 && <Trophy className="w-3 h-3 mr-1" />}
                  {round.roundName}
                </Badge>
              </div>

              {/* Matches in this round */}
              <div 
                className="flex flex-col flex-1"
                style={{
                  justifyContent: 'space-around',
                  gap: roundIdx === 0 ? '1rem' : `${Math.pow(2, roundIdx) * 2}rem`
                }}
              >
                {round.matches.map((match) => (
                  <BracketMatchCard
                    key={match.id}
                    match={match}
                    player1={getPlayer(match.player1_id)}
                    player2={getPlayer(match.player2_id)}
                    canEdit={canEdit && !!match.player1_id && !!match.player2_id}
                    onScoreUpdate={onScoreUpdate}
                    getGroupName={getGroupName}
                    isFinal={round.matches.length === 1}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Connector lines visualization hint */}
          {rounds.length > 0 && rounds[rounds.length - 1].matches.length > 1 && (
            <div className="flex flex-col min-w-[260px]">
              <div className="text-center mb-4">
                <Badge variant="outline" className="px-4 py-1 border-dashed">
                  {rounds[rounds.length - 1].matches.length === 2 ? 'Chung kết' : 
                   rounds[rounds.length - 1].matches.length <= 4 ? 'Bán kết' : 'Tứ kết'}
                </Badge>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-foreground-muted text-sm text-center p-4 border border-dashed rounded-lg">
                  Nhập kết quả vòng trước để mở vòng tiếp theo
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match List - Compact View */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm font-medium text-foreground-secondary mb-3">Danh sách trận đấu</div>
          <div className="grid gap-2">
            {matches.map((match) => {
              const p1 = getPlayer(match.player1_id);
              const p2 = getPlayer(match.player2_id);
              const isCompleted = match.status === 'completed';
              
              return (
                <div 
                  key={match.id}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3 rounded-lg text-sm",
                    isCompleted ? "bg-muted/30" : "bg-muted/10"
                  )}
                >
                  <span className="text-foreground-muted w-6">#{match.playoff_match_number}</span>
                  <span className={cn(
                    "flex-1 text-right truncate",
                    match.winner_id === match.player1_id && "font-semibold text-primary"
                  )}>
                    {p1?.name || 'TBD'}
                  </span>
                  <div className="flex items-center gap-1 px-2 min-w-[50px] justify-center font-mono">
                    <span className={match.winner_id === match.player1_id ? "font-bold" : ""}>
                      {match.score1 ?? '-'}
                    </span>
                    <span className="text-foreground-muted">:</span>
                    <span className={match.winner_id === match.player2_id ? "font-bold" : ""}>
                      {match.score2 ?? '-'}
                    </span>
                  </div>
                  <span className={cn(
                    "flex-1 truncate",
                    match.winner_id === match.player2_id && "font-semibold text-primary"
                  )}>
                    {p2?.name || 'TBD'}
                  </span>
                  {isCompleted && <Crown className="w-3 h-3 text-primary flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface BracketMatchCardProps {
  match: BracketMatch;
  player1: BracketPlayer | undefined;
  player2: BracketPlayer | undefined;
  canEdit: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
  getGroupName: (player: BracketPlayer | undefined) => string;
  isFinal: boolean;
}

const BracketMatchCard = ({ 
  match, 
  player1, 
  player2, 
  canEdit, 
  onScoreUpdate, 
  getGroupName,
  isFinal 
}: BracketMatchCardProps) => {
  const [s1, setS1] = useState<string>('');
  const [s2, setS2] = useState<string>('');
  
  const isCompleted = match.status === 'completed';
  const isP1Winner = match.winner_id === match.player1_id && isCompleted;
  const isP2Winner = match.winner_id === match.player2_id && isCompleted;

  const handleSubmit = () => {
    const score1 = parseInt(s1) || 0;
    const score2 = parseInt(s2) || 0;
    if ((score1 > 0 || score2 > 0) && score1 !== score2) {
      onScoreUpdate(match.id, score1, score2);
      setS1('');
      setS2('');
    }
  };

  const PlayerSlot = ({ 
    player, 
    isWinner, 
    score, 
    isTop 
  }: { 
    player: BracketPlayer | undefined; 
    isWinner: boolean; 
    score: number | null; 
    isTop: boolean 
  }) => (
    <div 
      className={cn(
        "flex items-center gap-2 p-2 transition-colors",
        isWinner && "bg-primary/10 border-l-2 border-primary",
        !player && "bg-muted/20"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className={cn(
          "font-medium text-sm truncate",
          isWinner && "text-primary",
          !player && "text-foreground-muted italic"
        )}>
          {player?.name || 'TBD'}
        </div>
        {player && (
          <div className="flex items-center gap-1 text-xs text-foreground-muted">
            {getGroupName(player) && <span>Bảng {getGroupName(player)}</span>}
            {player.is_wildcard && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">WC</Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Score */}
      <div className="w-10">
        {canEdit && !isCompleted && player ? (
          <Input
            type="number"
            min={0}
            max={99}
            className="w-10 h-7 text-center text-sm p-0"
            value={isTop ? s1 : s2}
            onChange={(e) => isTop ? setS1(e.target.value) : setS2(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="-"
          />
        ) : (
          <div className={cn(
            "w-8 h-7 flex items-center justify-center rounded text-sm font-bold mx-auto",
            isWinner ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {score ?? '-'}
          </div>
        )}
      </div>
      
      {isWinner && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
    </div>
  );

  return (
    <Card className={cn(
      "overflow-hidden transition-shadow",
      isFinal && "border-primary/30 shadow-lg ring-2 ring-primary/10",
      isCompleted && "opacity-90"
    )}>
      {/* Match header */}
      <div className="px-3 py-1.5 bg-muted/30 border-b flex items-center justify-between">
        <span className="text-xs text-foreground-muted">Trận {match.playoff_match_number}</span>
        {isFinal && (
          <Badge variant="default" className="text-xs py-0">
            <Trophy className="w-3 h-3 mr-1" />
            CK
          </Badge>
        )}
      </div>
      
      {/* Players */}
      <div className="divide-y divide-border/50">
        <PlayerSlot player={player1} isWinner={isP1Winner} score={match.score1} isTop={true} />
        <PlayerSlot player={player2} isWinner={isP2Winner} score={match.score2} isTop={false} />
      </div>
    </Card>
  );
};

export default PlayoffBracket;
