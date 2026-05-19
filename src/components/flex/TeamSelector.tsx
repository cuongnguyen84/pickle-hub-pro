import { useState } from 'react';
import { useI18n } from '@/i18n';
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

const surfaceCardStyle: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

export function TeamSelector({
  teams,
  teamMembers,
  players,
  isCreator,
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
      <div className="tl-empty-card">
        <span className="tl-empty-card-mark">◌</span>
        <span className="tl-empty-card-label">{t.tools.flexTournament.noTeams}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Team selector pills — token-styled, NOT shadcn Button */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {teams.map(team => {
          const memberCount = teamMembers.filter(m => m.team_id === team.id).length;
          const isSelected = selectedTeamId === team.id;
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => setSelectedTeamId(team.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 999,
                background: isSelected ? 'var(--tl-green)' : 'transparent',
                border: `1px solid ${isSelected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                color: isSelected ? 'var(--tl-bg)' : 'var(--tl-fg-2)',
                font: 'inherit',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border-2)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-2)';
                }
              }}
            >
              <Users className="w-3.5 h-3.5" />
              {team.name}
              <span
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: isSelected ? 'rgba(0,0,0,0.20)' : 'var(--tl-surface)',
                  color: isSelected ? 'var(--tl-bg)' : 'var(--tl-fg-3)',
                  letterSpacing: '0.04em',
                  fontVariantNumeric: 'tabular-nums',
                  marginLeft: 2,
                }}
              >
                {memberCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected team content */}
      {selectedTeam && (
        <div
          ref={setNodeRef}
          style={{
            ...surfaceCardStyle,
            borderColor: isOver ? 'var(--tl-green)' : 'var(--tl-border)',
            boxShadow: isOver ? '0 0 0 4px var(--tl-green-glow)' : 'none',
            background: isOver ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
            transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <Users className="w-4 h-4" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
              <h4
                style={{
                  fontFamily: 'Instrument Serif, serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 18,
                  letterSpacing: '-0.015em',
                  color: 'var(--tl-fg)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedTeam.name}
              </h4>
              <span
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'var(--tl-surface)',
                  border: '1px solid var(--tl-border)',
                  color: 'var(--tl-fg-3)',
                  flexShrink: 0,
                  letterSpacing: '0.04em',
                }}
              >
                {selectedTeamMembers.length}
              </span>
            </div>
            {isCreator && (
              <button
                type="button"
                onClick={() => onDeleteTeam(selectedTeam.id)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--tl-live)',
                  cursor: 'pointer',
                  padding: 4,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  transition: 'background 0.15s',
                }}
                aria-label="Delete team"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: 12 }}>
            {selectedTeamMembers.length === 0 ? (
              <p
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 11,
                  color: 'var(--tl-fg-3)',
                  textAlign: 'center',
                  padding: '14px 0',
                  border: '1px dashed var(--tl-border)',
                  borderRadius: 'var(--tl-radius)',
                  margin: 0,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {t.tools.flexTournament.dropPlayerHere}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedTeamMembers.map(member => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 'var(--tl-radius)',
                      background: 'var(--tl-bg)',
                      border: '1px solid var(--tl-border)',
                      fontSize: 13,
                      color: 'var(--tl-fg)',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getPlayerName(member.player_id)}
                    </span>
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(member.id)}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)';
                          (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)';
                        }}
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
                        aria-label="Remove member"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
