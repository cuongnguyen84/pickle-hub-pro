import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" />
                {t.tools.flexTournament.playerPool}
                <span className="text-muted-foreground font-normal">({players.length})</span>
              </CardTitle>
              {isMobile && (
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {/* Add player input */}
            {isCreator && (
              <div className="flex gap-2">
                <Input
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.tools.flexTournament.addPlayers}
                  className="flex-1 text-base h-9"
                />
                <Button size="sm" onClick={handleAddPlayer} disabled={!newPlayerName.trim()} className="h-9 w-9 p-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Player list */}
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {players.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
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
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
