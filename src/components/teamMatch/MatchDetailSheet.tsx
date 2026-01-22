import { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Trophy, Play } from 'lucide-react';
import { useTeamMatchMatch, useTeamMatchMatchManagement, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MatchDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: TeamMatchMatch | null;
  isOwner?: boolean;
  tournamentId: string;
  onScoreMatch?: (match: TeamMatchMatch) => void;
}

const GAME_TYPE_LABELS: Record<string, string> = {
  WD: 'Đôi Nữ',
  MD: 'Đôi Nam',
  MX: 'Đôi Nam Nữ',
  WS: 'Đơn Nữ',
  MS: 'Đơn Nam',
};

export function MatchDetailSheet({ 
  open, 
  onOpenChange, 
  match, 
  isOwner,
  tournamentId,
  onScoreMatch,
}: MatchDetailSheetProps) {
  const { games, isLoading } = useTeamMatchMatch(match?.id);
  const { updateGameScore, updateMatchResult, isUpdatingScore, isUpdatingResult } = useTeamMatchMatchManagement();
  
  const [scores, setScores] = useState<Record<string, { a: number; b: number }>>({});
  const [hasChanges, setHasChanges] = useState(false);

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

  // Initialize scores from games
  useEffect(() => {
    if (games.length > 0) {
      const initialScores: Record<string, { a: number; b: number }> = {};
      games.forEach(game => {
        initialScores[game.id] = { a: game.score_a, b: game.score_b };
      });
      setScores(initialScores);
      setHasChanges(false);
    }
  }, [games]);

  const handleScoreChange = (gameId: string, side: 'a' | 'b', value: string) => {
    const numValue = parseInt(value) || 0;
    setScores(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], [side]: Math.max(0, numValue) }
    }));
    setHasChanges(true);
  };

  const handleSaveScores = async () => {
    if (!match) return;

    try {
      // Update each game score
      for (const game of games) {
        const score = scores[game.id];
        if (score && (score.a !== game.score_a || score.b !== game.score_b)) {
          await updateGameScore({
            gameId: game.id,
            scoreA: score.a,
            scoreB: score.b,
            matchId: match.id,
          });
        }
      }

      // Calculate match totals
      let gamesWonA = 0;
      let gamesWonB = 0;
      let totalPointsA = 0;
      let totalPointsB = 0;

      Object.entries(scores).forEach(([_, score]) => {
        totalPointsA += score.a;
        totalPointsB += score.b;
        if (score.a > score.b) gamesWonA++;
        else if (score.b > score.a) gamesWonB++;
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

      setHasChanges(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!match) return null;

  const teamAName = (match.team_a as any)?.team_name || 'TBD';
  const teamBName = (match.team_b as any)?.team_name || 'TBD';
  
  // Ready to start = both lineups submitted
  const hasBothTeams = match.team_a_id && match.team_b_id;
  const isReadyToStart = hasBothTeams && match.lineup_a_submitted && match.lineup_b_submitted;
  const canScore = isOwner && (isReadyToStart || match.status === 'in_progress' || match.status === 'completed');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Chi tiết trận đấu
          </SheetTitle>
          <SheetDescription>
            Vòng {match.round_number}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Match Header */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <p className={`font-semibold text-lg ${match.winner_team_id === match.team_a_id ? 'text-green-600' : ''}`}>
                    {teamAName}
                  </p>
                  {match.winner_team_id === match.team_a_id && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 mt-1">
                      Thắng
                    </Badge>
                  )}
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {match.games_won_a} - {match.games_won_b}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ({match.total_points_a} - {match.total_points_b} điểm)
                  </p>
                </div>
                
                <div className="flex-1 text-center">
                  <p className={`font-semibold text-lg ${match.winner_team_id === match.team_b_id ? 'text-green-600' : ''}`}>
                    {teamBName}
                  </p>
                  {match.winner_team_id === match.team_b_id && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 mt-1">
                      Thắng
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Score Button */}
          {canScore && onScoreMatch && (
            <Button 
              onClick={() => onScoreMatch(match)}
              className="w-full"
              variant="default"
            >
              <Play className="h-4 w-4 mr-2" />
              Chấm điểm trận đấu
            </Button>
          )}

          <Separator />

          {/* Games List */}
          <div className="space-y-4">
            <h4 className="font-semibold">Các ván đấu</h4>
            
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : games.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Chưa có ván đấu nào
              </p>
            ) : (
              <div className="space-y-3">
                {games.map((game, index) => {
                  const score = scores[game.id] || { a: 0, b: 0 };
                  const gameWinner = score.a > score.b ? 'a' : score.b > score.a ? 'b' : null;
                  
                  // Get lineup player names
                  const lineupA = game.lineup_team_a || [];
                  const lineupB = game.lineup_team_b || [];
                  
                  return (
                    <Card key={game.id} className="overflow-hidden">
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
                          <div className={`flex-1 text-right text-sm ${gameWinner === 'a' ? 'text-green-600 font-bold' : ''}`}>
                            {lineupA.length > 0 
                              ? lineupA.map(id => rosterMap?.[id] || id).join(', ') 
                              : teamAName}
                          </div>
                          
                          {isOwner ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={score.a}
                                onChange={(e) => handleScoreChange(game.id, 'a', e.target.value)}
                                className="w-16 text-center"
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                type="number"
                                min="0"
                                value={score.b}
                                onChange={(e) => handleScoreChange(game.id, 'b', e.target.value)}
                                className="w-16 text-center"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded">
                              <span className={`text-lg font-bold ${gameWinner === 'a' ? 'text-green-600' : ''}`}>
                                {score.a}
                              </span>
                              <span className="text-muted-foreground">-</span>
                              <span className={`text-lg font-bold ${gameWinner === 'b' ? 'text-green-600' : ''}`}>
                                {score.b}
                              </span>
                            </div>
                          )}
                          
                          <div className={`flex-1 text-sm ${gameWinner === 'b' ? 'text-green-600 font-bold' : ''}`}>
                            {lineupB.length > 0 
                              ? lineupB.map(id => rosterMap?.[id] || id).join(', ') 
                              : teamBName}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save Button */}
          {isOwner && hasChanges && (
            <Button 
              onClick={handleSaveScores} 
              className="w-full"
              disabled={isUpdatingScore || isUpdatingResult}
            >
              {(isUpdatingScore || isUpdatingResult) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Save className="h-4 w-4 mr-2" />
              Lưu điểm số
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
