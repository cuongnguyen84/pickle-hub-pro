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
    let matchesChannel: ReturnType<typeof supabase.channel> | null = null;
    try {
      matchesChannel = supabase
        .channel(`team-match-matches:${tournamentId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
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
    } catch (err) {
      console.warn("[TeamMatch] Realtime setup failed:", err);
    }

    // Channel for games updates
    let gamesChannel: ReturnType<typeof supabase.channel> | null = null;
    try {
      gamesChannel = supabase
        .channel(`team-match-games:${tournamentId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
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
    } catch (err) {
      console.warn("[TeamMatch] Realtime setup failed:", err);
    }

    return () => {
      if (matchesChannel) supabase.removeChannel(matchesChannel);
      if (gamesChannel) supabase.removeChannel(gamesChannel);
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
    let matchChannel: ReturnType<typeof supabase.channel> | null = null;
    try {
      matchChannel = supabase
        .channel(`team-match-match:${matchId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
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
    } catch (err) {
      console.warn("[TeamMatch] Realtime setup failed:", err);
    }

    // Channel for games of this match
    let gamesChannel: ReturnType<typeof supabase.channel> | null = null;
    try {
      gamesChannel = supabase
        .channel(`team-match-games-match:${matchId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
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
    } catch (err) {
      console.warn("[TeamMatch] Realtime setup failed:", err);
    }

    return () => {
      if (matchChannel) supabase.removeChannel(matchChannel);
      if (gamesChannel) supabase.removeChannel(gamesChannel);
    };
  }, [matchId, queryClient]);
}
