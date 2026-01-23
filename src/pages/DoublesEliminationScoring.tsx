import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DynamicMeta } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDoublesElimination } from "@/hooks/useDoublesElimination";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Minus, Plus, RotateCcw, Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface GameScore {
  game: number;
  score_a: number;
  score_b: number;
  winner: 'a' | 'b';
}

interface MatchData {
  id: string;
  tournament_id: string;
  round_number: number;
  round_type: string;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  best_of: number;
  games: GameScore[];
  games_won_a: number;
  games_won_b: number;
  status: string;
}

interface TeamData {
  id: string;
  team_name: string;
  player1_name: string;
  player2_name: string | null;
  seed: number;
}

interface TournamentData {
  id: string;
  name: string;
  share_id: string;
  creator_user_id: string;
}

// Helper to propagate winner to next round
async function propagateWinnerToNextRound(
  match: MatchData,
  winnerId: string,
  tournamentId: string
) {
  // For R3 matches, find R4 match slot to fill
  if (match.round_number === 3) {
    const { data: r4Matches } = await supabase
      .from('doubles_elimination_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round_number', 4)
      .order('match_number', { ascending: true });
    
    if (r4Matches) {
      for (const r4Match of r4Matches) {
        if (!r4Match.team_a_id) {
          await supabase
            .from('doubles_elimination_matches')
            .update({ team_a_id: winnerId })
            .eq('id', r4Match.id);
          return;
        }
        if (!r4Match.team_b_id) {
          await supabase
            .from('doubles_elimination_matches')
            .update({ team_b_id: winnerId })
            .eq('id', r4Match.id);
          return;
        }
      }
    }
  }
  // For R4+ matches, follow bracket position
  else if (match.round_number >= 4) {
    const nextRound = match.round_number + 1;
    const { data: nextRoundMatches } = await supabase
      .from('doubles_elimination_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round_number', nextRound)
      .neq('round_type', 'third_place')
      .order('match_number', { ascending: true });
    
    if (nextRoundMatches && nextRoundMatches.length > 0) {
      const matchIndex = match.match_number - 1;
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const slot = matchIndex % 2;
      
      const targetMatch = nextRoundMatches[nextMatchIndex];
      if (targetMatch) {
        const updateField = slot === 0 ? 'team_a_id' : 'team_b_id';
        await supabase
          .from('doubles_elimination_matches')
          .update({ [updateField]: winnerId })
          .eq('id', targetMatch.id);
      }
    }
  }
}

