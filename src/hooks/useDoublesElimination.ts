import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Json } from '@/integrations/supabase/types';
import { generateShareId } from '@/lib/doubles-bracket-utils';
import { logMutationError } from './_mutationErrors';

const HOOK = 'useDoublesElimination';

export type TournamentStatus = 'setup' | 'registration_open' | 'ongoing' | 'completed';
export type MatchStatus = 'pending' | 'live' | 'completed';
export type RoundType = 'winner_r1' | 'loser_r2' | 'merge_r3' | 'elimination' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final';
export type BracketType = 'winner' | 'loser' | 'merged' | 'single';
export type BestOfFormat = 'bo1' | 'bo3' | 'bo5';

export type RatingSource = 'self' | 'dupr' | 'either';

export interface Tournament {
  id: string;
  name: string;
  share_id: string;
  creator_user_id: string;
  team_count: number;
  has_third_place_match: boolean;
  early_rounds_format: BestOfFormat;
  semifinals_format: BestOfFormat;
  finals_format: BestOfFormat;
  status: TournamentStatus;
  current_round: number;
  court_count: number;
  start_time: string | null;
  // DUPR Phase 1 (2026-05-29). Lowercase enum — DO NOT mix with skill_rating_system.
  rating_source: RatingSource;
  min_dupr_rating: number | null;
  max_dupr_rating: number | null;
  created_at: string;
  updated_at: string;
  creator_display_name?: string | null;
}

export type DuprSeedSource = 'exact' | 'approx' | 'none';

export interface Team {
  id: string;
  tournament_id: string;
  team_name: string;
  player1_name: string;
  player2_name: string | null;
  seed: number | null;
  // DUPR Phase 1 (2026-05-29). Nullable so legacy text-only teams stay valid.
  player1_user_id: string | null;
  player2_user_id: string | null;
  dupr_avg_rating: number | null;
  dupr_seed_source: DuprSeedSource;
  total_points_for: number;
  total_points_against: number;
  point_diff: number;
  status: string;
  eliminated_at_round: number | null;
  final_placement: number | null;
  created_at: string;
}

export interface GameScore {
  game: number;
  score_a: number;
  score_b: number;
  winner: 'a' | 'b';
}

export interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  round_type: string;
  bracket_type: string;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  best_of: number;
  games: Json;
  games_won_a: number;
  games_won_b: number;
  source_a: Json;
  source_b: Json;
  dest_winner: Json;
  dest_loser: Json;
  is_bye: boolean;
  display_order: number;
  status: string;
  live_referee_id: string | null;
  court_number: number | null;
  start_time: string | null;
  score_version: number;
  created_at: string;
  updated_at: string;
}

export interface AtomicDoublesEliminationScoreResult {
  success: boolean;
  error?: string;
  version?: number;
  currentVersion?: number;
  winnerId?: string | null;
  completed?: boolean;
  idempotent?: boolean;
}

export interface AtomicDoublesEliminationCreateTeam {
  team_name: string;
  player1_name: string;
  player2_name?: string | null;
  seed?: number | null;
  player1_user_id?: string | null;
  player2_user_id?: string | null;
  dupr_avg_rating?: number | null;
  dupr_seed_source?: DuprSeedSource;
}

export interface AtomicDoublesEliminationCreateInput {
  name: string;
  teamCount: number;
  hasThirdPlaceMatch: boolean;
  earlyRoundsFormat: BestOfFormat;
  semifinalsFormat: BestOfFormat;
  finalsFormat: BestOfFormat;
  courts?: number[];
  startTime?: string;
  ratingSource: RatingSource;
  minDuprRating?: number | null;
  maxDuprRating?: number | null;
  openRegistration: boolean;
  teams: AtomicDoublesEliminationCreateTeam[];
  seedingStrategy: 'manual' | 'random' | 'dupr';
}

export async function scoreDoublesEliminationMatchAtomic(input: {
  matchId: string;
  scoreA: number;
  scoreB: number;
  games: GameScore[];
  expectedVersion: number;
}): Promise<AtomicDoublesEliminationScoreResult> {
  const { data, error } = await supabase.rpc('score_doubles_elimination_match_atomic', {
    p_match_id: input.matchId,
    p_score_a: input.scoreA,
    p_score_b: input.scoreB,
    p_games: input.games as unknown as Json,
    p_expected_version: input.expectedVersion,
  });

  if (error) return { success: false, error: error.message };

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    success: result.success === true,
    error: typeof result.error === 'string' ? result.error : undefined,
    version: typeof result.version === 'number' ? result.version : undefined,
    currentVersion: typeof result.current_version === 'number' ? result.current_version : undefined,
    winnerId: typeof result.winner_id === 'string' ? result.winner_id : null,
    completed: typeof result.completed === 'boolean' ? result.completed : undefined,
    idempotent: typeof result.idempotent === 'boolean' ? result.idempotent : undefined,
  };
}

