import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { generateCircleMethodMatches } from '@/lib/round-robin';
import type { TeamMatchTeam } from './useTeamMatchTeams';

export interface TeamMatchGroup {
  id: string;
  tournament_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

// Roster player for auto-lineup.
interface RosterPlayer { id: string; gender: 'male' | 'female' }

// Gender make-up per game type (mirrors LineupSelectionSheet).
const GAME_GENDER_REQ: Record<string, { male: number; female: number }> = {
  WD: { male: 0, female: 2 },
  MD: { male: 2, female: 0 },
  MX: { male: 1, female: 1 },
  WS: { male: 0, female: 1 },
  MS: { male: 1, female: 0 },
};

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Auto-pick roster member ids for a game by gender, filling from the rest if a
// team is short of a gender. Dreambreaker = any 4 players.
function autoLineup(roster: RosterPlayer[], gameType: string, isDreambreaker: boolean): string[] {
  if (isDreambreaker) return roster.slice(0, 4).map((r) => r.id);
  const req = GAME_GENDER_REQ[gameType] ?? { male: 1, female: 1 };
  const males = roster.filter((r) => r.gender === 'male');
  const females = roster.filter((r) => r.gender === 'female');
  const picked = [...males.slice(0, req.male), ...females.slice(0, req.female)];
  const pickedIds = new Set(picked.map((r) => r.id));
  for (const r of roster) {
    if (picked.length >= req.male + req.female) break;
    if (!pickedIds.has(r.id)) { picked.push(r); pickedIds.add(r.id); }
  }
  return picked.map((r) => r.id);
}

// Hook for fetching groups of a tournament
export function useTeamMatchGroups(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ['team-match-groups', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];
      
      const { data, error } = await supabase
        .from('team_match_groups')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as TeamMatchGroup[];
    },
    enabled: !!tournamentId,
  });
}

