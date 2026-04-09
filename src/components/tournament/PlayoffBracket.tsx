import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Crown, Trophy, Check, Pencil, Play, Radio, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';

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
  live_referee_id?: string | null;
  court_id?: number | null;
  court_name?: string | null;
}

export interface BracketPlayer {
  id: string;
  name: string;
  team?: string | null;
  seed?: number | null;
  is_wildcard?: boolean | null;
  group_id?: string | null;
}

interface PlayoffBracketProps {
  matches: BracketMatch[];
  players: BracketPlayer[];
  canEdit: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
  onCourtNameUpdate?: (matchId: string, courtName: string) => void;
  groupNames?: Map<string, string>;
}

const PlayoffBracket = ({ matches, players, canEdit, onScoreUpdate, onCourtNameUpdate, groupNames }: PlayoffBracketProps) => {
  const { t } = useI18n();
  
  const getPlayer = (id: string | null): BracketPlayer | undefined => 
    id ? players.find(p => p.id === id) : undefined;

  const formatPlayerName = (player: BracketPlayer | undefined): string => {
    if (!player) return 'TBD';
    if (player.seed) {
      return `${player.name} (${player.seed})`;
    }
    return player.name;
  };

  const { rounds, champion } = useMemo(() => {
    if (matches.length === 0) return { rounds: [], champion: null };

    const roundMap = new Map<number, BracketMatch[]>();
    matches.forEach(match => {
      const round = match.playoff_round ?? 0;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(match);
    });

    roundMap.forEach((roundMatches) => {
      roundMatches.sort((a, b) => (a.playoff_match_number || 0) - (b.playoff_match_number || 0));
    });

    const roundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const roundsArray = roundNumbers.map(roundNum => {
      const roundMatches = roundMap.get(roundNum) || [];
      const matchCount = roundMatches.length;
      
      return { roundNumber: roundNum, matches: roundMatches, matchCount };
    });

    const lastRound = roundsArray[roundsArray.length - 1];
    const finalMatch = lastRound?.matches.length === 1 ? lastRound.matches[0] : null;
    const champion = finalMatch?.winner_id ? getPlayer(finalMatch.winner_id) : null;

    return { rounds: roundsArray, champion };
  }, [matches, players]);

  const getGroupName = (player: BracketPlayer | undefined): string | null => {
    if (!player?.group_id || !groupNames) return null;
    return groupNames.get(player.group_id) || null;
  };

  const getRoundName = (matchCount: number): string => {
    if (matchCount === 1) return t.quickTable.playoff.final;
    if (matchCount === 2) return t.quickTable.playoff.semiFinal;
    if (matchCount <= 4) return t.quickTable.playoff.quarterFinal;
    if (matchCount <= 8) return t.quickTable.playoff.round16;
    return t.quickTable.playoff.round;
  };

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-foreground-muted">
          {t.quickTable.playoff.noMatches}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {champion && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-8 h-8 text-primary" />
              <div className="text-center">
                <div className="text-sm text-foreground-secondary">{t.quickTable.playoff.champion}</div>
                <div className="text-2xl font-bold text-primary">{formatPlayerName(champion)}</div>
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-6 min-w-max items-stretch">
          {rounds.map((round, roundIdx) => (
            <div key={round.roundNumber} className="flex flex-col min-w-[280px]">
              <div className="text-center mb-4">
                <Badge 
                  variant={round.matchCount === 1 ? 'default' : 'outline'} 
                  className={cn(
                    'px-4 py-1',
                    round.matchCount === 1 && 'bg-primary'
                  )}
                >
                  {round.matchCount === 1 && <Trophy className="w-3 h-3 mr-1" />}
                  {getRoundName(round.matchCount)}
                </Badge>
              </div>

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
                    canEditCourt={canEdit}
                    onScoreUpdate={onScoreUpdate}
                    onCourtNameUpdate={onCourtNameUpdate}
                    getGroupName={getGroupName}
                    formatPlayerName={formatPlayerName}
                    isFinal={round.matchCount === 1}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}

          {rounds.length > 0 && rounds[rounds.length - 1].matchCount > 1 && (
            <div className="flex flex-col min-w-[280px]">
              <div className="text-center mb-4">
                <Badge variant="outline" className="px-4 py-1 border-dashed">
                  {getRoundName(Math.floor(rounds[rounds.length - 1].matchCount / 2))}
                </Badge>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-foreground-muted text-sm text-center p-4 border border-dashed rounded-lg">
                  {t.quickTable.playoff.enterNextRound}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface BracketMatchCardProps {
  match: BracketMatch;
  player1: BracketPlayer | undefined;
  player2: BracketPlayer | undefined;
  canEdit: boolean;
  canEditCourt: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
  onCourtNameUpdate?: (matchId: string, courtName: string) => void;
  getGroupName: (player: BracketPlayer | undefined) => string | null;
  formatPlayerName: (player: BracketPlayer | undefined) => string;
  isFinal: boolean;
  t: ReturnType<typeof useI18n>['t'];
}

const BracketMatchCard = ({ 
  match, 
  player1, 
  player2, 
  canEdit,
  canEditCourt,
  onScoreUpdate,
  onCourtNameUpdate,
  getGroupName,
  formatPlayerName,
  isFinal,
  t
}: BracketMatchCardProps) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [localScore1, setLocalScore1] = useState<string>(match.score1?.toString() ?? '');
  const [localScore2, setLocalScore2] = useState<string>(match.score2?.toString() ?? '');
  const [editingCourtName, setEditingCourtName] = useState(false);
  const [courtNameValue, setCourtNameValue] = useState(match.court_name ?? '');
  
  const score1Ref = useRef<HTMLInputElement>(null);
  const score2Ref = useRef<HTMLInputElement>(null);
  
  const isCompleted = match.status === 'completed';
  const isLive = !!match.live_referee_id;
  const isP1Winner = match.winner_id === match.player1_id && isCompleted;
  const isP2Winner = match.winner_id === match.player2_id && isCompleted;
  const hasCourtInfo = !!match.court_name || match.court_id != null;

  const handleStartEdit = useCallback(() => {
    setLocalScore1(match.score1?.toString() ?? '');
    setLocalScore2(match.score2?.toString() ?? '');
    setIsEditing(true);
  }, [match.score1, match.score2]);

  const handleSubmit = useCallback(() => {
    const score1 = parseInt(localScore1) || 0;
    const score2 = parseInt(localScore2) || 0;
    
    if (score1 === score2) {
      toast.error(t.quickTable.playoff.tieNotAllowed);
      return;
    }
    
    if (score1 > 0 || score2 > 0) {
      onScoreUpdate(match.id, score1, score2);
      setIsEditing(false);
    }
  }, [localScore1, localScore2, match.id, onScoreUpdate, t]);

  const handleCancel = useCallback(() => {
    setLocalScore1(match.score1?.toString() ?? '');
    setLocalScore2(match.score2?.toString() ?? '');
    setIsEditing(false);
  }, [match.score1, match.score2]);

  const handleCourtSave = useCallback(() => {
    const trimmedCourtName = courtNameValue.trim();
    if (!trimmedCourtName || !onCourtNameUpdate) {
      setCourtNameValue(match.court_name ?? '');
      setEditingCourtName(false);
      return;
    }

    onCourtNameUpdate(match.id, trimmedCourtName);
    setCourtNameValue(trimmedCourtName);
    setEditingCourtName(false);
  }, [courtNameValue, match.court_name, match.id, onCourtNameUpdate]);

  const handleScore1Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setLocalScore1(value);
  }, []);

  const handleScore2Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setLocalScore2(value);
  }, []);

  const handleOpenScoring = () => {
    navigate(`/matches/${match.id}/score`);
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-shadow',
      isFinal && 'border-primary/30 shadow-lg ring-2 ring-primary/10',
      isCompleted && !isEditing && 'opacity-90',
      isLive && !isCompleted && 'border-red-500/50 ring-2 ring-red-500/20'
    )}>
      <div className={cn(
        'px-3 py-1.5 border-b flex items-start justify-between gap-3',
        isLive && !isCompleted ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/30'
      )}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-muted">{t.quickTable.playoff.match} {match.playoff_match_number}</span>
            {isLive && !isCompleted && (
              <Badge variant="destructive" className="text-[10px] py-0 px-1 h-4 animate-pulse">
                <Radio className="w-2 h-2 mr-0.5" />
                LIVE
              </Badge>
            )}
          </div>

          {(hasCourtInfo || (canEditCourt && onCourtNameUpdate)) && (
            <div className="mt-1 min-h-5 flex items-center gap-1 text-xs text-foreground-muted">
              {editingCourtName && canEditCourt && onCourtNameUpdate ? (
                <>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <Input
                    className="h-7 w-28 text-xs"
                    value={courtNameValue}
                    onChange={(e) => setCourtNameValue(e.target.value)}
                    onBlur={handleCourtSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCourtSave();
                      }
                    }}
                    placeholder={t.quickTable.view.courtNamePlaceholder}
                    autoFocus
                  />
                </>
              ) : hasCourtInfo ? (
                <>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{match.court_name || `${t.quickTable.view.court} ${match.court_id}`}</span>
                  {canEditCourt && onCourtNameUpdate && (
                    <button
                      type="button"
                      className="text-foreground-muted hover:text-foreground transition-colors"
                      onClick={() => {
                        setCourtNameValue(match.court_name ?? '');
                        setEditingCourtName(true);
                      }}
                      title={t.quickTable.view.courtName}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => {
                    setCourtNameValue(match.court_name ?? '');
                    setEditingCourtName(true);
                  }}
                >
                  <MapPin className="w-3 h-3" />
                  <span className="underline decoration-dashed">{t.quickTable.view.courtName}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isFinal && (
            <Badge variant="default" className="text-xs py-0">
              <Trophy className="w-3 h-3 mr-1" />
              CK
            </Badge>
          )}
          {canEdit && player1 && player2 && (
            <>
              <Button 
                size="sm" 
                variant={isLive ? 'destructive' : 'outline'}
                className="h-6 px-2 text-xs ml-1"
                onClick={handleOpenScoring}
                title={t.quickTable.playoff.openScoring}
              >
                <Play className="w-3 h-3" />
              </Button>
              
              {isEditing ? (
                <div className="flex gap-1 ml-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs"
                    onClick={handleCancel}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={handleSubmit}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    {t.common.save}
                  </Button>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 px-2 text-xs ml-1"
                  onClick={handleStartEdit}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  {isCompleted ? t.quickTable.playoff.editScore : t.quickTable.playoff.inputScore}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="divide-y divide-border/50">
        <div 
          className={cn(
            'flex items-center gap-2 p-2 transition-colors',
            isP1Winner && 'bg-primary/10 border-l-2 border-primary',
            !player1 && 'bg-muted/20'
          )}
        >
          <div className="flex-1 min-w-0">
            <div className={cn(
              'font-medium text-sm truncate',
              isP1Winner && 'text-primary',
              !player1 && 'text-foreground-muted italic'
            )}>
              {formatPlayerName(player1)}
            </div>
            {player1 && (
              <div className="flex items-center gap-1 text-xs text-foreground-muted">
                {getGroupName(player1) && <span>{t.quickTable.playoff.group} {getGroupName(player1)}</span>}
                {player1.is_wildcard && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">WC</Badge>
                )}
              </div>
            )}
          </div>
          
          <div className="w-12">
            {isEditing && player1 ? (
              <input
                ref={score1Ref}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-12 h-8 text-center text-sm p-1 border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={localScore1}
                onChange={handleScore1Change}
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <div className={cn(
                'w-10 h-8 flex items-center justify-center rounded text-sm font-bold mx-auto',
                isP1Winner ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                {match.score1 ?? '-'}
              </div>
            )}
          </div>
          
          {isP1Winner && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
        
        <div 
          className={cn(
            'flex items-center gap-2 p-2 transition-colors',
            isP2Winner && 'bg-primary/10 border-l-2 border-primary',
            !player2 && 'bg-muted/20'
          )}
        >
          <div className="flex-1 min-w-0">
            <div className={cn(
              'font-medium text-sm truncate',
              isP2Winner && 'text-primary',
              !player2 && 'text-foreground-muted italic'
            )}>
              {formatPlayerName(player2)}
            </div>
            {player2 && (
              <div className="flex items-center gap-1 text-xs text-foreground-muted">
                {getGroupName(player2) && <span>{t.quickTable.playoff.group} {getGroupName(player2)}</span>}
                {player2.is_wildcard && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">WC</Badge>
                )}
              </div>
            )}
          </div>
          
          <div className="w-12">
            {isEditing && player2 ? (
              <input
                ref={score2Ref}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-12 h-8 text-center text-sm p-1 border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={localScore2}
                onChange={handleScore2Change}
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <div className={cn(
                'w-10 h-8 flex items-center justify-center rounded text-sm font-bold mx-auto',
                isP2Winner ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                {match.score2 ?? '-'}
              </div>
            )}
          </div>
          
          {isP2Winner && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
      </div>
    </Card>
  );
};

export default PlayoffBracket;
