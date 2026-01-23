import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DraggablePlayer } from './DraggablePlayer';
import { Plus, Users, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

      {/* Sheet Panel - slides from right, no overlay */}
      <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <SheetContent 
          side="right" 
          className={`w-[280px] sm:w-[320px] p-0 transition-all duration-200 ${
            isDragging ? 'w-[80px] sm:w-[80px]' : ''
          }`}
        >
          <SheetHeader className="p-4 pb-2 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" />
                {!isDragging && (
                  <>
                    {t.tools.flexTournament.playerPanel}
                    <span className="text-muted-foreground font-normal">({players.length})</span>
                  </>
                )}
              </SheetTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>
          
          <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Add player input */}
            {isCreator && !isDragging && (
              <div className="p-4 pb-2 border-b">
                <div className="flex gap-2">
                  <Input
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.tools.flexTournament.addPlayers}
                    className="flex-1 text-base h-9"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
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
              <div className="border-t p-4 space-y-1.5">
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