// Hook for group management operations
export function useTeamMatchGroupManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create groups and assign teams, then generate group stage matches
  const createGroupsMutation = useMutation({
    mutationFn: async ({
      tournamentId,
      groupCount,
      distribution,
      gameTemplates,
      hasDreambreaker,
      randomizeGameOrder,
    }: {
      tournamentId: string;
      groupCount: number;
      distribution: Array<Array<{ id: string; name: string }>>;
      gameTemplates: { game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS'; scoring_type: 'rally21' | 'sideout11'; display_name: string | null; order_index: number }[];
      hasDreambreaker?: boolean;
      /** Randomize the game order within each match (per match). */
      randomizeGameOrder?: boolean;
    }) => {
      // 1. Create groups
      const groupsToInsert = distribution.map((_, index) => ({
        tournament_id: tournamentId,
        name: `Bảng ${String.fromCharCode(65 + index)}`,
        display_order: index,
      }));

      const { data: groups, error: groupsError } = await supabase
        .from('team_match_groups')
        .insert(groupsToInsert)
        .select();

      if (groupsError) throw groupsError;
      if (!groups) throw new Error('Failed to create groups');

      // 2. Assign teams to groups — one atomic statement (a per-team await
      //    loop could fail partway and leave the draw half-applied).
      const pairs = distribution.flatMap((teamsInGroup, i) =>
        teamsInGroup.map((team) => ({ team_id: team.id, group_id: groups[i].id })),
      );
      const { error: assignError } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'assign_team_match_teams_to_groups' as any,
        { _pairs: pairs },
      );
      if (assignError) throw assignError;

      // 2b. Load rosters (for auto-lineup) keyed by team.
      const allTeamIds = distribution.flat().map((t) => t.id);
      const { data: rosterRows, error: rosterError } = await supabase
        .from('team_match_roster')
        .select('id, team_id, gender')
        .in('team_id', allTeamIds);
      if (rosterError) throw rosterError;
      const teamRosters = new Map<string, RosterPlayer[]>();
      (rosterRows || []).forEach((r) => {
        const list = teamRosters.get(r.team_id) ?? [];
        list.push({ id: r.id, gender: r.gender as 'male' | 'female' });
        teamRosters.set(r.team_id, list);
      });

      // 3. Update tournament with group_count
      const { error: tournamentError } = await supabase
        .from('team_match_tournaments')
        .update({ 
          group_count: groupCount,
          status: 'ongoing' 
        })
        .eq('id', tournamentId);

      if (tournamentError) throw tournamentError;

      // 4. Generate round-robin matches for each group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allMatches: any[] = [];
      let globalDisplayOrder = 0;

      for (let i = 0; i < distribution.length; i++) {
        const group = groups[i];
        const teamsInGroup = distribution[i];

        // Use circle method for round-robin
        const teamIds = teamsInGroup.map(t => t.id);
        const rrMatches = generateCircleMethodMatches(teamIds);

        for (const match of rrMatches) {
          // Skip BYE matches
          if (match.player1 === 'BYE' || match.player2 === 'BYE') continue;

          allMatches.push({
            tournament_id: tournamentId,
            group_id: group.id,
            team_a_id: match.player1,
            team_b_id: match.player2,
            games_won_a: 0,
            games_won_b: 0,
            total_points_a: 0,
            total_points_b: 0,
            winner_team_id: null,
            status: 'pending',
            round_number: match.rrRoundNumber,
            is_playoff: false,
            playoff_round: null,
            bracket_position: null,
            next_match_id: null,
            next_match_slot: null,
            // Auto-filled lineups below → mark as submitted so matches are ready.
            lineup_a_submitted: true,
            lineup_b_submitted: true,
            display_order: globalDisplayOrder++,
          });
        }
      }

      // Insert all matches
      const { data: insertedMatches, error: matchError } = await supabase
        .from('team_match_matches')
        .insert(allMatches)
        .select();

      if (matchError) throw matchError;

      // 5. Create games for each match based on templates. Game order is
      //    randomized per match when requested; each game's lineup is
      //    auto-filled from the two teams' rosters by gender.
      if (insertedMatches && gameTemplates.length > 0) {
        const isEvenGames = gameTemplates.length % 2 === 0;
        const shouldAddDreambreaker = hasDreambreaker && isEvenGames;

        const games = insertedMatches.flatMap(match => {
          const rosterA = teamRosters.get(match.team_a_id) ?? [];
          const rosterB = teamRosters.get(match.team_b_id) ?? [];
          const ordered = randomizeGameOrder ? shuffleArr(gameTemplates) : gameTemplates;

          const regularGames = ordered.map((template, index) => ({
            match_id: match.id,
            order_index: index,
            game_type: template.game_type,
            scoring_type: template.scoring_type,
            display_name: template.display_name,
            is_dreambreaker: false,
            score_a: 0,
            score_b: 0,
            status: 'pending',
            lineup_team_a: autoLineup(rosterA, template.game_type, false),
            lineup_team_b: autoLineup(rosterB, template.game_type, false),
          }));

          // Add dreambreaker as the last game
          if (shouldAddDreambreaker) {
            regularGames.push({
              match_id: match.id,
              order_index: gameTemplates.length,
              game_type: 'MS' as const,
              scoring_type: 'rally21' as const,
              display_name: 'Dreambreaker',
              is_dreambreaker: true,
              score_a: 0,
              score_b: 0,
              status: 'pending',
              lineup_team_a: autoLineup(rosterA, 'MS', true),
              lineup_team_b: autoLineup(rosterB, 'MS', true),
            });
          }

          return regularGames;
        });

        const { error: gamesError } = await supabase
          .from('team_match_games')
          .insert(games);

        if (gamesError) throw gamesError;
      }

      return { groups, matchCount: insertedMatches?.length || 0 };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-groups', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-tournament'] });
      toast({
        title: 'Thành công',
        description: `Đã chia ${result.groups.length} bảng và tạo ${result.matchCount} trận đấu`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete all groups (reset group stage)
  const deleteGroupsMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      // Delete groups (cascades to remove group_id from teams/matches)
      const { error } = await supabase
        .from('team_match_groups')
        .delete()
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      // Reset tournament group_count
      await supabase
        .from('team_match_tournaments')
        .update({ group_count: null })
        .eq('id', tournamentId);

      return tournamentId;
    },
    onSuccess: (tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-groups', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
      toast({
        title: 'Đã xóa',
        description: 'Đã xóa tất cả bảng đấu',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    createGroups: createGroupsMutation.mutateAsync,
    isCreatingGroups: createGroupsMutation.isPending,
    deleteGroups: deleteGroupsMutation.mutateAsync,
    isDeletingGroups: deleteGroupsMutation.isPending,
  };
}
