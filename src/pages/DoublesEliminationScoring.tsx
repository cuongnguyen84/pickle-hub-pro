import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { TheLineLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDoublesElimination } from "@/hooks/useDoublesElimination";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { submitDoublesEliminationMatch } from "@/lib/dupr/submitDoublesEliminationMatch";
import { RefereeScoringScreen, type RefereeLoaded } from "@/components/referee/RefereeScoringScreen";
import { Minus, Plus, RotateCcw, Check, Trophy } from "lucide-react";
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
  dupr_submitted?: boolean;
  dupr_match_code?: string | null;
  dupr_submit_error?: string | null;
}

interface TeamData {
  id: string;
  team_name: string;
  player1_name: string;
  player2_name: string | null;
  seed: number;
  player1_user_id?: string | null;
  player2_user_id?: string | null;
}

interface TournamentData {
  id: string;
  name: string;
  share_id: string;
  creator_user_id: string;
  rating_source?: 'self' | 'dupr' | 'either';
}

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
  padding: 24,
};

// Helper to propagate winner to next round
async function propagateWinnerToNextRound(
  match: MatchData,
  winnerId: string,
  tournamentId: string,
) {
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
  } else if (match.round_number >= 4) {
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
        // W1.3 — explicit branches instead of dynamic-key
        // `update({ [updateField]: winnerId })`. The Supabase
        // generated types reject `{ [string]: string }` because the
        // column union is fully constrained at the type level; the
        // dynamic-key form forced a `never` index signature error
        // (Scoring.tsx:120 pre-fix). Behaviour is identical — slot 0
        // writes team_a_id, slot 1 writes team_b_id.
        if (slot === 0) {
          await supabase
            .from('doubles_elimination_matches')
            .update({ team_a_id: winnerId })
            .eq('id', targetMatch.id);
        } else {
          await supabase
            .from('doubles_elimination_matches')
            .update({ team_b_id: winnerId })
            .eq('id', targetMatch.id);
        }
      }
    }
  }
}

