import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X, User, AlertTriangle } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { FlexMatch, FlexPlayer, FlexTeam, FlexTeamMember } from '@/hooks/useFlexTournament';

interface ChildMatchBlockProps {
  match: FlexMatch;
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  parentMatch?: FlexMatch | null;
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
  availablePlayers: FlexPlayer[];
  isCreator: boolean;
  usedPlayerIds: Set<string>;
  onClear: () => void;
  onSelect: (playerId: string) => void;
  isSecondSlot?: boolean;
}

function SelectableSlot({ id, playerId, players, availablePlayers, isCreator, usedPlayerIds, onClear, onSelect, isSecondSlot }: SelectableSlotProps) {
  const { t } = useI18n();
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: 'match-slot', slotId: id },
  });

  const [localPlayerId, setLocalPlayerId] = useState(playerId);

  useEffect(() => {
    setLocalPlayerId(playerId);
  }, [playerId]);

  const selectedPlayer = localPlayerId ? players.find(p => p.id === localPlayerId) : null;

  const filteredAvailablePlayers = useMemo(() => {
    return availablePlayers.filter(p => !usedPlayerIds.has(p.id) || p.id === localPlayerId);
  }, [availablePlayers, usedPlayerIds, localPlayerId]);

  const handleSelect = useCallback((value: string) => {
    if (value) {
      setLocalPlayerId(value);
      onSelect(value);
    }
  }, [onSelect]);

  // No team members available — simple drop zone with token border
  if (availablePlayers.length === 0) {
    const slotStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 8px',
      borderRadius: 'var(--tl-radius)',
      border: selectedPlayer
        ? '1px solid var(--tl-border)'
        : `1px dashed ${isOver ? 'var(--tl-green)' : 'var(--tl-border)'}`,
      background: isOver
        ? 'var(--tl-green-glow)'
        : selectedPlayer
          ? 'var(--tl-bg)'
          : 'transparent',
      minHeight: 32,
      transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
      transform: isOver ? 'scale(1.02)' : 'scale(1)',
      fontSize: 12,
    };

    return (
      <div ref={setNodeRef} style={slotStyle}>
        {selectedPlayer ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <User className="w-3 h-3" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--tl-fg)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedPlayer.name}
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
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)'; }}
                aria-label="Clear slot"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </>
        ) : (
          <>
            <span
              style={{
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {t.tools.flexTournament.dropPlayerHere}
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
                  opacity: 0.4,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
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
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // With team members — Select dropdown (auto-themed via D4)
  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'transform 0.15s',
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <Select
        value={localPlayerId || ''}
        onValueChange={handleSelect}
        disabled={!isCreator}
      >
        <SelectTrigger className={`h-8 text-xs flex-1 ${!localPlayerId ? 'border-dashed' : ''}`}>
          <SelectValue placeholder={t.tools.flexTournament.selectPlayer}>
            {selectedPlayer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <User className="w-3 h-3" />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedPlayer.name}
                </span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="z-50">
          {filteredAvailablePlayers.map(player => (
            <SelectItem key={player.id} value={player.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User className="w-3 h-3" />
                {player.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {localPlayerId && isCreator && (
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
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)'; }}
          aria-label="Clear slot"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function ChildMatchBlock({
  match,
  players,
  teams: _teams,
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

  const teamAPlayers = useMemo(() => {
    if (!parentMatch?.slot_a_team_id) return [];
    const memberIds = teamMembers
      .filter(m => m.team_id === parentMatch.slot_a_team_id)
      .map(m => m.player_id);
    return players.filter(p => memberIds.includes(p.id));
  }, [parentMatch?.slot_a_team_id, teamMembers, players]);

  const teamBPlayers = useMemo(() => {
    if (!parentMatch?.slot_b_team_id) return [];
    const memberIds = teamMembers
      .filter(m => m.team_id === parentMatch.slot_b_team_id)
      .map(m => m.player_id);
    return players.filter(p => memberIds.includes(p.id));
  }, [parentMatch?.slot_b_team_id, teamMembers, players]);

  const usedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (match.slot_a1_player_id) ids.add(match.slot_a1_player_id);
    if (match.slot_a2_player_id) ids.add(match.slot_a2_player_id);
    if (match.slot_b1_player_id) ids.add(match.slot_b1_player_id);
    if (match.slot_b2_player_id) ids.add(match.slot_b2_player_id);
    return ids;
  }, [match.slot_a1_player_id, match.slot_a2_player_id, match.slot_b1_player_id, match.slot_b2_player_id]);

  const hasDuplicateWarning = useMemo(() => {
    const allPlayers = [
      match.slot_a1_player_id,
      match.slot_a2_player_id,
      match.slot_b1_player_id,
      match.slot_b2_player_id,
    ].filter(Boolean) as string[];

    const uniquePlayers = new Set(allPlayers);
    return allPlayers.length !== uniquePlayers.size;
  }, [match.slot_a1_player_id, match.slot_a2_player_id, match.slot_b1_player_id, match.slot_b2_player_id]);

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
    <div
      style={{
        background: 'var(--tl-bg)',
        border: `1px solid ${hasDuplicateWarning ? 'rgba(255, 65, 54, 0.45)' : 'var(--tl-border)'}`,
        borderRadius: 'var(--tl-radius)',
        boxShadow: hasDuplicateWarning ? '0 0 0 2px rgba(255, 65, 54, 0.15)' : 'none',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 10.5,
              fontWeight: 500,
              color: 'var(--tl-fg-3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {t.tools.flexTournament.childMatch} {matchIndex}
          </span>
          {hasDuplicateWarning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--tl-live)' }}>
              <AlertTriangle className="w-3 h-3" />
              <span style={{ fontSize: 10, fontWeight: 600 }}>VĐV trùng!</span>
            </div>
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
              padding: 2,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            aria-label="Delete child match"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Stacked layout: Team A row, Score, Team B row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <SelectableSlot
            id={`match-${match.id}-slot-a1`}
            playerId={match.slot_a1_player_id}
            players={players}
            availablePlayers={teamAPlayers}
            isCreator={isCreator}
            usedPlayerIds={usedPlayerIds}
            onClear={() => onClearSlot('a1')}
            onSelect={(id) => onSelectPlayer('a1', id)}
          />
          <SelectableSlot
            id={`match-${match.id}-slot-a2`}
            playerId={match.slot_a2_player_id}
            players={players}
            availablePlayers={teamAPlayers}
            isCreator={isCreator}
            usedPlayerIds={usedPlayerIds}
            onClear={() => onClearSlot('a2')}
            onSelect={(id) => onSelectPlayer('a2', id)}
            isSecondSlot
          />
        </div>

        {/* Score — token Geist Mono inputs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Input
            type="number"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            onBlur={handleScoreBlur}
            className="w-16 text-center h-10 text-lg font-semibold"
            disabled={!isCreator}
          />
          <span
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--tl-fg-4)',
            }}
          >
            –
          </span>
          <Input
            type="number"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            onBlur={handleScoreBlur}
            className="w-16 text-center h-10 text-lg font-semibold"
            disabled={!isCreator}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <SelectableSlot
            id={`match-${match.id}-slot-b1`}
            playerId={match.slot_b1_player_id}
            players={players}
            availablePlayers={teamBPlayers}
            isCreator={isCreator}
            usedPlayerIds={usedPlayerIds}
            onClear={() => onClearSlot('b1')}
            onSelect={(id) => onSelectPlayer('b1', id)}
          />
          <SelectableSlot
            id={`match-${match.id}-slot-b2`}
            playerId={match.slot_b2_player_id}
            players={players}
            availablePlayers={teamBPlayers}
            isCreator={isCreator}
            usedPlayerIds={usedPlayerIds}
            onClear={() => onClearSlot('b2')}
            onSelect={(id) => onSelectPlayer('b2', id)}
            isSecondSlot
          />
        </div>
      </div>

      {winnerName && (
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 10.5,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'var(--tl-green-glow)',
              color: 'var(--tl-green)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {winnerName} {t.tools.flexTournament.wins}
          </span>
        </div>
      )}
    </div>
  );
}
