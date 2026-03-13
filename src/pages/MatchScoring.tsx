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
import { Input } from '@/components/ui/input';
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Minus, Undo2, CheckCircle, ChevronRight, ArrowLeft, Radio, Lock, ArrowLeftRight, RefreshCw, Play, Heart, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SetScore {
  s1: number;
  s2: number;
}

interface HistoryEntry {
  action: 'score' | 'swap_sides' | 'swap_serve' | 'end_set' | 'timeout' | 'medical';
  player?: 1 | 2;
  delta?: number;
  set?: number;
  prevServingSide?: number;
  prevSidesSwapped?: boolean;
  prevScore1?: number;
  prevScore2?: number;
  prevSetScores?: SetScore[];
  prevCurrentSet?: number;
  prevServerNumber?: number;
  side?: 1 | 2;
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

const TIMEOUT_DURATION = 60; // 1 minute countdown
const MEDICAL_DURATION = 300; // 5 minutes countdown

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
  const [matchStarted, setMatchStarted] = useState(false);

  // Server number (1 or 2 - "tay 1" or "tay 2" in doubles)
  const [serverNumber, setServerNumber] = useState<number>(2);

  // Player notes
  const [noteLeft, setNoteLeft] = useState('');
  const [noteRight, setNoteRight] = useState('');

  // Timeout & Medical
  const [maxTimeouts, setMaxTimeouts] = useState<number>(2);
  const [maxMedical] = useState<number>(1);
  const [timeoutsUsed1, setTimeoutsUsed1] = useState<number>(0);
  const [timeoutsUsed2, setTimeoutsUsed2] = useState<number>(0);
  const [medicalUsed1, setMedicalUsed1] = useState<number>(0);
  const [medicalUsed2, setMedicalUsed2] = useState<number>(0);
  
