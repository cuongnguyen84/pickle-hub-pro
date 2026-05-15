import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Check, User, Users } from 'lucide-react';
import { useI18n } from '@/i18n';

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

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius)',
};

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 14px',
  borderBottom: '1px solid var(--tl-border)',
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

const tinyBadge = (kind: 'count' | 'pill'): React.CSSProperties => ({
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.04em',
  padding: kind === 'count' ? '2px 7px' : '3px 8px',
  borderRadius: 999,
  background: 'var(--tl-surface)',
  border: '1px solid var(--tl-border)',
  color: 'var(--tl-fg-3)',
});

export function ManualGroupAssignment({
  players,
  groupCount,
  onComplete,
  onCancel,
}: ManualGroupAssignmentProps) {
  const { t } = useI18n();

  const [groupAssignments, setGroupAssignments] = useState<Map<number, PlayerInput[]>>(
    () => new Map(Array.from({ length: groupCount }, (_, i) => [i, []])),
  );
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerInput | null>(null);

  const unassignedPlayers = useMemo(() => {
    const assignedIds = new Set<string>();
    groupAssignments.forEach(group => {
      group.forEach(p => assignedIds.add(p.id));
    });
    return players.filter(p => p.name.trim() && !assignedIds.has(p.id));
  }, [players, groupAssignments]);

  const filledPlayers = players.filter(p => p.name.trim());

  const maxPerGroup = Math.ceil(filledPlayers.length / groupCount);
  const minPerGroup = Math.floor(filledPlayers.length / groupCount);

  const groupNames = Array.from({ length: groupCount }, (_, i) =>
    String.fromCharCode(65 + i),
  );

  const handlePlayerClick = (player: PlayerInput) => {
    if (selectedPlayer?.id === player.id) {
      setSelectedPlayer(null);
    } else {
      setSelectedPlayer(player);
    }
  };

  const handleGroupClick = (groupIndex: number) => {
    if (!selectedPlayer) return;
    const currentGroupPlayers = groupAssignments.get(groupIndex) || [];
    if (currentGroupPlayers.length >= maxPerGroup) return;

    setGroupAssignments(prev => {
      const newMap = new Map(prev);
      newMap.set(groupIndex, [...currentGroupPlayers, selectedPlayer]);
      return newMap;
    });
    setSelectedPlayer(null);
  };

  const handleRemoveFromGroup = (groupIndex: number, playerId: string) => {
    setGroupAssignments(prev => {
      const newMap = new Map(prev);
      const currentPlayers = newMap.get(groupIndex) || [];
      newMap.set(groupIndex, currentPlayers.filter(p => p.id !== playerId));
      return newMap;
    });
  };

  const warnings = useMemo(() => {
    const result: string[] = [];

    const sizes = Array.from(groupAssignments.values()).map(g => g.length);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    if (maxSize - minSize > 1) {
      result.push(t.quickTable.manualAssignment.unbalancedGroups);
    }

    groupAssignments.forEach((groupPlayers, groupIndex) => {
      const teamCounts = new Map<string, number>();
      groupPlayers.forEach(p => {
        if (p.team) {
          teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
        }
      });
      teamCounts.forEach((count, team) => {
        if (count > 1) {
          result.push(`${t.quickTable.manualAssignment.group} ${groupNames[groupIndex]}: ${count} ${t.quickTable.manualAssignment.sameTeamWarning} "${team}"`);
        }
      });
    });

    groupAssignments.forEach((groupPlayers, groupIndex) => {
      const topSeeds = groupPlayers.filter(p => p.seed && parseInt(p.seed) <= 2);
      if (topSeeds.length > 1) {
        result.push(`${t.quickTable.manualAssignment.group} ${groupNames[groupIndex]}: ${topSeeds.length} ${t.quickTable.manualAssignment.topSeedsWarning}`);
      }
    });

    return result;
  }, [groupAssignments, groupNames, t]);

  const allAssigned = unassignedPlayers.length === 0;
  const hasEmptyGroups = Array.from(groupAssignments.values()).some(g => g.length === 0);

  const handleConfirm = () => {
    if (!allAssigned || hasEmptyGroups) return;
    onComplete(groupAssignments);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header instruction */}
      <div
        style={{
          padding: 14,
          borderRadius: 'var(--tl-radius)',
          background: 'var(--tl-green-glow)',
          border: '1px solid rgba(0, 185, 107, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Users
            className="w-4 h-4"
            style={{ color: 'var(--tl-green)', flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <p
              style={{
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--tl-green)',
                margin: '0 0 6px',
              }}
            >
              {t.quickTable.manualAssignment.guide}
            </p>
            <ol
              style={{
                color: 'var(--tl-fg-2)',
                fontSize: 13,
                lineHeight: 1.55,
                margin: 0,
                paddingLeft: 22,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <li>{t.quickTable.manualAssignment.step1}</li>
              <li>{t.quickTable.manualAssignment.step2}</li>
              <li>{t.quickTable.manualAssignment.step3}</li>
            </ol>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 16,
        }}
        className="md:grid-cols-2"
      >
        {/* Unassigned players */}
        <div style={{ ...surfaceCard, borderStyle: 'dashed' }}>
          <div style={sectionHeader}>
            <span style={sectionTitleStyle}>
              <User className="w-4 h-4" />
              {t.quickTable.manualAssignment.unassigned}
            </span>
            <span style={tinyBadge('count')}>{unassignedPlayers.length}</span>
          </div>
          <div style={{ padding: 12 }}>
            <ScrollArea className="h-[200px]">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unassignedPlayers.length === 0 ? (
                  <div
                    style={{
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      fontSize: 12,
                      color: 'var(--tl-fg-3)',
                      textAlign: 'center',
                      padding: '20px 0',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t.quickTable.manualAssignment.allAssigned}
                  </div>
                ) : (
                  unassignedPlayers.map(player => {
                    const isSelected = selectedPlayer?.id === player.id;
                    return (
                      <div
                        key={player.id}
                        onClick={() => handlePlayerClick(player)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          border: `1px solid ${isSelected ? 'var(--tl-green)' : 'transparent'}`,
                          background: isSelected ? 'var(--tl-green)' : 'var(--tl-bg-elev)',
                          color: isSelected ? 'var(--tl-bg)' : 'var(--tl-fg)',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13.5,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {player.name}
                          {player.seed && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 11.5,
                                opacity: isSelected ? 0.85 : 0.6,
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                              }}
                            >
                              #{player.seed}
                            </span>
                          )}
                        </span>
                        {player.team && (
                          <span
                            style={{
                              flexShrink: 0,
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 10.5,
                              padding: '2px 7px',
                              borderRadius: 4,
                              border: `1px solid ${isSelected ? 'rgba(255,255,255,0.35)' : 'var(--tl-border)'}`,
                              color: isSelected ? 'var(--tl-bg)' : 'var(--tl-fg-3)',
                              background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                            }}
                          >
                            {player.team}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: groupCount }, (_, groupIndex) => {
            const groupPlayers = groupAssignments.get(groupIndex) || [];
            const isFull = groupPlayers.length >= maxPerGroup;
            const canAccept = !!selectedPlayer && !isFull;
            const dimmed = !!selectedPlayer && isFull;

            return (
              <div
                key={groupIndex}
                onClick={() => canAccept && handleGroupClick(groupIndex)}
                style={{
                  ...surfaceCard,
                  cursor: canAccept ? 'pointer' : dimmed ? 'not-allowed' : 'default',
                  borderColor: canAccept ? 'var(--tl-green)' : 'var(--tl-border)',
                  boxShadow: canAccept ? '0 0 0 2px var(--tl-green-glow)' : 'none',
                  opacity: dimmed ? 0.5 : 1,
                  transition: 'border-color 0.15s, box-shadow 0.15s, opacity 0.15s, background 0.15s',
                }}
              >
                <div style={{ ...sectionHeader, padding: '8px 12px' }}>
                  <span style={sectionTitleStyle}>
                    {t.quickTable.manualAssignment.group} {groupNames[groupIndex]}
                    <span style={tinyBadge('pill')}>
                      {groupPlayers.length}/{minPerGroup}-{maxPerGroup}
                    </span>
                  </span>
                  {isFull && <Check className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />}
                </div>
                <div style={{ padding: 12 }}>
                  {groupPlayers.length === 0 ? (
                    <div
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 11,
                        color: 'var(--tl-fg-3)',
                        textAlign: 'center',
                        padding: '8px 0',
                        border: '1px dashed var(--tl-border)',
                        borderRadius: 6,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedPlayer
                        ? t.quickTable.manualAssignment.clickToAdd
                        : t.quickTable.manualAssignment.noPlayers}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {groupPlayers.map(player => (
                        <span
                          key={player.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromGroup(groupIndex, player.id);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 9px',
                            borderRadius: 999,
                            background: 'var(--tl-surface)',
                            border: '1px solid var(--tl-border)',
                            color: 'var(--tl-fg)',
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--tl-live)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--tl-bg)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-live)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--tl-surface)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                          }}
                        >
                          {player.name}
                          {player.seed && (
                            <span
                              style={{
                                opacity: 0.7,
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontSize: 10.5,
                              }}
                            >
                              #{player.seed}
                            </span>
                          )}
                          {player.team && (
                            <span style={{ opacity: 0.7, fontSize: 10.5 }}>({player.team})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div
          style={{
            padding: 14,
            borderRadius: 'var(--tl-radius)',
            background: 'rgba(233, 182, 73, 0.10)',
            border: '1px solid rgba(233, 182, 73, 0.30)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle
              className="w-4 h-4"
              style={{ color: 'var(--tl-gold)', flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <p
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--tl-gold)',
                  margin: '0 0 6px',
                }}
              >
                {t.quickTable.manualAssignment.warning}
              </p>
              <ul
                style={{
                  color: 'var(--tl-fg-2)',
                  fontSize: 13,
                  margin: 0,
                  paddingLeft: 0,
                  listStyle: 'none',
                  lineHeight: 1.55,
                }}
              >
                {warnings.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 12,
          borderTop: '1px solid var(--tl-border)',
        }}
      >
        <button type="button" className="tl-btn" onClick={onCancel}>
          {t.quickTable.back}
        </button>
        <button
          type="button"
          className="tl-btn green"
          onClick={handleConfirm}
          disabled={!allAssigned || hasEmptyGroups}
        >
          {!allAssigned
            ? t.quickTable.manualAssignment.remainingPlayers.replace('{count}', String(unassignedPlayers.length))
            : hasEmptyGroups
              ? t.quickTable.manualAssignment.emptyGroup
              : t.quickTable.manualAssignment.confirm}
        </button>
      </div>
    </div>
  );
}
