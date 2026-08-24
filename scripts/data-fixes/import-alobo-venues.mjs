#!/usr/bin/env node
// ============================================================================
// import-alobo-venues.mjs — fill price/hours/phone on venues from a booking
// export, create the venues we do not have, and place a labelled default on
// everything else.
// ----------------------------------------------------------------------------
// PRICE-01 (2026-08-24). Reads a JSON export (the shape produced by the
// 2026-08-24 alobo pull: name/address/phone/open_time/close_time/
// price_min_vnd/price_max_vnd/latitude/longitude) plus an approved match file,
// and writes to Supabase `venues`.
//
// THREE THINGS THIS SCRIPT REFUSES TO DO SILENTLY
//
// 1. Import junk. The source export is a live booking product's own table and
//    it contains that product's seed data — "Fake ATC", "TEST SÂN", "Tạo để
//    xóa 1", a venue in Sydney, phone 1234567890, prices of 1 đ and 2.000 đ.
//    17 of 179 rows tripped at least one of those. They are dropped here, not
//    filtered downstream, because a fake venue that reaches `venues` also
//    reaches sitemap-venues.xml and Google.
//
// 2. Match on coordinates. Both datasets carry lat/long and it is tempting to
//    join on them. Measured on this export: 22 pairs whose names match exactly
//    sit a median 1.3 km apart (max 4.2 km), while the five pairs within 150 m
//    of each other have name similarity 0.00 — different courts that share a
//    block. Geo is a false friend here. Matching is by an approved list only.
//
// 3. Present a default as a fact. Venues with no real figure get
//    price_source='default', and the renderer is expected to keep those out of
//    <title>/<meta description>. See the migration comment for the contract.
//
// Usage:
//   node scripts/data-fixes/import-alobo-venues.mjs --dry-run
//   node scripts/data-fixes/import-alobo-venues.mjs --apply
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { readFileSync } from "node:fs";
import process from "node:process";

const SRC = process.env.ALOBO_JSON ?? "/tmp/san_pickleball.json";
const APPROVED_CSV = process.env.APPROVED_CSV ?? "/tmp/duyet-khop-san-alobo.csv";
// Second approval file: which of the venues we do NOT already hold may be
// created. Same contract as the match file — a row is created only if a human
// left an "x" in the first column. Absent file = create nothing new.
const APPROVED_NEW_CSV = process.env.APPROVED_NEW_CSV ?? "/tmp/duyet-san-moi-alobo.csv";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_PRICE_MIN = 80000;
const DEFAULT_PRICE_MAX = 200000;
const DEFAULT_OPEN = "06:00";
const DEFAULT_CLOSE = "24:00";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// ── junk detection ─────────────────────────────────────────────────────────
const JUNK_NAME = /\b(fake|test|demo|thử|xoá|xóa|tạo để|abc|xxx)\b/i;
const JUNK_PHONE = new Set(["1234567890", "0000000000", "0123456789", "0987654321"]);

/**
 * The export encodes "no coordinates" as the number 0, not as null — 22 rows
 * carry latitude 0 / longitude 0, which is a point in the Atlantic off Ghana.
 * Treating 0 as a real coordinate let three obvious seed rows ("Not Happy",
 * "Sân của toàn nhé") through the address+geo check on the first pass.
 */
export function hasGeo(v) {
  const { latitude: la, longitude: lo } = v;
  return (
    typeof la === "number" && typeof lo === "number" &&
    Number.isFinite(la) && Number.isFinite(lo) &&
    !(la === 0 && lo === 0) &&
    Math.abs(la) <= 90 && Math.abs(lo) <= 180
  );
}

export function junkReasons(v) {
  const out = [];
  const name = (v.name ?? "").trim();
  const addr = (v.address ?? "").trim();
  if (JUNK_NAME.test(name)) out.push("test/fake name");
  if (name.length > 60) out.push("garbage name (over 60 chars)");
  if (JUNK_PHONE.has(String(v.phone ?? "").trim())) out.push("placeholder phone");
  // A court that costs 1 đ, or 2.000 đ, is a seed row. 20k is below any real
  // Vietnamese court rate and matches the DB check constraint.
  const min = v.price_min_vnd;
  if (min != null && min > 0 && min < 20000) out.push(`implausible price floor (${min})`);
  if (!addr && !hasGeo(v)) out.push("no address and no coordinates");
  return out;
}

/**
 * Softer signals. These do NOT drop the row — they mark it for a human, because
 * the line between "sparse record" and "someone's test" is a judgement call and
 * getting it wrong in the dropping direction loses a real court silently.
 */
