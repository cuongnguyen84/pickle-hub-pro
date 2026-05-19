import { useI18n } from '@/i18n';
import { Swords } from 'lucide-react';

interface FloatingAddMatchButtonProps {
  onClick: () => void;
  isCreator: boolean;
}

export function FloatingAddMatchButton({ onClick, isCreator }: FloatingAddMatchButtonProps) {
  const { t } = useI18n();

  if (!isCreator) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={t.tools.flexTournament.addMatch}
      aria-label={t.tools.flexTournament.addMatch}
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 144px)',
        right: 'calc(env(safe-area-inset-right) + 16px)',
        zIndex: 40,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--tl-green)',
        color: 'var(--tl-bg)',
        border: '1px solid var(--tl-green)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--tl-green-dim)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green-dim)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--tl-green)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green)';
      }}
    >
      <Swords className="w-5 h-5" />
    </button>
  );
}
