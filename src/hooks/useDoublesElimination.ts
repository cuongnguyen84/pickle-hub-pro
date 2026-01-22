import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Json } from '@/integrations/supabase/types';

export type TournamentStatus = 'setup' | 'ongoing' | 'completed';
export type MatchStatus = 'pending' | 'live' | 'completed';
export type RoundType = 'winner_r1' | 'loser_r2' | 'merge_r3' | 'elimination' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final';
export type BracketType = 'winner' | 'loser' | 'merged' | 'single';
export type BestOfFormat = 'bo1' | 'bo3' | 'bo5';

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
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  tournament_id: string;
  team_name: string;
  player1_name: string;
  player2_name: string | null;
  seed: number | null;
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
  created_at: string;
  updated_at: string;
}

// Helper to find next power of 2
function nextPowerOf2(n: number): number {
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

// Helper to get best_of value based on round type
function getBestOfForRound(
  roundType: RoundType, 
  earlyFormat: BestOfFormat, 
  semifinalsFormat: BestOfFormat,
  finalsFormat: BestOfFormat
): number {
  if (roundType === 'final' || roundType === 'third_place') {
    return finalsFormat === 'bo5' ? 5 : finalsFormat === 'bo3' ? 3 : 1;
  }
  
  if (roundType === 'semifinal') {
    return semifinalsFormat === 'bo5' ? 5 : semifinalsFormat === 'bo3' ? 3 : 1;
  }
  
  switch (earlyFormat) {
    case 'bo5': return 5;
    case 'bo3': return 3;
    default: return 1;
  }
}

export function useDoublesElimination() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Generate random share ID
  const generateShareId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Create tournament
  const createTournament = useCallback(async (
    name: string,
    teamCount: number,
    hasThirdPlaceMatch: boolean,
    earlyRoundsFormat: BestOfFormat,
    finalsFormat: BestOfFormat,
    courtCount: number = 1,
    startTime?: string,
    semifinalsFormat?: BestOfFormat
  ): Promise<{ success: boolean; tournament?: Tournament; error?: string }> => {
    if (!user) return { success: false, error: 'AUTH_REQUIRED' };
    
    setLoading(true);
    try {
      const shareId = generateShareId();
      
      const { data, error } = await supabase
        .from('doubles_elimination_tournaments')
        .insert({
          name,
          share_id: shareId,
          creator_user_id: user.id,
          team_count: teamCount,
          has_third_place_match: hasThirdPlaceMatch,
          early_rounds_format: earlyRoundsFormat,
          semifinals_format: semifinalsFormat || finalsFormat,
          finals_format: finalsFormat,
          court_count: courtCount,
          start_time: startTime || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, tournament: data as Tournament };
    } catch (error: any) {
      console.error('Create tournament error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add teams to tournament
  const addTeams = useCallback(async (
    tournamentId: string,
    teams: Array<{ team_name: string; player1_name: string; player2_name?: string; seed?: number }>
  ): Promise<{ success: boolean; teams?: Team[]; error?: string }> => {
    setLoading(true);
    try {
      const teamsWithTournament = teams.map((t, index) => ({
        tournament_id: tournamentId,
        team_name: t.team_name,
        player1_name: t.player1_name,
        player2_name: t.player2_name || null,
        seed: t.seed ?? (index + 1)
      }));
      
      const { data, error } = await supabase
        .from('doubles_elimination_teams')
        .insert(teamsWithTournament)
        .select();
      
      if (error) throw error;
      return { success: true, teams: data as Team[] };
    } catch (error: any) {
      console.error('Add teams error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate bracket - CORE ALGORITHM
  const generateBracket = useCallback(async (
    tournamentId: string
  ): Promise<{ success: boolean; matches?: Match[]; error?: string }> => {
    setLoading(true);
    try {
      // Fetch tournament and teams
      const { data: tournament, error: tError } = await supabase
        .from('doubles_elimination_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
      
      if (tError) throw tError;
      
      const { data: teams, error: teamsError } = await supabase
        .from('doubles_elimination_teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true });
      
      if (teamsError) throw teamsError;
      
      const N = teams.length;
      const earlyFormat = (tournament.early_rounds_format || 'bo1') as BestOfFormat;
      const semifinalsFormat = (tournament.semifinals_format || 'bo3') as BestOfFormat;
      const finalsFormat = (tournament.finals_format || 'bo3') as BestOfFormat;
      
      const matches: any[] = [];
      let displayOrder = 0;
      
      // ROUND 1: All teams play (Winner Bracket)
      const r1MatchCount = Math.floor(N / 2);
      const r1Matches: { tempId: string; teamAIndex: number; teamBIndex: number }[] = [];
      
      // Seed pairing: 1 vs N, 2 vs N-1, etc.
      for (let i = 0; i < r1MatchCount; i++) {
        const teamAIndex = i;
        const teamBIndex = N - 1 - i;
        const tempId = `r1_${i}`;
        
        r1Matches.push({ tempId, teamAIndex, teamBIndex });
        
        matches.push({
          tournament_id: tournamentId,
          round_number: 1,
          round_type: 'winner_r1',
          bracket_type: 'winner',
          match_number: i + 1,
          team_a_id: teams[teamAIndex].id,
          team_b_id: teams[teamBIndex].id,
          score_a: 0,
          score_b: 0,
          winner_id: null,
          best_of: getBestOfForRound('winner_r1', earlyFormat, semifinalsFormat, finalsFormat),
          games: [],
          games_won_a: 0,
          games_won_b: 0,
          source_a: { type: 'seed', seed: teamAIndex + 1 },
          source_b: { type: 'seed', seed: teamBIndex + 1 },
          dest_winner: null, // Will be linked later
          dest_loser: null, // Will be linked later
          is_bye: false,
          display_order: displayOrder++,
          status: 'pending',
          live_referee_id: null,
          court_number: null,
          start_time: null
        });
      }
      
      // Handle odd team (bye to R3)
      let byeTeamFromR1: Team | null = null;
      if (N % 2 === 1) {
        byeTeamFromR1 = teams[Math.floor(N / 2)]; // Middle seed gets bye
      }
      
      // ROUND 2: Losers from R1 play (Loser Bracket)
      const r2MatchCount = Math.floor(r1MatchCount / 2);
      
      for (let i = 0; i < r2MatchCount; i++) {
        matches.push({
          tournament_id: tournamentId,
          round_number: 2,
          round_type: 'loser_r2',
          bracket_type: 'loser',
          match_number: i + 1,
          team_a_id: null, // Loser from R1 match 2i
          team_b_id: null, // Loser from R1 match 2i+1
          score_a: 0,
          score_b: 0,
          winner_id: null,
          best_of: getBestOfForRound('loser_r2', earlyFormat, semifinalsFormat, finalsFormat),
          games: [],
          games_won_a: 0,
          games_won_b: 0,
          source_a: { type: 'loser_of', match_id: `r1_${i * 2}` },
          source_b: { type: 'loser_of', match_id: `r1_${i * 2 + 1}` },
          dest_winner: null,
          dest_loser: { type: 'ELIMINATED' },
          is_bye: false,
          display_order: displayOrder++,
          status: 'pending',
          live_referee_id: null,
          court_number: null,
          start_time: null
        });
      }
      
      // Handle odd loser from R1 (bye to R3)
      let byeFromR2 = r1MatchCount % 2 === 1;
      
      // Calculate teams entering R3
      const winnersFromR1 = r1MatchCount + (byeTeamFromR1 ? 1 : 0);
      const winnersFromR2 = r2MatchCount + (byeFromR2 ? 1 : 0);
      const teamsEnteringR3 = winnersFromR1 + winnersFromR2;
      
      // ROUND 3: Merge Round - normalize to power of 2
      const targetR4 = nextPowerOf2(Math.floor(teamsEnteringR3 / 2));
      const actualTarget = targetR4 > teamsEnteringR3 ? targetR4 / 2 : targetR4;
      const excess = teamsEnteringR3 - actualTarget;
      const r3Matches = excess; // Number of matches needed
      const byesToR4 = teamsEnteringR3 - (r3Matches * 2);
      
      for (let i = 0; i < r3Matches; i++) {
        matches.push({
          tournament_id: tournamentId,
          round_number: 3,
          round_type: 'merge_r3',
          bracket_type: 'merged',
          match_number: i + 1,
          team_a_id: null,
          team_b_id: null,
          score_a: 0,
          score_b: 0,
          winner_id: null,
          best_of: getBestOfForRound('merge_r3', earlyFormat, semifinalsFormat, finalsFormat),
          games: [],
          games_won_a: 0,
          games_won_b: 0,
          source_a: { type: 'winner_of', match_id: `r1_${i}` },
          source_b: { type: 'winner_of', match_id: `r2_${i}` },
          dest_winner: null,
          dest_loser: { type: 'ELIMINATED' },
          is_bye: false,
          display_order: displayOrder++,
          status: 'pending',
          live_referee_id: null,
          court_number: null,
          start_time: null
        });
      }
      
      // ROUND 4+: Single Elimination
      let currentRound = 4;
      let teamsInRound = actualTarget;
      
      while (teamsInRound > 1) {
        const matchesInRound = teamsInRound / 2;
        let roundType: RoundType = 'elimination';
        
        if (teamsInRound === 8) roundType = 'quarterfinal';
        else if (teamsInRound === 4) roundType = 'semifinal';
        else if (teamsInRound === 2) roundType = 'final';
        
        for (let i = 0; i < matchesInRound; i++) {
          matches.push({
            tournament_id: tournamentId,
            round_number: currentRound,
            round_type: roundType,
            bracket_type: 'single',
            match_number: i + 1,
            team_a_id: null,
            team_b_id: null,
            score_a: 0,
            score_b: 0,
            winner_id: null,
            best_of: getBestOfForRound(roundType, earlyFormat, semifinalsFormat, finalsFormat),
            games: [],
            games_won_a: 0,
            games_won_b: 0,
            source_a: { type: 'winner_of', match_id: `r${currentRound - 1}_${i * 2}` },
            source_b: { type: 'winner_of', match_id: `r${currentRound - 1}_${i * 2 + 1}` },
            dest_winner: teamsInRound === 2 ? { type: 'CHAMPION' } : null,
            dest_loser: { type: 'ELIMINATED' },
            is_bye: false,
            display_order: displayOrder++,
            status: 'pending',
            live_referee_id: null,
            court_number: null,
            start_time: null
          });
        }
        
        teamsInRound = matchesInRound;
        currentRound++;
      }
      
      // Third place match (if enabled)
      if (tournament.has_third_place_match) {
        matches.push({
          tournament_id: tournamentId,
          round_number: currentRound - 1, // Same round as final
          round_type: 'third_place',
          bracket_type: 'single',
          match_number: 1,
          team_a_id: null,
          team_b_id: null,
          score_a: 0,
          score_b: 0,
          winner_id: null,
          best_of: getBestOfForRound('third_place', earlyFormat, semifinalsFormat, finalsFormat),
          games: [],
          games_won_a: 0,
          games_won_b: 0,
          source_a: { type: 'loser_of', match_id: 'semifinal_0' },
          source_b: { type: 'loser_of', match_id: 'semifinal_1' },
          dest_winner: null,
          dest_loser: null,
          is_bye: false,
          display_order: displayOrder++,
          status: 'pending',
          live_referee_id: null,
          court_number: null,
          start_time: null
        });
      }
      
      // Insert all matches
      const { data: insertedMatches, error: insertError } = await supabase
        .from('doubles_elimination_matches')
        .insert(matches)
        .select();
      
      if (insertError) throw insertError;
      
      // Update tournament status
      await supabase
        .from('doubles_elimination_tournaments')
        .update({ status: 'ongoing', current_round: 1 })
        .eq('id', tournamentId);
      
      return { success: true, matches: insertedMatches as Match[] };
    } catch (error: any) {
      console.error('Generate bracket error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get tournament by share ID
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
      
      if (tError || !tournament) {
        return { tournament: null, teams: [], matches: [] };
      }
      
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
      console.error('Get tournament error:', error);
      return { tournament: null, teams: [], matches: [] };
    }
  }, []);

  // Get user's tournaments
  const getUserTournaments = useCallback(async (): Promise<Tournament[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('doubles_elimination_tournaments')
        .select('*')
        .eq('creator_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Tournament[];
    } catch (error) {
      console.error('Get user tournaments error:', error);
      return [];
    }
  }, [user]);

  // Update match score (for BO1)
  const updateMatchScore = useCallback(async (
    matchId: string,
    scoreA: number,
    scoreB: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('doubles_elimination_matches')
        .update({ score_a: scoreA, score_b: scoreB, status: 'live' })
        .eq('id', matchId);
      
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  // Add game score (for BO3/BO5)
  const addGameScore = useCallback(async (
    matchId: string,
    gameNumber: number,
    scoreA: number,
    scoreB: number
  ): Promise<{ success: boolean; matchCompleted?: boolean; error?: string }> => {
    try {
      // Fetch current match
      const { data: match, error: fetchError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const games = (Array.isArray(match.games) ? match.games : []) as unknown as GameScore[];
      const newGame = {
        game: gameNumber,
        score_a: scoreA,
        score_b: scoreB,
        winner: scoreA > scoreB ? 'a' : 'b'
      };
      
      const updatedGames = [...games, newGame];
      
      const winsA = updatedGames.filter((g) => g.winner === 'a').length;
      const winsB = updatedGames.filter((g) => g.winner === 'b').length;
      const winsNeeded = Math.ceil(match.best_of / 2);
      
      const isCompleted = winsA >= winsNeeded || winsB >= winsNeeded;
      
      const { error: updateError } = await supabase
        .from('doubles_elimination_matches')
        .update({
          games: updatedGames as unknown as Json,
          games_won_a: winsA,
          games_won_b: winsB,
          status: isCompleted ? 'completed' : 'live'
        })
        .eq('id', matchId);
      
      if (updateError) throw updateError;
      
      return { success: true, matchCompleted: isCompleted };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  // End match and advance winner
  const endMatch = useCallback(async (
    matchId: string,
    winnerId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Fetch match
      const { data: match, error: fetchError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const loserId = match.team_a_id === winnerId ? match.team_b_id : match.team_a_id;
      
      // Update match as completed
      const { error: updateError } = await supabase
        .from('doubles_elimination_matches')
        .update({
          winner_id: winnerId,
          status: 'completed'
        })
        .eq('id', matchId);
      
      if (updateError) throw updateError;
      
      // Handle loser based on round
      if (match.round_type === 'winner_r1' && loserId) {
        // Loser goes to R2 - handled by dest_loser linking
      } else if (loserId) {
        // Loser eliminated (R2+)
        await supabase
          .from('doubles_elimination_teams')
          .update({
            status: 'eliminated',
            eliminated_at_round: match.round_number
          })
          .eq('id', loserId);
      }
      
      // Advance winner to next match (if dest_winner exists)
      // This would be handled by realtime triggers or explicit linking
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  // Delete tournament
  const deleteTournament = useCallback(async (tournamentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('doubles_elimination_tournaments')
        .delete()
        .eq('id', tournamentId);
      
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  return {
    loading,
    createTournament,
    addTeams,
    generateBracket,
    getTournamentByShareId,
    getUserTournaments,
    updateMatchScore,
    addGameScore,
    endMatch,
    deleteTournament
  };
}