export function reviewReasons(v) {
  const out = [];
  const addr = (v.address ?? "").trim();
  if (!hasGeo(v)) out.push("no usable coordinates");
  // "TPHCM", "Trường Sa", "Hà Nội" — a city or a joke, not somewhere you can go.
  if (addr && addr.length < 12 && !/\d/.test(addr)) out.push(`address too vague ("${addr}")`);
  if (!normalisePhone(v.phone)) out.push("no usable phone");
  if (priceFrom(v) === null) out.push("no usable price");
  if (!/pickle|pkl|thể thao|sport|clb|club|sân/i.test(v.name ?? "")) {
    out.push("name does not look like a venue");
  }
  return out;
}

// ── phone ──────────────────────────────────────────────────────────────────
/**
 * Vietnamese mobile/landline numbers are stored with the trunk prefix. The
 * 2026-08-24 export already had it on 171 of 179 rows, so this is mostly a
 * no-op — but it also normalises +84/84 forms, which the export did not
 * contain and a later one might.
 */
export function normalisePhone(raw) {
  const digits = String(raw ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  let d = digits;
  if (d.startsWith("+84")) d = "0" + d.slice(3);
  else if (d.startsWith("84") && d.length >= 10) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  if (d.length < 9 || d.length > 11) return null;
  return d;
}

// ── hours ──────────────────────────────────────────────────────────────────
/**
 * hours_json in the OBJECT form, because that is the only shape
 * functions/_lib/render/venues.ts turns into openingHoursSpecification —
 * the array/free-text forms render a human line but emit no schema.
 */
export function buildHoursJson(open, close) {
  const o = /^\d{2}:\d{2}$/.test(open ?? "") ? open : DEFAULT_OPEN;
  let c = /^\d{2}:\d{2}$/.test(close ?? "") ? close : DEFAULT_CLOSE;
  // "00:00" as a closing time means midnight-end, not midnight-start; the
  // export uses both "24:00" and "00:00" for it.
  if (c === "00:00") c = "24:00";
  const range = `${o}-${c}`;
  return Object.fromEntries(DAYS.map((d) => [d, range]));
}

/** Some rows carry 00:00-24:00, which is "open all day", not missing data. */
export function isRealHours(v) {
  return Boolean(v.open_time && v.close_time);
}

export function priceFrom(v) {
  const min = v.price_min_vnd;
  const max = v.price_max_vnd;
  if (min == null || max == null) return null;
  if (min < 20000 || max < min || max > 2000000) return null;
  return { min, max };
}

// ── approved-match parsing ─────────────────────────────────────────────────
export function parseApproved(csv) {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",");
  const iTick = head.indexOf("DUYET_x_neu_dung");
  const iSlug = head.indexOf("slug");
  const iId = head.indexOf("alobo_id");
  if (iTick < 0 || iSlug < 0 || iId < 0) {
    throw new Error("approved CSV missing DUYET_x_neu_dung / slug / alobo_id");
  }
  const bySlug = new Map();
  const byAloboId = new Map();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if ((cells[iTick] ?? "").trim().toLowerCase() !== "x") continue;
    const slug = cells[iSlug]?.trim();
    const id = cells[iId]?.trim();
    if (!slug || !id) continue;
    if (bySlug.has(slug)) {
      throw new Error(
        `two approved rows both point at ${slug} (${bySlug.get(slug)} and ${id}) — ` +
          `un-tick one; the export contains duplicate venues`,
      );
    }
    bySlug.set(slug, id);
    byAloboId.set(id, slug);
  }
  return { bySlug, byAloboId };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Slugs of venues a human approved for creation. Keyed by slug rather than by
 * source id because the creation file is the one a person edits in a
 * spreadsheet, and slug is the column that survives a re-sort.
 */
export function parseApprovedNew(csv) {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const head = splitCsvLine(lines[0]);
  const iTick = head.indexOf("TAO_x_neu_dong_y");
  const iSlug = head.indexOf("slug_se_tao");
  if (iTick < 0 || iSlug < 0) {
    throw new Error("new-venue CSV missing TAO_x_neu_dong_y / slug_se_tao");
  }
  const out = new Set();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if ((cells[iTick] ?? "").trim().toLowerCase() !== "x") continue;
    const slug = cells[iSlug]?.trim();
    if (slug) out.add(slug);
  }
  return out;
}

// ── city / district ────────────────────────────────────────────────────────
/**
 * venues.city is NOT NULL and feeds the /san/khu-vuc/<city> hub pages, so a new
 * venue has to land on one of the names already in the table — "TP.HCM", not
 * "TP Hồ Chí Minh" — or it silently forms a city of one.
 *
 * Aliases are ordered longest-first at match time so "TP Hồ Chí Minh" is not
 * shadowed by a bare "Hồ Chí Minh" rule.
 */