interface DoublesEliminationLifecycleResult {
  success: boolean;
  error?: string;
  action?: 'none' | 'r3_assigned' | 'playoff_generated';
  idempotent?: boolean;
}

async function advanceDoublesEliminationLifecycle(
  tournamentId: string,
): Promise<DoublesEliminationLifecycleResult> {
  const { data, error } = await supabase.rpc('advance_doubles_elimination_lifecycle', {
    p_tournament_id: tournamentId,
  });
  if (error) return { success: false, error: error.message };
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    success: result.success === true,
    error: typeof result.error === 'string' ? result.error : undefined,
    action: result.action === 'r3_assigned' || result.action === 'playoff_generated' || result.action === 'none'
      ? result.action
      : undefined,
    idempotent: typeof result.idempotent === 'boolean' ? result.idempotent : undefined,
  };
}

export function useDoublesElimination() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createTournamentAtomic = useCallback(async (
    input: AtomicDoublesEliminationCreateInput,
  ): Promise<{ success: boolean; tournament?: Tournament; error?: string; count?: number; quota?: number }> => {
    if (!user) return { success: false, error: 'AUTH_REQUIRED' };

    setLoading(true);
    try {
      const shareId = generateShareId();
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_doubles_elimination_atomic',
        {
          p_name: input.name,
          p_share_id: shareId,
          p_team_count: input.teamCount,
          p_has_third_place_match: input.hasThirdPlaceMatch,
          p_early_rounds_format: input.earlyRoundsFormat,
          p_semifinals_format: input.semifinalsFormat,
          p_finals_format: input.finalsFormat,
          p_court_count: input.courts?.length || 1,
          // RPC accepts NULL (checked via IS NOT NULL in the function body);
          // the generated Args type just doesn't model arg nullability.
          p_start_time: (input.startTime || null) as string,
          p_rating_source: input.ratingSource,
          p_min_dupr_rating: (input.minDuprRating ?? null) as number,
          p_max_dupr_rating: (input.maxDuprRating ?? null) as number,
          p_open_registration: input.openRegistration,
          p_teams: input.teams as unknown as Json,
          p_seeding_strategy: input.seedingStrategy,
        },
      );

      if (rpcError) throw rpcError;

      const result = rpcData as unknown as {
        success: boolean;
        error?: string;
        tournament?: Tournament;
        count?: number;
        quota?: number;
      };

      return result.success
        ? { success: true, tournament: result.tournament as Tournament, count: result.count, quota: result.quota }
        : { success: false, error: result.error || 'UNKNOWN', count: result.count, quota: result.quota };
    } catch (error: unknown) {
      console.error('[useDoublesElimination] create:', error);
      logMutationError(HOOK, 'rpc', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getTournamentByShareId = useCallback(async (shareId: string): Promise<{
    tournament: Tournament | null;
    teams: Team[];
    matches: Match[];
  }> => {
    try {
      const { data: tournament, error: tError } = await supabase
        .from('doubles_elimination_tournaments')
        .select('*')
        .eq('share_id', shareId)
        .single();

      if (tError || !tournament) return { tournament: null, teams: [], matches: [] };

      const { data: teams } = await supabase
        .from('doubles_elimination_teams')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('seed', { ascending: true });

      const { data: matches } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('display_order', { ascending: true });

      return {
        tournament: tournament as Tournament,
        teams: (teams || []) as Team[],
        matches: (matches || []) as Match[]
      };
    } catch (error) {
      logMutationError(HOOK, 'getTournamentByShareId', error);
      return { tournament: null, teams: [], matches: [] };
    }
  }, []);

  const getUserTournaments = useCallback(async (): Promise<Tournament[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('doubles_elimination_tournaments')
        .select('*')
        .eq('creator_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const creatorIds = new Set<string>();
      (data || []).forEach((t) => {
        if (t.creator_user_id) creatorIds.add(t.creator_user_id);
      });

      const profilesMap = new Map<string, { display_name: string | null }>();
      if (creatorIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('public_profiles')
          .select('id, display_name')
          .in('id', Array.from(creatorIds));

        if (profilesData) {
          profilesData.forEach(p => { if (p.id) profilesMap.set(p.id, { display_name: p.display_name }); });
        }
      }

      return (data || []).map((t) => {
        const profile = profilesMap.get(t.creator_user_id || '');
        return {
          ...t,
          creator_display_name: profile?.display_name,
        } as Tournament;
      });
    } catch (error) {
      logMutationError(HOOK, 'getUserTournaments', error);
      return [];
    }
  }, [user]);

  const deleteTournament = useCallback(async (tournamentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('doubles_elimination_tournaments')
        .delete()
        .eq('id', tournamentId);
      if (error) throw error;
      return { success: true };
    } catch (error: unknown) {
      logMutationError(HOOK, 'rpc', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }, []);

  const checkAndAssignR3 = useCallback(async (
    tournamentId: string
  ): Promise<{
    success: boolean;
    triggered: boolean;
    tiedTeamsInfo?: { count: number; names: string[] };
    error?: string;
  }> => {
    const result = await advanceDoublesEliminationLifecycle(tournamentId);
    return {
      success: result.success,
      triggered: result.success && result.action === 'r3_assigned',
      error: result.error,
    };
  }, []);

  const checkAndGeneratePlayoff = useCallback(async (
    tournamentId: string
  ): Promise<{ success: boolean; generated: boolean; error?: string }> => {
    const result = await advanceDoublesEliminationLifecycle(tournamentId);
    return {
      success: result.success,
      generated: result.success && result.action === 'playoff_generated',
      error: result.error,
    };
  }, []);
  // Sprint E.3 (2026-05-29) — open-registration RPC wrappers.
  const registerTeam = useCallback(async (
    tournamentId: string,
    partnerUserId: string,
    teamName?: string,
  ): Promise<{ success: boolean; error?: string; teamId?: string; duprAvg?: number; count?: number; capacity?: number; extra?: Record<string, unknown> }> => {
    const { data, error } = await supabase.rpc('register_team_for_doubles_elimination', {
      p_tournament_id: tournamentId,
      p_partner_user_id: partnerUserId,
      p_team_name: teamName,
    });
    if (error) return { success: false, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    if (!r.success) {
      return {
        success: false,
        error: typeof r.error === 'string' ? r.error : 'UNKNOWN',
        extra: r,
      };
    }
    return {
      success: true,
      teamId: typeof r.team_id === 'string' ? r.team_id : undefined,
      duprAvg: typeof r.dupr_avg === 'number' ? r.dupr_avg : typeof r.dupr_avg === 'string' ? parseFloat(r.dupr_avg) : undefined,
      count: typeof r.count === 'number' ? r.count : undefined,
      capacity: typeof r.capacity === 'number' ? r.capacity : undefined,
    };
  }, []);

  const cancelTeamRegistration = useCallback(async (tournamentId: string): Promise<{ success: boolean; error?: string; deleted?: number }> => {
    const { data, error } = await supabase.rpc('cancel_doubles_elimination_team_registration', {
      p_tournament_id: tournamentId,
    });
    if (error) return { success: false, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    return r.success
      ? { success: true, deleted: typeof r.deleted === 'number' ? r.deleted : 0 }
      : { success: false, error: typeof r.error === 'string' ? r.error : 'UNKNOWN' };
  }, []);

  const organizerAddTeam = useCallback(async (
    tournamentId: string,
    player1UserId: string,
    player2UserId: string,
    teamName?: string,
  ): Promise<{ success: boolean; error?: string; teamId?: string; duprAvg?: number; count?: number; capacity?: number }> => {
    const { data, error } = await supabase.rpc('organizer_add_team_to_doubles_elimination', {
      p_tournament_id: tournamentId,
      p_player1_user_id: player1UserId,
      p_player2_user_id: player2UserId,
      p_team_name: teamName,
    });
    if (error) return { success: false, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    if (!r.success) {
      return { success: false, error: typeof r.error === 'string' ? r.error : 'UNKNOWN' };
    }
    return {
      success: true,
      teamId: typeof r.team_id === 'string' ? r.team_id : undefined,
      duprAvg: typeof r.dupr_avg === 'number' ? r.dupr_avg : typeof r.dupr_avg === 'string' ? parseFloat(r.dupr_avg) : undefined,
      count: typeof r.count === 'number' ? r.count : undefined,
      capacity: typeof r.capacity === 'number' ? r.capacity : undefined,
    };
  }, []);

  const organizerRemoveTeam = useCallback(async (tournamentId: string, teamId: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('organizer_remove_team_from_doubles_elimination', {
      p_tournament_id: tournamentId,
      p_team_id: teamId,
    });
    if (error) return { success: false, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    return r.success
      ? { success: true }
      : { success: false, error: typeof r.error === 'string' ? r.error : 'UNKNOWN' };
  }, []);

  const closeRegistration = useCallback(async (tournamentId: string): Promise<{ success: boolean; error?: string; count?: number }> => {
    const { data, error } = await supabase.rpc('close_doubles_elimination_registration', {
      p_tournament_id: tournamentId,
    });
    if (error) return { success: false, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    return r.success
      ? { success: true, count: typeof r.count === 'number' ? r.count : undefined }
      : { success: false, error: typeof r.error === 'string' ? r.error : 'UNKNOWN' };
  }, []);

  return {
    loading,
    createTournamentAtomic,
    registerTeam,
    cancelTeamRegistration,
    organizerAddTeam,
    organizerRemoveTeam,
    closeRegistration,
    getTournamentByShareId,
    getUserTournaments,
    deleteTournament,
    checkAndAssignR3,
    checkAndGeneratePlayoff
  };
}
