import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface RegisteredPlayersListProps {
  tableId: string;
  isDoubles?: boolean;
}

// Hook to fetch all registered players (pending + approved) for singles
function useAllRegistrations(tableId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["all-registrations", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_table_registrations")
        .select("id, display_name, team, status, rating_system, skill_level, skill_system_name, skill_description")
        .eq("table_id", tableId)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!tableId,
  });
}

// Hook to fetch all registered teams (pending + approved) for doubles
function useAllTeams(tableId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["all-teams-registered", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_table_teams")
        .select("*")
        .eq("table_id", tableId)
        .not("team_status", "in", "(rejected,removed)")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!tableId,
  });
}

export function RegisteredPlayersList({ tableId, isDoubles = false }: RegisteredPlayersListProps) {
  const { t } = useI18n();
  const { data: singlesData = [], isLoading: singlesLoading } = useAllRegistrations(tableId, !isDoubles);
  const { data: teamsData = [], isLoading: teamsLoading } = useAllTeams(tableId, isDoubles);

  const isLoading = isDoubles ? teamsLoading : singlesLoading;
  const data = isDoubles ? teamsData : singlesData;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {t.quickTable.registeredPlayers}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {t.quickTable.registeredPlayers}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{t.quickTable.noRegisteredPlayers}</p>
        </CardContent>
      </Card>
    );
  }

  // Format skill display
  const formatSkill = (reg: any) => {
    if (reg.rating_system === 'DUPR' || reg.player1_rating_system === 'DUPR') {
      const level = reg.skill_level || reg.player1_skill_level;
      return level ? `DUPR ${level}` : 'DUPR';
    }
    if (reg.rating_system === 'other' || reg.player1_rating_system === 'other') {
      const systemName = reg.skill_system_name || 'Other';
      const level = reg.skill_level || reg.player1_skill_level;
      return level ? `${systemName}: ${level}` : systemName;
    }
    return reg.skill_description || t.quickTable.notDeclared;
  };

  const isApproved = (item: any) => {
    if (isDoubles) {
      return item.btc_approved || item.team_status === 'approved';
    }
    return item.status === 'approved';
  };

  const getDisplayName = (item: any) => {
    if (isDoubles) {
      let name = item.player1_display_name;
      if (item.player2_display_name) {
        name += ` & ${item.player2_display_name}`;
      }
      return name;
    }
    return item.display_name;
  };

  const getTeam = (item: any) => {
    if (isDoubles) {
      const teams = [item.player1_team, item.player2_team].filter(Boolean);
      return teams.length > 0 ? teams.join(' / ') : null;
    }
    return item.team;
  };

  const getPartnerStatus = (item: any) => {
    if (!isDoubles) return null;
    if (item.player2_user_id) {
      return t.quickTable.hasPartnerStatus;
    }
    return t.quickTable.noPartnerStatus;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {t.quickTable.registeredPlayers}
          <Badge variant="secondary" className="ml-2">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{isDoubles ? t.quickTable.teamName : t.quickTable.playerName}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.quickTable.club}</TableHead>
              <TableHead className="text-center">{t.quickTable.statusHeader}</TableHead>
              {isDoubles && <TableHead className="hidden md:table-cell text-center">Partner</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item: any, idx: number) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium">{getDisplayName(item)}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {getTeam(item) || '—'}
                </TableCell>
                <TableCell className="text-center">
                  {isApproved(item) ? (
                    <Badge className="gap-1 bg-green-600">
                      <CheckCircle2 className="w-3 h-3" />
                      {t.quickTable.approved}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {t.quickTable.pending}
                    </Badge>
                  )}
                </TableCell>
                {isDoubles && (
                  <TableCell className="hidden md:table-cell text-center text-sm text-muted-foreground">
                    {getPartnerStatus(item)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default RegisteredPlayersList;
