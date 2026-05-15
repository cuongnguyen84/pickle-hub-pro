import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { User, Users } from 'lucide-react';

interface DraggablePlayerProps {
  id: string;
  name: string;
  type: 'player' | 'team';
  disabled?: boolean;
}

export function DraggablePlayer({ id, name, type, disabled }: DraggablePlayerProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${type}-${id}`,
    data: { id, name, type },
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 'var(--tl-radius)',
    border: `1px solid ${isDragging ? 'var(--tl-green)' : 'var(--tl-border)'}`,
    background: isDragging ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
    cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
    touchAction: 'manipulation',
    transition: 'background 0.15s, border-color 0.15s',
    opacity: disabled ? 0.5 : isDragging ? 0.85 : 1,
    boxShadow: isDragging ? '0 6px 20px rgba(0,0,0,0.25)' : 'none',
    zIndex: isDragging ? 50 : undefined,
  };

  const Icon = type === 'team' ? Users : User;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseEnter={(e) => {
        if (!disabled && !isDragging) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border-2)';
          (e.currentTarget as HTMLElement).style.background = 'var(--tl-surface)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isDragging) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
          (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg-elev)';
        }
      }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--tl-fg)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </div>
  );
}
