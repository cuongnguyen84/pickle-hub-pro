import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FlexTeam, FlexTeamMember, FlexPlayer } from '@/hooks/useFlexTournament';

interface TeamBlockProps {
  team: FlexTeam;
  members: FlexTeamMember[];
  players: FlexPlayer[];
  isCreator: boolean;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onRemoveMember: (memberId: string) => void;
}

export function TeamBlock({
  team,
  members,
  players,
  isCreator,
  onUpdateName,
  onDelete,
  onRemoveMember,
}: TeamBlockProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(team.name);

  const { isOver, setNodeRef } = useDroppable({
    id: `team-drop-${team.id}`,
    data: { type: 'team', teamId: team.id },
  });

  const handleSaveName = () => {
    if (editName.trim() && editName !== team.name) {
      onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "transition-all",
        isOver && "ring-2 ring-primary border-primary bg-primary/5"
      )}
    >
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                {team.name}
              </CardTitle>
            )}
            <span className="text-xs text-muted-foreground flex-shrink-0">({members.length})</span>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onDelete}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2 border-2 border-dashed rounded-lg">
            {t.tools.flexTournament.dropPlayerHere}
          </p>
        ) : (
          <div className="space-y-1">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded text-sm"
              >
                <span className="truncate">{getPlayerName(member.player_id)}</span>
                {isCreator && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 flex-shrink-0"
                    onClick={() => onRemoveMember(member.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
