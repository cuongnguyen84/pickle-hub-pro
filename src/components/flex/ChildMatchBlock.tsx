import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FlexMatch, FlexPlayer, FlexTeam, FlexTeamMember } from '@/hooks/useFlexTournament';

interface ChildMatchBlockProps {
  match: FlexMatch;
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  isCreator: boolean;
  matchIndex: number;
  onUpdateScore: (scoreA: number, scoreB: number) => void;
  onClearSlot: (slot: 'a1' | 'a2' | 'b1' | 'b2') => void;
  onDelete: () => void;
}

interface DroppableSlotProps {
  id: string;
  playerId: string | null;
  players: FlexPlayer[];
  isCreator: boolean;
  onClear: () => void;
  isSecondSlot?: boolean;
}

function DroppableSlot({ id, playerId, players, isCreator, onClear, isSecondSlot }: DroppableSlotProps) {
  const { t } = useI18n();
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: 'match-slot', slotId: id },
  });

  const name = playerId ? players.find(p => p.id === playerId)?.name : null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-between px-2 py-1.5 rounded border-2 border-dashed min-h-[32px] transition-all text-xs",
        isOver && "border-primary bg-primary/10 scale-[1.02]",
        name && "border-solid bg-muted/50 border-muted-foreground/20"
      )}
    >
      {name ? (
        <>
          <div className="flex items-center gap-1 min-w-0">
            <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{name}</span>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={onClear}>
              <X className="w-2.5 h-2.5" />
            </Button>
          )}
        </>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">{t.tools.flexTournament.dropPlayerHere}</span>
          {isSecondSlot && isCreator && (
            <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0 opacity-30 hover:opacity-100" onClick={onClear}>
              <X className="w-2.5 h-2.5" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function ChildMatchBlock({
  match,
  players,
  teams,
  teamMembers,
  isCreator,
  matchIndex,
  onUpdateScore,
  onClearSlot,
  onDelete,
}: ChildMatchBlockProps) {
  const { t } = useI18n();
  const [scoreA, setScoreA] = useState(match.score_a.toString());
  const [scoreB, setScoreB] = useState(match.score_b.toString());

  const handleScoreBlur = () => {
    const newScoreA = parseInt(scoreA) || 0;
    const newScoreB = parseInt(scoreB) || 0;
    if (newScoreA !== match.score_a || newScoreB !== match.score_b) {
      onUpdateScore(newScoreA, newScoreB);
    }
  };

  // Get winner name
  const getWinnerName = () => {
    if (!match.winner_side) return null;
    const side = match.winner_side;
    if (side === 'a') {
      const p1 = players.find(p => p.id === match.slot_a1_player_id)?.name;
      const p2 = match.slot_a2_player_id ? players.find(p => p.id === match.slot_a2_player_id)?.name : null;
      return p2 ? `${p1} & ${p2}` : p1;
    } else {
      const p1 = players.find(p => p.id === match.slot_b1_player_id)?.name;
      const p2 = match.slot_b2_player_id ? players.find(p => p.id === match.slot_b2_player_id)?.name : null;
      return p2 ? `${p1} & ${p2}` : p1;
    }
  };

  const winnerName = getWinnerName();

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-2 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {t.tools.flexTournament.childMatch} {matchIndex}
          </span>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onDelete}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
        </div>

        {/* Slots + Score in compact layout */}
        <div className="flex items-center gap-2">
          {/* Side A */}
          <div className="flex-1 space-y-1">
            <DroppableSlot
              id={`match-${match.id}-slot-a1`}
              playerId={match.slot_a1_player_id}
              players={players}
              isCreator={isCreator}
              onClear={() => onClearSlot('a1')}
            />
            <DroppableSlot
              id={`match-${match.id}-slot-a2`}
              playerId={match.slot_a2_player_id}
              players={players}
              isCreator={isCreator}
              onClear={() => onClearSlot('a2')}
              isSecondSlot
            />
          </div>

          {/* Score */}
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              onBlur={handleScoreBlur}
              className="w-10 text-center h-7 text-sm p-1"
              disabled={!isCreator}
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              onBlur={handleScoreBlur}
              className="w-10 text-center h-7 text-sm p-1"
              disabled={!isCreator}
            />
          </div>

          {/* Side B */}
          <div className="flex-1 space-y-1">
            <DroppableSlot
              id={`match-${match.id}-slot-b1`}
              playerId={match.slot_b1_player_id}
              players={players}
              isCreator={isCreator}
              onClear={() => onClearSlot('b1')}
            />
            <DroppableSlot
              id={`match-${match.id}-slot-b2`}
              playerId={match.slot_b2_player_id}
              players={players}
              isCreator={isCreator}
              onClear={() => onClearSlot('b2')}
              isSecondSlot
            />
          </div>
        </div>

        {/* Winner indicator */}
        {winnerName && (
          <div className="text-center">
            <Badge variant="secondary" className="text-xs">
              {winnerName} {t.tools.flexTournament.wins}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
