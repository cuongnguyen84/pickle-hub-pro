import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Json } from '@/integrations/supabase/types';
import { parseCourtsInput } from '@/lib/round-robin';

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
    courts: number[] = [],
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
          court_count: courts.length || 1,
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
      const teamsWithTournament = teams.map((t) => ({
        tournament_id: tournamentId,
        team_name: t.team_name,
        player1_name: t.player1_name,
        player2_name: t.player2_name || null,
        seed: t.seed || null // Only set seed if provided, otherwise null
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
  // Round 1: RANDOM matchups (no seeding)
  // Round 3+: Use seeds to assign byes, ensure seeds 1&2 only meet in final
  const generateBracket = useCallback(async (
    tournamentId: string,
    courtsInput?: number[]
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
      
      const { data: teamsData, error: teamsError } = await supabase
        .from('doubles_elimination_teams')
        .select('*')
        .eq('tournament_id', tournamentId);
      
      if (teamsError) throw teamsError;
      
      // Shuffle teams for Round 1 (random matchups)
      const shuffledTeams = [...teamsData].sort(() => Math.random() - 0.5);
      
      const N = shuffledTeams.length;
      const earlyFormat = (tournament.early_rounds_format || 'bo1') as BestOfFormat;
      const semifinalsFormat = (tournament.semifinals_format || 'bo3') as BestOfFormat;
      const finalsFormat = (tournament.finals_format || 'bo3') as BestOfFormat;
      
      const matches: any[] = [];
      let displayOrder = 0;
      
      // ROUND 1: Random matchups (shuffled teams)
      const r1MatchCount = Math.floor(N / 2);
      
      for (let i = 0; i < r1MatchCount; i++) {
        const teamAIndex = i * 2;
        const teamBIndex = i * 2 + 1;
        
        matches.push({
          tournament_id: tournamentId,
          round_number: 1,
          round_type: 'winner_r1',
          bracket_type: 'winner',
          match_number: i + 1,
          team_a_id: shuffledTeams[teamAIndex].id,
          team_b_id: shuffledTeams[teamBIndex].id,
          score_a: 0,
          score_b: 0,
          winner_id: null,
          best_of: getBestOfForRound('winner_r1', earlyFormat, semifinalsFormat, finalsFormat),
          games: [],
          games_won_a: 0,
          games_won_b: 0,
          source_a: { type: 'team', team_id: shuffledTeams[teamAIndex].id },
          source_b: { type: 'team', team_id: shuffledTeams[teamBIndex].id },
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
      
      // Handle odd team (bye to R3)
      let byeTeamFromR1: typeof teamsData[0] | null = null;
      if (N % 2 === 1) {
        byeTeamFromR1 = shuffledTeams[N - 1]; // Last team in shuffle gets bye
      }
      
      // ROUND 2: Losers from R1 play (Loser Bracket) - RANDOMIZED pairings
      const r2MatchCount = Math.floor(r1MatchCount / 2);
      
      // Create array of R1 match indices and shuffle for random loser pairings
      const r1MatchIndices = Array.from({ length: r1MatchCount }, (_, i) => i);
      const shuffledLoserIndices = [...r1MatchIndices].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < r2MatchCount; i++) {
        // Random pairing from shuffled indices
        const loserAIndex = shuffledLoserIndices[i * 2];
        const loserBIndex = shuffledLoserIndices[i * 2 + 1];
        
        matches.push({
          tournament_id: tournamentId,
          round_number: 2,
          round_type: 'loser_r2',
          bracket_type: 'loser',
          match_number: i + 1,
          team_a_id: null, // Loser from random R1 match
          team_b_id: null, // Loser from another random R1 match
          score_a: 0,
          score_b: 0,
          winner_id: null,
          best_of: getBestOfForRound('loser_r2', earlyFormat, semifinalsFormat, finalsFormat),
          games: [],
          games_won_a: 0,
          games_won_b: 0,
          source_a: { type: 'loser_of', match_index: loserAIndex },
          source_b: { type: 'loser_of', match_index: loserBIndex },
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
      const byeFromR2 = r1MatchCount % 2 === 1;
      
      // Calculate teams entering R3 (T3)
      const winnersFromR1 = r1MatchCount + (byeTeamFromR1 ? 1 : 0);
      const winnersFromR2 = r2MatchCount + (byeFromR2 ? 1 : 0);
      const T3 = winnersFromR1 + winnersFromR2;
      
      // ROUND 3: Normalize to power of 2 by Round 4
      // Formula: R4 = 2^floor(log2(T3)), Byes to R4 = 2 × R4 - T3
      const R4 = Math.pow(2, Math.floor(Math.log2(T3)));
      const byesToR4 = 2 * R4 - T3;
      // Teams that play in R3 = T3 - byesToR4
      // R3 matches = (T3 - byesToR4) / 2
      const teamsPlayingR3 = T3 - byesToR4;
      const r3Matches = Math.floor(teamsPlayingR3 / 2);
      
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
          source_a: { type: 'winner_of', round: 1, match_index: i },
          source_b: { type: 'winner_of', round: 2, match_index: i },
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
      
      // ROUND 4+: Single Elimination with proper seeding
      // Seeds 1 and 2 should be placed on opposite halves of bracket
      let currentRound = 4;
      let teamsInRound = R4;
      
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
            source_a: { type: 'winner_of', round: currentRound - 1, match_index: i * 2 },
            source_b: { type: 'winner_of', round: currentRound - 1, match_index: i * 2 + 1 },
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
          round_number: currentRound - 1,
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
          source_a: { type: 'loser_of', round_type: 'semifinal', match_index: 0 },
          source_b: { type: 'loser_of', round_type: 'semifinal', match_index: 1 },
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
      
      // Assign courts and times ONLY to Round 1 and Round 2 matches
      // Round 3 and Playoff will get times dynamically when the previous round completes
      const courts = courtsInput && courtsInput.length > 0 
        ? courtsInput 
        : tournament.court_count > 0 
          ? Array.from({ length: tournament.court_count }, (_, i) => i + 1)
          : [];
      
      if (courts.length > 0 && tournament.start_time) {
        const startTime = tournament.start_time;
        const matchDurationMinutes = 20;

        // Track court usage for time calculation
        const courtNextSlot = new Map<number, number>();
        courts.forEach(c => courtNextSlot.set(c, 0));

        // Parse start time
        const [startHour, startMinute] = startTime.split(':').map((s: string) => parseInt(s, 10));
        const validStartTime = !isNaN(startHour) && !isNaN(startMinute);

        // Filter only Round 1 and Round 2 matches for initial scheduling
        const r1r2Matches = matches.filter(m => m.round_number === 1 || m.round_number === 2);

        // Assign courts and times to R1 & R2 matches sequentially
        for (const match of r1r2Matches) {
          // Find court with minimum load (earliest next available slot)
          const minSlot = Math.min(...Array.from(courtNextSlot.values()));
          const availableCourt = courts.find(c => courtNextSlot.get(c) === minSlot) || courts[0];

          match.court_number = availableCourt;

          if (validStartTime) {
            const slotIdx = courtNextSlot.get(availableCourt) || 0;
            const totalMinutes = startHour * 60 + startMinute + slotIdx * matchDurationMinutes;
            const hour = Math.floor(totalMinutes / 60) % 24;
            const minute = totalMinutes % 60;
            match.start_time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          }

          courtNextSlot.set(availableCourt, (courtNextSlot.get(availableCourt) || 0) + 1);
        }
        
        // R3 and R4+ matches will NOT have court/time assigned here
        // They will be assigned dynamically when checkAndAssignR3 is called
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

  // Calculate point differential and auto-assign R3/R4 after R2 completes
  // Returns info about tied teams if random selection was used
  const calculateR3Assignments = useCallback(async (
    tournamentId: string,
    matches: Match[],
    teams: Team[]
  ): Promise<{ 
    success: boolean; 
    r3Teams?: string[]; 
    r4Teams?: string[];
    tiedTeamsInfo?: { count: number; names: string[] };
    error?: string 
  }> => {
    try {
      // Get all completed R1 and R2 matches
      const r1Matches = matches.filter(m => m.round_number === 1 && m.status === 'completed');
      const r2Matches = matches.filter(m => m.round_number === 2 && m.status === 'completed');
      
      // Check if all R1 and R2 matches are completed
      const allR1Matches = matches.filter(m => m.round_number === 1);
      const allR2Matches = matches.filter(m => m.round_number === 2);
      
      if (r1Matches.length !== allR1Matches.length || r2Matches.length !== allR2Matches.length) {
        return { success: false, error: 'NOT_ALL_MATCHES_COMPLETED' };
      }

      // Calculate point differential for each surviving team
      // For teams that played in both R1 and R2, only use R2 results
      interface TeamDiff {
        teamId: string;
        teamName: string;
        pointDiff: number;
        playedR2: boolean;
      }

      const teamDiffs: TeamDiff[] = [];

      // R1 winners (those who did NOT play in R2 - they won R1 and their opponent went to R2)
      r1Matches.forEach(match => {
        const winnerId = match.winner_id;
        if (!winnerId) return;

        // Check if this winner also played in R2 (they wouldn't be in R2, only losers are)
        // R1 winners don't play R2, they wait for R3/R4
        const winnerTeam = teams.find(t => t.id === winnerId);
        if (!winnerTeam) return;

        // Calculate point diff from R1
        const isTeamA = match.team_a_id === winnerId;
        const pointsFor = isTeamA ? match.score_a : match.score_b;
        const pointsAgainst = isTeamA ? match.score_b : match.score_a;

        teamDiffs.push({
          teamId: winnerId,
          teamName: winnerTeam.team_name,
          pointDiff: pointsFor - pointsAgainst,
          playedR2: false
        });
      });

      // R2 winners (losers from R1 who won R2 - use only R2 results)
      r2Matches.forEach(match => {
        const winnerId = match.winner_id;
        if (!winnerId) return;

        const winnerTeam = teams.find(t => t.id === winnerId);
        if (!winnerTeam) return;

        // Calculate point diff from R2 ONLY (ignore their R1 loss)
        const isTeamA = match.team_a_id === winnerId;
        const pointsFor = isTeamA ? match.score_a : match.score_b;
        const pointsAgainst = isTeamA ? match.score_b : match.score_a;

        teamDiffs.push({
          teamId: winnerId,
          teamName: winnerTeam.team_name,
          pointDiff: pointsFor - pointsAgainst,
          playedR2: true
        });
      });

      // Check for bye team from R1 (odd number of teams)
      const r1MatchTeams = new Set<string>();
      r1Matches.forEach(m => {
        if (m.team_a_id) r1MatchTeams.add(m.team_a_id);
        if (m.team_b_id) r1MatchTeams.add(m.team_b_id);
      });
      
      // Teams that didn't play in R1 get a bye (point diff = 0)
      teams.forEach(team => {
        if (!r1MatchTeams.has(team.id) && team.status !== 'eliminated') {
          teamDiffs.push({
            teamId: team.id,
            teamName: team.team_name,
            pointDiff: 0, // Bye teams have 0 diff
            playedR2: false
          });
        }
      });

      // Sort by point differential (highest = best)
      teamDiffs.sort((a, b) => b.pointDiff - a.pointDiff);

      // Determine how many teams go to R3 vs R4
      const r3MatchesNeeded = matches.filter(m => m.round_number === 3).length;
      const teamsNeededForR3 = r3MatchesNeeded * 2;
      const teamsForR4 = teamDiffs.length - teamsNeededForR3;

      // Check for ties at the cutoff point
      let tiedTeamsInfo: { count: number; names: string[] } | undefined;

      if (teamsNeededForR3 > 0 && teamDiffs.length >= teamsNeededForR3) {
        const cutoffDiff = teamDiffs[teamsForR4 - 1]?.pointDiff;
        const teamsAtCutoff = teamDiffs.filter(t => t.pointDiff === cutoffDiff);
        
        if (teamsAtCutoff.length > 1) {
          // There are ties at the cutoff - need to randomly select
          tiedTeamsInfo = {
            count: teamsAtCutoff.length,
            names: teamsAtCutoff.map(t => t.teamName)
          };

          // Separate teams above cutoff, at cutoff, and below cutoff
          const aboveCutoff = teamDiffs.filter(t => t.pointDiff > cutoffDiff);
          const atCutoff = teamDiffs.filter(t => t.pointDiff === cutoffDiff);
          const belowCutoff = teamDiffs.filter(t => t.pointDiff < cutoffDiff);

          // Shuffle teams at cutoff for random selection
          const shuffledAtCutoff = [...atCutoff].sort(() => Math.random() - 0.5);

          // Recalculate how many we need from the tied group for R4
          const r4SlotsLeft = teamsForR4 - aboveCutoff.length;
          const r4FromTied = shuffledAtCutoff.slice(0, r4SlotsLeft);
          const r3FromTied = shuffledAtCutoff.slice(r4SlotsLeft);

          // Rebuild the sorted list
          teamDiffs.length = 0;
          teamDiffs.push(...aboveCutoff, ...r4FromTied, ...r3FromTied, ...belowCutoff);
        }
      }

      // Teams going to R4 (top performers - bye to R4)
      const r4TeamIds = teamDiffs.slice(0, teamsForR4).map(t => t.teamId);
      
      // Teams going to R3 (bottom performers - must play R3)
      const r3TeamIds = teamDiffs.slice(teamsForR4).map(t => t.teamId);

      // Shuffle R3 teams for random pairing
      const shuffledR3Teams = [...r3TeamIds].sort(() => Math.random() - 0.5);

      // Get R3 matches and assign teams + court/time scheduling
      const r3Matches = matches.filter(m => m.round_number === 3);
      
      // Calculate R3 start time: system time + 15 minutes
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      const r3StartHour = now.getHours();
      const r3StartMinute = now.getMinutes();
      
      // Get courts from tournament (reset from court 1)
      const { data: tournamentData } = await supabase
        .from('doubles_elimination_tournaments')
        .select('court_count')
        .eq('id', tournamentId)
        .single();
      
      const courtCount = tournamentData?.court_count || 4;
      const courts = Array.from({ length: courtCount }, (_, i) => i + 1);
      const matchDurationMinutes = 20;
      
      // Track court usage for R3
      const courtNextSlot = new Map<number, number>();
      courts.forEach(c => courtNextSlot.set(c, 0));
      
      for (let i = 0; i < r3Matches.length; i++) {
        const match = r3Matches[i];
        const teamAId = shuffledR3Teams[i * 2];
        const teamBId = shuffledR3Teams[i * 2 + 1];

        // Assign court and time
        const minSlot = Math.min(...Array.from(courtNextSlot.values()));
        const availableCourt = courts.find(c => courtNextSlot.get(c) === minSlot) || courts[0];
        const slotIdx = courtNextSlot.get(availableCourt) || 0;
        const totalMinutes = r3StartHour * 60 + r3StartMinute + slotIdx * matchDurationMinutes;
        const hour = Math.floor(totalMinutes / 60) % 24;
        const minute = totalMinutes % 60;
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        courtNextSlot.set(availableCourt, slotIdx + 1);

        if (teamAId && teamBId) {
          await supabase
            .from('doubles_elimination_matches')
            .update({
              team_a_id: teamAId,
              team_b_id: teamBId,
              court_number: availableCourt,
              start_time: startTime
            })
            .eq('id', match.id);
        }
      }
      
      // Also schedule R4 (playoff) matches with times starting after R3
      // Calculate R4 start based on when R3 would finish
      const maxR3Slots = Math.max(...Array.from(courtNextSlot.values()));
      const r4StartMinutes = r3StartHour * 60 + r3StartMinute + maxR3Slots * matchDurationMinutes + 15; // +15 min buffer
      const r4StartHour = Math.floor(r4StartMinutes / 60) % 24;
      const r4StartMinute = r4StartMinutes % 60;

      // For R4, we need to assign byes - teams go directly to R4
      // Get R4 matches and assign teams (with proper bracket positioning) + court/time
      const r4Matches = matches.filter(m => m.round_number === 4);
      
      // Reset court slots for R4
      const r4CourtNextSlot = new Map<number, number>();
      courts.forEach(c => r4CourtNextSlot.set(c, 0));
      
      // Simple assignment: fill R4 slots with R4 teams
      // Seeds 1 and 2 should be at opposite ends (if using seeds)
      const sortedR4Teams = [...r4TeamIds];
      
      for (let i = 0; i < r4Matches.length; i++) {
        const match = r4Matches[i];
        const teamAId = sortedR4Teams[i * 2];
        const teamBId = sortedR4Teams[i * 2 + 1];

        // Assign court and time for R4
        const minSlot = Math.min(...Array.from(r4CourtNextSlot.values()));
        const availableCourt = courts.find(c => r4CourtNextSlot.get(c) === minSlot) || courts[0];
        const slotIdx = r4CourtNextSlot.get(availableCourt) || 0;
        const totalMinutes = r4StartHour * 60 + r4StartMinute + slotIdx * matchDurationMinutes;
        const hour = Math.floor(totalMinutes / 60) % 24;
        const minute = totalMinutes % 60;
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        r4CourtNextSlot.set(availableCourt, slotIdx + 1);

        const updateData: Record<string, string | number | null> = {
          court_number: availableCourt,
          start_time: startTime
        };
        if (teamAId) updateData.team_a_id = teamAId;
        if (teamBId) updateData.team_b_id = teamBId;

        await supabase
          .from('doubles_elimination_matches')
          .update(updateData)
          .eq('id', match.id);
      }
      
      // Also schedule subsequent playoff rounds (R5+, semifinals, finals, third place)
      const laterRounds = matches.filter(m => 
        m.round_number > 4 || 
        m.round_type === 'semifinal' || 
        m.round_type === 'final' || 
        m.round_type === 'third_place'
      );
      
      if (laterRounds.length > 0) {
        // Calculate start time after R4
        const maxR4Slots = Math.max(...Array.from(r4CourtNextSlot.values()));
        const laterStartMinutes = r4StartHour * 60 + r4StartMinute + maxR4Slots * matchDurationMinutes + 15;
        
        const laterCourtNextSlot = new Map<number, number>();
        courts.forEach(c => laterCourtNextSlot.set(c, 0));
        
        for (const match of laterRounds) {
          const minSlot = Math.min(...Array.from(laterCourtNextSlot.values()));
          const availableCourt = courts.find(c => laterCourtNextSlot.get(c) === minSlot) || courts[0];
          const slotIdx = laterCourtNextSlot.get(availableCourt) || 0;
          const totalMinutes = laterStartMinutes + slotIdx * matchDurationMinutes;
          const hour = Math.floor(totalMinutes / 60) % 24;
          const minute = totalMinutes % 60;
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          laterCourtNextSlot.set(availableCourt, slotIdx + 1);
          
          await supabase
            .from('doubles_elimination_matches')
            .update({
              court_number: availableCourt,
              start_time: startTime
            })
            .eq('id', match.id);
        }
      }

      return { 
        success: true, 
        r3Teams: r3TeamIds,
        r4Teams: r4TeamIds,
        tiedTeamsInfo
      };
    } catch (error: any) {
      console.error('Calculate R3 assignments error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Check if all R2 matches are completed and trigger R3 assignment
  const checkAndAssignR3 = useCallback(async (
    tournamentId: string
  ): Promise<{ 
    success: boolean; 
    triggered: boolean;
    tiedTeamsInfo?: { count: number; names: string[] };
    error?: string 
  }> => {
    try {
      // Fetch current matches
      const { data: matches, error: fetchError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (fetchError) throw fetchError;

      const { data: teams, error: teamsError } = await supabase
        .from('doubles_elimination_teams')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (teamsError) throw teamsError;

      // Check if R3 matches already have teams assigned
      const r3Matches = (matches || []).filter((m: any) => m.round_number === 3);
      const r3AlreadyAssigned = r3Matches.some((m: any) => m.team_a_id || m.team_b_id);
      
      if (r3AlreadyAssigned) {
        return { success: true, triggered: false };
      }

      // Check if all R2 matches are completed
      const r2Matches = (matches || []).filter((m: any) => m.round_number === 2);
      const allR2Completed = r2Matches.every((m: any) => m.status === 'completed');
      
      // Also check R1
      const r1Matches = (matches || []).filter((m: any) => m.round_number === 1);
      const allR1Completed = r1Matches.every((m: any) => m.status === 'completed');

      if (!allR1Completed || !allR2Completed) {
        return { success: true, triggered: false };
      }

      // All preliminary matches completed, calculate and assign R3
      const result = await calculateR3Assignments(
        tournamentId, 
        matches as Match[], 
        teams as Team[]
      );

      if (!result.success) {
        return { success: false, triggered: false, error: result.error };
      }

      return { 
        success: true, 
        triggered: true,
        tiedTeamsInfo: result.tiedTeamsInfo
      };
    } catch (error: any) {
      console.error('Check and assign R3 error:', error);
      return { success: false, triggered: false, error: error.message };
    }
  }, [calculateR3Assignments]);

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
    deleteTournament,
    calculateR3Assignments,
    checkAndAssignR3
  };
}
