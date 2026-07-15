import { describe, expect, it } from "vitest";
import {
  buildInsertViewEvents,
  deduplicateClientViewEvents,
  extractClientViewEvents,
  getViewEventClientIp,
  hashViewEventIdentity,
  viewTargetKey,
  type ViewTarget,
} from "../../../supabase/functions/_shared/view-events";

const VIDEO_ID = "11111111-1111-4111-8111-111111111111";
const LIVE_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";

describe("view-event input contract", () => {
  it("keeps only target and source fields from the client", () => {
    const result = extractClientViewEvents({
      events: [{
        target_type: "video",
        target_id: VIDEO_ID,
        source: "embed",
        viewer_user_id: "attacker-selected-user",
        organization_id: "attacker-selected-org",
        is_replay: true,
      }],
    });

    expect(result).toEqual({
      rawCount: 1,
      events: [{ target_type: "video", target_id: VIDEO_ID, source: "embed" }],
      rejected: 0,
      tooLarge: false,
    });
  });

  it("rejects malformed events and batches over 20", () => {
    expect(extractClientViewEvents({ events: [{ target_type: "video", target_id: "bad" }] }))
      .toMatchObject({ events: [], rejected: 1, tooLarge: false });
    expect(extractClientViewEvents({ events: Array.from({ length: 21 }, () => ({
      target_type: "video",
      target_id: VIDEO_ID,
    })) })).toMatchObject({ events: [], rejected: 21, tooLarge: true });
  });

  it("deduplicates by target type and id", () => {
    const events = extractClientViewEvents({ events: [
      { target_type: "video", target_id: VIDEO_ID },
      { target_type: "video", target_id: VIDEO_ID, source: "embed" },
      { target_type: "livestream", target_id: LIVE_ID },
    ] }).events;

    expect(deduplicateClientViewEvents(events)).toEqual([
      { target_type: "video", target_id: VIDEO_ID, source: "embed" },
      { target_type: "livestream", target_id: LIVE_ID, source: "direct" },
    ]);
  });

  it("derives organization, user, IP, and replay state server-side", () => {
    const targets = new Map<string, ViewTarget>([[
      viewTargetKey("livestream", LIVE_ID),
      {
        target_type: "livestream",
        target_id: LIVE_ID,
        organization_id: ORG_ID,
        is_replay: true,
      },
    ]]);
    const parsed = extractClientViewEvents({
      target_type: "livestream",
      target_id: LIVE_ID,
      organization_id: "spoofed",
      viewer_user_id: "spoofed",
      is_replay: false,
    }).events;

    expect(buildInsertViewEvents(parsed, targets, "real-user", "203.0.113.7")).toEqual({
      missingTargets: 0,
      events: [{
        target_type: "livestream",
        target_id: LIVE_ID,
        source: "direct",
        organization_id: ORG_ID,
        viewer_user_id: "real-user",
        viewer_ip: "203.0.113.7",
        is_replay: true,
      }],
    });
  });

  it("prefers Cloudflare IP and hashes rate identities without exposing them", async () => {
    const request = new Request("https://example.test", {
      headers: {
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.1, 198.51.100.2",
      },
    });
    const hash = await hashViewEventIdentity("ip:203.0.113.7");

    expect(getViewEventClientIp(request)).toBe("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
  });
});