export default function DoublesEliminationScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useI18n();
  const { checkAndAssignR3, checkAndGeneratePlayoff } = useDoublesElimination();

  const [match, setMatch] = useState<MatchData | null>(null);
  const [teamA, setTeamA] = useState<TeamData | null>(null);
  const [teamB, setTeamB] = useState<TeamData | null>(null);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  const [localScoreA, setLocalScoreA] = useState(0);
  const [localScoreB, setLocalScoreB] = useState(0);
  const [currentGameNumber, setCurrentGameNumber] = useState(1);

  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [refereeing, setRefereeing] = useState(false);

  // ─── Bilingual short strings (inline ternary, matching PR A pattern) ─────
  const lang = language;
  const tx = {
    loading: lang === 'vi' ? 'Đang tải…' : 'Loading…',
    notFound: lang === 'vi' ? 'Không tìm thấy trận đấu' : 'Match not found',
    goBack: lang === 'vi' ? 'Quay lại' : 'Go back',
    loadError: lang === 'vi' ? 'Lỗi tải dữ liệu trận đấu' : 'Failed to load match data',
    resetSuccess: lang === 'vi' ? 'Đã reset điểm' : 'Score reset',
    scoresMustDiffer: lang === 'vi' ? 'Điểm phải khác nhau' : 'Scores must differ',
    matchEnded: lang === 'vi' ? 'Trận đấu kết thúc!' : 'Match ended!',
    bestOf: (n: number, wins: number) =>
      lang === 'vi' ? `Best of ${n} (Thắng ${wins})` : `Best of ${n} (Win ${wins})`,
    clickToScore: lang === 'vi'
      ? 'Click vào ô game để chấm điểm game đó'
      : 'Click a game slot to score it',
    gameLong: lang === 'vi' ? 'game' : 'game',
    matchLabel: lang === 'vi' ? 'Trận' : 'Match',
    reset: 'Reset',
    saveGame: (n: number) => lang === 'vi' ? `Lưu Game ${n}` : `Save Game ${n}`,
    endMatch: lang === 'vi' ? 'Kết thúc trận' : 'End match',
    matchEndedTitle: lang === 'vi' ? 'Trận đấu đã kết thúc' : 'Match ended',
    won: (name: string) => lang === 'vi' ? `${name} chiến thắng` : `${name} wins`,
    noPermission: lang === 'vi'
      ? 'Bạn không có quyền chỉnh sửa điểm trận này'
      : "You don't have permission to score this match",
    resetTitle: lang === 'vi' ? 'Reset điểm?' : 'Reset score?',
    resetDesc: lang === 'vi' ? 'Điểm hiện tại sẽ được đặt về 0–0.' : 'Score will be reset to 0–0.',
    cancel: lang === 'vi' ? 'Hủy' : 'Cancel',
    confirm: lang === 'vi' ? 'Xác nhận' : 'Confirm',
    endGameTitle: (n: number) => lang === 'vi' ? `Kết thúc Game ${n}?` : `End Game ${n}?`,
    endMatchTitle: lang === 'vi' ? 'Kết thúc trận đấu?' : 'End match?',
    endResult: (a: string, sa: number, sb: number, b: string) =>
      lang === 'vi' ? `Kết quả: ${a} ${sa} – ${sb} ${b}` : `Result: ${a} ${sa} – ${sb} ${b}`,
    winsThis: (name: string, isBestOfMatch: boolean) =>
      lang === 'vi'
        ? `${name} thắng${isBestOfMatch ? ' game này' : ''}.`
        : `${name} wins${isBestOfMatch ? ' this game' : ''}.`,
    savedGameN: (n: number) => lang === 'vi' ? `Đã lưu Game ${n}` : `Saved Game ${n}`,
  };

  const getRoundLabel = (roundType: string) => {
    if (lang === 'vi') {
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
    }
    switch (roundType) {
      case 'winner_r1': return 'Round 1 (Winner)';
      case 'loser_r2': return 'Round 2 (Loser)';
      case 'merge_r3': return 'Round 3 (Merge)';
      case 'quarterfinal': return 'Quarter-final';
      case 'semifinal': return 'Semi-final';
      case 'third_place': return '3rd place';
      case 'final': return 'Final';
      default: return 'Preliminary';
    }
  };

  useEffect(() => {
    if (matchId) {
      loadMatchData();
    }
  }, [matchId]);

  const loadMatchData = async () => {
    if (!matchId) return;
    setLoading(true);

    try {
      const { data: matchData, error: matchError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError) throw matchError;

      const gamesArray = (Array.isArray(matchData.games) ? matchData.games : []) as unknown as GameScore[];
      setMatch({ ...matchData, games: gamesArray } as unknown as MatchData);

      setCurrentGameNumber(gamesArray.length + 1);

      if (gamesArray.length === 0) {
        setLocalScoreA(matchData.score_a || 0);
        setLocalScoreB(matchData.score_b || 0);
      } else {
        setLocalScoreA(0);
        setLocalScoreB(0);
      }

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

      const { data: tournamentData } = await supabase
        .from('doubles_elimination_tournaments')
        .select('*')
        .eq('id', matchData.tournament_id)
        .single();
      setTournament(tournamentData as TournamentData);

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
      toast({ title: tx.loadError, variant: "destructive" });
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

    await supabase
      .from('doubles_elimination_matches')
      .update({
        score_a: newScoreA,
        score_b: newScoreB,
        status: 'live',
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
    toast({ title: tx.resetSuccess });
  };

  const handleSelectGame = (gameNum: number) => {
    if (!match || !canEdit || match.status === 'completed') return;

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

  const tryDuprSubmit = async () => {
    if (!match || !teamA || !teamB || !tournament) return;
    const ratingSource = tournament.rating_source ?? 'self';
    if (ratingSource === 'self') return;
    if (match.dupr_submitted) return;
    const outcome = await submitDoublesEliminationMatch({
      matchId: match.id,
      games: match.games || [],
      ratingSource,
      tournamentName: tournament.name,
      teamA: { id: teamA.id, player1_user_id: teamA.player1_user_id ?? null, player2_user_id: teamA.player2_user_id ?? null },
      teamB: { id: teamB.id, player1_user_id: teamB.player1_user_id ?? null, player2_user_id: teamB.player2_user_id ?? null },
      alreadySubmitted: !!match.dupr_submitted,
    });
    if (outcome.kind === 'ok') {
      setMatch((prev) => prev ? { ...prev, dupr_submitted: true, dupr_match_code: outcome.matchCode } : prev);
      toast({ title: language === 'vi' ? 'Đã gửi kết quả lên DUPR' : 'Submitted to DUPR' });
    } else if (outcome.kind === 'error') {
      setMatch((prev) => prev ? { ...prev, dupr_submit_error: outcome.message } : prev);
      toast({
        title: language === 'vi' ? 'Lỗi gửi DUPR' : 'DUPR submit error',
        description: outcome.message,
        variant: 'destructive',
      });
    } else if (outcome.reason === 'missing-dupr-id' || outcome.reason === 'missing-profile-link') {
      toast({
        title: language === 'vi' ? 'Bỏ qua DUPR — thiếu thông tin' : 'Skipped DUPR — incomplete data',
        description: language === 'vi'
          ? 'Trận thiếu user_id hoặc DUPR ID của ≥1 VĐV.'
          : 'Match is missing user_id or DUPR ID for ≥1 player.',
      });
    }
  };

  const handleSaveGame = async (overrideA?: number, overrideB?: number) => {
    if (!match || !canEdit) return;
    const sa = overrideA ?? localScoreA;
    const sb = overrideB ?? localScoreB;
    if (sa === sb) {
      toast({ title: tx.scoresMustDiffer, variant: "destructive" });
      return;
    }

    const newGame: GameScore = {
      game: currentGameNumber,
      score_a: sa,
      score_b: sb,
      winner: sa > sb ? 'a' : 'b',
    };

    const existingGames = [...(match.games || [])];
    const gameIndex = currentGameNumber - 1;

    if (gameIndex < existingGames.length) {
      existingGames[gameIndex] = newGame;
    } else {
      while (existingGames.length < gameIndex) {
        existingGames.push({ game: existingGames.length + 1, score_a: 0, score_b: 0, winner: 'a' });
      }
      existingGames.push(newGame);
    }

    const winsA = existingGames.filter(g => g.winner === 'a').length;
    const winsB = existingGames.filter(g => g.winner === 'b').length;
    const winsNeededForMatch = Math.ceil(match.best_of / 2);
    const isMatchComplete = winsA >= winsNeededForMatch || winsB >= winsNeededForMatch;

    if (isMatchComplete) {
      const winnerId = winsA > winsB ? match.team_a_id : match.team_b_id;
      const loserId = winsA > winsB ? match.team_b_id : match.team_a_id;

      await supabase
        .from('doubles_elimination_matches')
        .update({
          games: existingGames as never,
          games_won_a: winsA,
          games_won_b: winsB,
          winner_id: winnerId,
          status: 'completed',
          score_a: 0,
          score_b: 0,
        })
        .eq('id', match.id);

      if (loserId && match.round_type !== 'winner_r1') {
        await supabase
          .from('doubles_elimination_teams')
          .update({
            status: 'eliminated',
            eliminated_at_round: match.round_number,
          })
          .eq('id', loserId);
      }

      if (winnerId && match.round_number >= 3 && tournament) {
        await propagateWinnerToNextRound(match, winnerId, tournament.id);
      }

      if (match.round_type === 'final' && tournament) {
        await supabase
          .from('doubles_elimination_tournaments')
          .update({ status: 'completed' })
          .eq('id', tournament.id);
      }

      if (tournament) {
        if (match.round_number === 2) {
          await checkAndAssignR3(tournament.id);
        }
        if (match.round_number === 3) {
          await checkAndGeneratePlayoff(tournament.id);
        }
      }

      setMatch({
        ...match,
        games: existingGames,
        games_won_a: winsA,
        games_won_b: winsB,
        winner_id: winnerId,
        status: 'completed',
      });

      toast({ title: tx.matchEnded });
      await tryDuprSubmit();
    } else {
      await supabase
        .from('doubles_elimination_matches')
        .update({
          games: existingGames as never,
          games_won_a: winsA,
          games_won_b: winsB,
          status: 'live',
          score_a: 0,
          score_b: 0,
        })
        .eq('id', match.id);

      setMatch({
        ...match,
        games: existingGames,
        games_won_a: winsA,
        games_won_b: winsB,
      });

      const nextEmptyGame = existingGames.length + 1;
      if (nextEmptyGame <= match.best_of) {
        setCurrentGameNumber(nextEmptyGame);
        setLocalScoreA(0);
        setLocalScoreB(0);
      }

      toast({ title: tx.savedGameN(currentGameNumber) });
    }
  };

  const handleEndGame = async () => {
    await handleSaveGame();
    setShowEndDialog(false);
  };

  const handleEndMatchDirectly = async () => {
    if (!match || !canEdit) return;

    const winnerId = localScoreA > localScoreB ? match.team_a_id : match.team_b_id;
    const loserId = localScoreA > localScoreB ? match.team_b_id : match.team_a_id;

    await supabase
      .from('doubles_elimination_matches')
      .update({
        score_a: localScoreA,
        score_b: localScoreB,
        winner_id: winnerId,
        status: 'completed',
      })
      .eq('id', match.id);

    if (loserId && match.round_type !== 'winner_r1') {
      await supabase
        .from('doubles_elimination_teams')
        .update({
          status: 'eliminated',
          eliminated_at_round: match.round_number,
        })
        .eq('id', loserId);
    }

    if (winnerId && match.round_number >= 3 && tournament) {
      await propagateWinnerToNextRound(match, winnerId, tournament.id);
    }

    if (match.round_type === 'final' && tournament) {
      await supabase
        .from('doubles_elimination_tournaments')
        .update({ status: 'completed' })
        .eq('id', tournament.id);
    }

    if (tournament) {
      if (match.round_number === 2) {
        await checkAndAssignR3(tournament.id);
      }
      if (match.round_number === 3) {
        await checkAndGeneratePlayoff(tournament.id);
      }
    }

    toast({ title: tx.matchEnded });
    // DUPR Phase 2 (2026-05-29). Attempt submit BEFORE navigation so any
    // error toast is seen on the scoring page.
    await tryDuprSubmit();
    navigate(`/tools/doubles-elimination/${tournament?.share_id}`);
    setShowEndDialog(false);
  };

  // ─── Referee live-scoring (engine-driven; feeds the existing save flow) ───
  const refLoaded: RefereeLoaded | null = match && teamA && teamB ? {
    matchId: match.id,
    teamAName: teamA.team_name,
    teamBName: teamB.team_name,
    playersA: teamA.player2_name ? [teamA.player1_name, teamA.player2_name] : null,
    playersB: teamB.player2_name ? [teamB.player1_name, teamB.player2_name] : null,
    isDoubles: true,
    backHref: '',
  } : null;
  const refFinish = async (a: number, b: number) => {
    setLocalScoreA(a); setLocalScoreB(b);
    await handleSaveGame(a, b);
    setRefereeing(false);
  };
  const refLiveScore = (a: number, b: number) => {
    if (!match) return;
    void supabase.from('doubles_elimination_matches').update({ score_a: a, score_b: b }).eq('id', match.id).then(() => undefined, () => undefined);
  };
  const refClaimLive = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user && match) await supabase.from('doubles_elimination_matches').update({ live_referee_id: data.user.id }).eq('id', match.id).is('live_referee_id', null);
    } catch { /* ignore */ }
  };

  // ─── Loading + 404 states ────────────────────────────────────────────────
  if (loading) {
    return (
      <TheLineLayout title="Doubles Elimination Scoring" noindex={true} active="lab">
        <div className="tl-shell">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              color: 'var(--tl-fg-3)',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {tx.loading}
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!match || !teamA || !teamB) {
    return (
      <TheLineLayout title="Doubles Elimination Scoring" noindex={true} active="lab">
        <div className="tl-shell">
          <div className="tl-empty" style={{ marginTop: 56 }}>
            <h3>{tx.notFound}</h3>
            <button type="button" className="tl-btn" onClick={() => navigate(-1)}>
              ← {tx.goBack}
            </button>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const isBestOfMatch = match.best_of > 1;
  const winsNeeded = Math.ceil(match.best_of / 2);

  return (
    <TheLineLayout
      title={`${lang === 'vi' ? 'Chấm điểm' : 'Score'} - ${teamA.team_name} vs ${teamB.team_name}`}
      noindex={true}
      active="lab"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{lang === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/doubles-elimination">Doubles Elimination</Link>
          {tournament && (
            <>
              <span className="sep">/</span>
              <Link to={`/tools/doubles-elimination/${tournament.share_id}`}>{tournament.name}</Link>
            </>
          )}
          <span className="sep">/</span>
          <span className="current">
            {lang === 'vi' ? 'Chấm điểm' : 'Score'}
          </span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {getRoundLabel(match.round_type)}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {tx.matchLabel} {match.match_number}
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 3.6vw, 44px)' }}>
            <em className="tl-serif">{teamA.team_name}</em>{' '}
            <span style={{ color: 'var(--tl-fg-3)', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: '0.6em' }}>
              vs
            </span>{' '}
            <em className="tl-serif">{teamB.team_name}</em>
          </h1>
        </header>

        <section
          style={{
            maxWidth: 540,
            margin: '0 auto',
            padding: '24px 0 0',
            width: '100%',
          }}
        >
          {/* Best-of indicator with clickable game slots */}
          {isBestOfMatch && (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <span
                style={{
                  display: 'inline-block',
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'var(--tl-surface)',
                  border: '1px solid var(--tl-border)',
                  color: 'var(--tl-fg-2)',
                  letterSpacing: '0.04em',
                  marginBottom: 16,
                }}
              >
                {tx.bestOf(match.best_of, winsNeeded)}
              </span>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {Array.from({ length: match.best_of }).map((_, gameIndex) => {
                  const gameNum = gameIndex + 1;
                  const gameData = match.games?.[gameIndex];
                  const isCurrentGame = gameNum === currentGameNumber;
                  const isCompleted = !!gameData;
                  const winnerTeam = gameData?.winner;
                  const canClickGame = canEdit && match.status !== 'completed';

                  const slotBg =
                    isCurrentGame ? 'var(--tl-green-glow)' :
                    isCompleted ? 'var(--tl-bg-elev)' :
                    'var(--tl-bg)';
                  const slotBorder =
                    isCurrentGame ? 'var(--tl-green)' :
                    isCompleted ? 'var(--tl-border)' :
                    'var(--tl-border)';

                  return (
                    <button
                      key={gameIndex}
                      type="button"
                      onClick={() => handleSelectGame(gameNum)}
                      disabled={!canClickGame}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 64,
                        height: 80,
                        borderRadius: 'var(--tl-radius)',
                        border: `2px solid ${slotBorder}`,
                        background: slotBg,
                        cursor: canClickGame ? 'pointer' : 'not-allowed',
                        boxShadow: isCurrentGame ? '0 0 0 4px var(--tl-green-glow)' : 'none',
                        transition: 'border-color 0.15s, background 0.15s',
                        font: 'inherit',
                        color: 'var(--tl-fg)',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                          fontSize: 10,
                          fontWeight: 500,
                          marginBottom: 4,
                          color: isCurrentGame ? 'var(--tl-green)' : 'var(--tl-fg-3)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        G{gameNum}
                      </div>
                      {isCompleted ? (
                        <div
                          style={{
                            textAlign: 'center',
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: winnerTeam === 'a' ? 'var(--tl-green)' : 'var(--tl-fg-3)',
                            }}
                          >
                            {gameData.score_a}
                          </span>
                          <span style={{ color: 'var(--tl-fg-4)', margin: '0 2px' }}>–</span>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: winnerTeam === 'b' ? 'var(--tl-green)' : 'var(--tl-fg-3)',
                            }}
                          >
                            {gameData.score_b}
                          </span>
                        </div>
                      ) : isCurrentGame ? (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--tl-green)',
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {localScoreA}–{localScoreB}
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, color: 'var(--tl-fg-4)' }}>—</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Games won summary */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'baseline',
                  gap: 10,
                  marginTop: 16,
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: match.games_won_a > match.games_won_b ? 'var(--tl-green)' : 'var(--tl-fg)',
                  }}
                >
                  {match.games_won_a}
                </span>
                <span style={{ color: 'var(--tl-fg-3)', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {tx.gameLong}
                </span>
                <span style={{ color: 'var(--tl-fg-4)' }}>—</span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: match.games_won_b > match.games_won_a ? 'var(--tl-green)' : 'var(--tl-fg)',
                  }}
                >
                  {match.games_won_b}
                </span>
                <span style={{ color: 'var(--tl-fg-3)', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {tx.gameLong}
                </span>
              </div>

              {canEdit && match.status !== 'completed' && (
                <p style={{ fontSize: 12, color: 'var(--tl-fg-3)', marginTop: 12, fontStyle: 'italic' }}>
                  {tx.clickToScore}
                </p>
              )}
            </div>
          )}

          {/* Score Board */}
          <div style={{ ...surfaceCard, marginBottom: 20, padding: '32px 20px' }}>
            {isBestOfMatch && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: 'var(--tl-green-glow)',
                    color: 'var(--tl-green)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Game {currentGameNumber}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                {teamA.seed !== null && teamA.seed !== undefined && (
                  <div
                    style={{
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      fontSize: 11,
                      color: 'var(--tl-fg-3)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    #{teamA.seed}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: 'var(--tl-fg)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 80,
                  }}
                >
                  {teamA.team_name}
                </div>
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--tl-fg)',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {localScoreA}
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'var(--tl-fg-4)',
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                }}
              >
                :
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--tl-fg)',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {localScoreB}
              </div>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                {teamB.seed !== null && teamB.seed !== undefined && (
                  <div
                    style={{
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      fontSize: 11,
                      color: 'var(--tl-fg-3)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    #{teamB.seed}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: 'var(--tl-fg)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 80,
                  }}
                >
                  {teamB.team_name}
                </div>
              </div>
            </div>
          </div>

          {/* Score Controls */}
          {canEdit && match.status !== 'completed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Team names row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--tl-fg-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {teamA.team_name}
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--tl-fg-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {teamB.team_name}
                </div>
              </div>

              {/* Score controls — minus / plus per team */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleScoreChange('a', -1)}
                    style={{
                      width: 48,
                      height: 56,
                      background: 'transparent',
                      border: '1px solid var(--tl-border)',
                      borderRadius: 'var(--tl-radius)',
                      color: 'var(--tl-fg-2)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--tl-surface)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border-2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                    }}
                    aria-label={`-1 ${teamA.team_name}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScoreChange('a', 1)}
                    style={{
                      flex: 1,
                      height: 56,
                      background: 'var(--tl-green)',
                      border: '1px solid var(--tl-green)',
                      borderRadius: 'var(--tl-radius)',
                      color: 'var(--tl-bg)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'opacity 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--tl-green-dim)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green-dim)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--tl-green)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green)';
                    }}
                    aria-label={`+1 ${teamA.team_name}`}
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleScoreChange('b', -1)}
                    style={{
                      width: 48,
                      height: 56,
                      background: 'transparent',
                      border: '1px solid var(--tl-border)',
                      borderRadius: 'var(--tl-radius)',
                      color: 'var(--tl-fg-2)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--tl-surface)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border-2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                    }}
                    aria-label={`-1 ${teamB.team_name}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScoreChange('b', 1)}
                    style={{
                      flex: 1,
                      height: 56,
                      background: 'var(--tl-green)',
                      border: '1px solid var(--tl-green)',
                      borderRadius: 'var(--tl-radius)',
                      color: 'var(--tl-bg)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'opacity 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--tl-green-dim)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green-dim)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--tl-green)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green)';
                    }}
                    aria-label={`+1 ${teamB.team_name}`}
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Referee live-scoring — engine-driven board, fills this game's score */}
              {canEdit && refLoaded && (
                <button
                  type="button"
                  className="tl-btn green"
                  onClick={() => setRefereeing(true)}
                  style={{ width: '100%', justifyContent: 'center', padding: '13px 14px', marginTop: 10 }}
                >
                  {lang === 'vi' ? 'CHẤM TRỰC TIẾP' : 'LIVE SCORING'}
                </button>
              )}

              {/* Action buttons — sticky bottom dock with safe-area padding */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  position: 'sticky',
                  bottom: 0,
                  paddingTop: 14,
                  paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)',
                  background: 'linear-gradient(to top, var(--tl-bg) 60%, transparent)',
                }}
              >
                <button
                  type="button"
                  className="tl-btn"
                  onClick={() => setShowResetDialog(true)}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px 14px' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  {tx.reset}
                </button>
                {isBestOfMatch ? (
                  <button
                    type="button"
                    className="tl-btn green"
                    onClick={() => handleSaveGame()}
                    disabled={localScoreA === localScoreB}
                    style={{ flex: 1, justifyContent: 'center', padding: '12px 14px' }}
                  >
                    <Check className="w-4 h-4" />
                    {tx.saveGame(currentGameNumber)}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="tl-btn green"
                    onClick={() => setShowEndDialog(true)}
                    disabled={localScoreA === localScoreB}
                    style={{ flex: 1, justifyContent: 'center', padding: '12px 14px' }}
                  >
                    <Check className="w-4 h-4" />
                    {tx.endMatch}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Completed state */}
          {match.status === 'completed' && (
            <div
              style={{
                ...surfaceCard,
                background: 'var(--tl-green-glow)',
                borderColor: 'rgba(0, 185, 107, 0.30)',
                textAlign: 'center',
                padding: '28px 20px',
              }}
            >
              <Trophy className="w-12 h-12" style={{ color: 'var(--tl-green)', margin: '0 auto 10px' }} />
              <div
                style={{
                  fontFamily: 'Instrument Serif, serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 22,
                  color: 'var(--tl-fg)',
                }}
              >
                {tx.matchEndedTitle}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--tl-fg-2)', marginTop: 6 }}>
                {tx.won(match.winner_id === match.team_a_id ? teamA.team_name : teamB.team_name)}
              </div>
              {/* DUPR Phase 2 (2026-05-29). Submit status badge — visible only after a submit attempt. */}
              {(match.dupr_submitted || match.dupr_submit_error) && (
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--tl-radius)', background: match.dupr_submitted ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)', border: '1px solid ' + (match.dupr_submitted ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'), fontSize: 12, color: match.dupr_submitted ? 'var(--tl-green)' : 'var(--tl-live)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
                  {match.dupr_submitted
                    ? (language === 'vi' ? 'DUPR ✓ ' + (match.dupr_match_code ?? '') : 'DUPR ✓ ' + (match.dupr_match_code ?? ''))
                    : (language === 'vi' ? 'DUPR ✕ ' : 'DUPR ✕ ') + (match.dupr_submit_error ?? '')}
                </div>
              )}
            </div>
          )}

          {/* Read-only notice */}
          {!canEdit && match.status !== 'completed' && (
            <div
              style={{
                ...surfaceCard,
                background: 'var(--tl-surface)',
                textAlign: 'center',
                padding: '14px 16px',
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', margin: 0 }}>
                {tx.noPermission}
              </p>
            </div>
          )}
        </section>
        <div style={{ height: 24 }} />
      </div>

      {/* Reset dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tx.resetTitle}</AlertDialogTitle>
            <AlertDialogDescription>{tx.resetDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tx.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End game / match dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBestOfMatch ? tx.endGameTitle(currentGameNumber) : tx.endMatchTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tx.endResult(teamA.team_name, localScoreA, localScoreB, teamB.team_name)}
              <br />
              {tx.winsThis(localScoreA > localScoreB ? teamA.team_name : teamB.team_name, isBestOfMatch)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tx.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={isBestOfMatch ? handleEndGame : handleEndMatchDirectly}>
              {tx.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {refereeing && refLoaded && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <RefereeScoringScreen
            loaded={refLoaded}
            vi={lang === 'vi'}
            persistKey={`de-ref:${refLoaded.matchId}`}
            onLiveScore={refLiveScore}
            onClaimLive={refClaimLive}
            onFinish={(a, b) => refFinish(a, b)}
            onBack={() => setRefereeing(false)}
          />
        </div>
      )}
    </TheLineLayout>
  );
}

