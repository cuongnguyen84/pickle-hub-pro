import { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trophy, Play, RotateCcw, Check, Plus, Minus, Radio } from 'lucide-react';
import { useTeamMatchMatch, useTeamMatchMatchManagement, TeamMatchMatch, TeamMatchGame } from '@/hooks/useTeamMatchMatches';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TeamMatchScoringSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: TeamMatchMatch | null;
  tournamentId: string;
}

const GAME_TYPE_LABELS: Record<string, string> = {
  WD: 'Đôi Nữ',
  MD: 'Đôi Nam',
  MX: 'Đôi Nam Nữ',
  WS: 'Đơn Nữ',
  MS: 'Đơn Nam',
};

export function TeamMatchScoringSheet({ 
  open, 
  onOpenChange, 
  match, 
  tournamentId,
}: TeamMatchScoringSheetProps) {
  const { games, isLoading } = useTeamMatchMatch(match?.id);
  const { updateGameScore, updateMatchResult, isUpdatingScore, isUpdatingResult } = useTeamMatchMatchManagement();
  
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [localScoreA, setLocalScoreA] = useState(0);
  const [localScoreB, setLocalScoreB] = useState(0);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Collect all roster IDs from games to fetch player names
  const allRosterIds = useMemo(() => {
    const ids = new Set<string>();
    games.forEach(game => {
      game.lineup_team_a?.forEach(id => ids.add(id));
      game.lineup_team_b?.forEach(id => ids.add(id));
    });
    return Array.from(ids);
  }, [games]);

  // Fetch player names for all roster IDs
  const { data: rosterMap } = useQuery({
    queryKey: ['roster-names', allRosterIds],
    queryFn: async () => {
      if (allRosterIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('team_match_roster')
        .select('id, player_name')
        .in('id', allRosterIds);
      
      if (error) throw error;
      
      const map: Record<string, string> = {};
      data?.forEach(r => {
        map[r.id] = r.player_name;
      });
      return map;
    },
    enabled: allRosterIds.length > 0,
  });

  // Current selected game
  const currentGame = games[selectedGameIndex];

  // Reset local scores when game changes
  useEffect(() => {
    if (currentGame) {
      setLocalScoreA(currentGame.score_a || 0);
      setLocalScoreB(currentGame.score_b || 0);
    }
  }, [currentGame?.id, currentGame?.score_a, currentGame?.score_b]);

  // Auto-select first incomplete game when sheet opens
  useEffect(() => {
    if (open && games.length > 0) {
      const firstIncompleteIndex = games.findIndex(g => !g.winner_team_id);
      if (firstIncompleteIndex !== -1) {
        setSelectedGameIndex(firstIncompleteIndex);
      } else {
        setSelectedGameIndex(0);
      }
    }
  }, [open, games.length]);

  const handleScoreChange = (team: 'a' | 'b', delta: number) => {
    if (team === 'a') {
      setLocalScoreA(prev => Math.max(0, prev + delta));
    } else {
      setLocalScoreB(prev => Math.max(0, prev + delta));
    }
  };

  const handleReset = () => {
    setLocalScoreA(0);
    setLocalScoreB(0);
    setShowResetDialog(false);
  };

  const handleSaveGame = async () => {
    if (!match || !currentGame) return;
    
    try {
      // Update this game's score
      await updateGameScore({
        gameId: currentGame.id,
        scoreA: localScoreA,
        scoreB: localScoreB,
        matchId: match.id,
      });

      // Calculate match totals from all games including current update
      let gamesWonA = 0;
      let gamesWonB = 0;
      let totalPointsA = 0;
      let totalPointsB = 0;

      games.forEach((game, index) => {
        const scoreA = index === selectedGameIndex ? localScoreA : game.score_a;
        const scoreB = index === selectedGameIndex ? localScoreB : game.score_b;
        
        totalPointsA += scoreA;
        totalPointsB += scoreB;
        
        if (scoreA > scoreB) gamesWonA++;
        else if (scoreB > scoreA) gamesWonB++;
      });

      // Determine winner (majority of games)
      const totalGames = games.length;
      const requiredToWin = Math.ceil(totalGames / 2);
      let winnerId: string | null = null;
      
      if (gamesWonA >= requiredToWin && match.team_a_id) {
        winnerId = match.team_a_id;
      } else if (gamesWonB >= requiredToWin && match.team_b_id) {
        winnerId = match.team_b_id;
      }

      await updateMatchResult({
        matchId: match.id,
        gamesWonA,
        gamesWonB,
        totalPointsA,
        totalPointsB,
        winnerId,
        tournamentId,
      });

      // Move to next game if not the last one and current game completed
      if (localScoreA !== localScoreB && selectedGameIndex < games.length - 1) {
        setSelectedGameIndex(prev => prev + 1);
      }

      setShowSaveDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!match) return null;

  const teamAName = (match.team_a as any)?.team_name || 'TBD';
  const teamBName = (match.team_b as any)?.team_name || 'TBD';

  // Get player names for current game
  const currentLineupA = currentGame?.lineup_team_a || [];
  const currentLineupB = currentGame?.lineup_team_b || [];
  const playersA = currentLineupA.map(id => rosterMap?.[id] || id).join(' - ');
  const playersB = currentLineupB.map(id => rosterMap?.[id] || id).join(' - ');

  const isMatchCompleted = match.status === 'completed';
  const totalGames = games.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-primary border-primary">
              BO{totalGames}
            </Badge>
            {!isMatchCompleted && (
              <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                <Radio className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            )}
            <Badge variant="secondary">
              <Trophy className="h-3 w-3 mr-1" />
              Trận đấu
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Match Header with scores */}
          <Card className="border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-2">
                <div className={cn(
                  "flex-1 text-center",
                  match.winner_team_id === match.team_a_id && "text-primary"
                )}>
                  <p className="font-semibold text-lg">{teamAName}</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold tabular-nums">
                    {match.games_won_a} - {match.games_won_b}
                  </div>
                  <p className="text-xs text-muted-foreground">game</p>
                </div>
                
                <div className={cn(
                  "flex-1 text-center",
                  match.winner_team_id === match.team_b_id && "text-primary"
                )}>
                  <p className="font-semibold text-lg">{teamBName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game slots */}
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : games.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Chưa có ván đấu nào
            </p>
          ) : (
            <>
              {/* Clickable game slots */}
              <div className="flex justify-center gap-2 flex-wrap">
                {games.map((game, index) => {
                  const isSelected = index === selectedGameIndex;
                  const hasScore = game.score_a > 0 || game.score_b > 0;
                  const isCompleted = game.score_a !== game.score_b && hasScore;
                  const winnerSide = game.score_a > game.score_b ? 'a' : game.score_b > game.score_a ? 'b' : null;
                  
                  return (
                    <button
                      key={game.id}
                      onClick={() => setSelectedGameIndex(index)}
                      className={cn(
                        "flex flex-col items-center justify-center w-14 h-16 rounded-lg border-2 transition-all",
                        "cursor-pointer hover:border-primary/50 hover:bg-primary/5",
                        isSelected && "border-primary bg-primary/10 ring-2 ring-primary/30",
                        isCompleted && !isSelected && "border-muted bg-muted/30",
                        !isCompleted && !isSelected && "border-dashed border-muted-foreground/30 bg-muted/10"
                      )}
                    >
                      <div className={cn(
                        "text-[10px] font-medium mb-0.5",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}>
                        G{index + 1}
                      </div>
                      {hasScore ? (
                        <div className="text-center">
                          <span className={cn(
                            "text-xs font-bold",
                            winnerSide === 'a' ? "text-primary" : "text-muted-foreground"
                          )}>
                            {game.score_a}
                          </span>
                          <span className="text-xs text-muted-foreground mx-0.5">-</span>
                          <span className={cn(
                            "text-xs font-bold",
                            winnerSide === 'b' ? "text-primary" : "text-muted-foreground"
                          )}>
                            {game.score_b}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">—</div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Click vào ô game để chấm điểm game đó
              </p>

              {/* Current game card */}
              {currentGame && (
                <Card className="overflow-hidden border-2 border-primary/20">
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary" className="text-sm">
                        Game {selectedGameIndex + 1}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {GAME_TYPE_LABELS[currentGame.game_type]}
                      </Badge>
                    </div>
                    
                    {/* Lineup display with score */}
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex-1 text-right">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          localScoreA > localScoreB && "text-primary"
                        )}>
                          {playersA || teamAName}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 tabular-nums">
                        <span className={cn(
                          "text-4xl font-bold",
                          localScoreA > localScoreB && "text-primary"
                        )}>
                          {localScoreA}
                        </span>
                        <span className="text-2xl font-bold text-muted-foreground">:</span>
                        <span className={cn(
                          "text-4xl font-bold",
                          localScoreB > localScoreA && "text-primary"
                        )}>
                          {localScoreB}
                        </span>
                      </div>
                      
                      <div className="flex-1 text-left">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          localScoreB > localScoreA && "text-primary"
                        )}>
                          {playersB || teamBName}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Score controls */}
              {!isMatchCompleted && currentGame && (
                <div className="space-y-4">
                  {/* Team names row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center text-sm font-medium truncate">{teamAName}</div>
                    <div className="text-center text-sm font-medium truncate">{teamBName}</div>
                  </div>
                  
                  {/* Score controls row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Team A controls */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-12 h-14"
                        onClick={() => handleScoreChange('a', -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="default" 
                        size="lg" 
                        className="flex-1 h-14"
                        onClick={() => handleScoreChange('a', 1)}
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </div>

                    {/* Team B controls */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-12 h-14"
                        onClick={() => handleScoreChange('b', -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="default" 
                        size="lg" 
                        className="flex-1 h-14"
                        onClick={() => handleScoreChange('b', 1)}
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowResetDialog(true)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                    <Button 
                      variant="default" 
                      className="flex-1"
                      onClick={() => setShowSaveDialog(true)}
                      disabled={isUpdatingScore || isUpdatingResult}
                    >
                      {(isUpdatingScore || isUpdatingResult) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <Check className="w-4 h-4 mr-2" />
                      Lưu Game {selectedGameIndex + 1}
                    </Button>
                  </div>
                </div>
              )}

              {/* Games list - view only */}
              <div className="space-y-2 pt-4 border-t">
                <h4 className="font-semibold text-sm text-muted-foreground">Các ván đấu</h4>
                {games.map((game, index) => {
                  const lineupA = game.lineup_team_a || [];
                  const lineupB = game.lineup_team_b || [];
                  const gamePlayersA = lineupA.map(id => rosterMap?.[id] || id).join(', ');
                  const gamePlayersB = lineupB.map(id => rosterMap?.[id] || id).join(', ');
                  const gameWinner = game.score_a > game.score_b ? 'a' : game.score_b > game.score_a ? 'b' : null;
                  const isSelected = index === selectedGameIndex;
                  
                  return (
                    <Card 
                      key={game.id} 
                      className={cn(
                        "overflow-hidden cursor-pointer hover:border-primary/30 transition-colors",
                        isSelected && "border-primary ring-1 ring-primary/30"
                      )}
                      onClick={() => setSelectedGameIndex(index)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-medium">
                            Game {index + 1}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {GAME_TYPE_LABELS[game.game_type]}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-center gap-4">
                          <div className={cn(
                            "flex-1 text-right text-sm",
                            gameWinner === 'a' && "text-primary font-bold"
                          )}>
                            {gamePlayersA || teamAName}
                          </div>
                          
                          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded">
                            <span className={cn(
                              "text-lg font-bold",
                              gameWinner === 'a' && "text-primary"
                            )}>
                              {game.score_a}
                            </span>
                            <span className="text-muted-foreground">-</span>
                            <span className={cn(
                              "text-lg font-bold",
                              gameWinner === 'b' && "text-primary"
                            )}>
                              {game.score_b}
                            </span>
                          </div>
                          
                          <div className={cn(
                            "flex-1 text-sm",
                            gameWinner === 'b' && "text-primary font-bold"
                          )}>
                            {gamePlayersB || teamBName}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Completed state */}
          {isMatchCompleted && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-6 text-center">
                <Trophy className="w-12 h-12 mx-auto text-primary mb-2" />
                <div className="font-semibold">Trận đấu đã kết thúc</div>
                <div className="text-sm text-muted-foreground">
                  {match.winner_team_id === match.team_a_id ? teamAName : teamBName} chiến thắng
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>

      {/* Reset Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset điểm?</AlertDialogTitle>
            <AlertDialogDescription>
              Điểm hiện tại sẽ được đặt về 0-0.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lưu Game {selectedGameIndex + 1}?</AlertDialogTitle>
            <AlertDialogDescription>
              Kết quả: {playersA || teamAName} {localScoreA} - {localScoreB} {playersB || teamBName}
              {localScoreA !== localScoreB && (
                <>
                  <br />
                  {localScoreA > localScoreB ? (playersA || teamAName) : (playersB || teamBName)} thắng game này.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveGame}>Lưu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
