import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Minus, Plus, RotateCcw, Check, Trophy } from "lucide-react";
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

export default function DoublesEliminationScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

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

  const handleEndGame = async () => {
    if (!match || !canEdit) return;

    const newGame: GameScore = {
      game: currentGameNumber,
      score_a: localScoreA,
      score_b: localScoreB,
      winner: localScoreA > localScoreB ? 'a' : 'b'
    };

    const games = [...(match.games || []), newGame];
    const winsA = games.filter(g => g.winner === 'a').length;
    const winsB = games.filter(g => g.winner === 'b').length;
    const winsNeeded = Math.ceil(match.best_of / 2);
    const isMatchComplete = winsA >= winsNeeded || winsB >= winsNeeded;

    if (isMatchComplete) {
      // End match
      const winnerId = winsA > winsB ? match.team_a_id : match.team_b_id;
      const loserId = winsA > winsB ? match.team_b_id : match.team_a_id;

      await supabase
        .from('doubles_elimination_matches')
        .update({
          games: games as any,
          games_won_a: winsA,
          games_won_b: winsB,
          winner_id: winnerId,
          status: 'completed'
        })
        .eq('id', match.id);

      // Mark loser as eliminated (if applicable for this round)
      if (loserId && match.round_type !== 'winner_r1') {
        await supabase
          .from('doubles_elimination_teams')
          .update({
            status: 'eliminated',
            eliminated_at_round: match.round_number
          })
          .eq('id', loserId);
      }

      // If this is the final match, mark tournament as completed
      if (match.round_type === 'final' && tournament) {
        await supabase
          .from('doubles_elimination_tournaments')
          .update({ status: 'completed' })
          .eq('id', tournament.id);
      }

      toast({ title: "Trận đấu kết thúc!" });
      navigate(`/tools/doubles-elimination/${tournament?.share_id}`);
    } else {
      // Continue to next game
      await supabase
        .from('doubles_elimination_matches')
        .update({
          games: games as any,
          games_won_a: winsA,
          games_won_b: winsB,
          score_a: 0,
          score_b: 0
        })
        .eq('id', match.id);

      setMatch(prev => prev ? { ...prev, games, games_won_a: winsA, games_won_b: winsB } : null);
      setCurrentGameNumber(games.length + 1);
      setLocalScoreA(0);
      setLocalScoreB(0);
      toast({ title: `Game ${currentGameNumber} kết thúc. Tiếp tục Game ${currentGameNumber + 1}` });
    }

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

    // If this is the final match, mark tournament as completed
    if (match.round_type === 'final' && tournament) {
      await supabase
        .from('doubles_elimination_tournaments')
        .update({ status: 'completed' })
        .eq('id', tournament.id);
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

        {/* Best of indicator */}
        {isBestOf && (
          <div className="text-center mb-4">
            <Badge variant="outline" className="text-base px-4 py-1">
              Best of {match.best_of} (Thắng {winsNeeded})
            </Badge>
            <div className="flex justify-center gap-4 mt-2">
              <span className="font-medium">{match.games_won_a}</span>
              <span className="text-muted-foreground">-</span>
              <span className="font-medium">{match.games_won_b}</span>
            </div>
            {match.games && match.games.length > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                {match.games.map((g, i) => (
                  <span key={i}>
                    {i > 0 && ' | '}
                    {g.score_a}-{g.score_b}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Current game indicator */}
        {isBestOf && (
          <div className="text-center mb-4">
            <Badge>Game {currentGameNumber}</Badge>
          </div>
        )}

        {/* Score Board */}
        <Card className="mb-6">
          <CardContent className="py-8">
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
              <Button 
                variant="default" 
                className="flex-1"
                onClick={() => setShowEndDialog(true)}
                disabled={localScoreA === localScoreB}
              >
                <Check className="w-4 h-4 mr-2" />
                {isBestOf ? 'Kết thúc Game' : 'Kết thúc trận'}
              </Button>
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
