import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Grid3X3, Trash2, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FlexGroup, FlexGroupItem, FlexPlayer, FlexTeam, FlexPlayerStats } from '@/hooks/useFlexTournament';

interface GroupBlockProps {
  group: FlexGroup;
  items: FlexGroupItem[];
  players: FlexPlayer[];
  teams: FlexTeam[];
  playerStats: FlexPlayerStats[];
  isCreator: boolean;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onRemoveItem: (itemId: string) => void;
  onGenerateRR: () => void;
}

export function GroupBlock({
  group,
  items,
  players,
  teams,
  playerStats,
  isCreator,
  onUpdateName,
  onDelete,
  onRemoveItem,
  onGenerateRR,
}: GroupBlockProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

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

  const getItemStats = (item: FlexGroupItem) => {
    if (item.item_type === 'player' && item.player_id) {
      const stats = playerStats.find(s => s.player_id === item.player_id && s.group_id === group.id);
      return stats || { wins: 0, losses: 0, point_diff: 0 };
    }
    return { wins: 0, losses: 0, point_diff: 0 };
  };

  // Sort items by wins, then point_diff
  const sortedItems = [...items].sort((a, b) => {
    const statsA = getItemStats(a);
    const statsB = getItemStats(b);
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    return statsB.point_diff - statsA.point_diff;
  });

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
                {sortedItems.map((item, index) => {
                  const stats = getItemStats(item);
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
        )}
      </CardContent>
    </Card>
  );
}
