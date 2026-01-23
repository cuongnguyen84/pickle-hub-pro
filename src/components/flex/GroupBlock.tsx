import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Grid3X3, Trash2, X, GripVertical, RefreshCw } from 'lucide-react';
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
            <Grid3X3 className="w-4 h-4 text-muted-foreground" />
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
                className="text-sm cursor-pointer hover:text-primary"
                onClick={() => isCreator && setIsEditing(true)}
              >
                {group.name}
              </CardTitle>
            )}
            <span className="text-xs text-muted-foreground">({items.length})</span>
          </div>
          <div className="flex items-center gap-1">
            {isCreator && items.length >= 2 && (
              <Button variant="ghost" size="sm" onClick={onGenerateRR} className="h-7 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                {t.tools.flexTournament.generateRR}
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
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3 border-2 border-dashed rounded-lg">
            {t.tools.flexTournament.dropPlayerHere}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">{t.tools.flexTournament.stats.rank}</TableHead>
                <TableHead>{t.tools.flexTournament.stats.name}</TableHead>
                <TableHead className="text-center w-12">{t.tools.flexTournament.stats.wins}</TableHead>
                <TableHead className="text-center w-12">{t.tools.flexTournament.stats.losses}</TableHead>
                <TableHead className="text-center w-14">{t.tools.flexTournament.stats.pointDiff}</TableHead>
                {isCreator && <TableHead className="w-8"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, index) => {
                const stats = getItemStats(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{getItemName(item)}</TableCell>
                    <TableCell className="text-center">{stats.wins}</TableCell>
                    <TableCell className="text-center">{stats.losses}</TableCell>
                    <TableCell className="text-center">
                      {stats.point_diff > 0 ? `+${stats.point_diff}` : stats.point_diff}
                    </TableCell>
                    {isCreator && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
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
        )}
      </CardContent>
    </Card>
  );
}
