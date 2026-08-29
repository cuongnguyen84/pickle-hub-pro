#!/usr/bin/env node
// Stitch every READY recording of a livestream into one Mux asset and
// point the livestreams row at it. Mux cannot concatenate assets server-side
// (multi-input is overlays/tracks only), so: enable "highest" MP4 static
// rendition on each part → download → ffmpeg concat (stream copy, same
// encoder) → direct upload → repoint. mux-sync-assets leaves the replacement
// alone (stored asset is ready ⇒ no repoint).
//
// Usage:
//   node scripts/mux-stitch-livestream.mjs <livestream-uuid> [--dry-run]
// Reads MUX_TOKEN_ID / MUX_TOKEN_SECRET from env or /Users/cm10/secrets.local.md,
// Supabase writes via the Management API PAT (sbp_…) in the same file.

import { readFileSync, writeFileSync, mkdirSync, statSync, createReadStream } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = "ajvlcamxemgbxduhiqrl";
const [livestreamId, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
if (!livestreamId) throw new Error("usage: mux-stitch-livestream.mjs <livestream-uuid> [--dry-run]");

const secrets = readFileSync("/Users/cm10/secrets.local.md", "utf8");
const secret = (k) => process.env[k] ?? secrets.match(new RegExp(`^${k}=\\s*"?([^"\\s]+)`, "m"))?.[1];
const MUX_TOKEN_ID = secret("MUX_TOKEN_ID");
const MUX_TOKEN_SECRET = secret("MUX_TOKEN_SECRET");
const pat = secrets.match(/sbp_[A-Za-z0-9_-]{20,}/)?.[0];
if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET || !pat) throw new Error("MUX_TOKEN_ID / MUX_TOKEN_SECRET / sbp_ PAT missing");

const muxHeaders = {
  Authorization: `Basic ${Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString("base64")}`,
  "Content-Type": "application/json",
};
const mux = async (path, init) => {
  const res = await fetch(`https://api.mux.com/video/v1${path}`, { headers: muxHeaders, ...init });
  const json = await res.json();
  if (!res.ok) throw new Error(`mux ${path} ${res.status}: ${JSON.stringify(json)}`);
  return json.data;
};
const sql = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`supabase ${res.status}: ${JSON.stringify(json)}`);
  return json;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const [row] = await sql(
  `select id, title, mux_live_stream_id, mux_asset_id from livestreams where id = '${livestreamId}'`,
);
if (!row?.mux_live_stream_id) throw new Error("livestream not found or has no mux_live_stream_id");

const live = await mux(`/live-streams/${row.mux_live_stream_id}`);
const assets = [];
for (const id of live.recent_asset_ids ?? []) {
  const a = await mux(`/assets/${id}`);
  log(`${a.id}  ${a.status.padEnd(8)}  ${Math.round(a.duration ?? 0)}s`);
  if (a.status === "ready" && (a.duration ?? 0) > 5) assets.push(a);
}
// Mux created_at is a unix-seconds string; play back in broadcast order.
assets.sort((x, y) => Number(x.created_at) - Number(y.created_at));
if (assets.length < 2) throw new Error(`only ${assets.length} ready asset(s) — nothing to stitch`);
log(`stitching ${assets.length} assets, total ${Math.round(assets.reduce((s, a) => s + a.duration, 0))}s`);
if (dryRun) process.exit(0);

// 1. MP4 rendition per part (idempotent: skip if one already exists).
const dir = join(tmpdir(), `mux-stitch-${livestreamId}`);
mkdirSync(dir, { recursive: true });
const parts = [];
for (const a of assets) {
  let asset = a;
  if (!asset.static_renditions?.files?.length) {
    await mux(`/assets/${a.id}/static-renditions`, { method: "POST", body: JSON.stringify({ resolution: "highest" }) })
      .catch((e) => { if (!String(e).includes("already")) throw e; });
  }
  for (;;) {
    asset = await mux(`/assets/${a.id}`);
    const file = asset.static_renditions?.files?.find((f) => f.status === "ready" && f.resolution === "highest");
    if (file) { parts.push({ asset, name: file.name }); break; }
    if (asset.static_renditions?.files?.some((f) => f.status === "errored")) throw new Error(`rendition errored on ${a.id}`);
    await sleep(15_000);
  }
  log(`rendition ready ${a.id}`);
}

// 2. Download.
const files = [];
for (const [i, p] of parts.entries()) {
  const out = join(dir, `${i}.mp4`);
  const url = `https://stream.mux.com/${p.asset.playback_ids[0].id}/${p.name}`;
  try { if (statSync(out).size > 1e6) { files.push(out); continue; } } catch {}
  execFileSync("curl", ["-sSfL", "-o", out, url], { stdio: "inherit" });
  files.push(out);
  log(`downloaded ${out} (${(statSync(out).size / 1e6).toFixed(0)} MB)`);
}

// 3. Concat (stream copy — all parts come from one encoder session).
const list = join(dir, "list.txt");
writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
const merged = join(dir, "merged.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", merged], { stdio: "inherit" });
log(`merged ${(statSync(merged).size / 1e6).toFixed(0)} MB`);

// 4. Direct upload.
const upload = await mux("/uploads", {
  method: "POST",
  body: JSON.stringify({ cors_origin: "*", new_asset_settings: { playback_policy: ["public"], passthrough: `stitched:${livestreamId}` } }),
});
const put = await fetch(upload.url, {
  method: "PUT",
  headers: { "Content-Length": String(statSync(merged).size) },
  body: createReadStream(merged),
  duplex: "half",
});
if (!put.ok) throw new Error(`upload PUT ${put.status}`);
log("uploaded, waiting for asset…");
let assetId;
for (;;) {
  const u = await mux(`/uploads/${upload.id}`);
  if (u.asset_id) { assetId = u.asset_id; break; }
  if (u.status === "errored") throw new Error("upload errored");
  await sleep(10_000);
}
let stitched;
for (;;) {
  stitched = await mux(`/assets/${assetId}`);
  if (stitched.status === "ready") break;
  if (stitched.status === "errored") throw new Error(`asset ${assetId} errored: ${JSON.stringify(stitched.errors)}`);
  await sleep(15_000);
}

// 5. Repoint.
const playbackId = stitched.playback_ids[0].id;
await sql(
  `update livestreams set mux_asset_id = '${stitched.id}', mux_asset_playback_id = '${playbackId}' where id = '${livestreamId}'`,
);
log(`done: ${Math.round(stitched.duration)}s → https://www.thepicklehub.net/live/${livestreamId} (was ${row.mux_asset_id})`);
