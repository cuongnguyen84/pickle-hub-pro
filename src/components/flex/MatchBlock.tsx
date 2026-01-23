import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Swords, Trash2, X, GripVertical, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FlexMatch, FlexPlayer, FlexTeam } from '@/hooks/useFlexTournament';

interface MatchBlockProps {
  match: FlexMatch;
  players: FlexPlayer[];
  teams: FlexTeam[];
  isCreator: boolean;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onUpdateScore: (scoreA: number, scoreB: number) => void;
  onClearSlot: (slot: 'a1' | 'a2' | 'b1' | 'b2' | 'a_team' | 'b_team') => void;
}

interface DroppableSlotProps {
  id: string;
  label: string;
  playerId: string | null;
  teamId: string | null;
  players: FlexPlayer[];
  teams: FlexTeam[];
  isCreator: boolean;
  onClear: () => void;
}

function DroppableSlot({ id, label, playerId, teamId, players, teams, isCreator, onClear }: DroppableSlotProps) {
  const { t } = useI18n();
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: 'match-slot', slotId: id },
  });

  const getName = () => {
    if (playerId) {
      return players.find(p => p.id === playerId)?.name || 'Unknown';
    }
    if (teamId) {
      return teams.find(t => t.id === teamId)?.name || 'Unknown';
    }
    return null;
  };

  const name = getName();

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-between px-2 py-1.5 rounded border-2 border-dashed min-h-[36px]",
        isOver && "border-primary bg-primary/10",
        name && "border-solid bg-muted/50"
      )}
    >
      {name ? (
        <>
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm">{name}</span>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClear}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">{t.tools.flexTournament.dropPlayerHere}</span>
      )}
    </div>
  );
}

export function MatchBlock({
  match,
  players,
  teams,
  isCreator,
  onUpdateName,
  onDelete,
  onUpdateScore,
  onClearSlot,
}: MatchBlockProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(match.name);
  const [scoreA, setScoreA] = useState(match.score_a.toString());
  const [scoreB, setScoreB] = useState(match.score_b.toString());

  const handleSaveName = () => {
    if (editName.trim() && editName !== match.name) {
      onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  const handleScoreBlur = () => {
    const newScoreA = parseInt(scoreA) || 0;
    const newScoreB = parseInt(scoreB) || 0;
    if (newScoreA !== match.score_a || newScoreB !== match.score_b) {
      onUpdateScore(newScoreA, newScoreB);
    }
  };

  const isDoubles = match.match_type === 'doubles';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
            <Swords className="w-4 h-4 text-muted-foreground" />
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
                {match.name}
              </CardTitle>
            )}
            <Badge variant="secondary" className="text-xs">
              {isDoubles ? t.tools.flexTournament.matchType.doubles : t.tools.flexTournament.matchType.singles}
            </Badge>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Side A */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t.tools.flexTournament.slotA}</div>
          <DroppableSlot
            id={`match-${match.id}-slot-a1`}
            label="A1"
            playerId={match.slot_a1_player_id}
            teamId={match.slot_a_team_id}
            players={players}
            teams={teams}
            isCreator={isCreator}
            onClear={() => onClearSlot(match.slot_a_team_id ? 'a_team' : 'a1')}
          />
          {isDoubles && !match.slot_a_team_id && (
            <DroppableSlot
              id={`match-${match.id}-slot-a2`}
              label="A2"
              playerId={match.slot_a2_player_id}
              teamId={null}
              players={players}
              teams={teams}
              isCreator={isCreator}
              onClear={() => onClearSlot('a2')}
            />
          )}
        </div>

        {/* VS + Score */}
        <div className="flex items-center justify-center gap-2">
          <Input
            type="number"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            onBlur={handleScoreBlur}
            className="w-14 text-center"
            disabled={!isCreator}
          />
          <span className="text-sm font-medium text-muted-foreground">{t.tools.flexTournament.vs}</span>
          <Input
            type="number"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            onBlur={handleScoreBlur}
            className="w-14 text-center"
            disabled={!isCreator}
          />
        </div>

        {/* Side B */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t.tools.flexTournament.slotB}</div>
          <DroppableSlot
            id={`match-${match.id}-slot-b1`}
            label="B1"
            playerId={match.slot_b1_player_id}
            teamId={match.slot_b_team_id}
            players={players}
            teams={teams}
            isCreator={isCreator}
            onClear={() => onClearSlot(match.slot_b_team_id ? 'b_team' : 'b1')}
          />
          {isDoubles && !match.slot_b_team_id && (
            <DroppableSlot
              id={`match-${match.id}-slot-b2`}
              label="B2"
              playerId={match.slot_b2_player_id}
              teamId={null}
              players={players}
              teams={teams}
              isCreator={isCreator}
              onClear={() => onClearSlot('b2')}
            />
          )}
        </div>

        {/* Winner indicator */}
        {match.winner_side && (
          <div className="text-center">
            <Badge variant="default" className="text-xs">
              {match.winner_side === 'a' ? t.tools.flexTournament.slotA : t.tools.flexTournament.slotB} wins
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
