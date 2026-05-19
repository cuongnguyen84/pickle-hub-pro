import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Swords, Trash2, X, User, Users, ChevronDown, Plus, Grid3X3 } from 'lucide-react';
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
  isTeamMatch?: boolean;
  childMatches?: FlexMatch[];
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onUpdateScore: (scoreA: number, scoreB: number) => void;
  onClearSlot: (slot: 'a1' | 'a2' | 'b1' | 'b2' | 'a_team' | 'b_team') => void;
  onToggleCountsForStandings: (counts: boolean) => void;
  onUpdateGroupId?: (groupId: string | null) => void;
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
  isSecondSlot?: boolean;
  isTeamSlot?: boolean;
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

  const filled = !!name;

  const slotStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: 'var(--tl-radius)',
    border: filled
      ? '1px solid var(--tl-border)'
      : `1px dashed ${isOver && !disabled ? 'var(--tl-green)' : 'var(--tl-border)'}`,
    background: isOver && !disabled
      ? 'var(--tl-green-glow)'
      : filled
        ? 'var(--tl-bg)'
        : 'transparent',
    minHeight: 40,
    transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
    transform: isOver && !disabled ? 'scale(1.02)' : 'scale(1)',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={slotStyle}>
      {filled ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Icon className="w-3 h-3" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--tl-fg)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
          </div>
          {isCreator && (
            <button
              type="button"
              onClick={onClear}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--tl-fg-3)',
                cursor: 'pointer',
                padding: 2,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)';
              }}
              aria-label="Clear slot"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </>
      ) : (
        <>
          <span
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              color: 'var(--tl-fg-3)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {placeholderText}
          </span>
          {isSecondSlot && isCreator && (
            <button
              type="button"
              onClick={onClear}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--tl-fg-4)',
                cursor: 'pointer',
                padding: 2,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                opacity: 0.4,
                transition: 'opacity 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
                (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0.4';
                (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-4)';
              }}
              aria-label="Remove second slot"
            >
              <X className="w-3 h-3" />
            </button>
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
  onUpdateGroupId,
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

  useEffect(() => {
    setScoreA(match.score_a.toString());
    setScoreB(match.score_b.toString());
  }, [match.score_a, match.score_b]);

  const hasChildMatches = childMatches.length > 0;
  const isTeamMatchWithTeams = isTeamMatch && (match.slot_a_team_id || match.slot_b_team_id);

  const getPlayerTeam = (playerId: string): FlexTeam | null => {
    const member = teamMembers.find(m => m.player_id === playerId);
    if (!member) return null;
    return teams.find(t => t.id === member.team_id) || null;
  };

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

  const isMatchFilled = isDoubles
    ? (match.slot_a1_player_id && match.slot_a2_player_id && match.slot_b1_player_id && match.slot_b2_player_id) ||
      (match.slot_a_team_id && match.slot_b_team_id)
    : match.slot_a1_player_id && match.slot_b1_player_id;

  const showNoGroupHint = isMatchFilled && match.counts_for_standings && !hasGroups;

  const sideStyle = (highlight: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 8,
    borderRadius: 'var(--tl-radius)',
    background: highlight ? 'var(--tl-green-glow)' : 'transparent',
    border: highlight ? '1px solid rgba(0, 185, 107, 0.30)' : '1px solid transparent',
  });

  return (
    <div
      style={{
        background: 'var(--tl-bg-elev)',
        border: '1px solid var(--tl-border)',
        borderRadius: 'var(--tl-radius-lg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
          borderBottom: '1px solid var(--tl-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <Swords className="w-4 h-4" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
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
            <h4
              style={{
                fontFamily: 'Instrument Serif, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 17,
                letterSpacing: '-0.015em',
                color: 'var(--tl-fg)',
                margin: 0,
                cursor: isCreator ? 'pointer' : 'default',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onClick={() => isCreator && setIsEditing(true)}
            >
              {match.name}
            </h4>
          )}
          {groupName && (
            <span
              style={{
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10,
                fontWeight: 500,
                padding: '2px 7px',
                borderRadius: 4,
                background: 'var(--tl-surface)',
                color: 'var(--tl-fg-3)',
                border: '1px solid var(--tl-border)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              {groupName}
            </span>
          )}
        </div>
        {isCreator && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--tl-live)',
              cursor: 'pointer',
              padding: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            aria-label="Delete match"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Group assignment dropdown */}
        {!match.parent_match_id && isCreator && hasGroups && onUpdateGroupId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Grid3X3 className="w-3.5 h-3.5" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
            <Select
              value={match.group_id || 'none'}
              onValueChange={(value) => onUpdateGroupId(value === 'none' ? null : value)}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder={t.tools.flexTournament.selectGroup} />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="none" className="text-xs">
                  {t.tools.flexTournament.noGroup}
                </SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id} className="text-xs">
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Counts for standings checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox
            id={`counts-standings-${match.id}`}
            checked={match.counts_for_standings}
            onCheckedChange={(checked) => onToggleCountsForStandings(!!checked)}
            disabled={!isCreator}
          />
          <label
            htmlFor={`counts-standings-${match.id}`}
            style={{ fontSize: 12, color: 'var(--tl-fg-3)', cursor: 'pointer' }}
          >
            {t.tools.flexTournament.countsForStandings}
          </label>
        </div>

        {/* No group hint */}
        {showNoGroupHint && !match.group_id && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--tl-gold)',
              background: 'rgba(233, 182, 73, 0.10)',
              border: '1px solid rgba(233, 182, 73, 0.25)',
              padding: '6px 10px',
              borderRadius: 'var(--tl-radius)',
            }}
          >
            {t.tools.flexTournament.noGroupHint}
          </div>
        )}

        {/* Side A */}
        <div style={sideStyle(!!(isTeamMatch && match.slot_a_team_id))}>
          {!isTeamMatch && sideATeam && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                fontWeight: 500,
                color: 'var(--tl-green)',
                padding: '0 4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <Users className="w-3 h-3" />
              {sideATeam.name}
            </div>
          )}

          {isTeamMatch ? (
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0' }}>
          <div
            style={{
              width: 56,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--tl-radius)',
              background: isTeamMatchWithTeams ? 'var(--tl-surface)' : 'var(--tl-bg)',
              border: '1px solid var(--tl-border)',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--tl-fg)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isTeamMatchWithTeams ? (
              <span>{match.score_a}</span>
            ) : (
              <Input
                type="number"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                onBlur={handleScoreBlur}
                className="w-14 text-center h-9 text-base border-0 p-0 bg-transparent"
                disabled={!isCreator}
              />
            )}
          </div>
          <span
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--tl-fg-3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {t.tools.flexTournament.vs}
          </span>
          <div
            style={{
              width: 56,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--tl-radius)',
              background: isTeamMatchWithTeams ? 'var(--tl-surface)' : 'var(--tl-bg)',
              border: '1px solid var(--tl-border)',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--tl-fg)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isTeamMatchWithTeams ? (
              <span>{match.score_b}</span>
            ) : (
              <Input
                type="number"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                onBlur={handleScoreBlur}
                className="w-14 text-center h-9 text-base border-0 p-0 bg-transparent"
                disabled={!isCreator}
              />
            )}
          </div>
        </div>

        {/* Side B */}
        <div style={sideStyle(!!(isTeamMatch && match.slot_b_team_id))}>
          {!isTeamMatch && sideBTeam && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                fontWeight: 500,
                color: 'var(--tl-green)',
                padding: '0 4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <Users className="w-3 h-3" />
              {sideBTeam.name}
            </div>
          )}

          {isTeamMatch ? (
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

        {/* Winner indicator */}
        {match.winner_side && (
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'var(--tl-green)',
                color: 'var(--tl-bg)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
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
              })()}{' '}
              {t.tools.flexTournament.wins}
            </span>
          </div>
        )}

        {/* Child matches section */}
        {isTeamMatchWithTeams && (
          <Collapsible open={isChildrenOpen} onOpenChange={setIsChildrenOpen}>
            <div style={{ borderTop: '1px solid var(--tl-border)', paddingTop: 8, marginTop: 4 }}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--tl-radius)',
                    background: 'transparent',
                    border: 0,
                    color: 'var(--tl-fg-2)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tl-surface)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Swords className="w-3 h-3" />
                    {t.tools.flexTournament.childMatches} ({childMatches.length})
                  </span>
                  <ChevronDown
                    className="w-3 h-3"
                    style={{
                      transition: 'transform 0.15s',
                      transform: isChildrenOpen ? 'rotate(180deg)' : 'rotate(0)',
                    }}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
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

                  {isCreator && onAddChildMatch && (
                    <button
                      type="button"
                      className="tl-btn"
                      onClick={onAddChildMatch}
                      style={{ width: '100%', justifyContent: 'center', padding: '6px 10px', fontSize: 12 }}
                    >
                      <Plus className="w-3 h-3" />
                      {t.tools.flexTournament.addChildMatch}
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
