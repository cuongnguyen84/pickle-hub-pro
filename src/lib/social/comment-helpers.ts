import type { MatchComment } from "@/hooks/social/useComments";

/**
 * Pure helpers for comment threading + mention rendering. Extracted from
 * the components so they can be exercised by unit tests without standing
 * up React or React Query.
 */

/* ─── Mention parsing ─────────────────────────────────────────────────── */

export interface MentionTextSegment {
  type: "text";
  value: string;
}
export interface MentionLinkSegment {
  type: "mention";
  username: string;
}
export type MentionSegment = MentionTextSegment | MentionLinkSegment;

/**
 * Split a comment body into alternating text/mention segments. Mentions
 * follow Twitter/Strava convention: `@` immediately followed by 1-32
 * URL-safe handle characters (alphanumerics, underscore, dot, hyphen).
 *
 * Username chars are intentionally narrower than profile.username allows
 * (which permits unicode) — ASCII-only is what survives copy-paste from
 * mobile keyboards intact and what the regex can match without ambiguity.
 * Profiles whose username has non-ASCII chars simply don't get auto-
 * linkified, which is acceptable since the dropdown picker inserts the
 * normalized handle anyway.
 *
 * The regex uses a lookbehind to avoid matching email-style `foo@bar`.
 * We keep it conservative: a leading position must be either start-of-
 * string or whitespace.
 */
const MENTION_RE = /(^|[\s])@([A-Za-z0-9_.-]{1,32})/g;

export function parseMentions(body: string): MentionSegment[] {
  if (!body) return [];
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const matchStart = match.index ?? 0;
    const lead = match[1] ?? "";
    const username = match[2];
    // text up to and including the leading whitespace
    const textEnd = matchStart + lead.length;
    if (textEnd > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, textEnd) });
    }
    segments.push({ type: "mention", username });
    lastIndex = matchStart + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }
  return segments;
}

/* ─── Mention trigger detection ───────────────────────────────────────── */

export interface MentionTriggerState {
  /** The handle prefix the user is currently typing, e.g. "ngu" for "@ngu". */
  query: string;
  /** Caret position where the @ glyph starts, used to splice replacement. */
  triggerStart: number;
}

/**
 * Inspect the textarea value + caret position and decide whether the
 * user is currently mid-mention. Returns null when no trigger is active
 * (no recent @, or the @ was followed by whitespace, or caret moved).
 *
 * Rules:
 *   - Walk backwards from the caret looking for an @ glyph.
 *   - Stop at whitespace, newline, or another @ — none of those can be
 *     inside a username.
 *   - The trigger is valid only if the @ is at start-of-string or
 *     preceded by whitespace (otherwise it's an email-like construction
 *     the user didn't intend as a mention).
 *   - The query is everything between @ and the caret. May be empty
 *     (consumer can choose whether to render the dropdown for "" — usually
 *     yes, showing the top suggestions).
 */
export function detectMentionTrigger(
  value: string,
  caret: number,
): MentionTriggerState | null {
  if (caret < 1 || caret > value.length) return null;
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === "@") {
      const before = i > 0 ? value[i - 1] : "";
      if (before === "" || /\s/.test(before)) {
        const query = value.slice(i + 1, caret);
        // Username chars only — bail if we see anything that wouldn't be
        // valid in a handle.
        if (!/^[A-Za-z0-9_.-]*$/.test(query)) return null;
        return { query, triggerStart: i };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i -= 1;
  }
  return null;
}

/**
 * Replace the active mention trigger (from `triggerStart` up to caret)
 * with `@<username> ` and return the new value + new caret position.
 */
export function applyMentionInsert(
  value: string,
  caret: number,
  triggerStart: number,
  username: string,
): { value: string; caret: number } {
  const before = value.slice(0, triggerStart);
  const after = value.slice(caret);
  const insert = `@${username} `;
  return { value: before + insert + after, caret: before.length + insert.length };
}

/* ─── Threading tree ──────────────────────────────────────────────────── */

export interface ThreadedComment extends MatchComment {
  children: ThreadedComment[];
}

/**
 * Build a tree from the flat get_match_comments result. Children are
 * appended to their parent's `children` array preserving the input
 * order (which is created_at ASC from the RPC).
 *
 * Orphans (parent_comment_id refers to a parent we didn't fetch — would
 * happen if pagination split a thread) are surfaced as roots so they
 * render rather than disappear. They keep their original depth.
 */
export function buildCommentTree(flat: MatchComment[]): ThreadedComment[] {
  const byId = new Map<string, ThreadedComment>();
  const roots: ThreadedComment[] = [];
  for (const c of flat) {
    byId.set(c.comment_id, { ...c, children: [] });
  }
  for (const c of flat) {
    const node = byId.get(c.comment_id);
    if (!node) continue;
    if (c.parent_comment_id) {
      const parent = byId.get(c.parent_comment_id);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }
  return roots;
}
