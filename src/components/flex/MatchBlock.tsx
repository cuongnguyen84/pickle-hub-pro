import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Swords, Trash2, X, User, Users, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { ChildMatchBlock } from './ChildMatchBlock';
import type { FlexMatch, FlexPlayer, FlexTeam, FlexTeamMember, FlexGroup } from '@/hooks/useFlexTournament';

interface MatchBlockProps {
  match: FlexMatch;
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  groups: FlexGroup[];
  isCreator: boolean;
  hasGroups: boolean;
  isTeamMatch?: boolean; // True when this is a team vs team match (show 2 team slots instead of 4 player slots)
  childMatches?: FlexMatch[]; // Child matches for team matches
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onUpdateScore: (scoreA: number, scoreB: number) => void;
  onClearSlot: (slot: 'a1' | 'a2' | 'b1' | 'b2' | 'a_team' | 'b_team') => void;
  onToggleCountsForStandings: (counts: boolean) => void;
  onAddChildMatch?: () => void;
  onUpdateChildMatchScore?: (matchId: string, scoreA: number, scoreB: number) => void;
  onClearChildMatchSlot?: (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2') => void;
  onSelectChildMatchPlayer?: (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2', playerId: string) => void;
  onDeleteChildMatch?: (matchId: string) => void;
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
  isSecondSlot?: boolean; // True for slot a2/b2 - show faded delete button when empty
  isTeamSlot?: boolean; // True when this slot is for teams, not players
}

function DroppableSlot({ id, playerId, teamId, players, teams, isCreator, onClear, disabled, isSecondSlot, isTeamSlot }: DroppableSlotProps) {
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
  const Icon = isTeamSlot || teamId ? Users : User;
  const placeholderText = isTeamSlot ? t.tools.flexTournament.dropTeamHere : t.tools.flexTournament.dropPlayerHere;

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
            <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate">{name}</span>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={onClear}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">{placeholderText}</span>
          {/* Show faded delete button for second slot when empty - allows user to know they can remove slot 2 */}
          {isSecondSlot && isCreator && (
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 opacity-30 hover:opacity-100" onClick={onClear}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function MatchBlock({
  match,
  players,
  teams,
  teamMembers,
  groups,
  isCreator,
  hasGroups,
  isTeamMatch = false,
  childMatches = [],
  onUpdateName,
  onDelete,
  onUpdateScore,
  onClearSlot,
  onToggleCountsForStandings,
  onAddChildMatch,
  onUpdateChildMatchScore,
  onClearChildMatchSlot,
  onSelectChildMatchPlayer,
  onDeleteChildMatch,
}: MatchBlockProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(match.name);
  const [scoreA, setScoreA] = useState(match.score_a.toString());
  const [scoreB, setScoreB] = useState(match.score_b.toString());
  const [isChildrenOpen, setIsChildrenOpen] = useState(true);

  // Sync score state when match prop updates (e.g., from realtime/child match updates)
  useEffect(() => {
    setScoreA(match.score_a.toString());
    setScoreB(match.score_b.toString());
  }, [match.score_a, match.score_b]);

  // Check if this is a team match with child matches
  const hasChildMatches = childMatches.length > 0;
  const isTeamMatchWithTeams = isTeamMatch && (match.slot_a_team_id || match.slot_b_team_id);

  // Helper: find team that contains a player
  const getPlayerTeam = (playerId: string): FlexTeam | null => {
    const member = teamMembers.find(m => m.player_id === playerId);
    if (!member) return null;
    return teams.find(t => t.id === member.team_id) || null;
  };

  // Check if both players on same side belong to same team
  const sideATeam = useMemo(() => {
    if (!match.slot_a1_player_id || !match.slot_a2_player_id) return null;
    const team1 = getPlayerTeam(match.slot_a1_player_id);
    const team2 = getPlayerTeam(match.slot_a2_player_id);
    if (team1 && team2 && team1.id === team2.id) return team1;
    return null;
  }, [match.slot_a1_player_id, match.slot_a2_player_id, teamMembers, teams]);

  const sideBTeam = useMemo(() => {
    if (!match.slot_b1_player_id || !match.slot_b2_player_id) return null;
    const team1 = getPlayerTeam(match.slot_b1_player_id);
    const team2 = getPlayerTeam(match.slot_b2_player_id);
    if (team1 && team2 && team1.id === team2.id) return team1;
    return null;
  }, [match.slot_b1_player_id, match.slot_b2_player_id, teamMembers, teams]);

  // Get group name if match belongs to a group
  const groupName = match.group_id 
    ? groups.find(g => g.id === match.group_id)?.name 
    : null;

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
            {/* Removed "Đơn/Đôi" badge per user request */}
            {groupName && (
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {groupName}
              </Badge>
            )}
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
          {/* Team highlight for Side A - only show for player matches when both players are from same team */}
          {!isTeamMatch && sideATeam && (
            <div className="flex items-center gap-1 text-xs text-primary font-medium px-1">
              <Users className="w-3 h-3" />
              {sideATeam.name}
            </div>
          )}
          
          {isTeamMatch ? (
            // Team match: single slot for team
            <DroppableSlot
              id={`match-${match.id}-slot-a1`}
              playerId={null}
              teamId={match.slot_a_team_id}
              players={players}
              teams={teams}
              isCreator={isCreator}
              onClear={() => onClearSlot('a_team')}
              isTeamSlot
            />
          ) : (
            // Player match: slot for first player
            <>
              <DroppableSlot
                id={`match-${match.id}-slot-a1`}
                playerId={match.slot_a1_player_id}
                teamId={null}
                players={players}
                teams={teams}
                isCreator={isCreator}
                onClear={() => onClearSlot('a1')}
              />
              {/* Slot a2 for doubles */}
              <DroppableSlot
                id={`match-${match.id}-slot-a2`}
                playerId={match.slot_a2_player_id}
                teamId={null}
                players={players}
                teams={teams}
                isCreator={isCreator}
                onClear={() => onClearSlot('a2')}
                isSecondSlot
              />
            </>
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
          {/* Team highlight for Side B - only show for player matches when both players are from same team */}
          {!isTeamMatch && sideBTeam && (
            <div className="flex items-center gap-1 text-xs text-primary font-medium px-1">
              <Users className="w-3 h-3" />
              {sideBTeam.name}
            </div>
          )}
          
          {isTeamMatch ? (
            // Team match: single slot for team
            <DroppableSlot
              id={`match-${match.id}-slot-b1`}
              playerId={null}
              teamId={match.slot_b_team_id}
              players={players}
              teams={teams}
              isCreator={isCreator}
              onClear={() => onClearSlot('b_team')}
              isTeamSlot
            />
          ) : (
            // Player match: slots for players
            <>
              <DroppableSlot
                id={`match-${match.id}-slot-b1`}
                playerId={match.slot_b1_player_id}
                teamId={null}
                players={players}
                teams={teams}
                isCreator={isCreator}
                onClear={() => onClearSlot('b1')}
              />
              {/* Slot b2 for doubles */}
              <DroppableSlot
                id={`match-${match.id}-slot-b2`}
                playerId={match.slot_b2_player_id}
                teamId={null}
                players={players}
                teams={teams}
                isCreator={isCreator}
                onClear={() => onClearSlot('b2')}
                isSecondSlot
              />
            </>
          )}
        </div>

        {/* Winner indicator - show winner name */}
        {match.winner_side && (
          <div className="text-center pt-1">
            <Badge variant="default" className="text-xs">
              {(() => {
                const winnerSide = match.winner_side;
                if (winnerSide === 'a') {
                  if (match.slot_a_team_id) {
                    return teams.find(t => t.id === match.slot_a_team_id)?.name || 'A';
                  }
                  const p1 = players.find(p => p.id === match.slot_a1_player_id)?.name;
                  const p2 = match.slot_a2_player_id ? players.find(p => p.id === match.slot_a2_player_id)?.name : null;
                  return p2 ? `${p1} & ${p2}` : p1 || 'A';
                } else {
                  if (match.slot_b_team_id) {
                    return teams.find(t => t.id === match.slot_b_team_id)?.name || 'B';
                  }
                  const p1 = players.find(p => p.id === match.slot_b1_player_id)?.name;
                  const p2 = match.slot_b2_player_id ? players.find(p => p.id === match.slot_b2_player_id)?.name : null;
                  return p2 ? `${p1} & ${p2}` : p1 || 'B';
                }
              })()} {t.tools.flexTournament.wins}
            </Badge>
          </div>
        )}

        {/* Child matches section - for team matches */}
        {isTeamMatchWithTeams && (
          <Collapsible open={isChildrenOpen} onOpenChange={setIsChildrenOpen}>
            <div className="border-t pt-2 mt-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7">
                  <span className="flex items-center gap-1">
                    <Swords className="w-3 h-3" />
                    {t.tools.flexTournament.childMatches} ({childMatches.length})
                  </span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isChildrenOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-2 mt-2">
                {childMatches.map((childMatch, idx) => (
                  <ChildMatchBlock
                    key={childMatch.id}
                    match={childMatch}
                    players={players}
                    teams={teams}
                    teamMembers={teamMembers}
                    parentMatch={match}
                    isCreator={isCreator}
                    matchIndex={idx + 1}
                    onUpdateScore={(scoreA, scoreB) => onUpdateChildMatchScore?.(childMatch.id, scoreA, scoreB)}
                    onClearSlot={(slot) => onClearChildMatchSlot?.(childMatch.id, slot)}
                    onSelectPlayer={(slot, playerId) => onSelectChildMatchPlayer?.(childMatch.id, slot, playerId)}
                    onDelete={() => onDeleteChildMatch?.(childMatch.id)}
                  />
                ))}
                
                {/* Add child match button */}
                {isCreator && onAddChildMatch && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={onAddChildMatch}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {t.tools.flexTournament.addChildMatch}
                  </Button>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
