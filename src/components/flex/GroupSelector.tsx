import { useState } from 'react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Grid3X3, User, Users, Trash2, X, RefreshCw, Plus, Swords } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { FlexGroup, FlexGroupItem, FlexPlayer, FlexTeam, FlexPlayerStats, FlexPairStats, FlexTeamMember, FlexMatch } from '@/hooks/useFlexTournament';

interface GroupSelectorProps {
  groups: FlexGroup[];
  groupItems: FlexGroupItem[];
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  playerStats: FlexPlayerStats[];
  pairStats: FlexPairStats[];
  matches: FlexMatch[];
  isCreator: boolean;
  onUpdateGroupName: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onGenerateRR: (groupId: string) => void;
  onToggleIncludeDoubles: (groupId: string, include: boolean) => void;
  onAddMatchToGroup: (groupId: string) => void;
}

export function GroupSelector({
  groups,
  groupItems,
  players,
  teams,
  teamMembers,
  playerStats,
  pairStats,
  matches,
  isCreator,
  onUpdateGroupName,
  onDeleteGroup,
  onRemoveItem,
  onGenerateRR,
  onToggleIncludeDoubles,
  onAddMatchToGroup,
}: GroupSelectorProps) {
  const { t } = useI18n();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groups[0]?.id || null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'singles' | 'doubles' | 'teams' | 'individuals'>('singles');

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const selectedGroupItems = groupItems.filter(gi => gi.group_id === selectedGroupId);
  const selectedGroupMatches = matches.filter(m => m.group_id === selectedGroupId);

  // Determine group type
  const groupType = selectedGroupItems.length > 0
    ? selectedGroupItems[0].item_type === 'team' ? 'team' : 'player'
    : null;

  // Get teams in selected group
  const teamsInGroup = selectedGroupItems
    .filter(item => item.item_type === 'team')
    .map(item => teams.find(t => t.id === item.team_id))
    .filter(Boolean) as FlexTeam[];

  // Initialize selectedTeamIds when teams change
  if (teamsInGroup.length > 0 && selectedTeamIds.length === 0) {
    setSelectedTeamIds(teamsInGroup.map(t => t.id));
  }

  const { isOver, setNodeRef } = useDroppable({
    id: selectedGroupId ? `group-drop-${selectedGroupId}` : 'no-group',
    data: { type: 'group', groupId: selectedGroupId },
    disabled: !selectedGroupId,
  });

  // Stats helpers
  const getSinglesStats = (playerId: string) => {
    const stats = playerStats.find(s => s.player_id === playerId && s.group_id === selectedGroupId);
    return stats || { wins: 0, losses: 0, point_diff: 0 };
  };

  const sortedSinglesItems = [...selectedGroupItems]
    .filter(item => item.item_type === 'player')
    .sort((a, b) => {
      const statsA = getSinglesStats(a.player_id!);
      const statsB = getSinglesStats(b.player_id!);
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
      return statsB.point_diff - statsA.point_diff;
    });

  const sortedPairStats = [...pairStats]
    .filter(ps => ps.group_id === selectedGroupId)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });

  const getPairName = (player1Id: string, player2Id: string) => {
    const p1 = players.find(p => p.id === player1Id)?.name || 'Unknown';
    const p2 = players.find(p => p.id === player2Id)?.name || 'Unknown';
    return `${p1} / ${p2}`;
  };

  // Team stats
  const getTeamStats = (teamId: string) => {
    const members = teamMembers.filter(m => m.team_id === teamId);
    let wins = 0, losses = 0, pointDiff = 0;
    members.forEach(member => {
      const stats = playerStats.find(s => s.player_id === member.player_id && s.group_id === selectedGroupId);
      if (stats) {
        wins += stats.wins;
        losses += stats.losses;
        pointDiff += stats.point_diff;
      }
    });
    return { wins, losses, point_diff: pointDiff };
  };

  const sortedTeams = [...teamsInGroup].sort((a, b) => {
    const statsA = getTeamStats(a.id);
    const statsB = getTeamStats(b.id);
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    return statsB.point_diff - statsA.point_diff;
  });

  // Players from selected teams
  const playersFromSelectedTeams = (() => {
    if (selectedTeamIds.length === 0) return [];
    const playerIds = new Set<string>();
    selectedTeamIds.forEach(teamId => {
      teamMembers.filter(m => m.team_id === teamId).forEach(m => playerIds.add(m.player_id));
    });
    return players.filter(p => playerIds.has(p.id));
  })();

  const sortedPlayersFromTeams = [...playersFromSelectedTeams].sort((a, b) => {
    const statsA = getSinglesStats(a.id);
    const statsB = getSinglesStats(b.id);
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    return statsB.point_diff - statsA.point_diff;
  });

  const getPlayerTeamName = (playerId: string) => {
    const member = teamMembers.find(m => m.player_id === playerId);
    if (!member) return '';
    return teams.find(t => t.id === member.team_id)?.name || '';
  };

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSelectAllTeams = () => {
    setSelectedTeamIds(prev => 
      prev.length === teamsInGroup.length ? [] : teamsInGroup.map(t => t.id)
    );
  };

  const getItemName = (item: FlexGroupItem) => {
    if (item.item_type === 'player') {
      return players.find(p => p.id === item.player_id)?.name || 'Unknown';
    }
    return teams.find(t => t.id === item.team_id)?.name || 'Unknown';
  };

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground text-center text-sm">
          {t.tools.flexTournament.noGroups}
        </p>
      </div>
    );
  }

  // Determine group type for each group
  const getGroupType = (groupId: string): 'team' | 'player' | null => {
    const items = groupItems.filter(gi => gi.group_id === groupId);
    if (items.length === 0) return null;
    return items[0].item_type === 'team' ? 'team' : 'player';
  };

  return (
    <div className="space-y-3">
      {/* Group selector tabs */}
      <div className="flex flex-wrap gap-1.5">
        {groups.map(group => {
          const itemCount = groupItems.filter(gi => gi.group_id === group.id).length;
          const matchCount = matches.filter(m => m.group_id === group.id).length;
          const type = getGroupType(group.id);
          const GroupIcon = type === 'team' ? Users : User;
          return (
            <Button
              key={group.id}
              variant={selectedGroupId === group.id ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 gap-1"
              onClick={() => {
                setSelectedGroupId(group.id);
                setSelectedTeamIds([]);
              }}
            >
              {type ? <GroupIcon className="w-3 h-3" /> : <Grid3X3 className="w-3 h-3" />}
              {group.name}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">
                {itemCount}/{matchCount}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Selected group content */}
      {selectedGroup && (
        <Card
          ref={setNodeRef}
          className={cn(
            "transition-all",
            isOver && "ring-2 ring-primary border-primary bg-primary/5"
          )}
        >
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-muted-foreground" />
                {selectedGroup.name}
                <span className="text-xs text-muted-foreground">
                  ({selectedGroupItems.length} {groupType === 'team' ? t.tools.flexTournament.tabTeams.toLowerCase() : 'VĐV'})
                </span>
              </CardTitle>
              <div className="flex items-center gap-1">
                {isCreator && (
                  <>
                    {/* Add match button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => onAddMatchToGroup(selectedGroup.id)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {t.tools.flexTournament.addMatch}
                    </Button>
                    {selectedGroupItems.length >= 2 && groupType === 'player' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onGenerateRR(selectedGroup.id)}
                        className="h-7 text-xs px-2"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        RR
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDeleteGroup(selectedGroup.id)}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3">
            {selectedGroupItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                {t.tools.flexTournament.dropPlayerHere}
              </p>
            ) : groupType === 'team' ? (
              // Team-based group
              <Tabs
                value={activeTab === 'singles' || activeTab === 'doubles' ? 'teams' : activeTab}
                onValueChange={(v) => setActiveTab(v as 'teams' | 'individuals')}
              >
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="teams" className="text-xs gap-1">
                    <Users className="w-3 h-3" />
                    {t.tools.flexTournament.groupTabTeams}
                  </TabsTrigger>
                  <TabsTrigger value="individuals" className="text-xs gap-1">
                    <User className="w-3 h-3" />
                    {t.tools.flexTournament.groupTabIndividuals}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="teams" className="mt-2">
                  <StandingsTable
                    items={sortedTeams.map((team, idx) => {
                      const stats = getTeamStats(team.id);
                      const item = selectedGroupItems.find(i => i.team_id === team.id);
                      return {
                        rank: idx + 1,
                        name: team.name,
                        wins: stats.wins,
                        losses: stats.losses,
                        pointDiff: stats.point_diff,
                        itemId: item?.id,
                      };
                    })}
                    isCreator={isCreator}
                    onRemoveItem={onRemoveItem}
                  />
                </TabsContent>

                <TabsContent value="individuals" className="mt-2 space-y-2">
                  {/* Team filter */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="all-teams-selector"
                        checked={selectedTeamIds.length === teamsInGroup.length}
                        onCheckedChange={handleSelectAllTeams}
                      />
                      <label htmlFor="all-teams-selector" className="text-xs cursor-pointer font-medium">
                        {t.tools.flexTournament.allTeams}
                      </label>
                    </div>
                    <span className="text-muted-foreground">|</span>
                    {teamsInGroup.map(team => (
                      <div key={team.id} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`team-filter-${team.id}`}
                          checked={selectedTeamIds.includes(team.id)}
                          onCheckedChange={() => handleTeamToggle(team.id)}
                        />
                        <label htmlFor={`team-filter-${team.id}`} className="text-xs cursor-pointer">
                          {team.name}
                        </label>
                      </div>
                    ))}
                  </div>

                  {sortedPlayersFromTeams.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {t.tools.flexTournament.selectTeamsToShow}
                    </p>
                  ) : (
                    <StandingsTable
                      items={sortedPlayersFromTeams.map((player, idx) => {
                        const stats = getSinglesStats(player.id);
                        return {
                          rank: idx + 1,
                          name: player.name,
                          subtitle: getPlayerTeamName(player.id),
                          wins: stats.wins,
                          losses: stats.losses,
                          pointDiff: stats.point_diff,
                        };
                      })}
                      isCreator={false}
                    />
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              // Player-based group
              <Tabs
                value={activeTab === 'teams' || activeTab === 'individuals' ? 'singles' : activeTab}
                onValueChange={(v) => setActiveTab(v as 'singles' | 'doubles')}
              >
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="singles" className="text-xs gap-1">
                    <User className="w-3 h-3" />
                    {t.tools.flexTournament.matchType.singles}
                  </TabsTrigger>
                  <TabsTrigger value="doubles" className="text-xs gap-1">
                    <Users className="w-3 h-3" />
                    {t.tools.flexTournament.matchType.doubles}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="singles" className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`include-doubles-${selectedGroup.id}`}
                      checked={selectedGroup.include_doubles_in_singles ?? true}
                      onCheckedChange={(checked) => onToggleIncludeDoubles(selectedGroup.id, !!checked)}
                      disabled={!isCreator}
                    />
                    <label
                      htmlFor={`include-doubles-${selectedGroup.id}`}
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      {t.tools.flexTournament.includeDoublesInSingles}
                    </label>
                  </div>

                  <StandingsTable
                    items={sortedSinglesItems.map((item, idx) => {
                      const stats = getSinglesStats(item.player_id!);
                      return {
                        rank: idx + 1,
                        name: getItemName(item),
                        wins: stats.wins,
                        losses: stats.losses,
                        pointDiff: stats.point_diff,
                        itemId: item.id,
                      };
                    })}
                    isCreator={isCreator}
                    onRemoveItem={onRemoveItem}
                  />
                </TabsContent>

                <TabsContent value="doubles" className="mt-2">
                  {sortedPairStats.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {t.tools.flexTournament.noPairStats}
                    </p>
                  ) : (
                    <StandingsTable
                      items={sortedPairStats.map((ps, idx) => ({
                        rank: idx + 1,
                        name: getPairName(ps.player1_id, ps.player2_id),
                        wins: ps.wins,
                        losses: ps.losses,
                        pointDiff: ps.point_diff,
                      }))}
                      isCreator={false}
                    />
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Group matches summary */}
            {selectedGroupMatches.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <Swords className="w-3 h-3" />
                  {t.tools.flexTournament.tabMatches}: {selectedGroupMatches.length}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Reusable standings table
interface StandingsTableProps {
  items: {
    rank: number;
    name: string;
    subtitle?: string;
    wins: number;
    losses: number;
    pointDiff: number;
    itemId?: string;
  }[];
  isCreator: boolean;
  onRemoveItem?: (itemId: string) => void;
}

function StandingsTable({ items, isCreator, onRemoveItem }: StandingsTableProps) {
  const { t } = useI18n();

  return (
    <div className="overflow-x-auto -mx-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6 px-1 text-xs">#</TableHead>
            <TableHead className="px-1 text-xs">{t.tools.flexTournament.stats.name}</TableHead>
            <TableHead className="text-center w-8 px-1 text-xs">{t.tools.flexTournament.stats.wins}</TableHead>
            <TableHead className="text-center w-8 px-1 text-xs">{t.tools.flexTournament.stats.losses}</TableHead>
            <TableHead className="text-center w-10 px-1 text-xs">{t.tools.flexTournament.stats.pointDiff}</TableHead>
            {isCreator && onRemoveItem && <TableHead className="w-6 px-1"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.name + item.rank}>
              <TableCell className="font-medium px-1 py-1.5 text-xs">{item.rank}</TableCell>
              <TableCell className="px-1 py-1.5 text-xs">
                <div className="truncate max-w-[120px]">{item.name}</div>
                {item.subtitle && (
                  <div className="text-[10px] text-muted-foreground truncate">{item.subtitle}</div>
                )}
              </TableCell>
              <TableCell className="text-center px-1 py-1.5 text-xs">{item.wins}</TableCell>
              <TableCell className="text-center px-1 py-1.5 text-xs">{item.losses}</TableCell>
              <TableCell className="text-center px-1 py-1.5 text-xs">
                {item.pointDiff > 0 ? `+${item.pointDiff}` : item.pointDiff}
              </TableCell>
              {isCreator && onRemoveItem && item.itemId && (
                <TableCell className="px-1 py-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => onRemoveItem(item.itemId!)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
