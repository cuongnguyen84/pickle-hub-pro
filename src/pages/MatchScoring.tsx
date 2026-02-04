import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import { MainLayout } from '@/components/layout';
import { DynamicMeta } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Plus, Minus, RotateCcw, CheckCircle, ChevronRight, ArrowLeft, Radio, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MatchData {
  id: string;
  table_id: string;
  group_id: string | null;
  player1_id: string | null;
  player2_id: string | null;
  score1: number | null;
  score2: number | null;
  status: 'pending' | 'completed';
  is_playoff: boolean;
  playoff_round: number | null;
  display_order: number;
  live_referee_id: string | null;
  winner_id: string | null;
}

interface PlayerData {
  id: string;
  name: string;
  team: string | null;
  seed: number | null;
  group_id: string | null;
}

interface TableData {
  id: string;
  name: string;
  share_id: string;
  creator_user_id: string | null;
  status: string;
  format: string;
}

interface GroupData {
  id: string;
  name: string;
}

const MatchScoring = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();

  const [match, setMatch] = useState<MatchData | null>(null);
  const [table, setTable] = useState<TableData | null>(null);
  const [player1, setPlayer1] = useState<PlayerData | null>(null);
  const [player2, setPlayer2] = useState<PlayerData | null>(null);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [isLiveOwner, setIsLiveOwner] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Local scores for optimistic updates
  const [localScore1, setLocalScore1] = useState<number>(0);
  const [localScore2, setLocalScore2] = useState<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load match data
  const loadMatchData = useCallback(async () => {
    if (!matchId) return;

    try {
      // Fetch match
      const { data: matchData, error: matchError } = await supabase
        .from('quick_table_matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (matchError || !matchData) {
        toast.error(t.quickTable.matchScoring.matchNotFound);
        navigate('/quick-tables');
        return;
      }

      setMatch(matchData as MatchData);
      setLocalScore1(matchData.score1 ?? 0);
      setLocalScore2(matchData.score2 ?? 0);

      // Fetch table
      const { data: tableData } = await supabase
        .from('quick_tables')
        .select('id, name, share_id, creator_user_id, status, format')
        .eq('id', matchData.table_id)
        .maybeSingle();

      setTable(tableData as TableData);

      // Fetch players
      if (matchData.player1_id) {
        const { data: p1 } = await supabase
          .from('quick_table_players')
          .select('id, name, team, seed, group_id')
          .eq('id', matchData.player1_id)
          .maybeSingle();
        setPlayer1(p1 as PlayerData);
      }

      if (matchData.player2_id) {
        const { data: p2 } = await supabase
          .from('quick_table_players')
          .select('id, name, team, seed, group_id')
          .eq('id', matchData.player2_id)
          .maybeSingle();
        setPlayer2(p2 as PlayerData);
      }

      // Fetch group if exists
      if (matchData.group_id) {
        const { data: groupData } = await supabase
          .from('quick_table_groups')
          .select('id, name')
          .eq('id', matchData.group_id)
          .maybeSingle();
        setGroup(groupData as GroupData);
      }

    } catch (error) {
      console.error('Error loading match:', error);
      toast.error(t.quickTable.matchScoring.loadError);
    } finally {
      setLoading(false);
    }
  }, [matchId, navigate]);

  // Check permissions
  const checkPermissions = useCallback(async () => {
    if (!user || !table || !match) {
      setCanEdit(false);
      return;
    }

    const isCreator = table.creator_user_id === user.id;

    // Check if user is referee
    let isReferee = false;
    if (!isCreator) {
      const { data } = await supabase
        .from('quick_table_referees')
        .select('id')
        .eq('table_id', table.id)
        .eq('user_id', user.id)
        .maybeSingle();
      isReferee = !!data;
    }

    const hasPermission = isCreator || isReferee;
    setCanEdit(hasPermission);

    // Check if this user is the live owner
    if (match.live_referee_id) {
      if (match.live_referee_id === user.id) {
        setIsLiveOwner(true);
        setIsReadOnly(false);
      } else {
        setIsLiveOwner(false);
        setIsReadOnly(true);
      }
    } else {
      setIsLiveOwner(false);
      setIsReadOnly(false);
    }
  }, [user, table, match]);

  // Claim live scoring
  const claimLiveScoring = useCallback(async () => {
    if (!matchId || !user || isLiveOwner) return;

    const { error } = await supabase
      .from('quick_table_matches')
      .update({ live_referee_id: user.id })
      .eq('id', matchId)
      .is('live_referee_id', null);

    if (!error) {
      setIsLiveOwner(true);
      setIsReadOnly(false);
      toast.success(t.quickTable.matchScoring.claimSuccess);
    }
  }, [matchId, user, isLiveOwner, t]);

  // Update score with debounce
  const updateScore = useCallback(async (score1: number, score2: number) => {
    if (!matchId || isReadOnly) return;

    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce the database update to prevent race conditions
    updateTimeoutRef.current = setTimeout(async () => {
      setUpdating(true);
      try {
        const { error } = await supabase
          .from('quick_table_matches')
          .update({
            score1,
            score2,
            live_referee_id: user?.id || null,
          })
          .eq('id', matchId);

        if (error) {
          console.error('Error updating score:', error);
          toast.error(t.quickTable.matchScoring.scoreUpdateError);
        }
      } finally {
        setUpdating(false);
      }
    }, 100); // 100ms debounce
  }, [matchId, user?.id, isReadOnly, t]);

  // Score handlers
  const handleScoreChange = (player: 1 | 2, delta: number) => {
    if (isReadOnly || match?.status === 'completed') return;

    if (player === 1) {
      const newScore = Math.max(0, localScore1 + delta);
      setLocalScore1(newScore);
      updateScore(newScore, localScore2);
    } else {
      const newScore = Math.max(0, localScore2 + delta);
      setLocalScore2(newScore);
      updateScore(localScore1, newScore);
    }
  };

  // Reset scores
  const handleReset = async () => {
    if (!matchId || isReadOnly) return;

    setLocalScore1(0);
    setLocalScore2(0);
    await updateScore(0, 0);
    setShowResetDialog(false);
    toast.success(t.quickTable.matchScoring.resetSuccess);
  };

  // End match
  const handleEndMatch = async () => {
    if (!matchId || !match || !table || isReadOnly) return;

    // Determine winner
    let winnerId: string | null = null;
    if (localScore1 > localScore2 && player1) {
      winnerId = player1.id;
    } else if (localScore2 > localScore1 && player2) {
      winnerId = player2.id;
    }

    try {
      // Update match as completed
      const { error } = await supabase
        .from('quick_table_matches')
        .update({
          score1: localScore1,
          score2: localScore2,
          status: 'completed',
          winner_id: winnerId,
          live_referee_id: null,
        })
        .eq('id', matchId);

      if (error) throw error;

      // Update player stats for round robin
      if (!match.is_playoff && match.group_id) {
        await updatePlayerStats(table.id, match.group_id);
      }

      // For playoff, update next match with winner
      if (match.is_playoff && winnerId) {
        await advanceWinnerToNextMatch(matchId, winnerId);
      }

      toast.success(t.quickTable.matchScoring.endMatchSuccess);
      setShowEndDialog(false);
      
      // Reload match data
      await loadMatchData();
    } catch (error) {
      console.error('Error ending match:', error);
      toast.error(t.quickTable.matchScoring.endMatchError);
    }
  };

  // Update player stats (for round robin)
  const updatePlayerStats = async (tableId: string, groupId: string) => {
    // Fetch all completed matches in the group
    const { data: groupMatches } = await supabase
      .from('quick_table_matches')
      .select('*')
      .eq('table_id', tableId)
      .eq('group_id', groupId)
      .eq('status', 'completed');

    if (!groupMatches) return;

    // Fetch players in this group
    const { data: groupPlayers } = await supabase
      .from('quick_table_players')
      .select('*')
      .eq('group_id', groupId);

    if (!groupPlayers) return;

    // Calculate stats for each player
    for (const player of groupPlayers) {
      let matchesPlayed = 0;
      let matchesWon = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      for (const m of groupMatches) {
        if (m.player1_id === player.id) {
          matchesPlayed++;
          pointsFor += m.score1 || 0;
          pointsAgainst += m.score2 || 0;
          if ((m.score1 || 0) > (m.score2 || 0)) matchesWon++;
        } else if (m.player2_id === player.id) {
          matchesPlayed++;
          pointsFor += m.score2 || 0;
          pointsAgainst += m.score1 || 0;
          if ((m.score2 || 0) > (m.score1 || 0)) matchesWon++;
        }
      }

      await supabase
        .from('quick_table_players')
        .update({
          matches_played: matchesPlayed,
          matches_won: matchesWon,
          points_for: pointsFor,
          points_against: pointsAgainst,
          // point_diff is a generated column, don't update it directly
        })
        .eq('id', player.id);
    }
  };

  // Advance winner to next match
  const advanceWinnerToNextMatch = async (currentMatchId: string, winnerId: string) => {
    // Find next match info from current match
    const { data: currentMatch } = await supabase
      .from('quick_table_matches')
      .select('next_match_id, next_match_slot, playoff_round, table_id')
      .eq('id', currentMatchId)
      .maybeSingle();

    if (!currentMatch) return;

    if (currentMatch.next_match_id) {
      const updateField = currentMatch.next_match_slot === 1 ? 'player1_id' : 'player2_id';

      await supabase
        .from('quick_table_matches')
        .update({ [updateField]: winnerId })
        .eq('id', currentMatch.next_match_id);
    } else {
      // No next match - check if this is the final match
      // Get all matches in current round to verify it's the final
      const { data: currentRoundMatches } = await supabase
        .from('quick_table_matches')
        .select('id')
        .eq('table_id', currentMatch.table_id)
        .eq('is_playoff', true)
        .eq('playoff_round', currentMatch.playoff_round);

      // If current round only has 1 match, this is the final
      if (currentRoundMatches && currentRoundMatches.length === 1) {
        console.log('[advanceWinnerToNextMatch] Final match completed, marking tournament as completed');
        await supabase
          .from('quick_tables')
          .update({ status: 'completed' })
          .eq('id', currentMatch.table_id);
      }
    }
  };

  // Navigate to next match
  const handleNextMatch = async () => {
    if (!match || !table) return;

    // Find next match in same group or next playoff match
    let nextMatch: MatchData | null = null;

    if (match.is_playoff) {
      // For playoff, go to next match in bracket
      const { data } = await supabase
        .from('quick_table_matches')
        .select('*')
        .eq('table_id', table.id)
        .eq('is_playoff', true)
        .neq('status', 'completed')
        .order('playoff_round', { ascending: true })
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      nextMatch = data as MatchData;
    } else if (match.group_id) {
      // For round robin, find next pending match in same group
      const { data } = await supabase
        .from('quick_table_matches')
        .select('*')
        .eq('table_id', table.id)
        .eq('group_id', match.group_id)
        .eq('status', 'pending')
        .neq('id', match.id)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      nextMatch = data as MatchData;
    }

    if (nextMatch) {
      navigate(`/matches/${nextMatch.id}/score`);
    } else {
      toast.info(t.quickTable.matchScoring.noNextMatch);
    }
  };

  // Initial load
  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  // Check permissions when data loads
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Claim live scoring on mount if can edit
  useEffect(() => {
    if (canEdit && !isReadOnly && !isLiveOwner && match?.status !== 'completed') {
      claimLiveScoring();
    }
  }, [canEdit, isReadOnly, isLiveOwner, match?.status, claimLiveScoring]);

  // Realtime subscription
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-scoring-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quick_table_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const newData = payload.new as MatchData;
          setMatch(newData);
          
          // Only update local scores if not the live owner (to avoid conflicts)
          if (newData.live_referee_id !== user?.id) {
            setLocalScore1(newData.score1 ?? 0);
            setLocalScore2(newData.score2 ?? 0);
          }
          
          // Update read-only status
          if (newData.live_referee_id && newData.live_referee_id !== user?.id) {
            setIsReadOnly(true);
          } else if (!newData.live_referee_id) {
            setIsReadOnly(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Format round name
  // Calculate total playoff rounds from matches data
  const [totalPlayoffRounds, setTotalPlayoffRounds] = useState<number>(1);

  useEffect(() => {
    if (!match?.is_playoff || !table) return;
    
    // Calculate total playoff rounds based on number of matches in first round
    const fetchTotalRounds = async () => {
      // Count matches in round 1 to determine bracket size
      const { data: round1Matches, count } = await supabase
        .from('quick_table_matches')
        .select('id', { count: 'exact' })
        .eq('table_id', table.id)
        .eq('is_playoff', true)
        .eq('playoff_round', 1);
      
      const matchesInRound1 = count || round1Matches?.length || 1;
      
      // Calculate total rounds: log2(matchesInRound1 * 2)
      // 4 matches in round 1 = 8 players = 3 rounds (quarterfinal, semifinal, final)
      // 2 matches in round 1 = 4 players = 2 rounds (semifinal, final)
      // 1 match in round 1 = 2 players = 1 round (final)
      const totalRounds = Math.max(1, Math.ceil(Math.log2(matchesInRound1 * 2)));
      setTotalPlayoffRounds(totalRounds);
    };
    
    fetchTotalRounds();
  }, [match?.is_playoff, table]);

  const getRoundName = () => {
    if (!match) return '';
    
    if (match.is_playoff) {
      const currentRound = match.playoff_round || 1;
      const roundsFromFinal = totalPlayoffRounds - currentRound;
      
      // Map based on distance from final
      if (roundsFromFinal === 0) {
        return t.quickTable.matchScoring.final;
      } else if (roundsFromFinal === 1) {
        return t.quickTable.matchScoring.semiFinal;
      } else if (roundsFromFinal === 2) {
        return t.quickTable.matchScoring.quarterFinal;
      } else {
        return `${t.quickTable.matchScoring.round} ${currentRound}`;
      }
    }
    
    return group ? `${group.name} — ${t.quickTable.matchScoring.match} ${match.display_order + 1}` : `${t.quickTable.matchScoring.match} ${match.display_order + 1}`;
  };

  // Format player display
  const formatPlayer = (player: PlayerData | null) => {
    if (!player) return { name: 'TBD', seed: null };
    return {
      name: player.name,
      seed: player.seed,
      team: player.team,
    };
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="container-wide py-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">{t.quickTable.matchScoring.loading}</div>
        </div>
      </MainLayout>
    );
  }

  if (!canEdit && !isReadOnly) {
    return (
      <MainLayout>
        <div className="container-wide py-8 text-center">
          <h1 className="text-xl font-bold mb-2">{t.quickTable.matchScoring.noPermission}</h1>
          <p className="text-muted-foreground mb-4">{t.quickTable.matchScoring.noPermissionDesc}</p>
          {table && (
            <Button variant="outline" onClick={() => navigate(`/quick-tables/${table.share_id}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.quickTable.matchScoring.backToBracket}
            </Button>
          )}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta 
        title={`${t.quickTable.matchScoring.match} - ${formatPlayer(player1).name} vs ${formatPlayer(player2).name}`} 
        noindex={true} 
      />
      <div className="container max-w-lg mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => table && navigate(`/quick-tables/${table.share_id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.quickTable.matchScoring.goBack}
          </Button>
          {match?.status !== 'completed' && (
            <Badge 
              variant={isLiveOwner ? 'default' : 'secondary'}
              className={cn(
                'gap-1',
                isLiveOwner && 'bg-destructive hover:bg-destructive/90 animate-pulse'
              )}
            >
              <Radio className="w-3 h-3" />
              {t.quickTable.matchScoring.live}
            </Badge>
          )}
          {match?.status === 'completed' && (
            <Badge variant="outline">{t.quickTable.matchScoring.ended}</Badge>
          )}
        </div>

        {/* Match Info */}
        <Card className="mb-6">
          <CardHeader className="py-3 text-center">
            <div className="text-sm text-muted-foreground">{table?.name}</div>
            <CardTitle className="text-lg">{getRoundName()}</CardTitle>
          </CardHeader>
        </Card>

        {/* Read-only banner */}
        {isReadOnly && match?.status !== 'completed' && (
          <Card className="mb-4 bg-warning/10 border-warning/30">
            <CardContent className="py-3 flex items-center gap-2 text-warning-foreground">
              <Lock className="w-4 h-4" />
              <span className="text-sm">{t.quickTable.matchScoring.otherRefereeScoring}</span>
            </CardContent>
          </Card>
        )}

        {/* Scoreboard */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Player 1 */}
              <div className="text-center">
                <div className="font-semibold text-lg truncate">
                  {formatPlayer(player1).name}
                </div>
                {formatPlayer(player1).seed && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Seed {formatPlayer(player1).seed}
                  </Badge>
                )}
              </div>

              {/* Scores */}
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-bold tabular-nums">{localScore1}</span>
                <span className="text-2xl text-muted-foreground">—</span>
                <span className="text-5xl font-bold tabular-nums">{localScore2}</span>
              </div>

              {/* Player 2 */}
              <div className="text-center">
                <div className="font-semibold text-lg truncate">
                  {formatPlayer(player2).name}
                </div>
                {formatPlayer(player2).seed && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Seed {formatPlayer(player2).seed}
                  </Badge>
                )}
              </div>
            </div>

            {/* Score Controls */}
            {match?.status !== 'completed' && !isReadOnly && (
              <div className="grid grid-cols-2 gap-6 mt-8">
                {/* Player 1 Controls */}
                <div className="space-y-3">
                  <Button 
                    size="lg" 
                    className="w-full h-16 text-2xl"
                    onClick={() => handleScoreChange(1, 1)}
                    disabled={updating}
                  >
                    <Plus className="w-6 h-6 mr-2" />
                    +1
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full h-12"
                    onClick={() => handleScoreChange(1, -1)}
                    disabled={localScore1 === 0 || updating}
                  >
                    <Minus className="w-5 h-5 mr-2" />
                    -1
                  </Button>
                </div>

                {/* Player 2 Controls */}
                <div className="space-y-3">
                  <Button 
                    size="lg" 
                    className="w-full h-16 text-2xl"
                    onClick={() => handleScoreChange(2, 1)}
                    disabled={updating}
                  >
                    <Plus className="w-6 h-6 mr-2" />
                    +1
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full h-12"
                    onClick={() => handleScoreChange(2, -1)}
                    disabled={localScore2 === 0 || updating}
                  >
                    <Minus className="w-5 h-5 mr-2" />
                    -1
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {match?.status !== 'completed' && !isReadOnly && (
            <>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowResetDialog(true)}
                disabled={updating}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t.quickTable.matchScoring.resetScore}
              </Button>

              <Button 
                className="w-full"
                onClick={() => setShowEndDialog(true)}
                disabled={updating}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t.quickTable.matchScoring.endMatch}
              </Button>
            </>
          )}

          <Button 
            variant="secondary"
            className="w-full"
            onClick={handleNextMatch}
          >
            {t.quickTable.matchScoring.nextMatch}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Reset Dialog */}
        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.quickTable.matchScoring.resetConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.quickTable.matchScoring.resetConfirmDesc}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.quickTable.matchScoring.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* End Match Dialog */}
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.quickTable.matchScoring.endMatchConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.quickTable.matchScoring.finalResult}: {localScore1} — {localScore2}
                {localScore1 > localScore2 && player1 && (
                  <div className="mt-2 font-medium">🏆 {t.quickTable.matchScoring.winner}: {player1.name}</div>
                )}
                {localScore2 > localScore1 && player2 && (
                  <div className="mt-2 font-medium">🏆 {t.quickTable.matchScoring.winner}: {player2.name}</div>
                )}
                {localScore1 === localScore2 && (
                  <div className="mt-2 text-warning">⚠️ {t.quickTable.matchScoring.tieWarning}</div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.quickTable.matchScoring.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleEndMatch}>{t.quickTable.matchScoring.confirm}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default MatchScoring;
