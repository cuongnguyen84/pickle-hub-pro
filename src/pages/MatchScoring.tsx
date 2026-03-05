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
import { Plus, Minus, Undo2, CheckCircle, ChevronRight, ArrowLeft, Radio, Lock, ArrowLeftRight, RefreshCw, Play, Pause, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SetScore {
  s1: number;
  s2: number;
}

interface HistoryEntry {
  action: 'score' | 'swap_sides' | 'swap_serve' | 'end_set';
  player?: 1 | 2;
  delta?: number;
  set?: number;
  prevServingSide?: number;
  prevSidesSwapped?: boolean;
  prevScore1?: number;
  prevScore2?: number;
  prevSetScores?: SetScore[];
  prevCurrentSet?: number;
}

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
  set_scores: SetScore[] | null;
  current_set: number | null;
  total_sets: number | null;
  serving_side: number | null;
  sides_swapped: boolean | null;
  score_history: HistoryEntry[] | null;
  match_timer_started_at: string | null;
  match_timer_elapsed_seconds: number | null;
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
  is_doubles: boolean;
}

interface GroupData {
  id: string;
  name: string;
}

interface TeamData {
  id: string;
  player1_display_name: string;
  player2_display_name: string | null;
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
  const [team1, setTeam1] = useState<TeamData | null>(null);
  const [team2, setTeam2] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [isLiveOwner, setIsLiveOwner] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showEndSetDialog, setShowEndSetDialog] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Local state for optimistic updates
  const [localScore1, setLocalScore1] = useState<number>(0);
  const [localScore2, setLocalScore2] = useState<number>(0);
  const [localSetScores, setLocalSetScores] = useState<SetScore[]>([]);
  const [localCurrentSet, setLocalCurrentSet] = useState<number>(1);
  const [localTotalSets, setLocalTotalSets] = useState<number>(1);
  const [localServingSide, setLocalServingSide] = useState<number>(1);
  const [localSidesSwapped, setLocalSidesSwapped] = useState<boolean>(false);
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerElapsed, setTimerElapsed] = useState<number>(0);
  const [displayTime, setDisplayTime] = useState<number>(0);
  const [matchStarted, setMatchStarted] = useState(false);

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer display update
  useEffect(() => {
    if (timerStartedAt) {
      const update = () => {
        const elapsed = Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000);
        setDisplayTime(timerElapsed + elapsed);
      };
      update();
      timerIntervalRef.current = setInterval(update, 1000);
      return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    } else {
      setDisplayTime(timerElapsed);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [timerStartedAt, timerElapsed]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Load match data
  const loadMatchData = useCallback(async () => {
    if (!matchId) return;
    try {
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

      const md = matchData as any;
      setMatch(md as MatchData);
      setLocalScore1(md.score1 ?? 0);
      setLocalScore2(md.score2 ?? 0);
      setLocalSetScores((md.set_scores as SetScore[]) ?? []);
      setLocalCurrentSet(md.current_set ?? 1);
      setLocalTotalSets(md.total_sets ?? 1);
      setLocalServingSide(md.serving_side ?? 1);
      setLocalSidesSwapped(md.sides_swapped ?? false);
      setLocalHistory((md.score_history as HistoryEntry[]) ?? []);
      setTimerStartedAt(md.match_timer_started_at ?? null);
      setTimerElapsed(md.match_timer_elapsed_seconds ?? 0);
      setMatchStarted(!!(md.match_timer_started_at || (md.match_timer_elapsed_seconds && md.match_timer_elapsed_seconds > 0) || md.score1 || md.score2));

      // Fetch table
      const { data: tableData } = await supabase
        .from('quick_tables')
        .select('id, name, share_id, creator_user_id, status, format, is_doubles')
        .eq('id', md.table_id)
        .maybeSingle();
      setTable(tableData as TableData);

      // Fetch players
      if (md.player1_id) {
        const { data: p1 } = await supabase
          .from('quick_table_players')
          .select('id, name, team, seed, group_id')
          .eq('id', md.player1_id)
          .maybeSingle();
        setPlayer1(p1 as PlayerData);
      }
      if (md.player2_id) {
        const { data: p2 } = await supabase
          .from('quick_table_players')
          .select('id, name, team, seed, group_id')
          .eq('id', md.player2_id)
          .maybeSingle();
        setPlayer2(p2 as PlayerData);
      }

      // Fetch teams for doubles
      if (tableData?.is_doubles) {
        if (md.player1_id) {
          const { data: t1 } = await supabase
            .from('quick_table_teams')
            .select('id, player1_display_name, player2_display_name, player1_user_id')
            .eq('table_id', md.table_id)
            .maybeSingle() as any;
          setTeam1(t1 as TeamData);
        }
        if (md.player2_id) {
          const { data: t2 } = await supabase
            .from('quick_table_teams')
            .select('id, player1_display_name, player2_display_name, player1_user_id')
            .eq('table_id', md.table_id)
            .maybeSingle() as any;
          setTeam2(t2 as TeamData);
        }
      }

      // Fetch group
      if (md.group_id) {
        const { data: groupData } = await supabase
          .from('quick_table_groups')
          .select('id, name')
          .eq('id', md.group_id)
          .maybeSingle();
        setGroup(groupData as GroupData);
      }
    } catch (error) {
      console.error('Error loading match:', error);
      toast.error(t.quickTable.matchScoring.loadError);
    } finally {
      setLoading(false);
    }
  }, [matchId, navigate, t]);

  // Check permissions
  const checkPermissions = useCallback(async () => {
    if (!user || !table || !match) { setCanEdit(false); return; }
    const isCreator = table.creator_user_id === user.id;
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
    setCanEdit(isCreator || isReferee);
    if (match.live_referee_id) {
      setIsLiveOwner(match.live_referee_id === user.id);
      setIsReadOnly(match.live_referee_id !== user.id);
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
      .update({ live_referee_id: user.id } as any)
      .eq('id', matchId)
      .is('live_referee_id', null);
    if (!error) {
      setIsLiveOwner(true);
      setIsReadOnly(false);
      toast.success(t.quickTable.matchScoring.claimSuccess);
    }
  }, [matchId, user, isLiveOwner, t]);

  // Persist state to DB with debounce
  const persistState = useCallback(async (overrides: Record<string, any> = {}) => {
    if (!matchId || isReadOnly) return;
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

    updateTimeoutRef.current = setTimeout(async () => {
      setUpdating(true);
      try {
        const updateData: any = {
          score1: localScore1,
          score2: localScore2,
          set_scores: localSetScores,
          current_set: localCurrentSet,
          total_sets: localTotalSets,
          serving_side: localServingSide,
          sides_swapped: localSidesSwapped,
          score_history: localHistory,
          match_timer_started_at: timerStartedAt,
          match_timer_elapsed_seconds: timerElapsed,
          live_referee_id: user?.id || null,
          ...overrides,
        };
        const { error } = await supabase
          .from('quick_table_matches')
          .update(updateData)
          .eq('id', matchId);
        if (error) {
          console.error('Error updating:', error);
          toast.error(t.quickTable.matchScoring.scoreUpdateError);
        }
      } finally {
        setUpdating(false);
      }
    }, 100);
  }, [matchId, localScore1, localScore2, localSetScores, localCurrentSet, localTotalSets, localServingSide, localSidesSwapped, localHistory, timerStartedAt, timerElapsed, user?.id, isReadOnly, t]);

  // Score handlers
  const handleScoreChange = (player: 1 | 2, delta: number) => {
    if (isReadOnly || match?.status === 'completed') return;

    const entry: HistoryEntry = {
      action: 'score',
      player,
      delta,
      set: localCurrentSet,
      prevScore1: localScore1,
      prevScore2: localScore2,
    };

    if (player === 1) {
      const newScore = Math.max(0, localScore1 + delta);
      setLocalScore1(newScore);
      setLocalHistory(prev => [...prev, entry]);
      setTimeout(() => persistState({ score1: newScore, score_history: [...localHistory, entry] }), 0);
    } else {
      const newScore = Math.max(0, localScore2 + delta);
      setLocalScore2(newScore);
      setLocalHistory(prev => [...prev, entry]);
      setTimeout(() => persistState({ score2: newScore, score_history: [...localHistory, entry] }), 0);
    }
  };

  // Swap sides
  const handleSwapSides = () => {
    if (isReadOnly || match?.status === 'completed') return;
    const entry: HistoryEntry = { action: 'swap_sides', prevSidesSwapped: localSidesSwapped };
    const newVal = !localSidesSwapped;
    setLocalSidesSwapped(newVal);
    setLocalHistory(prev => [...prev, entry]);
    persistState({ sides_swapped: newVal, score_history: [...localHistory, entry] });
  };

  // Swap serve
  const handleSwapServe = () => {
    if (isReadOnly || match?.status === 'completed') return;
    const entry: HistoryEntry = { action: 'swap_serve', prevServingSide: localServingSide };
    const newVal = localServingSide === 1 ? 2 : 1;
    setLocalServingSide(newVal);
    setLocalHistory(prev => [...prev, entry]);
    persistState({ serving_side: newVal, score_history: [...localHistory, entry] });
  };

  // Undo
  const handleUndo = () => {
    if (isReadOnly || match?.status === 'completed' || localHistory.length === 0) return;
    const last = localHistory[localHistory.length - 1];
    const newHistory = localHistory.slice(0, -1);
    setLocalHistory(newHistory);

    const overrides: Record<string, any> = { score_history: newHistory };

    switch (last.action) {
      case 'score':
        if (last.prevScore1 !== undefined) { setLocalScore1(last.prevScore1); overrides.score1 = last.prevScore1; }
        if (last.prevScore2 !== undefined) { setLocalScore2(last.prevScore2); overrides.score2 = last.prevScore2; }
        break;
      case 'swap_sides':
        if (last.prevSidesSwapped !== undefined) { setLocalSidesSwapped(last.prevSidesSwapped); overrides.sides_swapped = last.prevSidesSwapped; }
        break;
      case 'swap_serve':
        if (last.prevServingSide !== undefined) { setLocalServingSide(last.prevServingSide); overrides.serving_side = last.prevServingSide; }
        break;
      case 'end_set':
        if (last.prevScore1 !== undefined) { setLocalScore1(last.prevScore1); overrides.score1 = last.prevScore1; }
        if (last.prevScore2 !== undefined) { setLocalScore2(last.prevScore2); overrides.score2 = last.prevScore2; }
        if (last.prevSetScores) { setLocalSetScores(last.prevSetScores); overrides.set_scores = last.prevSetScores; }
        if (last.prevCurrentSet !== undefined) { setLocalCurrentSet(last.prevCurrentSet); overrides.current_set = last.prevCurrentSet; }
        break;
    }
    persistState(overrides);
  };

  // Timer toggle
  const handleTimerToggle = () => {
    if (isReadOnly || match?.status === 'completed') return;
    if (timerStartedAt) {
      // Pause
      const elapsed = Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000);
      const newElapsed = timerElapsed + elapsed;
      setTimerElapsed(newElapsed);
      setTimerStartedAt(null);
      persistState({ match_timer_started_at: null, match_timer_elapsed_seconds: newElapsed });
    } else {
      // Start
      const now = new Date().toISOString();
      setTimerStartedAt(now);
      setMatchStarted(true);
      persistState({ match_timer_started_at: now });
    }
  };

  // End set
  const handleEndSet = () => {
    if (isReadOnly || match?.status === 'completed') return;

    const entry: HistoryEntry = {
      action: 'end_set',
      prevScore1: localScore1,
      prevScore2: localScore2,
      prevSetScores: [...localSetScores],
      prevCurrentSet: localCurrentSet,
    };

    const newSetScores = [...localSetScores, { s1: localScore1, s2: localScore2 }];
    const newCurrentSet = localCurrentSet + 1;

    setLocalSetScores(newSetScores);
    setLocalCurrentSet(newCurrentSet);
    setLocalScore1(0);
    setLocalScore2(0);
    setLocalHistory(prev => [...prev, entry]);
    setShowEndSetDialog(false);

    persistState({
      set_scores: newSetScores,
      current_set: newCurrentSet,
      score1: 0,
      score2: 0,
      score_history: [...localHistory, entry],
    });
  };

  // Reset scores
  const handleReset = async () => {
    if (!matchId || isReadOnly) return;
    setLocalScore1(0);
    setLocalScore2(0);
    setLocalSetScores([]);
    setLocalCurrentSet(1);
    setLocalHistory([]);
    setTimerStartedAt(null);
    setTimerElapsed(0);
    setLocalServingSide(1);
    setLocalSidesSwapped(false);
    setMatchStarted(false);
    await persistState({
      score1: 0, score2: 0, set_scores: [], current_set: 1,
      score_history: [], match_timer_started_at: null, match_timer_elapsed_seconds: 0,
      serving_side: 1, sides_swapped: false,
    });
    setShowResetDialog(false);
    toast.success(t.quickTable.matchScoring.resetSuccess);
  };

  // End match
  const handleEndMatch = async () => {
    if (!matchId || !match || !table || isReadOnly) return;

    // Determine winner based on sets or score
    let winnerId: string | null = null;
    if (localTotalSets > 1) {
      // Count sets won
      let sets1 = 0, sets2 = 0;
      for (const s of localSetScores) {
        if (s.s1 > s.s2) sets1++;
        else if (s.s2 > s.s1) sets2++;
      }
      // Include current set if scores > 0
      if (localScore1 > localScore2) sets1++;
      else if (localScore2 > localScore1) sets2++;

      if (sets1 > sets2 && player1) winnerId = player1.id;
      else if (sets2 > sets1 && player2) winnerId = player2.id;
    } else {
      if (localScore1 > localScore2 && player1) winnerId = player1.id;
      else if (localScore2 > localScore1 && player2) winnerId = player2.id;
    }

    // If current set has scores, save to set_scores
    let finalSetScores = [...localSetScores];
    if (localScore1 > 0 || localScore2 > 0) {
      finalSetScores = [...localSetScores, { s1: localScore1, s2: localScore2 }];
    }

    try {
      // Pause timer
      let finalElapsed = timerElapsed;
      if (timerStartedAt) {
        finalElapsed = timerElapsed + Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000);
      }

      const { error } = await supabase
        .from('quick_table_matches')
        .update({
          score1: localScore1,
          score2: localScore2,
          status: 'completed',
          winner_id: winnerId,
          live_referee_id: null,
          set_scores: finalSetScores,
          match_timer_started_at: null,
          match_timer_elapsed_seconds: finalElapsed,
        } as any)
        .eq('id', matchId);

      if (error) throw error;

      if (!match.is_playoff && match.group_id) {
        await updatePlayerStats(table.id, match.group_id);
      }
      if (match.is_playoff && winnerId) {
        await advanceWinnerToNextMatch(matchId, winnerId);
      }

      toast.success(t.quickTable.matchScoring.endMatchSuccess);
      setShowEndDialog(false);
      await loadMatchData();
    } catch (error) {
      console.error('Error ending match:', error);
      toast.error(t.quickTable.matchScoring.endMatchError);
    }
  };

  // Update player stats (for round robin)
  const updatePlayerStats = async (tableId: string, groupId: string) => {
    const { data: groupMatches } = await supabase
      .from('quick_table_matches')
      .select('*')
      .eq('table_id', tableId)
      .eq('group_id', groupId)
      .eq('status', 'completed');
    if (!groupMatches) return;

    const { data: groupPlayers } = await supabase
      .from('quick_table_players')
      .select('*')
      .eq('group_id', groupId);
    if (!groupPlayers) return;

    for (const player of groupPlayers) {
      let matchesPlayed = 0, matchesWon = 0, pointsFor = 0, pointsAgainst = 0;
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
        .update({ matches_played: matchesPlayed, matches_won: matchesWon, points_for: pointsFor, points_against: pointsAgainst })
        .eq('id', player.id);
    }
  };

  // Advance winner to next match
  const advanceWinnerToNextMatch = async (currentMatchId: string, winnerId: string) => {
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
      const { data: currentRoundMatches } = await supabase
        .from('quick_table_matches')
        .select('id')
        .eq('table_id', currentMatch.table_id)
        .eq('is_playoff', true)
        .eq('playoff_round', currentMatch.playoff_round);
      if (currentRoundMatches && currentRoundMatches.length === 1) {
        await supabase.from('quick_tables').update({ status: 'completed' }).eq('id', currentMatch.table_id);
      }
    }
  };

  // Navigate to next match
  const handleNextMatch = async () => {
    if (!match || !table) return;
    let nextMatch: any = null;
    if (match.is_playoff) {
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
      nextMatch = data;
    } else if (match.group_id) {
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
      nextMatch = data;
    }
    if (nextMatch) navigate(`/matches/${nextMatch.id}/score`);
    else toast.info(t.quickTable.matchScoring.noNextMatch);
  };

  // Effects
  useEffect(() => { loadMatchData(); }, [loadMatchData]);
  useEffect(() => { checkPermissions(); }, [checkPermissions]);

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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quick_table_matches', filter: `id=eq.${matchId}` },
        (payload) => {
          const nd = payload.new as any;
          setMatch(nd as MatchData);
          if (nd.live_referee_id !== user?.id) {
            setLocalScore1(nd.score1 ?? 0);
            setLocalScore2(nd.score2 ?? 0);
            setLocalSetScores((nd.set_scores as SetScore[]) ?? []);
            setLocalCurrentSet(nd.current_set ?? 1);
            setLocalServingSide(nd.serving_side ?? 1);
            setLocalSidesSwapped(nd.sides_swapped ?? false);
            setLocalHistory((nd.score_history as HistoryEntry[]) ?? []);
            setTimerStartedAt(nd.match_timer_started_at ?? null);
            setTimerElapsed(nd.match_timer_elapsed_seconds ?? 0);
          }
          if (nd.live_referee_id && nd.live_referee_id !== user?.id) setIsReadOnly(true);
          else if (!nd.live_referee_id) setIsReadOnly(false);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId, user?.id]);

  useEffect(() => {
    return () => { if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current); };
  }, []);

  // Round name
  const [totalPlayoffRounds, setTotalPlayoffRounds] = useState<number>(1);
  useEffect(() => {
    if (!match?.is_playoff || !table) return;
    const fetchTotalRounds = async () => {
      const { data: round1Matches, count } = await supabase
        .from('quick_table_matches')
        .select('id', { count: 'exact' })
        .eq('table_id', table.id)
        .eq('is_playoff', true)
        .eq('playoff_round', 1);
      const matchesInRound1 = count || round1Matches?.length || 1;
      setTotalPlayoffRounds(Math.max(1, Math.ceil(Math.log2(matchesInRound1 * 2))));
    };
    fetchTotalRounds();
  }, [match?.is_playoff, table]);

  const getRoundName = () => {
    if (!match) return '';
    if (match.is_playoff) {
      const currentRound = match.playoff_round || 1;
      const roundsFromFinal = totalPlayoffRounds - currentRound;
      if (roundsFromFinal === 0) return t.quickTable.matchScoring.final;
      if (roundsFromFinal === 1) return t.quickTable.matchScoring.semiFinal;
      if (roundsFromFinal === 2) return t.quickTable.matchScoring.quarterFinal;
      return `${t.quickTable.matchScoring.round} ${currentRound}`;
    }
    return group ? `${group.name} — ${t.quickTable.matchScoring.match} ${match.display_order + 1}` : `${t.quickTable.matchScoring.match} ${match.display_order + 1}`;
  };

  // Get display sides (swap-aware)
  const getLeftPlayer = () => localSidesSwapped ? player2 : player1;
  const getRightPlayer = () => localSidesSwapped ? player1 : player2;
  const getLeftTeam = () => localSidesSwapped ? team2 : team1;
  const getRightTeam = () => localSidesSwapped ? team1 : team2;
  const getLeftScore = () => localSidesSwapped ? localScore2 : localScore1;
  const getRightScore = () => localSidesSwapped ? localScore1 : localScore2;
  const getLeftSide = (): 1 | 2 => localSidesSwapped ? 2 : 1;
  const getRightSide = (): 1 | 2 => localSidesSwapped ? 1 : 2;

  const formatPlayerName = (player: PlayerData | null) => player?.name ?? 'TBD';

  // Count sets won
  const getSetsWon = () => {
    let s1 = 0, s2 = 0;
    for (const s of localSetScores) {
      if (s.s1 > s.s2) s1++;
      else if (s.s2 > s.s1) s2++;
    }
    return { s1, s2 };
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
            <Button variant="outline" onClick={() => navigate(`/tools/quick-tables/${table.share_id}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.quickTable.matchScoring.backToBracket}
            </Button>
          )}
        </div>
      </MainLayout>
    );
  }

  const leftPlayer = getLeftPlayer();
  const rightPlayer = getRightPlayer();
  const leftTeam = getLeftTeam();
  const rightTeam = getRightTeam();
  const leftScore = getLeftScore();
  const rightScore = getRightScore();
  const leftSide = getLeftSide();
  const rightSide = getRightSide();
  const setsWon = getSetsWon();
  const isMultiSet = localTotalSets > 1;
  const isCompleted = match?.status === 'completed';
  const canInteract = !isCompleted && !isReadOnly;

  return (
    <MainLayout>
      <DynamicMeta 
        title={`${t.quickTable.matchScoring.match} - ${formatPlayerName(player1)} vs ${formatPlayerName(player2)}`} 
        noindex={true} 
      />
      <div className="container max-w-lg mx-auto py-4 px-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => table && navigate(`/tools/quick-tables/${table.share_id}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.quickTable.matchScoring.goBack}
          </Button>
          {!isCompleted && (
            <Badge variant={isLiveOwner ? 'default' : 'secondary'}
              className={cn('gap-1', isLiveOwner && 'bg-destructive hover:bg-destructive/90 animate-pulse')}>
              <Radio className="w-3 h-3" />
              {t.quickTable.matchScoring.live}
            </Badge>
          )}
          {isCompleted && <Badge variant="outline">{t.quickTable.matchScoring.ended}</Badge>}
        </div>

        {/* Match Info */}
        <Card>
          <CardHeader className="py-3 text-center">
            <div className="text-sm text-muted-foreground">{table?.name}</div>
            <CardTitle className="text-lg">{getRoundName()}</CardTitle>
            {isMultiSet && (
              <div className="text-xs text-muted-foreground">{t.quickTable.matchScoring.bestOf} {localTotalSets}</div>
            )}
          </CardHeader>
        </Card>

        {/* Toolbar */}
        {matchStarted && canInteract && (
          <div className="flex gap-2 flex-wrap justify-center">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={localHistory.length === 0 || updating}>
              <Undo2 className="w-4 h-4 mr-1" />
              {t.quickTable.matchScoring.undo}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSwapSides} disabled={updating}>
              <ArrowLeftRight className="w-4 h-4 mr-1" />
              {t.quickTable.matchScoring.swapSides}
            </Button>
            {isMultiSet && localCurrentSet < localTotalSets && (
              <Button variant="outline" size="sm" onClick={() => setShowEndSetDialog(true)} disabled={updating}>
                {t.quickTable.matchScoring.endSet}
              </Button>
            )}
          </div>
        )}

        {/* Read-only banner */}
        {isReadOnly && !isCompleted && (
          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="py-3 flex items-center gap-2 text-warning-foreground">
              <Lock className="w-4 h-4" />
              <span className="text-sm">{t.quickTable.matchScoring.otherRefereeScoring}</span>
            </CardContent>
          </Card>
        )}

        {/* Scoreboard */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Player names */}
            <div className="grid grid-cols-3 gap-2 items-start">
              <div className="text-center">
                <div className="font-semibold text-base truncate">{formatPlayerName(leftPlayer)}</div>
                {table?.is_doubles && leftTeam && (
                  <div className="text-xs text-muted-foreground truncate">
                    {leftTeam.player2_display_name || ''}
                  </div>
                )}
                {localServingSide === leftSide && matchStarted && (
                  <Badge variant="secondary" className="text-xs mt-1 gap-1">🏓 {t.quickTable.matchScoring.serving}</Badge>
                )}
              </div>
              <div className="text-center text-sm text-muted-foreground font-medium">VS</div>
              <div className="text-center">
                <div className="font-semibold text-base truncate">{formatPlayerName(rightPlayer)}</div>
                {table?.is_doubles && rightTeam && (
                  <div className="text-xs text-muted-foreground truncate">
                    {rightTeam.player2_display_name || ''}
                  </div>
                )}
                {localServingSide === rightSide && matchStarted && (
                  <Badge variant="secondary" className="text-xs mt-1 gap-1">🏓 {t.quickTable.matchScoring.serving}</Badge>
                )}
              </div>
            </div>

            {/* Set scores table (multi-set) */}
            {isMultiSet && localSetScores.length > 0 && (
              <div className="flex justify-center gap-3 text-sm">
                {localSetScores.map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xs text-muted-foreground">{t.quickTable.matchScoring.set} {i + 1}</div>
                    <div className="font-mono">
                      {localSidesSwapped ? `${s.s2}-${s.s1}` : `${s.s1}-${s.s2}`}
                    </div>
                  </div>
                ))}
                {localCurrentSet <= localTotalSets && (
                  <div className="text-center">
                    <div className="text-xs text-primary font-medium">{t.quickTable.matchScoring.set} {localCurrentSet}</div>
                    <div className="font-mono text-primary">·-·</div>
                  </div>
                )}
              </div>
            )}

            {/* Multi-set: sets won summary */}
            {isMultiSet && (
              <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                <span>{localSidesSwapped ? setsWon.s2 : setsWon.s1} {t.quickTable.matchScoring.setsWon}</span>
                <span>{localSidesSwapped ? setsWon.s1 : setsWon.s2} {t.quickTable.matchScoring.setsWon}</span>
              </div>
            )}

            {/* Current score (big) */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-6xl font-bold tabular-nums">{leftScore}</span>
              <span className="text-2xl text-muted-foreground">—</span>
              <span className="text-6xl font-bold tabular-nums">{rightScore}</span>
            </div>

            {/* Timer + serving */}
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <button 
                onClick={handleTimerToggle} 
                disabled={!canInteract}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-full transition-colors",
                  timerStartedAt 
                    ? "bg-destructive/10 text-destructive" 
                    : "bg-muted hover:bg-muted/80",
                  !canInteract && "opacity-50"
                )}
              >
                <Timer className="w-4 h-4" />
                <span className="font-mono text-base">{formatTime(displayTime)}</span>
                {timerStartedAt ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>

            {/* Score Controls */}
            {canInteract && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                {/* Left side controls */}
                <div className="space-y-2">
                  <Button size="lg" className="w-full h-16 text-2xl" onClick={() => handleScoreChange(leftSide, 1)} disabled={updating}>
                    <Plus className="w-6 h-6 mr-1" /> +1
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleScoreChange(leftSide, -1)}
                    disabled={(leftSide === 1 ? localScore1 : localScore2) === 0 || updating}>
                    <Minus className="w-4 h-4 mr-1" /> -1
                  </Button>
                </div>
                {/* Right side controls */}
                <div className="space-y-2">
                  <Button size="lg" className="w-full h-16 text-2xl" onClick={() => handleScoreChange(rightSide, 1)} disabled={updating}>
                    <Plus className="w-6 h-6 mr-1" /> +1
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleScoreChange(rightSide, -1)}
                    disabled={(rightSide === 1 ? localScore1 : localScore2) === 0 || updating}>
                    <Minus className="w-4 h-4 mr-1" /> -1
                  </Button>
                </div>
              </div>
            )}

            {/* Swap serve button (between score buttons) */}
            {canInteract && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={handleSwapServe} disabled={updating} className="gap-1">
                  <RefreshCw className="w-4 h-4" />
                  {t.quickTable.matchScoring.swapServe}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-2">
          {canInteract && !matchStarted && (
            <Button className="w-full" onClick={handleTimerToggle}>
              <Play className="w-4 h-4 mr-2" />
              {t.quickTable.matchScoring.startMatch}
            </Button>
          )}

          {canInteract && matchStarted && (
            <>
              <Button variant="outline" className="w-full" onClick={() => setShowResetDialog(true)} disabled={updating}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t.quickTable.matchScoring.resetScore}
              </Button>
              <Button className="w-full" onClick={() => setShowEndDialog(true)} disabled={updating}>
                <CheckCircle className="w-4 h-4 mr-2" />
                {t.quickTable.matchScoring.endMatch}
              </Button>
            </>
          )}

          <Button variant="secondary" className="w-full" onClick={handleNextMatch}>
            {t.quickTable.matchScoring.nextMatch}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Reset Dialog */}
        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.quickTable.matchScoring.resetConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.quickTable.matchScoring.resetConfirmDesc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.quickTable.matchScoring.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* End Set Dialog */}
        <AlertDialog open={showEndSetDialog} onOpenChange={setShowEndSetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.quickTable.matchScoring.endSetConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.quickTable.matchScoring.set} {localCurrentSet}: {localScore1} — {localScore2}
                <br />
                {t.quickTable.matchScoring.endSetConfirmDesc}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.quickTable.matchScoring.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleEndSet}>{t.quickTable.matchScoring.confirm}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* End Match Dialog */}
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.quickTable.matchScoring.endMatchConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {isMultiSet && localSetScores.length > 0 && (
                  <div className="mb-2">
                    {localSetScores.map((s, i) => (
                      <span key={i} className="mr-2">{t.quickTable.matchScoring.set} {i + 1}: {s.s1}-{s.s2}</span>
                    ))}
                  </div>
                )}
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
