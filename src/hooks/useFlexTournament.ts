import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types
export interface FlexTournament {
  id: string;
  creator_user_id: string;
  name: string;
  share_id: string;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FlexPlayer {
  id: string;
  tournament_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface FlexTeam {
  id: string;
  tournament_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface FlexTeamMember {
  id: string;
  team_id: string;
  player_id: string;
  created_at: string;
}

export interface FlexGroup {
  id: string;
  tournament_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface FlexGroupItem {
  id: string;
  group_id: string;
  item_type: 'player' | 'team';
  player_id: string | null;
  team_id: string | null;
  display_order: number;
  created_at: string;
}

export interface FlexMatch {
  id: string;
  tournament_id: string;
  group_id: string | null;
  name: string;
  match_type: 'singles' | 'doubles';
  slot_a1_player_id: string | null;
  slot_a2_player_id: string | null;
  slot_b1_player_id: string | null;
  slot_b2_player_id: string | null;
  slot_a_team_id: string | null;
  slot_b_team_id: string | null;
  score_a: number;
  score_b: number;
  winner_side: 'a' | 'b' | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FlexPlayerStats {
  id: string;
  group_id: string;
  player_id: string;
  wins: number;
  losses: number;
  point_diff: number;
  updated_at: string;
}

export interface FlexPairStats {
  id: string;
  group_id: string;
  player1_id: string;
  player2_id: string;
  wins: number;
  losses: number;
  point_diff: number;
  updated_at: string;
}

export interface FlexTournamentData {
  tournament: FlexTournament;
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  groups: FlexGroup[];
  groupItems: FlexGroupItem[];
  matches: FlexMatch[];
  playerStats: FlexPlayerStats[];
  pairStats: FlexPairStats[];
}

export function useFlexTournament() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's tournaments
  const { data: myTournaments = [], isLoading: isLoadingTournaments } = useQuery({
    queryKey: ['flex-tournaments', 'my', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('flex_tournaments')
        .select('*')
        .eq('creator_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FlexTournament[];
    },
    enabled: !!user?.id,
  });

  // Create tournament mutation
  const createMutation = useMutation({
    mutationFn: async (input: { name: string; playerNames: string[]; isPublic: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('flex_tournaments')
        .insert({
          name: input.name,
          creator_user_id: user.id,
          is_public: input.isPublic,
        })
        .select()
        .single();

      if (tournamentError) throw tournamentError;

      // Add players
      if (input.playerNames.length > 0) {
        const playersToInsert = input.playerNames.map((name, index) => ({
          tournament_id: tournament.id,
          name: name.trim(),
          display_order: index,
        }));

        const { error: playersError } = await supabase
          .from('flex_players')
          .insert(playersToInsert);

        if (playersError) throw playersError;
      }

      return tournament as FlexTournament;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flex-tournaments'] });
    },
  });

  // Delete tournament mutation
  const deleteMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase
        .from('flex_tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flex-tournaments'] });
    },
  });

  // Get tournament by share ID
  async function getTournamentByShareId(shareId: string): Promise<FlexTournamentData | null> {
    const { data: tournament, error: tournamentError } = await supabase
      .from('flex_tournaments')
      .select('*')
      .eq('share_id', shareId)
      .single();

    if (tournamentError || !tournament) return null;

    // Fetch all related data in parallel
    const [
      { data: players },
      { data: teams },
      { data: groups },
      { data: matches },
    ] = await Promise.all([
      supabase.from('flex_players').select('*').eq('tournament_id', tournament.id).order('display_order'),
      supabase.from('flex_teams').select('*').eq('tournament_id', tournament.id).order('display_order'),
      supabase.from('flex_groups').select('*').eq('tournament_id', tournament.id).order('display_order'),
      supabase.from('flex_matches').select('*').eq('tournament_id', tournament.id).order('display_order'),
    ]);

    // Fetch team members and group items
    const teamIds = (teams || []).map(t => t.id);
    const groupIds = (groups || []).map(g => g.id);

    const [{ data: teamMembers }, { data: groupItems }, { data: playerStats }, { data: pairStats }] = await Promise.all([
      teamIds.length > 0
        ? supabase.from('flex_team_members').select('*').in('team_id', teamIds)
        : Promise.resolve({ data: [] }),
      groupIds.length > 0
        ? supabase.from('flex_group_items').select('*').in('group_id', groupIds).order('display_order')
        : Promise.resolve({ data: [] }),
      groupIds.length > 0
        ? supabase.from('flex_player_stats').select('*').in('group_id', groupIds)
        : Promise.resolve({ data: [] }),
      groupIds.length > 0
        ? supabase.from('flex_pair_stats').select('*').in('group_id', groupIds)
        : Promise.resolve({ data: [] }),
    ]);

    return {
      tournament: tournament as FlexTournament,
      players: (players || []) as FlexPlayer[],
      teams: (teams || []) as FlexTeam[],
      teamMembers: (teamMembers || []) as FlexTeamMember[],
      groups: (groups || []) as FlexGroup[],
      groupItems: (groupItems || []) as FlexGroupItem[],
      matches: (matches || []) as FlexMatch[],
      playerStats: (playerStats || []) as FlexPlayerStats[],
      pairStats: (pairStats || []) as FlexPairStats[],
    };
  }

  // Add player
  async function addPlayer(tournamentId: string, name: string, displayOrder: number): Promise<FlexPlayer | null> {
    const { data, error } = await supabase
      .from('flex_players')
      .insert({ tournament_id: tournamentId, name, display_order: displayOrder })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    return data as FlexPlayer;
  }

  // Add team
  async function addTeam(tournamentId: string, name: string, displayOrder: number): Promise<FlexTeam | null> {
    const { data, error } = await supabase
      .from('flex_teams')
      .insert({ tournament_id: tournamentId, name, display_order: displayOrder })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    return data as FlexTeam;
  }

  // Add player to team
  async function addPlayerToTeam(teamId: string, playerId: string): Promise<FlexTeamMember | null> {
    const { data, error } = await supabase
      .from('flex_team_members')
      .insert({ team_id: teamId, player_id: playerId })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    return data as FlexTeamMember;
  }

  // Remove player from team
  async function removePlayerFromTeam(memberId: string): Promise<boolean> {
    const { error } = await supabase
      .from('flex_team_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  }

  // Add group
  async function addGroup(tournamentId: string, name: string, displayOrder: number): Promise<FlexGroup | null> {
    const { data, error } = await supabase
      .from('flex_groups')
      .insert({ tournament_id: tournamentId, name, display_order: displayOrder })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    return data as FlexGroup;
  }

  // Add item to group (player or team)
  async function addItemToGroup(
    groupId: string,
    itemType: 'player' | 'team',
    itemId: string,
    displayOrder: number
  ): Promise<FlexGroupItem | null> {
    const insertData: any = {
      group_id: groupId,
      item_type: itemType,
      display_order: displayOrder,
    };

    if (itemType === 'player') {
      insertData.player_id = itemId;
    } else {
      insertData.team_id = itemId;
    }

    const { data, error } = await supabase
      .from('flex_group_items')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    return data as FlexGroupItem;
  }

  // Remove item from group
  async function removeItemFromGroup(itemId: string): Promise<boolean> {
    const { error } = await supabase
      .from('flex_group_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  }

  // Add match
  async function addMatch(
    tournamentId: string,
    name: string,
    matchType: 'singles' | 'doubles',
    groupId: string | null,
    displayOrder: number
  ): Promise<FlexMatch | null> {
    const { data, error } = await supabase
      .from('flex_matches')
      .insert({
        tournament_id: tournamentId,
        name,
        match_type: matchType,
        group_id: groupId,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    return data as FlexMatch;
  }

  // Update match slots
  async function updateMatchSlots(
    matchId: string,
    updates: Partial<Pick<FlexMatch, 'slot_a1_player_id' | 'slot_a2_player_id' | 'slot_b1_player_id' | 'slot_b2_player_id' | 'slot_a_team_id' | 'slot_b_team_id'>>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('flex_matches')
      .update(updates)
      .eq('id', matchId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  }

  // Update match score
  async function updateMatchScore(
    matchId: string,
    scoreA: number,
    scoreB: number
  ): Promise<boolean> {
    const winnerSide = scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : null;
    
    const { error } = await supabase
      .from('flex_matches')
      .update({ score_a: scoreA, score_b: scoreB, winner_side: winnerSide })
      .eq('id', matchId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  }

  // Delete entity
  async function deleteEntity(table: string, id: string): Promise<boolean> {
    const { error } = await supabase
      .from(table as any)
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  }

  // Update entity name
  async function updateEntityName(table: string, id: string, name: string): Promise<boolean> {
    const { error } = await supabase
      .from(table as any)
      .update({ name })
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  }

  // Update tournament visibility
  async function updateTournamentVisibility(tournamentId: string, isPublic: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('flex_tournaments')
      .update({ is_public: isPublic })
      .eq('id', tournamentId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  }

  // Generate round robin matches for a group
  async function generateRoundRobinMatches(
    tournamentId: string,
    groupId: string,
    items: { id: string; name: string; type: 'player' | 'team' }[],
    matchType: 'singles' | 'doubles'
  ): Promise<FlexMatch[]> {
    // Generate all pairings
    const pairings: { a: typeof items[0]; b: typeof items[0] }[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        pairings.push({ a: items[i], b: items[j] });
      }
    }

    // Create matches
    const matchesToInsert = pairings.map((pair, index) => {
      const match: any = {
        tournament_id: tournamentId,
        group_id: groupId,
        name: `${pair.a.name} vs ${pair.b.name}`,
        match_type: matchType,
        display_order: index,
      };

      if (pair.a.type === 'player') {
        match.slot_a1_player_id = pair.a.id;
        match.slot_b1_player_id = pair.b.id;
      } else {
        match.slot_a_team_id = pair.a.id;
        match.slot_b_team_id = pair.b.id;
      }

      return match;
    });

    const { data, error } = await supabase
      .from('flex_matches')
      .insert(matchesToInsert)
      .select();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return [];
    }

    return (data || []) as FlexMatch[];
  }

  return {
    // Data
    myTournaments,
    isLoadingTournaments,

    // Mutations
    createTournament: createMutation.mutateAsync,
    deleteTournament: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Functions
    getTournamentByShareId,
    addPlayer,
    addTeam,
    addPlayerToTeam,
    removePlayerFromTeam,
    addGroup,
    addItemToGroup,
    removeItemFromGroup,
    addMatch,
    updateMatchSlots,
    updateMatchScore,
    deleteEntity,
    updateEntityName,
    updateTournamentVisibility,
    generateRoundRobinMatches,
  };
}
