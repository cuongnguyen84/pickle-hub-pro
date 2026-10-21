// @vitest-environment jsdom
// Core presence paths that had zero coverage before the gated-viewer-state
// change added enough new surface area to this file to drag repo statement
// coverage below the 83% gate. Not gate-specific — general hold-up for
// useLivePresence itself: disabled early-return, presence "sync" viewer
// counting, CHANNEL_ERROR retry scheduling, and the gated re-track catch path.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

type SubscribeCb = (status: string, err?: Error) => void;
type PresenceCb = () => void;

const channels: Array<{
  topic: string;
  subscribe: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  untrack: ReturnType<typeof vi.fn>;
  presenceState: ReturnType<typeof vi.fn>;
  fire: (status: string) => void;
  fireSync: () => void;
}> = [];

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeChannel = (topic: string) => {
    let subscribeCb: SubscribeCb | null = null;
    let syncCb: PresenceCb | null = null;
    const channel = {
      topic: `realtime:${topic}`,
      on: vi.fn((_event: string, config: { event: string }, cb: PresenceCb) => {
        if (config.event === "sync") syncCb = cb;
        return channel;
      }),
      subscribe: vi.fn((fn: SubscribeCb) => {
        subscribeCb = fn;
        return channel;
      }),
      track: vi.fn().mockResolvedValue("ok"),
      untrack: vi.fn().mockResolvedValue("ok"),
      presenceState: vi.fn(() => ({})),
      fire: (status: string) => subscribeCb?.(status),
      fireSync: () => syncCb?.(),
    };
    channels.push(channel);
    return channel;
  };
  return {
    supabase: {
      channel: vi.fn((topic: string) => makeChannel(topic)),
      getChannels: vi.fn(() => []),
      removeChannel: vi.fn().mockResolvedValue("ok"),
    },
  };
});

import { useLivePresence } from "../useLivePresence";

let idCounter = 0;
const freshId = () => `core-stream-${idCounter}`;

beforeEach(() => {
  channels.length = 0;
  idCounter++;
});

describe("useLivePresence core paths", () => {
  it("disabled: never acquires a channel, count/connected stay at defaults", () => {
    const id = freshId();
    const { result, unmount } = renderHook(() => useLivePresence(id, false));
    expect(channels.length).toBe(0);
    expect(result.current.concurrentViewers).toBe(0);
    expect(result.current.isConnected).toBe(false);
    unmount();
  });

  it("counts viewers from presence sync, excluding admin_watcher_* keys and gated viewers", async () => {
    const id = freshId();
    const { result, unmount } = renderHook(() => useLivePresence(id, true));
    const channel = channels[0];
    await act(async () => {
      channel.fire("SUBSCRIBED");
    });
    channel.presenceState.mockReturnValue({
      viewer_a: [{}],                    // legacy client, no gated field → counted
      viewer_b: [{ gated: false }],      // watching → counted
      viewer_c: [{ gated: true }],       // stuck at login gate → NOT counted
      admin_watcher_x: [{}],
    });
    await act(async () => {
      channel.fireSync();
    });
    expect(result.current.concurrentViewers).toBe(2);
    unmount();
  });

  it("CHANNEL_ERROR marks disconnected and schedules a retry without throwing", async () => {
    const id = freshId();
    const { result, unmount } = renderHook(() => useLivePresence(id, true));
    const channel = channels[0];
    await act(async () => {
      channel.fire("SUBSCRIBED");
    });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      channel.fire("CHANNEL_ERROR");
    });
    expect(result.current.isConnected).toBe(false);

    unmount();
  });

  it("gated re-track failure is swallowed, not thrown", async () => {
    const id = freshId();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender, unmount } = renderHook(
      ({ gated }: { gated: boolean }) => useLivePresence(id, true, gated),
      { initialProps: { gated: false } },
    );
    const channel = channels[0];
    await act(async () => {
      channel.fire("SUBSCRIBED");
    });
    channel.track.mockRejectedValueOnce(new Error("network blip"));

    await expect(
      act(async () => {
        rerender({ gated: true });
      }),
    ).resolves.not.toThrow();

    warnSpy.mockRestore();
    unmount();
  });
});
