import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseFlexRealtimeOptions {
  tournamentId: string;
  onPlayersChange?: () => void;
  onTeamsChange?: () => void;
  onGroupsChange?: () => void;
  onMatchesChange?: () => void;
  onTeamMembersChange?: () => void;
  onGroupItemsChange?: () => void;
  onPlayerStatsChange?: () => void;
  onPairStatsChange?: () => void;
}

export function useFlexRealtime({
  tournamentId,
  onPlayersChange,
  onTeamsChange,
  onGroupsChange,
  onMatchesChange,
  onTeamMembersChange,
  onGroupItemsChange,
  onPlayerStatsChange,
  onPairStatsChange,
}: UseFlexRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const setupSubscription = useCallback(() => {
    if (!tournamentId) return;

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`flex-tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => onPlayersChange?.()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_teams',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => onTeamsChange?.()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_groups',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => onGroupsChange?.()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => onMatchesChange?.()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_team_members',
        },
        () => onTeamMembersChange?.()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_group_items',
        },
        () => onGroupItemsChange?.()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_player_stats',
        },
        () => onPlayerStatsChange?.()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_pair_stats',
        },
        () => onPairStatsChange?.()
      )
      .subscribe();

    channelRef.current = channel;
  }, [
    tournamentId,
    onPlayersChange,
    onTeamsChange,
    onGroupsChange,
    onMatchesChange,
    onTeamMembersChange,
    onGroupItemsChange,
    onPlayerStatsChange,
    onPairStatsChange,
  ]);

  useEffect(() => {
    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupSubscription]);

  return { reconnect: setupSubscription };
}
