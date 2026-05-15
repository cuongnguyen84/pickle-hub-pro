import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { DraggablePlayer } from './DraggablePlayer';
import { Plus, Users } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { FlexPlayer, FlexTeam } from '@/hooks/useFlexTournament';

interface FloatingPlayerPanelProps {
  players: FlexPlayer[];
  teams: FlexTeam[];
  onAddPlayer: (name: string) => void;
  isCreator: boolean;
  isDragging: boolean;
}

export function FloatingPlayerPanel({
  players,
  teams,
  onAddPlayer,
  isCreator,
  isDragging,
}: FloatingPlayerPanelProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      onAddPlayer(newPlayerName.trim());
      setNewPlayerName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPlayer();
    }
  };

  return (
    <>
      {/* FAB — always visible on mobile */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t.tools.flexTournament.playerPool}
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
          right: 'calc(env(safe-area-inset-right) + 16px)',
          zIndex: 40,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--tl-fg)',
          color: 'var(--tl-bg)',
          border: '1px solid var(--tl-fg)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'opacity 0.15s, transform 0.15s',
          opacity: isDragging ? 0.5 : 1,
          transform: isDragging ? 'scale(0.9)' : 'scale(1)',
        }}
      >
        <Users className="w-6 h-6" />
        {players.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--tl-green)',
              color: 'var(--tl-bg)',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              borderRadius: '50%',
              height: 22,
              minWidth: 22,
              padding: '0 5px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {players.length}
          </span>
        )}
      </button>

      {/* Sheet panel — slides from right */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          hideCloseButton
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={`w-[280px] sm:w-[300px] p-0 h-auto max-h-[80vh] top-auto bottom-20 rounded-l-xl ${
            isDragging ? 'w-[80px] sm:w-[80px]' : ''
          }`}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Add player input */}
            {isCreator && !isDragging && (
              <div style={{ padding: 12, borderBottom: '1px solid var(--tl-border)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Input
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.tools.flexTournament.addPlayers}
                    className="flex-1 text-base h-9"
                    autoFocus={false}
                  />
                  <button
                    type="button"
                    className="tl-btn green"
                    onClick={handleAddPlayer}
                    disabled={!newPlayerName.trim()}
                    style={{ padding: '8px 10px', flexShrink: 0 }}
                    aria-label="Add player"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Player list */}
            <div
              style={{
                overflowY: 'auto',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: '50vh',
              }}
            >
              {players.length === 0 ? (
                <p
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 11,
                    color: 'var(--tl-fg-3)',
                    textAlign: 'center',
                    padding: '12px 0',
                    margin: 0,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t.tools.flexTournament.noPlayers}
                </p>
              ) : (
                players.map((player) => (
                  <DraggablePlayer
                    key={player.id}
                    id={player.id}
                    name={isDragging ? '' : player.name}
                    type="player"
                    disabled={!isCreator}
                  />
                ))
              )}
            </div>

            {/* Teams section */}
            {teams.length > 0 && !isDragging && (
              <div
                style={{
                  borderTop: '1px solid var(--tl-border)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--tl-fg-3)',
                    padding: '0 4px',
                    marginBottom: 4,
                  }}
                >
                  {t.tools.flexTournament.teams}
                </div>
                {teams.map((team) => (
                  <DraggablePlayer
                    key={team.id}
                    id={team.id}
                    name={team.name}
                    type="team"
                    disabled={!isCreator}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
