import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
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

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-card",
        "cursor-grab active:cursor-grabbing touch-manipulation",
        "hover:border-primary/50 hover:bg-accent/50 transition-colors",
        isDragging && "opacity-50 border-primary shadow-lg z-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {type === 'team' ? (
        <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      ) : (
        <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      )}
      <span className="text-sm font-medium truncate">{name}</span>
    </div>
  );
}
