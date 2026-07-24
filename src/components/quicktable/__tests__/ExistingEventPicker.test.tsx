// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ExistingEventPicker from '../ExistingEventPicker';
import type { AttachableQuickTable } from '@/hooks/useParentTournament';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      common: { loading: 'Loading' },
      quickTable: {
        players: 'players',
        status: {
          setup: 'Setup',
          groupStage: 'Group stage',
          playoff: 'Playoff',
          completed: 'Completed',
        },
        parentTournament: {
          noAttachableEvents: 'No existing events available',
          noAttachableEventsHint: 'Already assigned events are hidden.',
          selectedEventCount: '{count} events selected',
          selectAll: 'Select all',
          clearSelection: 'Clear',
          existingEventsTitle: 'Choose existing events',
          doublesEvent: 'Doubles',
          singlesEvent: 'Singles',
        },
      },
    },
  }),
}));

const events: AttachableQuickTable[] = [
  {
    id: 'event-a',
    name: 'Men Open',
    status: 'group_stage',
    share_id: 'share-a',
    player_count: 16,
    format: 'round_robin',
    is_doubles: true,
    created_at: '2026-07-20T00:00:00.000Z',
  },
  {
    id: 'event-b',
    name: 'Women Open',
    status: 'setup',
    share_id: 'share-b',
    player_count: 12,
    format: 'round_robin',
    is_doubles: false,
    created_at: '2026-07-21T00:00:00.000Z',
  },
];

afterEach(cleanup);

describe('ExistingEventPicker', () => {
  it('selects an organizer-owned event without changing the other selection', () => {
    const onSelectionChange = vi.fn();
    render(
      <ExistingEventPicker
        events={events}
        selectedIds={['event-b']}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /^Men Open/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(['event-b', 'event-a']);
  });

  it('selects all available events and can clear the selection', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <ExistingEventPicker
        events={events}
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['event-a', 'event-b']);

    rerender(
      <ExistingEventPicker
        events={events}
        selectedIds={['event-a', 'event-b']}
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('explains why there are no attachable events', () => {
    render(
      <ExistingEventPicker
        events={[]}
        selectedIds={[]}
        onSelectionChange={() => undefined}
      />,
    );

    expect(screen.getByText('No existing events available')).toBeTruthy();
    expect(screen.getByText('Already assigned events are hidden.')).toBeTruthy();
  });
});
