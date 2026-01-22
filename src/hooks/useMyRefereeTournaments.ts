import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface RefereeTournament {
  id: string;
  name: string;
  share_id: string;
  status: string;
  type: 'quick_table' | 'doubles_elimination' | 'team_match';
  player_count?: number;
  team_count?: number;
  format?: string;
  start_time?: string | null;
  created_at?: string;
}

export function useMyRefereeTournaments() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<RefereeTournament[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMyRefereeTournaments = useCallback(async () => {
    if (!user) {
      setTournaments([]);
      return;
    }

    setLoading(true);
    try {
      const allTournaments: RefereeTournament[] = [];

      // Fetch Quick Tables where user is referee
      const { data: quickTableReferees } = await supabase
        .from('quick_table_referees')
        .select('table_id')
        .eq('user_id', user.id);

      if (quickTableReferees && quickTableReferees.length > 0) {
        const tableIds = quickTableReferees.map(r => r.table_id);
        const { data: quickTables } = await supabase
          .from('quick_tables')
          .select('id, name, share_id, status, player_count, format, start_time, created_at')
          .in('id', tableIds);

        if (quickTables) {
          for (const qt of quickTables) {
            allTournaments.push({
              id: qt.id,
              name: qt.name,
              share_id: qt.share_id,
              status: qt.status,
              type: 'quick_table',
              player_count: qt.player_count,
              format: qt.format,
              start_time: qt.start_time,
              created_at: qt.created_at,
            });
          }
        }
      }

      // Fetch Doubles Elimination where user is referee
      const { data: doublesReferees } = await supabase
        .from('doubles_elimination_referees')
        .select('tournament_id')
        .eq('user_id', user.id);

      if (doublesReferees && doublesReferees.length > 0) {
        const tournamentIds = doublesReferees.map(r => r.tournament_id).filter(Boolean) as string[];
        if (tournamentIds.length > 0) {
          const { data: doublesTournaments } = await supabase
            .from('doubles_elimination_tournaments')
            .select('id, name, share_id, status, team_count, start_time, created_at')
            .in('id', tournamentIds);

          if (doublesTournaments) {
            for (const dt of doublesTournaments) {
              allTournaments.push({
                id: dt.id,
                name: dt.name,
                share_id: dt.share_id,
                status: dt.status,
                type: 'doubles_elimination',
                team_count: dt.team_count,
                start_time: dt.start_time,
                created_at: dt.created_at,
              });
            }
          }
        }
      }

      // Fetch Team Match where user is referee
      const { data: teamMatchReferees } = await supabase
        .from('team_match_referees')
        .select('tournament_id')
        .eq('user_id', user.id);

      if (teamMatchReferees && teamMatchReferees.length > 0) {
        const tournamentIds = teamMatchReferees.map(r => r.tournament_id);
        const { data: teamMatchTournaments } = await supabase
          .from('team_match_tournaments')
          .select('id, name, share_id, status, team_count, format, created_at')
          .in('id', tournamentIds);

        if (teamMatchTournaments) {
          for (const tm of teamMatchTournaments) {
            allTournaments.push({
              id: tm.id,
              name: tm.name,
              share_id: tm.share_id,
              status: tm.status || 'draft',
              type: 'team_match',
              team_count: tm.team_count,
              format: tm.format,
              created_at: tm.created_at || undefined,
            });
          }
        }
      }

      // Sort by created_at desc
      allTournaments.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setTournaments(allTournaments);
    } catch (error) {
      console.error('Error fetching referee tournaments:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyRefereeTournaments();
  }, [fetchMyRefereeTournaments]);

  return {
    tournaments,
    loading,
    refresh: fetchMyRefereeTournaments,
  };
}
