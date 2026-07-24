import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/i18n';
import type { AttachableQuickTable } from '@/hooks/useParentTournament';
import { CalendarDays, Users } from 'lucide-react';
import { format } from 'date-fns';

interface ExistingEventPickerProps {
  events: AttachableQuickTable[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  loading?: boolean;
}

export default function ExistingEventPicker({
  events,
  selectedIds,
  onSelectionChange,
  loading = false,
}: ExistingEventPickerProps) {
  const { t } = useI18n();
  const copy = t.quickTable.parentTournament;
  const selected = new Set(selectedIds);

  const toggleEvent = (eventId: string, checked: boolean) => {
    onSelectionChange(
      checked
        ? [...selectedIds, eventId]
        : selectedIds.filter(id => id !== eventId),
    );
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'setup': return t.quickTable.status.setup;
      case 'group_stage': return t.quickTable.status.groupStage;
      case 'playoff': return t.quickTable.status.playoff;
      case 'completed': return t.quickTable.status.completed;
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label={t.common.loading}>
        {[0, 1, 2].map(item => (
          <div
            key={item}
            className="h-[74px] animate-pulse rounded-md border border-border bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-6 text-center">
        <p className="text-sm font-medium text-foreground">{copy.noAttachableEvents}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {copy.noAttachableEventsHint}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {copy.selectedEventCount.replace('{count}', String(selectedIds.length))}
        </span>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelectionChange(
            selectedIds.length === events.length ? [] : events.map(event => event.id),
          )}
        >
          {selectedIds.length === events.length ? copy.clearSelection : copy.selectAll}
        </button>
      </div>

      <ScrollArea className="h-[250px] rounded-md border border-border">
        <div
          className="space-y-2 p-2"
          role="group"
          aria-label={copy.existingEventsTitle}
        >
          {events.map(event => {
            const checkboxId = `existing-event-${event.id}`;
            const checked = selected.has(event.id);

            return (
              <label
                key={event.id}
                htmlFor={checkboxId}
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                  'hover:border-primary/40 hover:bg-muted/40',
                  checked
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-background',
                ].join(' ')}
              >
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  onCheckedChange={value => toggleEvent(event.id, value === true)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {event.name}
                    </span>
                    <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {getStatusLabel(event.status)}
                    </span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {event.player_count} {t.quickTable.players}
                    </span>
                    <span>
                      {event.is_doubles ? copy.doublesEvent : copy.singlesEvent}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      {format(new Date(event.created_at), 'dd/MM/yyyy')}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
