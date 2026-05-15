import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Users, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { FlexTeam, FlexTeamMember, FlexPlayer } from '@/hooks/useFlexTournament';

interface TeamBlockProps {
  team: FlexTeam;
  members: FlexTeamMember[];
  players: FlexPlayer[];
  isCreator: boolean;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onRemoveMember: (memberId: string) => void;
}

export function TeamBlock({
  team,
  members,
  players,
  isCreator,
  onUpdateName,
  onDelete,
  onRemoveMember,
}: TeamBlockProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(team.name);

  const { isOver, setNodeRef } = useDroppable({
    id: `team-drop-${team.id}`,
    data: { type: 'team', teamId: team.id },
  });

  const handleSaveName = () => {
    if (editName.trim() && editName !== team.name) {
      onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        background: 'var(--tl-bg-elev)',
        border: `1px solid ${isOver ? 'var(--tl-green)' : 'var(--tl-border)'}`,
        borderRadius: 'var(--tl-radius-lg)',
        boxShadow: isOver ? '0 0 0 4px var(--tl-green-glow)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
        ...(isOver ? { background: 'var(--tl-green-glow)' } : {}),
      }}
    >
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
              {team.name}
            </h4>
          )}
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
            {members.length}
          </span>
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
              flexShrink: 0,
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
            aria-label="Delete team"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div style={{ padding: 12 }}>
        {members.length === 0 ? (
          <p
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              color: 'var(--tl-fg-3)',
              textAlign: 'center',
              padding: '10px 0',
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
            {members.map((member) => (
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
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)';
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
  );
}