  // Timeout countdown
  const [activeTimeout, setActiveTimeout] = useState<{ side: 1 | 2; type: 'timeout' | 'medical' } | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Match timer (kept internally but not displayed as clock)
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerElapsed, setTimerElapsed] = useState<number>(0);

  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timeout countdown effect
  useEffect(() => {
    if (activeTimeout && countdownSeconds > 0) {
      countdownRef.current = setInterval(() => {
        setCountdownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            setActiveTimeout(null);
            toast.info(`⏰ ${t.quickTable.matchScoring.timeoutExpired}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
  }, [activeTimeout]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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

      // Fetch teams for doubles - match by player name
      if (tableData?.is_doubles) {
        const { data: allTeams } = await supabase
          .from('quick_table_teams')
          .select('id, player1_display_name, player2_display_name')
          .eq('table_id', md.table_id);
        if (allTeams && allTeams.length > 0) {
          // Match teams to players by player1_display_name
          const p1Data = md.player1_id ? (await supabase.from('quick_table_players').select('name').eq('id', md.player1_id).maybeSingle()).data : null;
          const p2Data = md.player2_id ? (await supabase.from('quick_table_players').select('name').eq('id', md.player2_id).maybeSingle()).data : null;
          const t1 = p1Data ? allTeams.find(t => t.player1_display_name === p1Data.name) : null;
          const t2 = p2Data ? allTeams.find(t => t.player1_display_name === p2Data.name) : null;
          setTeam1((t1 as TeamData) ?? null);
          setTeam2((t2 as TeamData) ?? null);
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

    // Auto-start match on first score
    if (!matchStarted) {
      setMatchStarted(true);
      const now = new Date().toISOString();
      setTimerStartedAt(now);
    }

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
      setTimeout(() => persistState({ score1: newScore, score_history: [...localHistory, entry], match_timer_started_at: timerStartedAt || new Date().toISOString() }), 0);
    } else {
      const newScore = Math.max(0, localScore2 + delta);
      setLocalScore2(newScore);
      setLocalHistory(prev => [...prev, entry]);
      setTimeout(() => persistState({ score2: newScore, score_history: [...localHistory, entry], match_timer_started_at: timerStartedAt || new Date().toISOString() }), 0);
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

  // Swap serve - rotation: A2 -> B1 -> B2 -> A1 -> A2 (cycle)
  const handleSwapServe = () => {
    if (isReadOnly || match?.status === 'completed') return;
    const entry: HistoryEntry = { action: 'swap_serve', prevServingSide: localServingSide, prevServerNumber: serverNumber };
    
    let newSide = localServingSide;
    let newServerNum = serverNumber;
    
    if (localServingSide === 1 && serverNumber === 2) {
      // A2 -> B1
      newSide = 2;
      newServerNum = 1;
    } else if (localServingSide === 2 && serverNumber === 1) {
      // B1 -> B2
      newSide = 2;
      newServerNum = 2;
    } else if (localServingSide === 2 && serverNumber === 2) {
      // B2 -> A1
      newSide = 1;
      newServerNum = 1;
    } else if (localServingSide === 1 && serverNumber === 1) {
      // A1 -> A2
      newSide = 1;
      newServerNum = 2;
    }
    
    setLocalServingSide(newSide);
    setServerNumber(newServerNum);
    setLocalHistory(prev => [...prev, entry]);
    persistState({ serving_side: newSide, score_history: [...localHistory, entry] });
  };

  // Toggle server number (tay 1 / tay 2)
  const handleToggleServerNumber = () => {
    if (isReadOnly || match?.status === 'completed') return;
    setServerNumber(prev => prev === 1 ? 2 : 1);
  };

  // Timeout handler
  const handleTimeout = (side: 1 | 2) => {
    if (isReadOnly || match?.status === 'completed') return;
    if (side === 1 && timeoutsUsed1 >= maxTimeouts) {
      toast.error(t.quickTable.matchScoring.timeoutExhausted);
      return;
    }
    if (side === 2 && timeoutsUsed2 >= maxTimeouts) {
      toast.error(t.quickTable.matchScoring.timeoutExhausted);
      return;
    }

    if (side === 1) setTimeoutsUsed1(prev => prev + 1);
    else setTimeoutsUsed2(prev => prev + 1);

    const entry: HistoryEntry = { action: 'timeout', side };
    setLocalHistory(prev => [...prev, entry]);

    // Start countdown
    setActiveTimeout({ side, type: 'timeout' });
    setCountdownSeconds(TIMEOUT_DURATION);
  };

  // Medical handler
  const handleMedical = (side: 1 | 2) => {
    if (isReadOnly || match?.status === 'completed') return;
    if (side === 1 && medicalUsed1 >= maxMedical) {
      toast.error(t.quickTable.matchScoring.medicalExhausted);
      return;
    }
    if (side === 2 && medicalUsed2 >= maxMedical) {
      toast.error(t.quickTable.matchScoring.medicalExhausted);
      return;
    }

    if (side === 1) setMedicalUsed1(prev => prev + 1);
    else setMedicalUsed2(prev => prev + 1);

    const entry: HistoryEntry = { action: 'medical', side };
    setLocalHistory(prev => [...prev, entry]);

    // Start countdown - medical is 5 minutes
    setActiveTimeout({ side, type: 'medical' });
    setCountdownSeconds(MEDICAL_DURATION);
  };

  // Cancel active timeout countdown
  const handleCancelCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setActiveTimeout(null);
    setCountdownSeconds(0);
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
        if (last.prevServerNumber !== undefined) { setServerNumber(last.prevServerNumber); }
        break;
      case 'end_set':
        if (last.prevScore1 !== undefined) { setLocalScore1(last.prevScore1); overrides.score1 = last.prevScore1; }
        if (last.prevScore2 !== undefined) { setLocalScore2(last.prevScore2); overrides.score2 = last.prevScore2; }
        if (last.prevSetScores) { setLocalSetScores(last.prevSetScores); overrides.set_scores = last.prevSetScores; }
        if (last.prevCurrentSet !== undefined) { setLocalCurrentSet(last.prevCurrentSet); overrides.current_set = last.prevCurrentSet; }
        break;
      case 'timeout':
        if (last.side === 1) setTimeoutsUsed1(prev => Math.max(0, prev - 1));
        else if (last.side === 2) setTimeoutsUsed2(prev => Math.max(0, prev - 1));
        break;
      case 'medical':
        if (last.side === 1) setMedicalUsed1(prev => Math.max(0, prev - 1));
        else if (last.side === 2) setMedicalUsed2(prev => Math.max(0, prev - 1));
        break;
    }
    persistState(overrides);
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
    setServerNumber(2);
    setTimeoutsUsed1(0);
    setTimeoutsUsed2(0);
    setMedicalUsed1(0);
    setMedicalUsed2(0);
    setNoteLeft('');
    setNoteRight('');
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
      let sets1 = 0, sets2 = 0;
      for (const s of localSetScores) {
        if (s.s1 > s.s2) sets1++;
        else if (s.s2 > s.s1) sets2++;
      }
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

  // Timeout emoji indicators
  const renderTimeoutIndicators = (used: number, max: number) => {
    return Array.from({ length: max }, (_, i) => (
      <span key={i} className={cn("text-lg", i < used ? "opacity-100" : "opacity-30")}>
        ⏱️
      </span>
    ));
  };

  const renderMedicalIndicators = (used: number, max: number) => {
    return Array.from({ length: max }, (_, i) => (
      <span key={i} className={cn("text-lg", i < used ? "opacity-100" : "opacity-30")}>
        🏥
      </span>
    ));
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

  // Build score display string: "serving_score - receiving_score - server_number"
  const servingScore = localServingSide === 1 ? localScore1 : localScore2;
  const receivingScore = localServingSide === 1 ? localScore2 : localScore1;

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

        {/* Timeout Countdown Overlay */}
        {activeTimeout && countdownSeconds > 0 && (
          <Card className={cn(
            "border-2",
            activeTimeout.type === 'timeout' ? "border-yellow-500 bg-yellow-500/10" : "border-red-500 bg-red-500/10"
          )}>
            <CardContent className="py-4 text-center space-y-2">
              <div className="text-sm font-medium">
                {activeTimeout.type === 'timeout' ? `⏱️ ${t.quickTable.matchScoring.timeoutLabel}` : `🏥 ${t.quickTable.matchScoring.medicalLabel}`} — {activeTimeout.side === leftSide ? formatPlayerName(leftPlayer) : formatPlayerName(rightPlayer)}
              </div>
              <div className="text-5xl font-bold font-mono tabular-nums">
                {formatCountdown(countdownSeconds)}
              </div>
              <Button variant="outline" size="sm" onClick={handleCancelCountdown}>
                Kết thúc sớm
              </Button>
            </CardContent>
          </Card>
        )}

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
            {/* Player names + notes */}
            <div className="grid grid-cols-3 gap-2 items-start">
              <div className="text-center space-y-1">
                <div className="font-semibold text-base truncate">{formatPlayerName(leftPlayer)}</div>
                {table?.is_doubles && leftTeam && (
                  <div className="text-xs text-muted-foreground truncate">
                    {leftTeam.player2_display_name || ''}
                  </div>
                )}
                {localServingSide === leftSide && matchStarted && (
                  <Badge variant="secondary" className="text-xs mt-1 gap-1">🏓 Giao</Badge>
                )}
                {/* Timeout/Medical indicators */}
                <div className="flex justify-center gap-0.5 flex-wrap">
                  {renderTimeoutIndicators(leftSide === 1 ? timeoutsUsed1 : timeoutsUsed2, maxTimeouts)}
                  {renderMedicalIndicators(leftSide === 1 ? medicalUsed1 : medicalUsed2, maxMedical)}
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground font-medium">VS</div>
              <div className="text-center space-y-1">
                <div className="font-semibold text-base truncate">{formatPlayerName(rightPlayer)}</div>
                {table?.is_doubles && rightTeam && (
                  <div className="text-xs text-muted-foreground truncate">
                    {rightTeam.player2_display_name || ''}
                  </div>
                )}
                {localServingSide === rightSide && matchStarted && (
                  <Badge variant="secondary" className="text-xs mt-1 gap-1">🏓 Giao</Badge>
                )}
                {/* Timeout/Medical indicators */}
                <div className="flex justify-center gap-0.5 flex-wrap">
                  {renderTimeoutIndicators(rightSide === 1 ? timeoutsUsed1 : timeoutsUsed2, maxTimeouts)}
                  {renderMedicalIndicators(rightSide === 1 ? medicalUsed1 : medicalUsed2, maxMedical)}
                </div>
              </div>
            </div>

            {/* Player notes */}
            {canInteract && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Ghi chú VĐV trái..."
                  value={noteLeft}
                  onChange={(e) => setNoteLeft(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  placeholder="Ghi chú VĐV phải..."
                  value={noteRight}
                  onChange={(e) => setNoteRight(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            )}
            {!canInteract && (noteLeft || noteRight) && (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>{noteLeft}</div>
                <div>{noteRight}</div>
              </div>
            )}

            {/* Set scores table (multi-set) - only after match started */}
            {matchStarted && isMultiSet && localSetScores.length > 0 && (
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
            {matchStarted && isMultiSet && (
              <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                <span>{localSidesSwapped ? setsWon.s2 : setsWon.s1} {t.quickTable.matchScoring.setsWon}</span>
                <span>{localSidesSwapped ? setsWon.s1 : setsWon.s2} {t.quickTable.matchScoring.setsWon}</span>
              </div>
            )}

            {/* Current score display: score1 - score2 - serverNumber - only after match started */}
            {matchStarted && (
              <div className="flex items-center justify-center gap-3">
                <span className="text-6xl font-bold tabular-nums">{leftScore}</span>
                <span className="text-2xl text-muted-foreground">–</span>
                <span className="text-6xl font-bold tabular-nums">{rightScore}</span>
                {table?.is_doubles && (
                  <>
                    <span className="text-2xl text-muted-foreground">–</span>
                    <button
                      onClick={handleToggleServerNumber}
                      disabled={!canInteract}
                      className={cn(
                        "text-4xl font-bold tabular-nums px-3 py-1 rounded-lg transition-colors",
                        "bg-primary/10 text-primary hover:bg-primary/20",
                        !canInteract && "opacity-50 cursor-default"
                      )}
                      title="Tay giao (bấm để đổi)"
                    >
                      {serverNumber}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Serving side selector + swap serve */}
            {canInteract && matchStarted && (
              <div className="flex items-center justify-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleSwapServe} disabled={updating} className="gap-1">
                  <RefreshCw className="w-4 h-4" />
                  Đổi giao
                </Button>
                {table?.is_doubles && (
                  <span className="text-xs text-muted-foreground">
                    Tay {serverNumber} đang giao
                  </span>
                )}
              </div>
            )}

            {/* Timeout & Medical buttons */}
            {canInteract && matchStarted && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {/* Left side timeout/medical */}
                <div className="space-y-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs border-yellow-500/50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => handleTimeout(leftSide)}
                    disabled={(leftSide === 1 ? timeoutsUsed1 : timeoutsUsed2) >= maxTimeouts || updating || !!activeTimeout}
                  >
                    <Timer className="w-3 h-3 mr-1" />
                    Time Out ({leftSide === 1 ? timeoutsUsed1 : timeoutsUsed2}/{maxTimeouts})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-500/10"
                    onClick={() => handleMedical(leftSide)}
                    disabled={(leftSide === 1 ? medicalUsed1 : medicalUsed2) >= maxMedical || updating || !!activeTimeout}
                  >
                    <Heart className="w-3 h-3 mr-1" />
                    Y tế ({leftSide === 1 ? medicalUsed1 : medicalUsed2}/{maxMedical})
                  </Button>
                </div>
                {/* Right side timeout/medical */}
                <div className="space-y-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs border-yellow-500/50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => handleTimeout(rightSide)}
                    disabled={(rightSide === 1 ? timeoutsUsed1 : timeoutsUsed2) >= maxTimeouts || updating || !!activeTimeout}
                  >
                    <Timer className="w-3 h-3 mr-1" />
                    Time Out ({rightSide === 1 ? timeoutsUsed1 : timeoutsUsed2}/{maxTimeouts})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-500/10"
                    onClick={() => handleMedical(rightSide)}
                    disabled={(rightSide === 1 ? medicalUsed1 : medicalUsed2) >= maxMedical || updating || !!activeTimeout}
                  >
                    <Heart className="w-3 h-3 mr-1" />
                    Y tế ({rightSide === 1 ? medicalUsed1 : medicalUsed2}/{maxMedical})
                  </Button>
                </div>
              </div>
            )}

            {/* Score Controls - only after match started */}
            {canInteract && matchStarted && (
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
          </CardContent>
        </Card>

        {/* Pre-match settings */}
        {canInteract && !matchStarted && (
          <Card>
            <CardContent className="py-4 space-y-4">
              <h4 className="text-sm font-semibold">Cài đặt trận đấu</h4>
              
              {/* Serving side selection - prominent */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Chọn bên giao bóng trước</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={localServingSide === 1 ? 'default' : 'outline'}
                    className={cn('h-14 text-sm font-semibold flex flex-col gap-0.5', localServingSide === 1 && 'ring-2 ring-primary ring-offset-2')}
                    onClick={() => {
                      setLocalServingSide(1);
                      persistState({ serving_side: 1 });
                    }}
                  >
                    <span>🏓</span>
                    <span>{formatPlayerName(localSidesSwapped ? player2 : player1)}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={localServingSide === 2 ? 'default' : 'outline'}
                    className={cn('h-14 text-sm font-semibold flex flex-col gap-0.5', localServingSide === 2 && 'ring-2 ring-primary ring-offset-2')}
                    onClick={() => {
                      setLocalServingSide(2);
                      persistState({ serving_side: 2 });
                    }}
                  >
                    <span>🏓</span>
                    <span>{formatPlayerName(localSidesSwapped ? player1 : player2)}</span>
                  </Button>
                </div>
              </div>

              {/* Timeout settings */}
              <div>
                <label className="text-xs text-muted-foreground">Số lần Time Out mỗi bên</label>
                <Select value={String(maxTimeouts)} onValueChange={(v) => setMaxTimeouts(Number(v))}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 lần</SelectItem>
                    <SelectItem value="2">2 lần</SelectItem>
                    <SelectItem value="3">3 lần</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Y tế: mặc định 1 lần mỗi bên (5 phút)</p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {canInteract && !matchStarted && (
            <Button className="w-full" onClick={() => {
              setMatchStarted(true);
              const now = new Date().toISOString();
              setTimerStartedAt(now);
              persistState({ match_timer_started_at: now });
            }}>
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
