import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
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
  isDragging 
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
      {/* FAB Button - always visible on mobile */}
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg transition-all ${
          isDragging ? 'opacity-50 scale-90' : ''
        }`}
        size="icon"
      >
        <Users className="w-6 h-6" />
        {players.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {players.length}
          </span>
        )}
      </Button>

      {/* Sheet Panel - slides from right, auto-height */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="right" 
          hideCloseButton
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={`w-[280px] sm:w-[300px] p-0 h-auto max-h-[80vh] top-auto bottom-20 rounded-l-xl ${
            isDragging ? 'w-[80px] sm:w-[80px]' : ''
          }`}
        >
          <div className="flex flex-col">
            {/* Add player input */}
            {isCreator && !isDragging && (
              <div className="p-3 border-b">
                <div className="flex gap-2">
                  <Input
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.tools.flexTournament.addPlayers}
                    className="flex-1 text-base h-9"
                    autoFocus={false}
                  />
                  <Button 
                    size="sm" 
                    onClick={handleAddPlayer} 
                    disabled={!newPlayerName.trim()} 
                    className="h-9 w-9 p-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Player list */}
            <div className="overflow-y-auto p-3 space-y-1.5 max-h-[50vh]">
              {players.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
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
              <div className="border-t p-3 space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground px-1 mb-2">
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
