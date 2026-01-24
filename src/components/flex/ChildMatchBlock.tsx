import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import type { FlexMatch, FlexPlayer, FlexTeam, FlexTeamMember } from '@/hooks/useFlexTournament';

interface ChildMatchBlockProps {
  match: FlexMatch;
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  parentMatch?: FlexMatch | null; // Parent team match to get team members
  isCreator: boolean;
  matchIndex: number;
  onUpdateScore: (scoreA: number, scoreB: number) => void;
  onClearSlot: (slot: 'a1' | 'a2' | 'b1' | 'b2') => void;
  onSelectPlayer: (slot: 'a1' | 'a2' | 'b1' | 'b2', playerId: string) => void;
  onDelete: () => void;
}

interface SelectableSlotProps {
  id: string;
  playerId: string | null;
  players: FlexPlayer[];
  availablePlayers: FlexPlayer[]; // Players from the team for this side
  isCreator: boolean;
  onClear: () => void;
  onSelect: (playerId: string) => void;
  isSecondSlot?: boolean;
}

function SelectableSlot({ id, playerId, players, availablePlayers, isCreator, onClear, onSelect, isSecondSlot }: SelectableSlotProps) {
  const { t } = useI18n();
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: 'match-slot', slotId: id },
  });

  const selectedPlayer = playerId ? players.find(p => p.id === playerId) : null;

  // If no available players from team, show simple drop zone
  if (availablePlayers.length === 0) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex items-center justify-between px-2 py-1.5 rounded border-2 border-dashed min-h-[32px] transition-all text-xs",
          isOver && "border-primary bg-primary/10 scale-[1.02]",
          selectedPlayer && "border-solid bg-muted/50 border-muted-foreground/20"
        )}
      >
        {selectedPlayer ? (
          <>
            <div className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{selectedPlayer.name}</span>
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

  // Show select dropdown when team members are available
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-1 transition-all",
        isOver && "scale-[1.02]"
      )}
    >
      <Select
        value={playerId || ''}
        onValueChange={(value) => {
          if (value) onSelect(value);
        }}
        disabled={!isCreator}
      >
        <SelectTrigger className={cn(
          "h-8 text-xs flex-1",
          !playerId && "border-dashed"
        )}>
          <SelectValue placeholder={t.tools.flexTournament.selectPlayer}>
            {selectedPlayer && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate">{selectedPlayer.name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availablePlayers.map(player => (
            <SelectItem key={player.id} value={player.id}>
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3" />
                {player.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {playerId && isCreator && (
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

export function ChildMatchBlock({
  match,
  players,
  teams,
  teamMembers,
  parentMatch,
  isCreator,
  matchIndex,
  onUpdateScore,
  onClearSlot,
  onSelectPlayer,
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

  // Get players from Team A (parent match's slot_a_team_id)
  const teamAPlayers = useMemo(() => {
    if (!parentMatch?.slot_a_team_id) return [];
    const memberIds = teamMembers
      .filter(m => m.team_id === parentMatch.slot_a_team_id)
      .map(m => m.player_id);
    return players.filter(p => memberIds.includes(p.id));
  }, [parentMatch?.slot_a_team_id, teamMembers, players]);

  // Get players from Team B (parent match's slot_b_team_id)
  const teamBPlayers = useMemo(() => {
    if (!parentMatch?.slot_b_team_id) return [];
    const memberIds = teamMembers
      .filter(m => m.team_id === parentMatch.slot_b_team_id)
      .map(m => m.player_id);
    return players.filter(p => memberIds.includes(p.id));
  }, [parentMatch?.slot_b_team_id, teamMembers, players]);

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

        {/* Stacked layout: Team A row, Score, Team B row */}
        <div className="space-y-2">
          {/* Team A Row */}
          <div className="grid grid-cols-2 gap-1">
            <SelectableSlot
              id={`match-${match.id}-slot-a1`}
              playerId={match.slot_a1_player_id}
              players={players}
              availablePlayers={teamAPlayers}
              isCreator={isCreator}
              onClear={() => onClearSlot('a1')}
              onSelect={(id) => onSelectPlayer('a1', id)}
            />
            <SelectableSlot
              id={`match-${match.id}-slot-a2`}
              playerId={match.slot_a2_player_id}
              players={players}
              availablePlayers={teamAPlayers}
              isCreator={isCreator}
              onClear={() => onClearSlot('a2')}
              onSelect={(id) => onSelectPlayer('a2', id)}
              isSecondSlot
            />
          </div>

          {/* Score - centered with larger inputs */}
          <div className="flex items-center justify-center gap-3">
            <Input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              onBlur={handleScoreBlur}
              className="w-16 text-center h-10 text-lg font-semibold"
              disabled={!isCreator}
            />
            <span className="text-lg text-muted-foreground font-bold">-</span>
            <Input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              onBlur={handleScoreBlur}
              className="w-16 text-center h-10 text-lg font-semibold"
              disabled={!isCreator}
            />
          </div>

          {/* Team B Row */}
          <div className="grid grid-cols-2 gap-1">
            <SelectableSlot
              id={`match-${match.id}-slot-b1`}
              playerId={match.slot_b1_player_id}
              players={players}
              availablePlayers={teamBPlayers}
              isCreator={isCreator}
              onClear={() => onClearSlot('b1')}
              onSelect={(id) => onSelectPlayer('b1', id)}
            />
            <SelectableSlot
              id={`match-${match.id}-slot-b2`}
              playerId={match.slot_b2_player_id}
              players={players}
              availablePlayers={teamBPlayers}
              isCreator={isCreator}
              onClear={() => onClearSlot('b2')}
              onSelect={(id) => onSelectPlayer('b2', id)}
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
