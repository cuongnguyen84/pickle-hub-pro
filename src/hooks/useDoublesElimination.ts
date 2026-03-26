import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Json } from '@/integrations/supabase/types';
import { getBestOfForRound, generateSeedPositions, generateShareId, assignCourtAndTime } from '@/lib/doubles-bracket-utils';

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
  creator_display_name?: string | null;
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

export function useDoublesElimination() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        seed: t.seed || null
      }));

      const { data, error } = await supabase
        .from('doubles_elimination_teams')
        .insert(teamsWithTournament)
        .select();

      if (error) throw error;
      return { success: true, teams: data as Team[] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const generateBracket = useCallback(async (
    tournamentId: string,
    courtsInput?: number[]
  ): Promise<{ success: boolean; matches?: Match[]; error?: string }> => {
    setLoading(true);
    try {
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

      const shuffledTeams = [...teamsData].sort(() => Math.random() - 0.5);
      const N = shuffledTeams.length;
      const earlyFormat = (tournament.early_rounds_format || 'bo1') as BestOfFormat;
      const semifinalsFormat = (tournament.semifinals_format || 'bo3') as BestOfFormat;
      const finalsFormat = (tournament.finals_format || 'bo3') as BestOfFormat;

      const matches: Array<Record<string, unknown>> = [];
      let displayOrder = 0;

      // ROUND 1
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
          score_a: 0, score_b: 0, winner_id: null,
          best_of: getBestOfForRound('winner_r1', earlyFormat, semifinalsFormat, finalsFormat),
          games: [], games_won_a: 0, games_won_b: 0,
          source_a: { type: 'team', team_id: shuffledTeams[teamAIndex].id },
          source_b: { type: 'team', team_id: shuffledTeams[teamBIndex].id },
          dest_winner: null, dest_loser: null,
          is_bye: false, display_order: displayOrder++,
          status: 'pending', live_referee_id: null, court_number: null, start_time: null
        });
      }

      // ROUND 2 (Loser bracket)
      const r2MatchCount = Math.floor(r1MatchCount / 2);
      const r1MatchIndices = Array.from({ length: r1MatchCount }, (_, i) => i);
      const shuffledLoserIndices = [...r1MatchIndices].sort(() => Math.random() - 0.5);

      for (let i = 0; i < r2MatchCount; i++) {
        const loserAIndex = shuffledLoserIndices[i * 2];
        const loserBIndex = shuffledLoserIndices[i * 2 + 1];
        matches.push({
          tournament_id: tournamentId,
          round_number: 2,
          round_type: 'loser_r2',
          bracket_type: 'loser',
          match_number: i + 1,
          team_a_id: null, team_b_id: null,
          score_a: 0, score_b: 0, winner_id: null,
          best_of: getBestOfForRound('loser_r2', earlyFormat, semifinalsFormat, finalsFormat),
          games: [], games_won_a: 0, games_won_b: 0,
          source_a: { type: 'loser_of', match_index: loserAIndex },
          source_b: { type: 'loser_of', match_index: loserBIndex },
          dest_winner: null, dest_loser: { type: 'ELIMINATED' },
          is_bye: false, display_order: displayOrder++,
          status: 'pending', live_referee_id: null, court_number: null, start_time: null
        });
      }

      // ROUND 3 (Merge)
      const byeFromR2 = r1MatchCount % 2 === 1;
      const byeTeamFromR1 = N % 2 === 1 ? shuffledTeams[N - 1] : null;
      const winnersFromR1 = r1MatchCount + (byeTeamFromR1 ? 1 : 0);
      const winnersFromR2 = r2MatchCount + (byeFromR2 ? 1 : 0);
      const T3 = winnersFromR1 + winnersFromR2;
      const R4 = Math.pow(2, Math.floor(Math.log2(T3)));
      const byesToR4 = 2 * R4 - T3;
      const teamsPlayingR3 = T3 - byesToR4;
      const r3Matches = Math.floor(teamsPlayingR3 / 2);

      for (let i = 0; i < r3Matches; i++) {
        matches.push({
          tournament_id: tournamentId,
          round_number: 3,
          round_type: 'merge_r3',
          bracket_type: 'merged',
          match_number: i + 1,
          team_a_id: null, team_b_id: null,
          score_a: 0, score_b: 0, winner_id: null,
          best_of: getBestOfForRound('merge_r3', earlyFormat, semifinalsFormat, finalsFormat),
          games: [], games_won_a: 0, games_won_b: 0,
          source_a: { type: 'winner_of', round: 1, match_index: i },
          source_b: { type: 'winner_of', round: 2, match_index: i },
          dest_winner: null, dest_loser: { type: 'ELIMINATED' },
          is_bye: false, display_order: displayOrder++,
          status: 'pending', live_referee_id: null, court_number: null, start_time: null
        });
      }

      // Assign courts/times to R1 & R2
      const courts = courtsInput && courtsInput.length > 0
        ? courtsInput
        : tournament.court_count > 0
          ? Array.from({ length: tournament.court_count }, (_, i) => i + 1)
          : [];

      if (courts.length > 0 && tournament.start_time) {
        const [startHour, startMinute] = tournament.start_time.split(':').map((s: string) => parseInt(s, 10));
        const validStartTime = !isNaN(startHour) && !isNaN(startMinute);

        if (validStartTime) {
          const courtNextSlot = new Map<number, number>();
          courts.forEach(c => courtNextSlot.set(c, 0));

          const r1r2Matches = matches.filter(m => (m.round_number as number) === 1 || (m.round_number as number) === 2);
          for (const match of r1r2Matches) {
            const { courtNumber, startTime } = assignCourtAndTime(courtNextSlot, courts, startHour, startMinute, 20);
            match.court_number = courtNumber;
            match.start_time = startTime;
          }
        }
      }

      const { data: insertedMatches, error: insertError } = await supabase
        .from('doubles_elimination_matches')
        .insert(matches)
        .select();

      if (insertError) throw insertError;

      await supabase
        .from('doubles_elimination_tournaments')
        .update({ status: 'ongoing', current_round: 1 })
        .eq('id', tournamentId);

      return { success: true, matches: insertedMatches as Match[] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

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
    } catch {
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
          profilesData.forEach(p => profilesMap.set(p.id, { display_name: p.display_name }));
        }
      }

      return (data || []).map((t) => {
        const profile = profilesMap.get(t.creator_user_id || '');
        return {
          ...t,
          creator_display_name: profile?.display_name,
        } as Tournament;
      });
    } catch {
      return [];
    }
  }, [user]);

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }, []);

  const addGameScore = useCallback(async (
    matchId: string,
    gameNumber: number,
    scoreA: number,
    scoreB: number
  ): Promise<{ success: boolean; matchCompleted?: boolean; error?: string }> => {
    try {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }, []);

  const endMatch = useCallback(async (
    matchId: string,
    winnerId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: match, error: fetchError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (fetchError) throw fetchError;

      const loserId = match.team_a_id === winnerId ? match.team_b_id : match.team_a_id;

      const { error: updateError } = await supabase
        .from('doubles_elimination_matches')
        .update({ winner_id: winnerId, status: 'completed' })
        .eq('id', matchId);

      if (updateError) throw updateError;

      if (match.round_type === 'winner_r1' && loserId) {
        const { data: r2Matches } = await supabase
          .from('doubles_elimination_matches')
          .select('*')
          .eq('tournament_id', match.tournament_id)
          .eq('round_number', 2);

        if (r2Matches) {
          for (const r2Match of r2Matches) {
            const sourceA = r2Match.source_a as { type?: string; match_index?: number } | null;
            const sourceB = r2Match.source_b as { type?: string; match_index?: number } | null;
            const r1MatchIndex = match.match_number - 1;

            let updateField: 'team_a_id' | 'team_b_id' | null = null;
            if (sourceA?.type === 'loser_of' && sourceA.match_index === r1MatchIndex && !r2Match.team_a_id) {
              updateField = 'team_a_id';
            } else if (sourceB?.type === 'loser_of' && sourceB.match_index === r1MatchIndex && !r2Match.team_b_id) {
              updateField = 'team_b_id';
            }

            if (updateField && loserId) {
              await supabase
                .from('doubles_elimination_matches')
                .update({ [updateField]: loserId })
                .eq('id', r2Match.id);
              break;
            }
          }
        }
      } else if (loserId) {
        await supabase
          .from('doubles_elimination_teams')
          .update({ status: 'eliminated', eliminated_at_round: match.round_number })
          .eq('id', loserId);
      }

      if (match.round_type === 'final') {
        await supabase
          .from('doubles_elimination_tournaments')
          .update({ status: 'completed' })
          .eq('id', match.tournament_id);
      }

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }, []);

  const deleteTournament = useCallback(async (tournamentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('doubles_elimination_tournaments')
        .delete()
        .eq('id', tournamentId);
      if (error) throw error;
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }, []);

  const calculateR3Assignments = useCallback(async (
    tournamentId: string,
    matchesParam: Match[],
    teamsParam: Team[]
  ): Promise<{
    success: boolean;
    r3Teams?: string[];
    r4Teams?: string[];
    tiedTeamsInfo?: { count: number; names: string[] };
    error?: string;
  }> => {
    try {
      const r1Matches = matchesParam.filter(m => m.round_number === 1 && m.status === 'completed');
      const r2Matches = matchesParam.filter(m => m.round_number === 2 && m.status === 'completed');
      const allR1Matches = matchesParam.filter(m => m.round_number === 1);
      const allR2Matches = matchesParam.filter(m => m.round_number === 2);

      if (r1Matches.length !== allR1Matches.length || r2Matches.length !== allR2Matches.length) {
        return { success: false, error: 'NOT_ALL_MATCHES_COMPLETED' };
      }

      interface TeamDiff {
        teamId: string;
        teamName: string;
        pointDiff: number;
        playedR2: boolean;
      }

      const teamDiffs: TeamDiff[] = [];

      r1Matches.forEach(match => {
        const winnerId = match.winner_id;
        if (!winnerId) return;
        const winnerTeam = teamsParam.find(t => t.id === winnerId);
        if (!winnerTeam) return;
        const isTeamA = match.team_a_id === winnerId;
        const pointsFor = isTeamA ? match.score_a : match.score_b;
        const pointsAgainst = isTeamA ? match.score_b : match.score_a;
        teamDiffs.push({ teamId: winnerId, teamName: winnerTeam.team_name, pointDiff: pointsFor - pointsAgainst, playedR2: false });
      });

      r2Matches.forEach(match => {
        const winnerId = match.winner_id;
        if (!winnerId) return;
        const winnerTeam = teamsParam.find(t => t.id === winnerId);
        if (!winnerTeam) return;
        const isTeamA = match.team_a_id === winnerId;
        const pointsFor = isTeamA ? match.score_a : match.score_b;
        const pointsAgainst = isTeamA ? match.score_b : match.score_a;
        teamDiffs.push({ teamId: winnerId, teamName: winnerTeam.team_name, pointDiff: pointsFor - pointsAgainst, playedR2: true });
      });

      const r1MatchTeams = new Set<string>();
      r1Matches.forEach(m => {
        if (m.team_a_id) r1MatchTeams.add(m.team_a_id);
        if (m.team_b_id) r1MatchTeams.add(m.team_b_id);
      });

      teamsParam.forEach(team => {
        if (!r1MatchTeams.has(team.id) && team.status !== 'eliminated') {
          teamDiffs.push({ teamId: team.id, teamName: team.team_name, pointDiff: 0, playedR2: false });
        }
      });

      teamDiffs.sort((a, b) => b.pointDiff - a.pointDiff);

      const r3MatchesNeeded = matchesParam.filter(m => m.round_number === 3).length;
      const teamsNeededForR3 = r3MatchesNeeded * 2;
      const teamsForR4 = teamDiffs.length - teamsNeededForR3;

      let tiedTeamsInfo: { count: number; names: string[] } | undefined;

      if (teamsNeededForR3 > 0 && teamDiffs.length >= teamsNeededForR3) {
        const cutoffDiff = teamDiffs[teamsForR4 - 1]?.pointDiff;
        const teamsAtCutoff = teamDiffs.filter(t => t.pointDiff === cutoffDiff);

        if (teamsAtCutoff.length > 1) {
          tiedTeamsInfo = { count: teamsAtCutoff.length, names: teamsAtCutoff.map(t => t.teamName) };
          const aboveCutoff = teamDiffs.filter(t => t.pointDiff > cutoffDiff);
          const atCutoff = teamDiffs.filter(t => t.pointDiff === cutoffDiff);
          const belowCutoff = teamDiffs.filter(t => t.pointDiff < cutoffDiff);
          const shuffledAtCutoff = [...atCutoff].sort(() => Math.random() - 0.5);
          const r4SlotsLeft = teamsForR4 - aboveCutoff.length;
          const r4FromTied = shuffledAtCutoff.slice(0, r4SlotsLeft);
          const r3FromTied = shuffledAtCutoff.slice(r4SlotsLeft);
          teamDiffs.length = 0;
          teamDiffs.push(...aboveCutoff, ...r4FromTied, ...r3FromTied, ...belowCutoff);
        }
      }

      const r4TeamIds = teamDiffs.slice(0, teamsForR4).map(t => t.teamId);
      const r3TeamIds = teamDiffs.slice(teamsForR4).map(t => t.teamId);
      const shuffledR3Teams = [...r3TeamIds].sort(() => Math.random() - 0.5);

      const r3MatchesList = matchesParam.filter(m => m.round_number === 3);

      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      const r3StartHour = now.getHours();
      const r3StartMinute = now.getMinutes();

      const { data: tournamentData } = await supabase
        .from('doubles_elimination_tournaments')
        .select('court_count')
        .eq('id', tournamentId)
        .single();

      const courtCount = tournamentData?.court_count || 4;
      const courts = Array.from({ length: courtCount }, (_, i) => i + 1);
      const courtNextSlot = new Map<number, number>();
      courts.forEach(c => courtNextSlot.set(c, 0));

      for (let i = 0; i < r3MatchesList.length; i++) {
        const match = r3MatchesList[i];
        const teamAId = shuffledR3Teams[i * 2];
        const teamBId = shuffledR3Teams[i * 2 + 1];

        const { courtNumber, startTime } = assignCourtAndTime(courtNextSlot, courts, r3StartHour, r3StartMinute, 20);

        if (teamAId && teamBId) {
          await supabase
            .from('doubles_elimination_matches')
            .update({ team_a_id: teamAId, team_b_id: teamBId, court_number: courtNumber, start_time: startTime })
            .eq('id', match.id);
        }
      }

      return { success: true, r3Teams: r3TeamIds, r4Teams: r4TeamIds, tiedTeamsInfo };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }, []);

  const generatePlayoffBracket = useCallback(async (
    tournamentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: tournament, error: tError } = await supabase
        .from('doubles_elimination_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tError) throw tError;

      const { data: teams, error: teamsError } = await supabase
        .from('doubles_elimination_teams')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (teamsError) throw teamsError;

      const { data: matches, error: matchesError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (matchesError) throw matchesError;

      const r3Matches = matches.filter((m) => m.round_number === 3);
      if (!r3Matches.every((m) => m.status === 'completed')) {
        return { success: false, error: 'R3_NOT_COMPLETED' };
      }

      const existingPlayoff = matches.filter((m) => m.round_number >= 4);
      if (existingPlayoff.length > 0) return { success: true };

      const playoffTeamIds: string[] = [];
      r3Matches.forEach((m) => { if (m.winner_id) playoffTeamIds.push(m.winner_id); });

      const r3TeamIds = new Set<string>();
      r3Matches.forEach((m) => {
        if (m.team_a_id) r3TeamIds.add(m.team_a_id);
        if (m.team_b_id) r3TeamIds.add(m.team_b_id);
      });

      const r1Matches = matches.filter((m) => m.round_number === 1);
      const r2Matches = matches.filter((m) => m.round_number === 2);

      r1Matches.forEach((m) => { if (m.winner_id && !r3TeamIds.has(m.winner_id)) playoffTeamIds.push(m.winner_id); });
      r2Matches.forEach((m) => { if (m.winner_id && !r3TeamIds.has(m.winner_id)) playoffTeamIds.push(m.winner_id); });

      const r1Teams = new Set<string>();
      r1Matches.forEach((m) => {
        if (m.team_a_id) r1Teams.add(m.team_a_id);
        if (m.team_b_id) r1Teams.add(m.team_b_id);
      });

      teams.forEach((team) => {
        if (!r1Teams.has(team.id) && team.status !== 'eliminated' && !playoffTeamIds.includes(team.id)) {
          playoffTeamIds.push(team.id);
        }
      });

      const uniquePlayoffTeamIds = [...new Set(playoffTeamIds)];
      const playoffTeamCount = uniquePlayoffTeamIds.length;
      if (playoffTeamCount < 2) return { success: false, error: 'NOT_ENOUGH_TEAMS' };

      const R4 = Math.pow(2, Math.floor(Math.log2(playoffTeamCount)));
      const playoffTeams = uniquePlayoffTeamIds.map(id => teams.find((t) => t.id === id)).filter(Boolean);

      const seededTeams = playoffTeams.filter((t) => t!.seed !== null && t!.seed !== undefined)
        .sort((a, b) => a!.seed! - b!.seed!);
      const unseededTeams = playoffTeams.filter((t) => t!.seed === null || t!.seed === undefined);
      const shuffledUnseeded = [...unseededTeams].sort(() => Math.random() - 0.5);

      const bracketPositions: (typeof playoffTeams[0] | null)[] = new Array(R4).fill(null);
      const seedPositions = generateSeedPositions(R4);

      for (let i = 0; i < seededTeams.length && i < seedPositions.length; i++) {
        const position = seedPositions[i];
        if (position !== undefined && position < R4) bracketPositions[position] = seededTeams[i];
      }

      let unseededIdx = 0;
      for (let i = 0; i < bracketPositions.length; i++) {
        if (bracketPositions[i] === null && unseededIdx < shuffledUnseeded.length) {
          bracketPositions[i] = shuffledUnseeded[unseededIdx];
          unseededIdx++;
        }
      }

      const earlyFormat = (tournament.early_rounds_format || 'bo1') as BestOfFormat;
      const sfFormat = (tournament.semifinals_format || 'bo3') as BestOfFormat;
      const finalsFormat = (tournament.finals_format || 'bo3') as BestOfFormat;

      const playoffMatchesData: Array<Record<string, unknown>> = [];
      let displayOrder = matches.length;

      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      const r4StartHour = now.getHours();
      const r4StartMinute = now.getMinutes();
      const courtCount = tournament.court_count || 4;
      const courts = Array.from({ length: courtCount }, (_, i) => i + 1);
      const courtNextSlot = new Map<number, number>();
      courts.forEach(c => courtNextSlot.set(c, 0));

      let currentRound = 4;
      let teamsInRound = R4;
      const currentTeams = bracketPositions;

      while (teamsInRound > 1) {
        const matchesInRound = teamsInRound / 2;
        let roundType: RoundType = 'elimination';
        if (teamsInRound === 8) roundType = 'quarterfinal';
        else if (teamsInRound === 4) roundType = 'semifinal';
        else if (teamsInRound === 2) roundType = 'final';

        for (let i = 0; i < matchesInRound; i++) {
          const { courtNumber, startTime } = assignCourtAndTime(courtNextSlot, courts, r4StartHour, r4StartMinute, 20);
          const teamA = currentRound === 4 ? currentTeams[i * 2] : null;
          const teamB = currentRound === 4 ? currentTeams[i * 2 + 1] : null;

          playoffMatchesData.push({
            tournament_id: tournamentId,
            round_number: currentRound,
            round_type: roundType,
            bracket_type: 'single',
            match_number: i + 1,
            team_a_id: teamA?.id || null,
            team_b_id: teamB?.id || null,
            score_a: 0, score_b: 0, winner_id: null,
            best_of: getBestOfForRound(roundType, earlyFormat, sfFormat, finalsFormat),
            games: [], games_won_a: 0, games_won_b: 0,
            source_a: currentRound === 4
              ? { type: 'bracket_position', position: i * 2 }
              : { type: 'winner_of', round: currentRound - 1, match_index: i * 2 },
            source_b: currentRound === 4
              ? { type: 'bracket_position', position: i * 2 + 1 }
              : { type: 'winner_of', round: currentRound - 1, match_index: i * 2 + 1 },
            dest_winner: teamsInRound === 2 ? { type: 'CHAMPION' } : null,
            dest_loser: { type: 'ELIMINATED' },
            is_bye: false,
            display_order: displayOrder++,
            status: 'pending',
            live_referee_id: null,
            court_number: currentRound === 4 ? courtNumber : null,
            start_time: currentRound === 4 ? startTime : null
          });
        }

        teamsInRound = matchesInRound;
        currentRound++;
        courts.forEach(c => courtNextSlot.set(c, 0));
      }

      if (tournament.has_third_place_match) {
        const finalRound = currentRound - 1;
        playoffMatchesData.push({
          tournament_id: tournamentId,
          round_number: finalRound,
          round_type: 'third_place',
          bracket_type: 'single',
          match_number: 1,
          team_a_id: null, team_b_id: null,
          score_a: 0, score_b: 0, winner_id: null,
          best_of: getBestOfForRound('third_place', earlyFormat, sfFormat, finalsFormat),
          games: [], games_won_a: 0, games_won_b: 0,
          source_a: { type: 'loser_of', round_type: 'semifinal', match_index: 0 },
          source_b: { type: 'loser_of', round_type: 'semifinal', match_index: 1 },
          dest_winner: null, dest_loser: null,
          is_bye: false, display_order: displayOrder++,
          status: 'pending', live_referee_id: null, court_number: null, start_time: null
        });
      }

      const { error: insertError } = await supabase
        .from('doubles_elimination_matches')
        .insert(playoffMatchesData);
      if (insertError) throw insertError;

      return { success: true };
    } catch (error: unknown) {
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
    try {
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

      const r3Matches = (matches || []).filter((m) => m.round_number === 3);
      if (r3Matches.some((m) => m.team_a_id || m.team_b_id)) {
        return { success: true, triggered: false };
      }

      const r2Matches = (matches || []).filter((m) => m.round_number === 2);
      const r1Matches = (matches || []).filter((m) => m.round_number === 1);

      if (!r1Matches.every((m) => m.status === 'completed') || !r2Matches.every((m) => m.status === 'completed')) {
        return { success: true, triggered: false };
      }

      const result = await calculateR3Assignments(tournamentId, matches as Match[], teams as Team[]);
      if (!result.success) return { success: false, triggered: false, error: result.error };

      return { success: true, triggered: true, tiedTeamsInfo: result.tiedTeamsInfo };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, triggered: false, error: message };
    }
  }, [calculateR3Assignments]);

  const checkAndGeneratePlayoff = useCallback(async (
    tournamentId: string
  ): Promise<{ success: boolean; generated: boolean; error?: string }> => {
    try {
      const { data: matches, error: fetchError } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('tournament_id', tournamentId);
      if (fetchError) throw fetchError;

      if ((matches || []).some((m) => m.round_number >= 4)) return { success: true, generated: false };

      const r3Matches = (matches || []).filter((m) => m.round_number === 3);
      if (r3Matches.length === 0 || !r3Matches.every((m) => m.status === 'completed')) {
        return { success: true, generated: false };
      }

      const result = await generatePlayoffBracket(tournamentId);
      if (!result.success) return { success: false, generated: false, error: result.error };

      return { success: true, generated: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, generated: false, error: message };
    }
  }, [generatePlayoffBracket]);

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
    checkAndAssignR3,
    generatePlayoffBracket,
    checkAndGeneratePlayoff
  };
}
