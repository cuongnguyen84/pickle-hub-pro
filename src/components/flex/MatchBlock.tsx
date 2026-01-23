import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Swords, Trash2, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FlexMatch, FlexPlayer, FlexTeam } from '@/hooks/useFlexTournament';

interface MatchBlockProps {
  match: FlexMatch;
  players: FlexPlayer[];
  teams: FlexTeam[];
  isCreator: boolean;
  hasGroups: boolean;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onUpdateScore: (scoreA: number, scoreB: number) => void;
  onClearSlot: (slot: 'a1' | 'a2' | 'b1' | 'b2' | 'a_team' | 'b_team') => void;
  onToggleCountsForStandings: (counts: boolean) => void;
}

interface DroppableSlotProps {
  id: string;
  playerId: string | null;
  teamId: string | null;
  players: FlexPlayer[];
  teams: FlexTeam[];
  isCreator: boolean;
  onClear: () => void;
  disabled?: boolean;
}

function DroppableSlot({ id, playerId, teamId, players, teams, isCreator, onClear, disabled }: DroppableSlotProps) {
  const { t } = useI18n();
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: 'match-slot', slotId: id },
    disabled,
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
        "flex items-center justify-between px-2 py-2 rounded border-2 border-dashed min-h-[40px] transition-all",
        isOver && !disabled && "border-primary bg-primary/10 scale-[1.02]",
        name && "border-solid bg-muted/50 border-muted-foreground/20",
        disabled && "opacity-50"
      )}
    >
      {name ? (
        <>
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate">{name}</span>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={onClear}>
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
  hasGroups,
  onUpdateName,
  onDelete,
  onUpdateScore,
  onClearSlot,
  onToggleCountsForStandings,
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
  
  // Check if match is "complete" (has all required players)
  const isMatchFilled = isDoubles
    ? (match.slot_a1_player_id && match.slot_a2_player_id && match.slot_b1_player_id && match.slot_b2_player_id) ||
      (match.slot_a_team_id && match.slot_b_team_id)
    : match.slot_a1_player_id && match.slot_b1_player_id;

  // Show hint if match is filled, counts for standings, but no groups exist
  const showNoGroupHint = isMatchFilled && match.counts_for_standings && !hasGroups;

  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Swords className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                {match.name}
              </CardTitle>
            )}
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {isDoubles ? t.tools.flexTournament.matchType.doubles : t.tools.flexTournament.matchType.singles}
            </Badge>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onDelete}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3 space-y-2">
        {/* Counts for standings checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id={`counts-standings-${match.id}`}
            checked={match.counts_for_standings}
            onCheckedChange={(checked) => onToggleCountsForStandings(!!checked)}
            disabled={!isCreator}
          />
          <label
            htmlFor={`counts-standings-${match.id}`}
            className="text-xs text-muted-foreground cursor-pointer"
          >
            {t.tools.flexTournament.countsForStandings}
          </label>
        </div>

        {/* No group hint */}
        {showNoGroupHint && (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded">
            {t.tools.flexTournament.noGroupHint}
          </div>
        )}

        {/* Side A */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t.tools.flexTournament.slotA}</div>
          <DroppableSlot
            id={`match-${match.id}-slot-a1`}
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
        <div className="flex items-center justify-center gap-2 py-1">
          <Input
            type="number"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            onBlur={handleScoreBlur}
            className="w-14 text-center h-9 text-base"
            disabled={!isCreator}
          />
          <span className="text-sm font-medium text-muted-foreground">{t.tools.flexTournament.vs}</span>
          <Input
            type="number"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            onBlur={handleScoreBlur}
            className="w-14 text-center h-9 text-base"
            disabled={!isCreator}
          />
        </div>

        {/* Side B */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t.tools.flexTournament.slotB}</div>
          <DroppableSlot
            id={`match-${match.id}-slot-b1`}
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
          <div className="text-center pt-1">
            <Badge variant="default" className="text-xs">
              {match.winner_side === 'a' ? t.tools.flexTournament.slotA : t.tools.flexTournament.slotB} wins
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
