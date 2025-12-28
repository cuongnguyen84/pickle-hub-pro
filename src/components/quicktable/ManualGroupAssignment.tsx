import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Check, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerInput {
  id: string;
  name: string;
  team: string;
  seed: string;
}

interface ManualGroupAssignmentProps {
  players: PlayerInput[];
  groupCount: number;
  onComplete: (groupAssignments: Map<number, PlayerInput[]>) => void;
  onCancel: () => void;
}

export function ManualGroupAssignment({
  players,
  groupCount,
  onComplete,
  onCancel,
}: ManualGroupAssignmentProps) {
  // Map from group index (0-based) to list of players
  const [groupAssignments, setGroupAssignments] = useState<Map<number, PlayerInput[]>>(
    () => new Map(Array.from({ length: groupCount }, (_, i) => [i, []]))
  );
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerInput | null>(null);

  // Get list of unassigned players
  const unassignedPlayers = useMemo(() => {
    const assignedIds = new Set<string>();
    groupAssignments.forEach(group => {
      group.forEach(p => assignedIds.add(p.id));
    });
    return players.filter(p => p.name.trim() && !assignedIds.has(p.id));
  }, [players, groupAssignments]);

  // Get filled players count
  const filledPlayers = players.filter(p => p.name.trim());

  // Calculate max players per group
  const maxPerGroup = Math.ceil(filledPlayers.length / groupCount);
  const minPerGroup = Math.floor(filledPlayers.length / groupCount);

  // Group names (A, B, C, ...)
  const groupNames = Array.from({ length: groupCount }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  // Handle player click - select/deselect
  const handlePlayerClick = (player: PlayerInput) => {
    if (selectedPlayer?.id === player.id) {
      setSelectedPlayer(null);
    } else {
      setSelectedPlayer(player);
    }
  };

  // Handle group click - assign selected player
  const handleGroupClick = (groupIndex: number) => {
    if (!selectedPlayer) return;

    const currentGroupPlayers = groupAssignments.get(groupIndex) || [];
    
    // Check if group is full
    if (currentGroupPlayers.length >= maxPerGroup) {
      return;
    }

    // Assign player to group
    setGroupAssignments(prev => {
      const newMap = new Map(prev);
      newMap.set(groupIndex, [...currentGroupPlayers, selectedPlayer]);
      return newMap;
    });

    setSelectedPlayer(null);
  };

  // Remove player from group
  const handleRemoveFromGroup = (groupIndex: number, playerId: string) => {
    setGroupAssignments(prev => {
      const newMap = new Map(prev);
      const currentPlayers = newMap.get(groupIndex) || [];
      newMap.set(
        groupIndex,
        currentPlayers.filter(p => p.id !== playerId)
      );
      return newMap;
    });
  };

  // Validation warnings
  const warnings = useMemo(() => {
    const result: string[] = [];
    
    // Check for unbalanced groups
    const sizes = Array.from(groupAssignments.values()).map(g => g.length);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    if (maxSize - minSize > 1) {
      result.push('Các bảng không cân bằng số lượng VĐV');
    }

    // Check for same team in group
    groupAssignments.forEach((groupPlayers, groupIndex) => {
      const teamCounts = new Map<string, number>();
      groupPlayers.forEach(p => {
        if (p.team) {
          teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
        }
      });
      teamCounts.forEach((count, team) => {
        if (count > 1) {
          result.push(`Bảng ${groupNames[groupIndex]}: ${count} VĐV cùng team "${team}"`);
        }
      });
    });

    // Check for high seeds in same group
    groupAssignments.forEach((groupPlayers, groupIndex) => {
      const topSeeds = groupPlayers.filter(p => p.seed && parseInt(p.seed) <= 2);
      if (topSeeds.length > 1) {
        result.push(`Bảng ${groupNames[groupIndex]}: ${topSeeds.length} hạt giống cao (seed 1-2)`);
      }
    });

    return result;
  }, [groupAssignments, groupNames]);

  // Check if all players are assigned
  const allAssigned = unassignedPlayers.length === 0;

  // Check minimum players per group
  const hasEmptyGroups = Array.from(groupAssignments.values()).some(g => g.length === 0);

  const handleConfirm = () => {
    if (!allAssigned || hasEmptyGroups) return;
    onComplete(groupAssignments);
  };

  return (
    <div className="space-y-4">
      {/* Header instruction */}
      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
          <div>
            <p className="font-medium text-primary">Hướng dẫn chia bảng thủ công</p>
            <ol className="text-foreground-secondary mt-1 space-y-0.5 list-decimal list-inside">
              <li>Click chọn VĐV từ danh sách bên trái</li>
              <li>Click vào bảng muốn đưa VĐV vào</li>
              <li>Click vào VĐV đã chia để xóa khỏi bảng</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unassigned players */}
        <Card className="border-dashed">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Chưa phân bảng ({unassignedPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <ScrollArea className="h-[200px]">
              <div className="space-y-1.5">
                {unassignedPlayers.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Tất cả VĐV đã được phân bảng
                  </div>
                ) : (
                  unassignedPlayers.map(player => (
                    <div
                      key={player.id}
                      onClick={() => handlePlayerClick(player)}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors border',
                        selectedPlayer?.id === player.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-transparent'
                      )}
                    >
                      <span className="flex-1 text-sm font-medium truncate">
                        {player.name}
                        {player.seed && (
                          <span className={cn(
                            "ml-1 text-xs",
                            selectedPlayer?.id === player.id 
                              ? "text-primary-foreground/80" 
                              : "text-muted-foreground"
                          )}>
                            (#{player.seed})
                          </span>
                        )}
                      </span>
                      {player.team && (
                        <Badge 
                          variant={selectedPlayer?.id === player.id ? "secondary" : "outline"} 
                          className="text-xs flex-shrink-0"
                        >
                          {player.team}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Groups */}
        <div className="space-y-3">
          {Array.from({ length: groupCount }, (_, groupIndex) => {
            const groupPlayers = groupAssignments.get(groupIndex) || [];
            const isFull = groupPlayers.length >= maxPerGroup;
            const canAccept = selectedPlayer && !isFull;

            return (
              <Card
                key={groupIndex}
                onClick={() => canAccept && handleGroupClick(groupIndex)}
                className={cn(
                  'transition-all',
                  canAccept && 'cursor-pointer ring-2 ring-primary ring-offset-2 hover:bg-primary/5',
                  isFull && selectedPlayer && 'opacity-50 cursor-not-allowed'
                )}
              >
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      Bảng {groupNames[groupIndex]}
                      <Badge variant="outline" className="text-xs">
                        {groupPlayers.length}/{minPerGroup}-{maxPerGroup}
                      </Badge>
                    </span>
                    {isFull && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  {groupPlayers.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded">
                      {selectedPlayer ? 'Click để thêm VĐV' : 'Chưa có VĐV'}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {groupPlayers.map(player => (
                        <Badge
                          key={player.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromGroup(groupIndex, player.id);
                          }}
                        >
                          {player.name}
                          {player.seed && <span className="ml-1 opacity-70">#{player.seed}</span>}
                          {player.team && <span className="ml-1 opacity-70">({player.team})</span>}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-300">Cảnh báo</p>
              <ul className="text-yellow-600 dark:text-yellow-400 mt-1 space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <Button variant="outline" onClick={onCancel}>
          Quay lại
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!allAssigned || hasEmptyGroups}
        >
          {!allAssigned
            ? `Còn ${unassignedPlayers.length} VĐV chưa phân bảng`
            : hasEmptyGroups
            ? 'Có bảng chưa có VĐV'
            : 'Xác nhận chia bảng'}
        </Button>
      </div>
    </div>
  );
}
