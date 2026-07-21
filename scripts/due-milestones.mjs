#!/usr/bin/env node
// ============================================================================
// due-milestones.mjs — prints open milestones that are due (docs/milestones.md)
// ============================================================================
// Every autonomous session runs this at session start (CLAUDE.md); the
// milestone-due.yml workflow runs it daily and pings Telegram while anything
// is due and unticked. A milestone line carries BOTH a date and a predicate —
// this script only surfaces the date; the predicate is enforced by whoever
// acts on the milestone (see docs/milestones.md header).
//
// Usage:
//   node scripts/due-milestones.mjs            # exit 0 = nothing due, 3 = due
//   node scripts/due-milestones.mjs --self-check
//
// Dates are evaluated in Asia/Ho_Chi_Minh regardless of runner TZ (GitHub
// runners are UTC; a milestone due "24/07" must fire on 24/07 ICT).
// ============================================================================

import { readFileSync } from "node:fs";

const LINE_RE = /^- \[( |x)\] (\d{4}-\d{2}-\d{2}) (\S+) — (.*)$/;

export function todayICT(now = new Date()) {
  // en-CA gives YYYY-MM-DD directly.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

export function dueMilestones(markdown, today) {
  const due = [];
  for (const line of markdown.split("\n")) {
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const [, done, date, id, desc] = m;
    if (done === "x") continue;
    if (date <= today) due.push({ date, id, desc });
  }
  return due;
}

function selfCheck() {
  const md = [
    "- [ ] 2026-07-24 PERF-05 — read p75",
    "- [x] 2026-07-01 DONE-01 — already ticked",
    "- [ ] 2026-09-01 FUTURE-01 — not yet",
    "not a milestone line",
  ].join("\n");
  const due = dueMilestones(md, "2026-07-24");
  console.assert(due.length === 1 && due[0].id === "PERF-05", "due-today parses");
  console.assert(dueMilestones(md, "2026-07-23").length === 0, "future not due");
  console.assert(dueMilestones(md, "2026-09-02").length === 2, "ticked stays excluded");
  console.assert(/^\d{4}-\d{2}-\d{2}$/.test(todayICT()), "todayICT format");
  console.log("self-check OK");
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  if (process.argv.includes("--self-check")) {
    selfCheck();
    process.exit(0);
  }
  const file = process.argv[2] ?? new URL("../docs/milestones.md", import.meta.url).pathname;
  let md;
  try {
    md = readFileSync(file, "utf8");
  } catch (err) {
    console.error(`due-milestones: cannot read ${file} — ${err.message}`);
    process.exit(2);
  }
  const today = todayICT();
  const due = dueMilestones(md, today);
  if (due.length === 0) {
    console.log(`due-milestones: ${today} — không có mốc nào đến hạn.`);
    process.exit(0);
  }
  console.log(`due-milestones: ${today} — ${due.length} mốc ĐẾN HẠN chưa tick:`);
  for (const d of due) {
    const daysLate = Math.round((new Date(today) - new Date(d.date)) / 86400000);
    console.log(`  ${daysLate > 0 ? `⏰ QUÁ HẠN ${daysLate} ngày` : "⏰ HÔM NAY"} · ${d.date} ${d.id} — ${d.desc}`);
  }
  console.log("→ Thực thi theo PREDICATE trong docs/milestones.md, hoặc ghi lý do defer vào dòng mốc.");
  process.exit(3);
}
