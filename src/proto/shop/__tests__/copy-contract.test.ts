// F08 — the copy contract, enforced.
//
// Two things a reviewer cannot reliably catch by eye across 40 screens:
//   1. a banned term creeping back in (e.g. "thanh toán thành công" on a
//      VietQR order, which would be a lie — nothing verifies it automatically);
//   2. an icon-only control shipped without an accessible name.
// Both are grep-able, so they are tests instead of checklist lines.

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED_TERMS } from "../copy";

const ROOT = resolve(__dirname, "..");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

const FILES = walk(ROOT).filter((f) => !f.endsWith("copy.ts"));

/**
 * True when the JSX fragment contains a letter or digit that sits OUTSIDE both
 * a `<tag>` and a `{expression}`.
 *
 * Written as an explicit scanner rather than `.replace(/<[^>]*>/g, "")`, which
 * CodeQL correctly flags as `js/incomplete-multi-character-sanitization`: that
 * regex is the classic broken-HTML-sanitiser shape, and even in a test the
 * pattern is worth not teaching the codebase.
 */
const hasBareText = (jsx: string): boolean => {
  let inTag = false;
  let braces = 0;
  for (const ch of jsx) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag && ch === "{") braces += 1;
    else if (!inTag && ch === "}") braces = Math.max(0, braces - 1);
    else if (!inTag && braces === 0 && /[\p{L}\d]/u.test(ch)) return true;
  }
  return false;
};

describe("shop prototype copy contract", () => {
  it("has files to check", () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it.each(BANNED_TERMS)("never uses the banned term %s", (term) => {
    const offenders = FILES.filter((f) =>
      readFileSync(f, "utf8").toLowerCase().includes(term.toLowerCase()),
    ).map((f) => f.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });

  it("gives every icon-only button an accessible name", () => {
    // A <button> whose children are only an icon component must carry
    // aria-label. Heuristic: flag buttons containing a lucide <Icon .../> and
    // no text node, missing aria-label on the opening tag.
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      const buttons = src.match(/<button[\s\S]*?<\/button>/g) ?? [];
      for (const b of buttons) {
        const open = b.slice(0, b.indexOf(">") + 1);
        const inner = b.slice(open.length, b.lastIndexOf("</button>"));
        const hasIcon = /<[A-Z][A-Za-z]*\s+size=/.test(inner);
        // `{children}` and `{label}`-style slots ARE the text — the caller
        // supplies it. Only a button with literally nothing readable counts.
        const hasSlot = /\{\s*(children|label|title|text)\b/.test(inner);
        const hasText = hasSlot || hasBareText(inner);
        const named = /aria-label|aria-labelledby/.test(open) || /aria-label/.test(inner);
        if (hasIcon && !hasText && !named) {
          offenders.push(`${f.slice(ROOT.length + 1)}: ${open.replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