export const CITY_ALIASES = [
  ["TP.HCM", ["tp ho chi minh", "tp.ho chi minh", "thanh pho ho chi minh", "ho chi minh", "tphcm", "tp hcm", "hcm city", "sai gon", "saigon"]],
  ["Hà Nội", ["thanh pho ha noi", "ha noi", "hanoi"]],
  ["Đà Nẵng", ["thanh pho da nang", "da nang", "danang"]],
  ["Hải Phòng", ["hai phong"]],
  ["Cần Thơ", ["can tho"]],
  ["Bắc Ninh", ["bac ninh"]],
  ["Bắc Giang", ["bac giang"]],
  ["Hạ Long", ["ha long"]],
  ["Nam Định", ["nam dinh"]],
  ["Thanh Hóa", ["thanh hoa"]],
  ["Nha Trang", ["nha trang"]],
  ["Vũng Tàu", ["vung tau"]],
  ["Bình Dương", ["binh duong", "thu dau mot"]],
  ["Pleiku", ["pleiku"]],
  ["Lạng Sơn", ["lang son"]],
  ["Cao Bằng", ["cao bang"]],
  ["Bảo Lộc", ["bao loc"]],
  ["Buôn Ma Thuột", ["buon ma thuot"]],
  ["Vinh", ["thanh pho vinh", "tp vinh"]],
  ["Huế", ["thua thien hue", "tp hue", "hue"]],
  ["Quy Nhơn", ["quy nhon"]],
  ["Đà Lạt", ["da lat", "dalat"]],
  ["Biên Hòa", ["bien hoa"]],
  ["Thái Nguyên", ["thai nguyen"]],
  ["Tiền Giang", ["tien giang"]],
  ["Kon Tum", ["kon tum"]],
  ["Ninh Bình", ["ninh binh"]],
  ["Tam Điệp", ["tam diep"]],
];

export function deaccent(s) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

export function cityFromAddress(address) {
  const flat = deaccent(address).replace(/[.,]/g, " ").replace(/\s+/g, " ");
  let best = null;
  for (const [canon, aliases] of CITY_ALIASES) {
    for (const a of aliases) {
      const at = flat.lastIndexOf(a);
      if (at === -1) continue;
      // Prefer the alias appearing latest in the string — Vietnamese addresses
      // run smallest-to-largest, so the city sits at the end and a street named
      // after another city ("Đường Hà Nội, Vinh") must not win.
      if (!best || at > best.at || (at === best.at && a.length > best.len)) {
        best = { canon, at, len: a.length };
      }
    }
  }
  return best?.canon ?? null;
}

/**
 * Best-effort district. Vietnamese addresses run "street, ward, district,
 * city", so the segment before the city is usually it. Nullable in the schema,
 * so a miss costs nothing but a slightly worse title.
 */
