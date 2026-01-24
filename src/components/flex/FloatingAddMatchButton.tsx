import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Swords } from 'lucide-react';

interface FloatingAddMatchButtonProps {
  onClick: () => void;
  isCreator: boolean;
}

export function FloatingAddMatchButton({ onClick, isCreator }: FloatingAddMatchButtonProps) {
  const { t } = useI18n();

  if (!isCreator) return null;

  return (
    <Button
      size="lg"
      className="fixed bottom-36 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
      onClick={onClick}
      title={t.tools.flexTournament.addMatch}
    >
      <Swords className="w-5 h-5" />
    </Button>
  );
}
