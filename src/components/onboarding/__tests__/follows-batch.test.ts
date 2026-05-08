import { describe, it, expect } from "vitest";
import { buildFollowsBatchRows } from "../follows-batch";

/**
 * Unit tests for the wizard's Finish-time follow reconciliation payload.
 * These cover the silent-failure regression Cuong reported on PR #15:
 * counter incremented but social_follows was empty afterwards. The fix
 * is to re-emit selected_user_ids as an idempotent upsert at Finish time;
 * this helper builds that payload defensively.
 */

describe("buildFollowsBatchRows", () => {
  it("returns an empty array when nothing is selected", () => {
    expect(buildFollowsBatchRows("viewer-1", [])).toEqual([]);
  });

  it("returns an empty array when followerId is empty (defensive)", () => {
    expect(buildFollowsBatchRows("", ["a", "b"])).toEqual([]);
  });

  it("maps each selected id into a follower→followed row", () => {
    expect(
      buildFollowsBatchRows("viewer-1", ["target-a", "target-b"]),
    ).toEqual([
      { follower_id: "viewer-1", followed_id: "target-a" },
      { follower_id: "viewer-1", followed_id: "target-b" },
    ]);
  });

  it("drops self-follow ids — DB CHECK constraint would reject them", () => {
    expect(
      buildFollowsBatchRows("viewer-1", ["target-a", "viewer-1", "target-b"]),
    ).toEqual([
      { follower_id: "viewer-1", followed_id: "target-a" },
      { follower_id: "viewer-1", followed_id: "target-b" },
    ]);
  });

  it("de-duplicates within a single payload", () => {
    expect(
      buildFollowsBatchRows("viewer-1", ["target-a", "target-a", "target-b"]),
    ).toEqual([
      { follower_id: "viewer-1", followed_id: "target-a" },
      { follower_id: "viewer-1", followed_id: "target-b" },
    ]);
  });

  it("ignores empty / falsy ids", () => {
    expect(
      buildFollowsBatchRows("viewer-1", ["target-a", "", "target-b"]),
    ).toEqual([
      { follower_id: "viewer-1", followed_id: "target-a" },
      { follower_id: "viewer-1", followed_id: "target-b" },
    ]);
  });

  it("preserves the order of the first occurrence of each id", () => {
    expect(
      buildFollowsBatchRows("viewer-1", [
        "target-c",
        "target-a",
        "target-c",
        "target-b",
      ]).map((r) => r.followed_id),
    ).toEqual(["target-c", "target-a", "target-b"]);
  });
});