export function districtFromAddress(address) {
  const parts = String(address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const tail = deaccent(parts[parts.length - 1]);
  // Drop a trailing "Việt Nam" before looking for the district.
  const trimmed = tail === "viet nam" ? parts.slice(0, -1) : parts;
  if (trimmed.length < 3) return null;
  const cand = trimmed[trimmed.length - 2]
    .replace(/^(thành phố|tp\.?|tỉnh)\s+/i, "")
    .trim();
  if (!cand || cand.length > 30 || /^\d+$/.test(cand)) return null;
  // Do not return the city itself as its own district.
  if (cityFromAddress(cand)) return null;
  return cand;
}

/**
 * Coordinate fallback for city only.
 *
 * Geo is explicitly rejected above as an identity key, because the two datasets
 * disagree by a median 1.3 km — but city assignment has a tolerance of tens of
 * kilometres, so the same coordinates that cannot tell two courts apart can
 * still say which city a court is in. Different question, different precision.
 */
export function cityFromNearest(v, existing) {
  if (!hasGeo(v)) return null;
  let best = null;
  for (const o of existing) {
    if (o.latitude == null || o.longitude == null || !o.city) continue;
    const km = haversineKm(v.latitude, v.longitude, o.latitude, o.longitude);
    if (!best || km < best.km) best = { km, city: o.city };
  }
  // 25 km keeps a venue inside its own metro without letting a rural court
  // borrow the name of a city an hour away.
  return best && best.km <= 25 ? best.city : null;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

// ── main ───────────────────────────────────────────────────────────────────
async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  // `Prefer: return=minimal` answers 201 with an EMPTY body, not 204, so
  // status alone is not enough to decide whether there is JSON to parse.
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!apply && !process.argv.includes("--dry-run")) {
    console.error("pass --dry-run or --apply");
    process.exit(2);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(2);
  }

  const src = JSON.parse(readFileSync(SRC, "utf8"));
  const approved = parseApproved(readFileSync(APPROVED_CSV, "utf8"));
  let approvedNew = new Set();
  try {
    approvedNew = parseApprovedNew(readFileSync(APPROVED_NEW_CSV, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    console.warn(`no ${APPROVED_NEW_CSV} — creating no new venues`);
  }
  // latitude/longitude are needed by cityFromNearest — omitting them made the
  // coordinate fallback silently return null for every row.
  const existing = await rest(
    "venues?select=id,slug,name,city,district,country,phone,price_source,latitude,longitude&limit=2000",
  );
  const bySlug = new Map(existing.map((v) => [v.slug, v]));

  const plan = {
    fillMatched: [], createNew: [], defaulted: [],
    skippedJunk: [], needsReview: [], heldBack: [],
  };

  for (const v of src.venues) {
    const junk = junkReasons(v);
    if (junk.length) { plan.skippedJunk.push({ name: v.name, why: junk }); continue; }

    const price = priceFrom(v);
    const patch = {
      ...(price ? { price_min_vnd: price.min, price_max_vnd: price.max, price_source: "partner" } : {}),
      ...(isRealHours(v)
        ? { hours_json: buildHoursJson(v.open_time, v.close_time), hours_source: "partner" }
        : {}),
      price_updated_at: new Date().toISOString(),
    };

    const targetSlug = approved.byAloboId.get(v.id);
    if (targetSlug) {
      const row = bySlug.get(targetSlug);
      const phone = normalisePhone(v.phone);
      // Never overwrite a phone we already hold — ours may be the corrected one.
      if (phone && !row?.phone) patch.phone = phone;
      plan.fillMatched.push({ slug: targetSlug, name: row?.name, patch });
    } else {
      const review = reviewReasons(v);
      const slug = slugify(v.name);
      if (!approvedNew.has(slug)) {
        plan.heldBack.push({ name: v.name, why: review.length ? review : ["not ticked"] });
        continue;
      }
      if (review.length) plan.needsReview.push({ name: v.name, why: review });
      const city = cityFromAddress(v.address) ?? cityFromNearest(v, existing);
      if (!city) {
        // venues.city is NOT NULL and drives the /san/khu-vuc hubs. Guessing it
        // is worse than holding the row: a wrong city puts the court on the
        // wrong hub page and into the wrong "nearby" lists.
        plan.heldBack.push({ name: v.name, why: ["could not determine city"] });
        continue;
      }
      plan.createNew.push({
        review,
        slug,
        name: v.name.trim(),
        city,
        district: districtFromAddress(v.address),
        address: v.address || null,
        phone: normalisePhone(v.phone),
        latitude: hasGeo(v) ? v.latitude : null,
        longitude: hasGeo(v) ? v.longitude : null,
        ...patch,
      });
    }
  }

  // The export holds the same venue more than once — "Lakeside Pickleball –
  // Coffe – Rửa xe" appears 3x, "OB Pickleball" and "Sân Pickleball Quân Đội"
  // 2x each. venues.slug is UNIQUE, so the second insert of a pair is a 409
  // that would abort its whole 50-row batch. Collapse them here and keep the
  // most complete copy, rather than letting batch ordering decide which
  // version of a venue we end up with.
  const score = (r) =>
    (r.price_min_vnd ? 2 : 0) + (r.phone ? 1 : 0) +
    (r.latitude != null ? 1 : 0) + (r.address ? 1 : 0);

  // Two venues can share a name without being the same place — "Go Pickleball"
  // appears once in Nha Trang and once in Vũng Tàu, at different addresses with
  // different phone numbers. Collapsing those by slug drops a real court, so
  // disambiguate with the city first — which is also the convention the
  // existing 760 rows follow (789-pickleball-club-ha-noi) — and only treat what
  // still collides afterwards as a genuine duplicate record.
  const nameCount = new Map();
  for (const row of plan.createNew) {
    nameCount.set(row.slug, (nameCount.get(row.slug) ?? 0) + 1);
  }
  for (const row of plan.createNew) {
    // Only WITHIN-batch collisions get a suffix. A slug that already exists in
    // the table is deliberately left alone so it trips the "already exists"
    // guard below: on a re-run that is a row this script created last time, and
    // suffixing it would insert a second copy of the same court instead of
    // skipping it.
    if (nameCount.get(row.slug) === 1) continue;
    const citySuffix = slugify(row.city);
    if (citySuffix && !row.slug.endsWith(citySuffix)) {
      row.slug = `${row.slug}-${citySuffix}`;
    }
  }

  const bestBySlug = new Map();
  for (const row of plan.createNew) {
    const prev = bestBySlug.get(row.slug);
    if (!prev || score(row) > score(prev)) bestBySlug.set(row.slug, row);
  }
  // A slug we already hold is an update, never an insert — the approved-match
  // file is the only sanctioned route to touching an existing venue.
  for (const slug of bestBySlug.keys()) {
    if (bySlug.has(slug)) {
      plan.heldBack.push({ name: slug, why: ["slug already exists — not in the approved match list"] });
      bestBySlug.delete(slug);
    }
  }
  plan.duplicatesCollapsed = plan.createNew.length - bestBySlug.size;
  plan.createNew = [...bestBySlug.values()];

  // Everything we did not touch gets the labelled default.
  const touched = new Set([
    ...plan.fillMatched.map((r) => r.slug),
    ...plan.createNew.map((r) => r.slug),
  ]);
  for (const row of existing) {
    if (touched.has(row.slug)) continue;
    if (row.price_source === "manual" || row.price_source === "partner") continue;
    // The default is 80.000-200.000 VND. It is a statement about the Vietnamese
    // market and means nothing anywhere else — applied blindly it put
    // "Sân pickleball ở Singapore thường thuê 80.000đ-200.000đ/giờ" on 60 SG/MY/BN
    // pages before this guard existed. A venue outside VN keeps no price at all
    // until someone supplies a figure in its own currency.
    if ((row.country ?? "VN") !== "VN") {
      plan.heldBack.push({ name: row.slug, why: [`outside VN (${row.country}) — VND default does not apply`] });
      continue;
    }
    plan.defaulted.push(row.slug);
  }

  console.log(`source rows      : ${src.venues.length}`);
  console.log(`skipped as junk  : ${plan.skippedJunk.length}`);
  for (const s of plan.skippedJunk) console.log(`    - ${s.name} — ${s.why.join(", ")}`);
  console.log(`fill on existing : ${plan.fillMatched.length}`);
  console.log(`create new       : ${plan.createNew.length}`);
  console.log(`  ...of which flagged for review: ${plan.needsReview.length}`);
  console.log(`duplicate slugs collapsed: ${plan.duplicatesCollapsed}`);
  console.log(`held back: ${plan.heldBack.length}`);
  const heldWhy = new Map();
  for (const h of plan.heldBack) {
    for (const w of h.why) heldWhy.set(w, (heldWhy.get(w) ?? 0) + 1);
  }
  for (const [w, n] of [...heldWhy].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)} x ${w}`);
  }
  console.log(`labelled default : ${plan.defaulted.length}`);

  if (!apply) { console.log("\nDRY RUN — nothing written."); return; }

  for (const r of plan.fillMatched) {
    await rest(`venues?slug=eq.${encodeURIComponent(r.slug)}`, {
      method: "PATCH", body: JSON.stringify(r.patch),
    });
  }
  for (let i = 0; i < plan.createNew.length; i += 50) {
    await rest("venues?on_conflict=slug", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      // PostgREST rejects a bulk insert whose objects do not all carry the same
      // keys (PGRST102 "All object keys must match"). Rows here legitimately
      // differ — a venue with no price has no price_* keys at all — so flatten
      // every row onto one shape with explicit nulls before sending.
      body: JSON.stringify(
        plan.createNew.slice(i, i + 50).map(({ review, ...row }) => ({
          slug: null, name: null, city: null, district: null, address: null,
          phone: null, latitude: null, longitude: null,
          price_min_vnd: null, price_max_vnd: null, price_source: null,
          hours_json: null, hours_source: null, price_updated_at: null,
          ...row,
        })),
      ),
    });
  }
  for (let i = 0; i < plan.defaulted.length; i += 100) {
    const slugs = plan.defaulted.slice(i, i + 100).map((s) => `"${s}"`).join(",");
    await rest(`venues?slug=in.(${encodeURIComponent(slugs)})`, {
      method: "PATCH",
      body: JSON.stringify({
        price_min_vnd: DEFAULT_PRICE_MIN,
        price_max_vnd: DEFAULT_PRICE_MAX,
        price_source: "default",
        hours_json: buildHoursJson(DEFAULT_OPEN, DEFAULT_CLOSE),
        hours_source: "default",
      }),
    });
  }
  console.log("\nAPPLIED.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
