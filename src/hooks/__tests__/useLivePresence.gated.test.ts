// @vitest-environment jsdom
// MERGE-GATE for the presence-gated PR (panel D3, approved 2026-07-20):
// the naive implementation (add `gated` to the payload) is a silent no-op —
// channel.track() runs once at SUBSCRIBED, ~15s before the gate fires, so
// `gated` would stay false forever while looking shipped. These tests fail
// against that implementation:
//  1. track() MUST be called AGAIN when isGated flips true.
//  2. The channel MUST NOT be re-subscribed on a gate flip (re-subscribe
//     churn is the 2026-07-08 presence collision incident).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

type SubscribeCb = (status: string, err?: Error) => void;

const channels: Array<{
  topic: string;
  subscribe: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  untrack: ReturnType<typeof vi.fn>;
  fire: (status: string) => void;
}> = [];

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeChannel = (topic: string) => {
    let cb: SubscribeCb | null = null;
    const channel = {
      topic: `realtime:${topic}`,
      on: vi.fn(() => channel),
      subscribe: vi.fn((fn: SubscribeCb) => {
        cb = fn;
        return channel;
      }),
      track: vi.fn().mockResolvedValue("ok"),
      untrack: vi.fn().mockResolvedValue("ok"),
      presenceState: () => ({}),
      fire: (status: string) => cb?.(status),
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

beforeEach(() => {
  channels.length = 0;
  idCounter++;
});

// Each test uses a fresh livestreamId — the hook keeps a module-level
// shared-entry registry that survives between tests.
const freshId = () => `stream-${idCounter}`;

describe("useLivePresence gated re-track (merge-gate)", () => {
  it("calls track() AGAIN with gated: true when the gate flips — same joined_at, no re-subscribe", async () => {
    const id = freshId();
    const { rerender, unmount } = renderHook(
      ({ gated }: { gated: boolean }) => useLivePresence(id, true, gated),
      { initialProps: { gated: false } },
    );

    const channel = channels[0];
    await act(async () => {
      channel.fire("SUBSCRIBED");
    });

    expect(channel.track).toHaveBeenCalledTimes(1);
    const first = channel.track.mock.calls[0][0];
    expect(first.gated).toBe(false);

    await act(async () => {
      rerender({ gated: true });
    });

    // The whole point: a second track() with gated: true...
    expect(channel.track).toHaveBeenCalledTimes(2);
    const second = channel.track.mock.calls[1][0];
    expect(second.gated).toBe(true);
    // ...that does NOT reset the join timestamp...
    expect(second.joined_at).toBe(first.joined_at);
    // ...and does NOT re-subscribe the shared channel (collision guard).
    expect(channels.length).toBe(1);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("re-track is idempotent: same gated value does not spam track()", async () => {
    const id = freshId();
    const { rerender, unmount } = renderHook(
      ({ gated }: { gated: boolean }) => useLivePresence(id, true, gated),
      { initialProps: { gated: false } },
    );
    const channel = channels[0];
    await act(async () => {
      channel.fire("SUBSCRIBED");
    });

    await act(async () => {
      rerender({ gated: false });
    });
    expect(channel.track).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("gate flip BEFORE subscribe completes is picked up by the SUBSCRIBED track", async () => {
    const id = freshId();
    const { rerender, unmount } = renderHook(
      ({ gated }: { gated: boolean }) => useLivePresence(id, true, gated),
      { initialProps: { gated: false } },
    );
    const channel = channels[0];

    // Gate fires while the channel is still connecting (slow network).
    await act(async () => {
      rerender({ gated: true });
    });
    expect(channel.track).not.toHaveBeenCalled();

    await act(async () => {
      channel.fire("SUBSCRIBED");
    });
    expect(channel.track).toHaveBeenCalledTimes(1);
    expect(channel.track.mock.calls[0][0].gated).toBe(true);

    unmount();
  });

  it("consumers that omit gated never overwrite the shared gate state", async () => {
    const id = freshId();
    // WatchLive owns the gate...
    const owner = renderHook(
      ({ gated }: { gated: boolean }) => useLivePresence(id, true, gated),
      { initialProps: { gated: false } },
    );
    const channel = channels[0];
    await act(async () => {
      channel.fire("SUBSCRIBED");
    });
    await act(async () => {
      owner.rerender({ gated: true });
    });
    expect(channel.track).toHaveBeenCalledTimes(2);

    // ...a second consumer on the same stream (e.g. a live card) without the
    // gated param must not push a third track() that resets it to false.
    const bystander = renderHook(() => useLivePresence(id, true));
    await act(async () => {});
    expect(channel.track).toHaveBeenCalledTimes(2);

    bystander.unmount();
    owner.unmount();
  });
});
