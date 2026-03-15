import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to subscribe to realtime updates for team match matches and games
 * This ensures the UI updates automatically when scores are changed by referees
 */
export function useTeamMatchRealtime(tournamentId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tournamentId) return;

    // Channel for matches updates
    const matchesChannel = supabase
      .channel(`team-match-matches:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_match_matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          console.log('[Realtime] team_match_matches changed:', payload.eventType);
          // Invalidate the matches query to refetch
          queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
          
          // Also invalidate the specific match if we have the ID
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['team-match-match', payload.new.id] });
          }
          if (payload.old && typeof payload.old === 'object' && 'id' in payload.old) {
            queryClient.invalidateQueries({ queryKey: ['team-match-match', payload.old.id] });
          }
        }
      )
      .subscribe();

    // Channel for teams updates
    const teamsChannel = supabase
      .channel(`team-match-teams:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_match_teams',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          console.log('[Realtime] team_match_teams changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
        }
      )
      .subscribe();

    // Channel for games updates  
    const gamesChannel = supabase
      .channel(`team-match-games:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_match_games',
        },
        (payload) => {
          console.log('[Realtime] team_match_games changed:', payload.eventType);
          
          // Invalidate games query for the specific match
          if (payload.new && typeof payload.new === 'object' && 'match_id' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['team-match-games', payload.new.match_id] });
            queryClient.invalidateQueries({ queryKey: ['team-match-match', payload.new.match_id] });
          }
          if (payload.old && typeof payload.old === 'object' && 'match_id' in payload.old) {
            queryClient.invalidateQueries({ queryKey: ['team-match-games', payload.old.match_id] });
            queryClient.invalidateQueries({ queryKey: ['team-match-match', payload.old.match_id] });
          }

          // Also invalidate main matches list to update scores in the list view
          queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(gamesChannel);
    };
  }, [tournamentId, queryClient]);
}

/**
 * Hook to subscribe to realtime updates for a specific match
 * Use this in the scoring sheet for more responsive updates
 */
export function useTeamMatchMatchRealtime(matchId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!matchId) return;

    // Channel for this specific match
    const matchChannel = supabase
      .channel(`team-match-match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_match_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          console.log('[Realtime] Match updated:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['team-match-match', matchId] });
        }
      )
      .subscribe();

    // Channel for games of this match
    const gamesChannel = supabase
      .channel(`team-match-games-match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_match_games',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          console.log('[Realtime] Game updated:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['team-match-games', matchId] });
          queryClient.invalidateQueries({ queryKey: ['team-match-match', matchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(gamesChannel);
    };
  }, [matchId, queryClient]);
}
