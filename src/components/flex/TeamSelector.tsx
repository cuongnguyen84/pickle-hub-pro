import { useState } from 'react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Trash2, X } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { FlexTeam, FlexTeamMember, FlexPlayer } from '@/hooks/useFlexTournament';

interface TeamSelectorProps {
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  players: FlexPlayer[];
  isCreator: boolean;
  onUpdateTeamName: (teamId: string, name: string) => void;
  onDeleteTeam: (teamId: string) => void;
  onRemoveMember: (memberId: string) => void;
}

export function TeamSelector({
  teams,
  teamMembers,
  players,
  isCreator,
  onUpdateTeamName,
  onDeleteTeam,
  onRemoveMember,
}: TeamSelectorProps) {
  const { t } = useI18n();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id || null);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedTeamMembers = teamMembers.filter(m => m.team_id === selectedTeamId);

  const { isOver, setNodeRef } = useDroppable({
    id: selectedTeamId ? `team-drop-${selectedTeamId}` : 'no-team',
    data: { type: 'team', teamId: selectedTeamId },
    disabled: !selectedTeamId,
  });

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground text-center text-sm">
          {t.tools.flexTournament.noTeams}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Team selector tabs */}
      <div className="flex flex-wrap gap-1.5">
        {teams.map(team => {
          const memberCount = teamMembers.filter(m => m.team_id === team.id).length;
          return (
            <Button
              key={team.id}
              variant={selectedTeamId === team.id ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 gap-1"
              onClick={() => setSelectedTeamId(team.id)}
            >
              <Users className="w-3 h-3" />
              {team.name}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">
                {memberCount}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Selected team content */}
      {selectedTeam && (
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
                <Users className="w-4 h-4 text-muted-foreground" />
                {selectedTeam.name}
                <span className="text-xs text-muted-foreground">
                  ({selectedTeamMembers.length})
                </span>
              </CardTitle>
              {isCreator && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onDeleteTeam(selectedTeam.id)}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3">
            {selectedTeamMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                {t.tools.flexTournament.dropPlayerHere}
              </p>
            ) : (
              <div className="space-y-1">
                {selectedTeamMembers.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5"
                  >
                    <span className="text-sm">{getPlayerName(member.player_id)}</span>
                    {isCreator && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
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
      )}
    </div>
  );
}
