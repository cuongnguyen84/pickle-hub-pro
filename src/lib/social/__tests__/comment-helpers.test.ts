import { describe, it, expect } from "vitest";
import {
  parseMentions,
  detectMentionTrigger,
  applyMentionInsert,
  buildCommentTree,
  shouldTriggerSubmitOnEnter,
  shouldTriggerMentionSelect,
} from "../comment-helpers";
import type { MatchComment } from "@/hooks/social/useComments";

/**
 * Pure helper tests for the comment surface. Components themselves are
 * not exercised here (no @testing-library installed in this project, per
 * vitest config) — these helpers carry the parts that actually need
 * regression pinning: mention parsing, the @-trigger state machine, and
 * the flat→tree reduce that drives threading.
 */

/* ─── parseMentions ───────────────────────────────────────────────────── */

describe("parseMentions", () => {
  it("returns one text segment for body without mentions", () => {
    expect(parseMentions("hello world")).toEqual([
      { type: "text", value: "hello world" },
    ]);
  });

  it("captures a leading mention at the start of the body", () => {
    const out = parseMentions("@alice nice match");
    expect(out).toEqual([
      { type: "mention", username: "alice" },
      { type: "text", value: " nice match" },
    ]);
  });

  it("captures a mid-sentence mention preserving leading space", () => {
    const out = parseMentions("ggs @bob_42 well played");
    expect(out).toEqual([
      { type: "text", value: "ggs " },
      { type: "mention", username: "bob_42" },
      { type: "text", value: " well played" },
    ]);
  });

  it("captures multiple mentions in one body", () => {
    const out = parseMentions("hi @a and @b cheers");
    expect(out.filter((s) => s.type === "mention").map((s) =>
      s.type === "mention" ? s.username : "",
    )).toEqual(["a", "b"]);
  });

  it("ignores email-style foo@bar (no whitespace before @)", () => {
    // The trigger requires SOL or whitespace before @, so foo@bar does not
    // produce a mention segment.
    const out = parseMentions("send to me@example.com please");
    expect(out.find((s) => s.type === "mention")).toBeUndefined();
  });

  it("trailing mention with no text after it is captured cleanly", () => {
    const out = parseMentions("nice @alice");
    expect(out).toEqual([
      { type: "text", value: "nice " },
      { type: "mention", username: "alice" },
    ]);
  });

  it("empty body returns empty segments", () => {
    expect(parseMentions("")).toEqual([]);
  });
});

/* ─── detectMentionTrigger ────────────────────────────────────────────── */

describe("detectMentionTrigger", () => {
  it("detects an in-progress mention at end of value", () => {
    expect(detectMentionTrigger("hi @al", 6)).toEqual({
      query: "al",
      triggerStart: 3,
    });
  });

  it("detects empty trigger immediately after typing @", () => {
    expect(detectMentionTrigger("hi @", 4)).toEqual({
      query: "",
      triggerStart: 3,
    });
  });

  it("detects a mention at the very start of the textarea", () => {
    expect(detectMentionTrigger("@alpha", 6)).toEqual({
      query: "alpha",
      triggerStart: 0,
    });
  });

  it("returns null when caret is past whitespace following the @", () => {
    // "hi @alpha bravo" with caret at end — `bravo` is no longer a mention.
    expect(detectMentionTrigger("hi @alpha bravo", 15)).toBeNull();
  });

  it("returns null for email-like prefix (no whitespace before @)", () => {
    expect(detectMentionTrigger("me@gmail", 8)).toBeNull();
  });

  it("returns null when caret lands inside chars that don't belong to a handle", () => {
    // The space after @al breaks the trigger.
    expect(detectMentionTrigger("hi @al ", 7)).toBeNull();
  });
});

/* ─── applyMentionInsert ──────────────────────────────────────────────── */

describe("applyMentionInsert", () => {
  it("replaces the trigger range with @username + space", () => {
    const out = applyMentionInsert("hi @al", 6, 3, "alpha");
    expect(out.value).toBe("hi @alpha ");
    expect(out.caret).toBe(10);
  });

  it("preserves text after the caret", () => {
    const out = applyMentionInsert("hi @al rest", 6, 3, "alpha");
    expect(out.value).toBe("hi @alpha  rest");
    expect(out.caret).toBe(10);
  });
});

/* ─── buildCommentTree ────────────────────────────────────────────────── */

const c = (
  id: string,
  parent: string | null,
  depth: number,
  body = "x",
): MatchComment => ({
  comment_id: id,
  parent_comment_id: parent,
  depth,
  body,
  user_id: "u1",
  username: "u1",
  display_name: "U One",
  avatar_url: null,
  created_at: "2026-05-08T10:00:00Z",
  updated_at: null,
  is_deleted: false,
});

