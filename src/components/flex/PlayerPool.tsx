import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { DraggablePlayer } from './DraggablePlayer';
import { Plus, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import type { FlexPlayer } from '@/hooks/useFlexTournament';

interface PlayerPoolProps {
  players: FlexPlayer[];
  onAddPlayer: (name: string) => void;
  isCreator: boolean;
}

export function PlayerPool({ players, onAddPlayer, isCreator }: PlayerPoolProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isOpen, setIsOpen] = useState(!isMobile || players.length === 0);

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
    <div
      style={{
        background: 'var(--tl-bg-elev)',
        border: '1px solid var(--tl-border)',
        borderRadius: 'var(--tl-radius-lg)',
        padding: 14,
      }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              gap: 8,
              paddingBottom: isOpen ? 12 : 0,
              borderBottom: isOpen ? '1px solid var(--tl-border)' : 'none',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--tl-fg-2)',
              }}
            >
              <Users className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
              {t.tools.flexTournament.playerPool}
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
                  letterSpacing: '0.04em',
                }}
              >
                {players.length}
              </span>
            </div>
            {isMobile && (
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--tl-fg-3)',
                  cursor: 'pointer',
                  width: 24,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Add player input */}
            {isCreator && (
              <div style={{ display: 'flex', gap: 6 }}>
                <Input
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.tools.flexTournament.addPlayers}
                  className="flex-1 text-base h-9"
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
            )}

            {/* Player list */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: '40vh',
                overflowY: 'auto',
                paddingRight: 2,
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
                    name={player.name}
                    type="player"
                    disabled={!isCreator}
                  />
                ))
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
