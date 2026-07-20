import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { uniqueChannelSuffix } from '@/lib/uniqueChannelId';

/**
 * Hook to subscribe to realtime updates for team match matches and games
 * This ensures the UI updates automatically when scores are changed by referees
 */
export function useTeamMatchRealtime(tournamentId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tournamentId) return undefined;

    // Channel for matches updates
    let matchesChannel: ReturnType<typeof supabase.channel> | null = null;
    try {
      matchesChannel = supabase
        .channel(`team-match-matches:${tournamentId}:${uniqueChannelSuffix()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_match_matches',
            filter: `tournament_id=eq.${tournamentId}`,
          },
          (payload) => {
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

    // Channel for games updates.
    //
    // `team_match_games` carries no tournament_id, so postgres_changes cannot
    // filter this server-side — every client watching ANY team match receives
    // every game write on the site. Scope it here instead: a payload whose
    // match_id is not one of THIS tournament's matches is dropped, which stops
    // an unrelated tournament's scoring from forcing a matches-list refetch on
    // every open bracket (ARCH-03). Unknown match_id falls through to
    // invalidate, so a game arriving before the matches query settles is never
    // silently swallowed.
    const belongsToThisTournament = (matchId: string): boolean => {
      const matches = queryClient.getQueryData<Array<{ id: string }>>([
        'team-match-matches',
        tournamentId,
      ]);
      if (!matches) return true; // list not loaded yet — do not drop the event
      return matches.some((m) => m.id === matchId);
    };

    let gamesChannel: ReturnType<typeof supabase.channel> | null = null;
    try {
      gamesChannel = supabase
        .channel(`team-match-games:${tournamentId}:${uniqueChannelSuffix()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_match_games',
          },
          (payload) => {
            // DELETE sends `new` as an EMPTY OBJECT, not undefined — `??`
            // would never fall through to `old`. Pick whichever row actually
            // carries the id.
            const pick = (row: unknown): string | undefined =>
              row && typeof row === 'object' && 'match_id' in row &&
              typeof (row as { match_id: unknown }).match_id === 'string'
                ? (row as { match_id: string }).match_id
                : undefined;
            const matchId = pick(payload.new) ?? pick(payload.old);
            if (!matchId || !belongsToThisTournament(matchId)) return;

            queryClient.invalidateQueries({ queryKey: ['team-match-games', matchId] });
            queryClient.invalidateQueries({ queryKey: ['team-match-match', matchId] });

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
    if (!matchId) return undefined;

    // Channel for this specific match
    let matchChannel: ReturnType<typeof supabase.channel> | null = null;
    try {
      matchChannel = supabase
        .channel(`team-match-match:${matchId}:${uniqueChannelSuffix()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_match_matches',
            filter: `id=eq.${matchId}`,
          },
          () => {
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
        .channel(`team-match-games-match:${matchId}:${uniqueChannelSuffix()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_match_games',
            filter: `match_id=eq.${matchId}`,
          },
          () => {
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