describe("buildCommentTree", () => {
  it("returns roots in input order when no parents", () => {
    const out = buildCommentTree([c("a", null, 0), c("b", null, 0)]);
    expect(out.map((n) => n.comment_id)).toEqual(["a", "b"]);
  });

  it("nests children under parents preserving order", () => {
    const out = buildCommentTree([
      c("root", null, 0),
      c("child1", "root", 1),
      c("child2", "root", 1),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].children.map((n) => n.comment_id)).toEqual([
      "child1",
      "child2",
    ]);
  });

  it("supports 5-level nesting (depth 0..4)", () => {
    const out = buildCommentTree([
      c("d0", null, 0),
      c("d1", "d0", 1),
      c("d2", "d1", 2),
      c("d3", "d2", 3),
      c("d4", "d3", 4),
    ]);
    let cur = out[0];
    for (const id of ["d0", "d1", "d2", "d3", "d4"]) {
      expect(cur.comment_id).toBe(id);
      if (cur.children.length > 0) cur = cur.children[0];
    }
  });

  it("surfaces orphan children as roots so they don't disappear", () => {
    // child references a parent we didn't fetch — happens when pagination
    // splits a thread. Surfacing as root preserves visibility.
    const out = buildCommentTree([c("orphan", "missing-parent", 2)]);
    expect(out.map((n) => n.comment_id)).toEqual(["orphan"]);
  });

  it("does not mutate input rows", () => {
    const flat = [c("root", null, 0), c("child", "root", 1)];
    const before = JSON.stringify(flat);
    buildCommentTree(flat);
    expect(JSON.stringify(flat)).toBe(before);
  });
});

/* ─── Keyboard guards (CommentInput Enter duplicate-submit fix) ───────── */

describe("shouldTriggerSubmitOnEnter", () => {
  it("returns true for plain Enter without modifiers", () => {
    expect(
      shouldTriggerSubmitOnEnter({ key: "Enter", nativeEvent: {} }),
    ).toBe(true);
  });

  it("returns false for Shift+Enter (newline)", () => {
    expect(
      shouldTriggerSubmitOnEnter({
        key: "Enter",
        shiftKey: true,
        nativeEvent: {},
      }),
    ).toBe(false);
  });

  it("returns false for non-Enter keys", () => {
    expect(
      shouldTriggerSubmitOnEnter({ key: "a", nativeEvent: {} }),
    ).toBe(false);
    expect(
      shouldTriggerSubmitOnEnter({ key: "Tab", nativeEvent: {} }),
    ).toBe(false);
  });

  it("returns false during IME composition (isComposing=true)", () => {
    // Vietnamese IME (Telex/VNI) confirms tone composition with Enter
    // and the browser then re-fires a real Enter — without this guard
    // both fire handleKeyDown and submit twice.
    expect(
      shouldTriggerSubmitOnEnter({
        key: "Enter",
        nativeEvent: { isComposing: true },
      }),
    ).toBe(false);
  });

  it("returns false for legacy keyCode 229 (IME placeholder)", () => {
    // Some browsers don't set isComposing but still send the legacy
    // 229 keyCode for IME-confirm Enter.
    expect(
      shouldTriggerSubmitOnEnter({
        key: "Enter",
        keyCode: 229,
        nativeEvent: {},
      }),
    ).toBe(false);
  });

  it("tolerates missing nativeEvent (loose typing safety)", () => {
    expect(shouldTriggerSubmitOnEnter({ key: "Enter" })).toBe(true);
  });
});

describe("shouldTriggerMentionSelect", () => {
  it("returns true for plain Enter or Tab", () => {
    expect(
      shouldTriggerMentionSelect({ key: "Enter", nativeEvent: {} }),
    ).toBe(true);
    expect(
      shouldTriggerMentionSelect({ key: "Tab", nativeEvent: {} }),
    ).toBe(true);
  });

  it("returns false during IME composition", () => {
    // Same composition guard as the submit path — IME-confirm Enter
    // shouldn't accidentally pick the highlighted suggestion either.
    expect(
      shouldTriggerMentionSelect({
        key: "Enter",
        nativeEvent: { isComposing: true },
      }),
    ).toBe(false);
    expect(
      shouldTriggerMentionSelect({
        key: "Enter",
        keyCode: 229,
        nativeEvent: {},
      }),
    ).toBe(false);
  });

  it("returns false for keys other than Enter/Tab", () => {
    expect(
      shouldTriggerMentionSelect({ key: "Escape", nativeEvent: {} }),
    ).toBe(false);
  });
});
