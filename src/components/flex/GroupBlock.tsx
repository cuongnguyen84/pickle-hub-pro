import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Grid3X3, Trash2, X, RefreshCw, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FlexGroup, FlexGroupItem, FlexPlayer, FlexTeam, FlexPlayerStats, FlexPairStats } from '@/hooks/useFlexTournament';

interface GroupBlockProps {
  group: FlexGroup;
  items: FlexGroupItem[];
  players: FlexPlayer[];
  teams: FlexTeam[];
  playerStats: FlexPlayerStats[];
  pairStats: FlexPairStats[];
  isCreator: boolean;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onRemoveItem: (itemId: string) => void;
  onGenerateRR: () => void;
  onToggleIncludeDoubles: (include: boolean) => void;
}

export function GroupBlock({
  group,
  items,
  players,
  teams,
  playerStats,
  pairStats,
  isCreator,
  onUpdateName,
  onDelete,
  onRemoveItem,
  onGenerateRR,
  onToggleIncludeDoubles,
}: GroupBlockProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [activeTab, setActiveTab] = useState<'singles' | 'doubles'>('singles');

  const { isOver, setNodeRef } = useDroppable({
    id: `group-drop-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  const handleSaveName = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  const getItemName = (item: FlexGroupItem) => {
    if (item.item_type === 'player') {
      return players.find(p => p.id === item.player_id)?.name || 'Unknown';
    }
    return teams.find(t => t.id === item.team_id)?.name || 'Unknown';
  };

  // Singles stats: per player
  const getSinglesStats = (playerId: string) => {
    const stats = playerStats.find(s => s.player_id === playerId && s.group_id === group.id);
    return stats || { wins: 0, losses: 0, point_diff: 0 };
  };

  // Sort items by wins, then point_diff for singles
  const sortedSinglesItems = [...items]
    .filter(item => item.item_type === 'player')
    .sort((a, b) => {
      const statsA = getSinglesStats(a.player_id!);
      const statsB = getSinglesStats(b.player_id!);
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
      return statsB.point_diff - statsA.point_diff;
    });

  // Doubles stats: per pair
  const sortedPairStats = [...pairStats]
    .filter(ps => ps.group_id === group.id)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });

  const getPairName = (player1Id: string, player2Id: string) => {
    const p1 = players.find(p => p.id === player1Id)?.name || 'Unknown';
    const p2 = players.find(p => p.id === player2Id)?.name || 'Unknown';
    return `${p1} / ${p2}`;
  };

  const includeDoubles = group.include_doubles_in_singles ?? true;

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "transition-all",
        isOver && "ring-2 ring-primary border-primary bg-primary/5"
      )}
    >
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Grid3X3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="h-7 text-sm font-semibold"
                autoFocus
              />
            ) : (
              <CardTitle
                className="text-sm cursor-pointer hover:text-primary truncate"
                onClick={() => isCreator && setIsEditing(true)}
              >
                {group.name}
              </CardTitle>
            )}
            <span className="text-xs text-muted-foreground flex-shrink-0">({items.length})</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isCreator && items.length >= 2 && (
              <Button variant="ghost" size="sm" onClick={onGenerateRR} className="h-7 text-xs px-2">
                <RefreshCw className="w-3 h-3 mr-1" />
                RR
              </Button>
            )}
            {isCreator && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2 border-2 border-dashed rounded-lg">
            {t.tools.flexTournament.dropPlayerHere}
          </p>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'singles' | 'doubles')}>
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
              {/* Include doubles checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`include-doubles-${group.id}`}
                  checked={includeDoubles}
                  onCheckedChange={(checked) => onToggleIncludeDoubles(!!checked)}
                  disabled={!isCreator}
                />
                <label
                  htmlFor={`include-doubles-${group.id}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  {t.tools.flexTournament.includeDoublesInSingles}
                </label>
              </div>

              {/* Singles standings table */}
              <div className="overflow-x-auto -mx-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6 px-1 text-xs">#</TableHead>
                      <TableHead className="px-1 text-xs">{t.tools.flexTournament.stats.name}</TableHead>
                      <TableHead className="text-center w-8 px-1 text-xs">{t.tools.flexTournament.stats.wins}</TableHead>
                      <TableHead className="text-center w-8 px-1 text-xs">{t.tools.flexTournament.stats.losses}</TableHead>
                      <TableHead className="text-center w-10 px-1 text-xs">{t.tools.flexTournament.stats.pointDiff}</TableHead>
                      {isCreator && <TableHead className="w-6 px-1"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSinglesItems.map((item, index) => {
                      const stats = getSinglesStats(item.player_id!);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium px-1 py-1.5 text-xs">{index + 1}</TableCell>
                          <TableCell className="px-1 py-1.5 text-xs truncate max-w-[120px]">{getItemName(item)}</TableCell>
                          <TableCell className="text-center px-1 py-1.5 text-xs">{stats.wins}</TableCell>
                          <TableCell className="text-center px-1 py-1.5 text-xs">{stats.losses}</TableCell>
                          <TableCell className="text-center px-1 py-1.5 text-xs">
                            {stats.point_diff > 0 ? `+${stats.point_diff}` : stats.point_diff}
                          </TableCell>
                          {isCreator && (
                            <TableCell className="px-1 py-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => onRemoveItem(item.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="doubles" className="mt-2">
              {/* Doubles standings table - by pair */}
              {sortedPairStats.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t.tools.flexTournament.noDoublesStats}
                </p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6 px-1 text-xs">#</TableHead>
                        <TableHead className="px-1 text-xs">{t.tools.flexTournament.stats.pair}</TableHead>
                        <TableHead className="text-center w-8 px-1 text-xs">{t.tools.flexTournament.stats.wins}</TableHead>
                        <TableHead className="text-center w-8 px-1 text-xs">{t.tools.flexTournament.stats.losses}</TableHead>
                        <TableHead className="text-center w-10 px-1 text-xs">{t.tools.flexTournament.stats.pointDiff}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPairStats.map((pair, index) => (
                        <TableRow key={`${pair.player1_id}-${pair.player2_id}`}>
                          <TableCell className="font-medium px-1 py-1.5 text-xs">{index + 1}</TableCell>
                          <TableCell className="px-1 py-1.5 text-xs truncate max-w-[150px]">
                            {getPairName(pair.player1_id, pair.player2_id)}
                          </TableCell>
                          <TableCell className="text-center px-1 py-1.5 text-xs">{pair.wins}</TableCell>
                          <TableCell className="text-center px-1 py-1.5 text-xs">{pair.losses}</TableCell>
                          <TableCell className="text-center px-1 py-1.5 text-xs">
                            {pair.point_diff > 0 ? `+${pair.point_diff}` : pair.point_diff}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