export default function DoublesEliminationScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { checkAndAssignR3, checkAndGeneratePlayoff } = useDoublesElimination();

  const [match, setMatch] = useState<MatchData | null>(null);
  const [teamA, setTeamA] = useState<TeamData | null>(null);
  const [teamB, setTeamB] = useState<TeamData | null>(null);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  // Local scores for current game
  const [localScoreA, setLocalScoreA] = useState(0);
  const [localScoreB, setLocalScoreB] = useState(0);
  const [currentGameNumber, setCurrentGameNumber] = useState(1);

  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    if (matchId) {
      loadMatchData();
    }
  }, [matchId]);

  const loadMatchData = async () => {
    if (!matchId) return;
    setLoading(true);

    try {
      // Fetch match
      const { data: matchData, error: matchError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError) throw matchError;

      const gamesArray = (Array.isArray(matchData.games) ? matchData.games : []) as unknown as GameScore[];
      setMatch({ ...matchData, games: gamesArray } as unknown as MatchData);
      
      // Set current game number
      setCurrentGameNumber(gamesArray.length + 1);
      
      // If match is live with no completed games, use current scores
      if (gamesArray.length === 0) {
        setLocalScoreA(matchData.score_a || 0);
        setLocalScoreB(matchData.score_b || 0);
      } else {
        setLocalScoreA(0);
        setLocalScoreB(0);
      }

      // Fetch teams
      if (matchData.team_a_id) {
        const { data: teamAData } = await supabase
          .from('doubles_elimination_teams')
          .select('*')
          .eq('id', matchData.team_a_id)
          .single();
        setTeamA(teamAData as TeamData);
      }

      if (matchData.team_b_id) {
        const { data: teamBData } = await supabase
          .from('doubles_elimination_teams')
          .select('*')
          .eq('id', matchData.team_b_id)
          .single();
        setTeamB(teamBData as TeamData);
      }

      // Fetch tournament
      const { data: tournamentData } = await supabase
        .from('doubles_elimination_tournaments')
        .select('*')
        .eq('id', matchData.tournament_id)
        .single();
      setTournament(tournamentData as TournamentData);

      // Check permissions
      if (user && tournamentData) {
        const isCreator = user.id === tournamentData.creator_user_id;
        
        const { data: refereeData } = await supabase
          .from('doubles_elimination_referees')
          .select('id')
          .eq('tournament_id', tournamentData.id)
          .eq('user_id', user.id)
          .single();

        setCanEdit(isCreator || !!refereeData);
      }
    } catch (error) {
      console.error('Load match error:', error);
      toast({ title: "Lỗi tải dữ liệu trận đấu", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = useCallback(async (team: 'a' | 'b', delta: number) => {
    if (!match || !canEdit) return;

    const newScoreA = team === 'a' ? Math.max(0, localScoreA + delta) : localScoreA;
    const newScoreB = team === 'b' ? Math.max(0, localScoreB + delta) : localScoreB;

    setLocalScoreA(newScoreA);
    setLocalScoreB(newScoreB);

    // Update in database
    await supabase
      .from('doubles_elimination_matches')
      .update({
        score_a: newScoreA,
        score_b: newScoreB,
        status: 'live'
      })
      .eq('id', match.id);
  }, [match, canEdit, localScoreA, localScoreB]);

  const handleReset = async () => {
    if (!match || !canEdit) return;

    setLocalScoreA(0);
    setLocalScoreB(0);

    await supabase
      .from('doubles_elimination_matches')
      .update({ score_a: 0, score_b: 0 })
      .eq('id', match.id);

    setShowResetDialog(false);
    toast({ title: "Đã reset điểm" });
  };

  // Handle selecting a game to score
  const handleSelectGame = (gameNum: number) => {
    if (!match || !canEdit || match.status === 'completed') return;
    
    // Load existing game data if available
    const existingGame = match.games?.[gameNum - 1];
    if (existingGame) {
      setLocalScoreA(existingGame.score_a);
      setLocalScoreB(existingGame.score_b);
    } else {
      setLocalScoreA(0);
      setLocalScoreB(0);
    }
    setCurrentGameNumber(gameNum);
  };

  // Save current game score
  const handleSaveGame = async () => {
    if (!match || !canEdit) return;
    if (localScoreA === localScoreB) {
      toast({ title: "Điểm phải khác nhau", variant: "destructive" });
      return;
    }

    const newGame: GameScore = {
      game: currentGameNumber,
      score_a: localScoreA,
      score_b: localScoreB,
      winner: localScoreA > localScoreB ? 'a' : 'b'
    };

    // Update or add game
    const existingGames = [...(match.games || [])];
    const gameIndex = currentGameNumber - 1;
    
    if (gameIndex < existingGames.length) {
      // Update existing game
      existingGames[gameIndex] = newGame;
    } else {
      // Add new game (fill gaps if needed)
      while (existingGames.length < gameIndex) {
        existingGames.push({ game: existingGames.length + 1, score_a: 0, score_b: 0, winner: 'a' });
      }
      existingGames.push(newGame);
    }

    // Recalculate wins
    const winsA = existingGames.filter(g => g.winner === 'a').length;
    const winsB = existingGames.filter(g => g.winner === 'b').length;
    const winsNeededForMatch = Math.ceil(match.best_of / 2);
    const isMatchComplete = winsA >= winsNeededForMatch || winsB >= winsNeededForMatch;

    if (isMatchComplete) {
      // End match
      const winnerId = winsA > winsB ? match.team_a_id : match.team_b_id;
      const loserId = winsA > winsB ? match.team_b_id : match.team_a_id;

      await supabase
        .from('doubles_elimination_matches')
        .update({
          games: existingGames as any,
          games_won_a: winsA,
          games_won_b: winsB,
          winner_id: winnerId,
          status: 'completed',
          score_a: 0,
          score_b: 0
        })
        .eq('id', match.id);

      // Mark loser as eliminated
      if (loserId && match.round_type !== 'winner_r1') {
        await supabase
          .from('doubles_elimination_teams')
          .update({
            status: 'eliminated',
            eliminated_at_round: match.round_number
          })
          .eq('id', loserId);
      }

      // Propagate winner to next round for R3+ matches
      if (winnerId && match.round_number >= 3 && tournament) {
        await propagateWinnerToNextRound(match, winnerId, tournament.id);
      }

      // If final match, mark tournament as completed
      if (match.round_type === 'final' && tournament) {
        await supabase
          .from('doubles_elimination_tournaments')
          .update({ status: 'completed' })
          .eq('id', tournament.id);
      }

      // Trigger auto-generation of next rounds
      if (tournament) {
        // Check if R2 is complete and trigger R3 assignment
        if (match.round_number === 2) {
          await checkAndAssignR3(tournament.id);
        }
        // Check if R3 is complete and trigger playoff generation
        if (match.round_number === 3) {
          await checkAndGeneratePlayoff(tournament.id);
        }
      }

      // Update local state
      setMatch({
        ...match,
        games: existingGames,
        games_won_a: winsA,
        games_won_b: winsB,
        winner_id: winnerId,
        status: 'completed'
      });

      toast({ title: "Trận đấu kết thúc!" });
    } else {
      // Save game and continue
      await supabase
        .from('doubles_elimination_matches')
        .update({
          games: existingGames as any,
          games_won_a: winsA,
          games_won_b: winsB,
          status: 'live',
          score_a: 0,
          score_b: 0
        })
        .eq('id', match.id);

      // Update local state
      setMatch({
        ...match,
        games: existingGames,
        games_won_a: winsA,
        games_won_b: winsB
      });

      // Move to next empty game slot
      const nextEmptyGame = existingGames.length + 1;
      if (nextEmptyGame <= match.best_of) {
        setCurrentGameNumber(nextEmptyGame);
        setLocalScoreA(0);
        setLocalScoreB(0);
      }

      toast({ title: `Đã lưu Game ${currentGameNumber}` });
    }
  };

  // Legacy handleEndGame for dialog confirmation (redirects to handleSaveGame)
  const handleEndGame = async () => {
    await handleSaveGame();
    setShowEndDialog(false);
  };

  const handleEndMatchDirectly = async () => {
    if (!match || !canEdit) return;

    // For BO1, just use current scores
    const winnerId = localScoreA > localScoreB ? match.team_a_id : match.team_b_id;
    const loserId = localScoreA > localScoreB ? match.team_b_id : match.team_a_id;

    await supabase
      .from('doubles_elimination_matches')
      .update({
        score_a: localScoreA,
        score_b: localScoreB,
        winner_id: winnerId,
        status: 'completed'
      })
      .eq('id', match.id);

    // Mark loser as eliminated (if applicable)
    if (loserId && match.round_type !== 'winner_r1') {
      await supabase
        .from('doubles_elimination_teams')
        .update({
          status: 'eliminated',
          eliminated_at_round: match.round_number
        })
        .eq('id', loserId);
    }

    // Propagate winner to next round for R3+ matches
    if (winnerId && match.round_number >= 3 && tournament) {
      await propagateWinnerToNextRound(match, winnerId, tournament.id);
    }

    // If this is the final match, mark tournament as completed
    if (match.round_type === 'final' && tournament) {
      await supabase
        .from('doubles_elimination_tournaments')
        .update({ status: 'completed' })
        .eq('id', tournament.id);
    }

    // Trigger auto-generation of next rounds
    if (tournament) {
      // Check if R2 is complete and trigger R3 assignment
      if (match.round_number === 2) {
        await checkAndAssignR3(tournament.id);
      }
      // Check if R3 is complete and trigger playoff generation
      if (match.round_number === 3) {
        await checkAndGeneratePlayoff(tournament.id);
      }
    }

    toast({ title: "Trận đấu kết thúc!" });
    navigate(`/tools/doubles-elimination/${tournament?.share_id}`);
    setShowEndDialog(false);
  };

  const getRoundLabel = (roundType: string) => {
    switch (roundType) {
      case 'winner_r1': return 'Vòng 1 (Winner)';
      case 'loser_r2': return 'Vòng 2 (Loser)';
      case 'merge_r3': return 'Vòng 3 (Merge)';
      case 'quarterfinal': return 'Tứ kết';
      case 'semifinal': return 'Bán kết';
      case 'third_place': return 'Tranh hạng 3';
      case 'final': return 'Chung kết';
      default: return 'Vòng loại';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  if (!match || !teamA || !teamB) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Không tìm thấy trận đấu</h2>
          <Button onClick={() => navigate(-1)}>Quay lại</Button>
        </div>
      </div>
    );
  }

  const isBestOf = match.best_of > 1;
  const winsNeeded = Math.ceil(match.best_of / 2);

  return (
    <div className="min-h-screen bg-background">
      <DynamicMeta title={`Chấm điểm - ${teamA.team_name} vs ${teamB.team_name}`} noindex={true} />
      <div className="container max-w-lg mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(`/tools/doubles-elimination/${tournament?.share_id}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <div className="font-medium">{tournament?.name}</div>
            <div className="text-sm text-muted-foreground">
              {getRoundLabel(match.round_type)} - Trận {match.match_number}
            </div>
          </div>
          <div className="w-10" />
        </div>

        {/* Best of indicator with clickable game slots */}
        {isBestOf && (
          <div className="text-center mb-6">
            <Badge variant="outline" className="text-base px-4 py-1 mb-4">
              Best of {match.best_of} (Thắng {winsNeeded})
            </Badge>
            
            {/* Clickable Game slots */}
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: match.best_of }).map((_, gameIndex) => {
                const gameNum = gameIndex + 1;
                const gameData = match.games?.[gameIndex];
                const isCurrentGame = gameNum === currentGameNumber;
                const isCompleted = !!gameData;
                const winnerTeam = gameData?.winner;
                const canClickGame = canEdit && match.status !== 'completed';
                
                return (
                  <button
                    key={gameIndex}
                    onClick={() => handleSelectGame(gameNum)}
                    disabled={!canClickGame}
                    className={cn(
                      "flex flex-col items-center justify-center w-16 h-20 rounded-lg border-2 transition-all",
                      canClickGame && "cursor-pointer hover:border-primary/50 hover:bg-primary/5",
                      isCurrentGame && "border-primary bg-primary/10 ring-2 ring-primary/30",
                      isCompleted && !isCurrentGame && "border-muted bg-muted/30",
                      !isCompleted && !isCurrentGame && "border-dashed border-muted-foreground/30 bg-muted/10",
                      !canClickGame && "cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "text-[10px] font-medium mb-1",
                      isCurrentGame ? "text-primary" : "text-muted-foreground"
                    )}>
                      G{gameNum}
                    </div>
                    {isCompleted ? (
                      <div className="text-center">
                        <span className={cn(
                          "text-sm font-bold",
                          winnerTeam === 'a' ? "text-primary" : "text-muted-foreground"
                        )}>
                          {gameData.score_a}
                        </span>
                        <span className="text-xs text-muted-foreground mx-0.5">-</span>
                        <span className={cn(
                          "text-sm font-bold",
                          winnerTeam === 'b' ? "text-primary" : "text-muted-foreground"
                        )}>
                          {gameData.score_b}
                        </span>
                      </div>
                    ) : isCurrentGame ? (
                      <div className="text-xs text-primary font-medium">
                        {localScoreA}-{localScoreB}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">—</div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Games won summary */}
            <div className="flex justify-center items-center gap-3 mt-3">
              <span className={cn(
                "text-lg font-bold",
                match.games_won_a > match.games_won_b ? "text-primary" : "text-foreground"
              )}>{match.games_won_a}</span>
              <span className="text-muted-foreground">game</span>
              <span className="text-muted-foreground">-</span>
              <span className={cn(
                "text-lg font-bold",
                match.games_won_b > match.games_won_a ? "text-primary" : "text-foreground"
              )}>{match.games_won_b}</span>
              <span className="text-muted-foreground">game</span>
            </div>
            
            {canEdit && match.status !== 'completed' && (
              <p className="text-xs text-muted-foreground mt-2">
                Click vào ô game để chấm điểm game đó
              </p>
            )}
          </div>
        )}

        {/* Score Board */}
        <Card className="mb-6">
          <CardContent className="py-8">
            {/* Current game indicator for BO3/BO5 */}
            {isBestOf && (
              <div className="text-center mb-4">
                <Badge variant="secondary" className="text-sm">
                  Game {currentGameNumber}
                </Badge>
              </div>
            )}
            {/* Scores - centered on same line */}
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                {teamA.seed !== null && teamA.seed !== undefined && (
                  <div className="text-xs text-muted-foreground">#{teamA.seed}</div>
                )}
                <div className="text-sm font-medium truncate max-w-[80px]">{teamA.team_name}</div>
              </div>
              <div className="text-5xl font-bold font-mono whitespace-nowrap">
                {localScoreA}
              </div>
              <div className="text-3xl font-bold text-muted-foreground">:</div>
              <div className="text-5xl font-bold font-mono whitespace-nowrap">
                {localScoreB}
              </div>
              <div className="text-center">
                {teamB.seed !== null && teamB.seed !== undefined && (
                  <div className="text-xs text-muted-foreground">#{teamB.seed}</div>
                )}
                <div className="text-sm font-medium truncate max-w-[80px]">{teamB.team_name}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Controls */}
        {canEdit && match.status !== 'completed' && (
          <div className="space-y-4">
            {/* Team names row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center text-sm font-medium">{teamA.team_name}</div>
              <div className="text-center text-sm font-medium">{teamB.team_name}</div>
            </div>
            
            {/* Score controls row - all buttons on same line */}
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
              {isBestOf ? (
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={handleSaveGame}
                  disabled={localScoreA === localScoreB}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Lưu Game {currentGameNumber}
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={() => setShowEndDialog(true)}
                  disabled={localScoreA === localScoreB}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Kết thúc trận
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Completed state */}
        {match.status === 'completed' && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6 text-center">
              <Trophy className="w-12 h-12 mx-auto text-primary mb-2" />
              <div className="font-semibold">Trận đấu đã kết thúc</div>
              <div className="text-sm text-muted-foreground">
                {match.winner_id === match.team_a_id ? teamA.team_name : teamB.team_name} chiến thắng
              </div>
            </CardContent>
          </Card>
        )}

        {/* Read-only notice */}
        {!canEdit && match.status !== 'completed' && (
          <Card className="bg-muted">
            <CardContent className="py-4 text-center text-sm text-muted-foreground">
              Bạn không có quyền chỉnh sửa điểm trận này
            </CardContent>
          </Card>
        )}
      </div>

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

      {/* End Game Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBestOf ? `Kết thúc Game ${currentGameNumber}?` : 'Kết thúc trận đấu?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kết quả: {teamA.team_name} {localScoreA} - {localScoreB} {teamB.team_name}
              <br />
              {localScoreA > localScoreB ? teamA.team_name : teamB.team_name} thắng
              {isBestOf && ` game này`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={isBestOf ? handleEndGame : handleEndMatchDirectly}>
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
