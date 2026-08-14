#!/usr/bin/env node
// Prove the four contexts really are four different actors before anything
// depends on it.
import { launch, close, actor, assertIdentity, SITE } from "./browser.mjs";

await launch();
const out = [];
for (const [label, who, opts] of [
  ["anonymous", "anon", {}],
  ["buyer", "buyer", {}],
  ["seller", "seller", {}],
  ["admin aal1", "admin", {}],
  ["admin aal2", "admin", { aal2: true }],
]) {
  process.stdout.write(`  ${label} … `);
  const a = await actor(who, opts);
  await a.goto("/shop");
  process.stdout.write("loaded ");
  const id = await assertIdentity(a);
  out.push({ label, sub: id.sub ? `${id.sub.slice(0, 8)}…` : "(none)", aal: id.aal ?? "(none)" });
  await a.ctx.close();
}
await close();
console.table(out);

const subs = out.filter((o) => o.sub !== "(none)").map((o) => o.sub);
const admins = out.filter((o) => o.label.startsWith("admin"));
console.log(
  admins[0].sub === admins[1].sub && admins[0].aal === "aal1" && admins[1].aal === "aal2"
    ? "✅ same admin account seen at two assurance levels, in two isolated contexts"
    : "❌ admin contexts are not what they claim",
);
console.log(new Set(subs).size === 3 ? "✅ three distinct accounts" : "❌ accounts collided");
