#!/usr/bin/env node
/**
 * enrich-venues-google-places.mjs — Sprint 2 (Content Effort venue), hướng A+B.
 *
 * A) Điền NAP đang NULL (phone/website/address) bằng data Google Places — CHỈ khi
 *    cột đang trống, không ghi đè dữ liệu cộng đồng đã nhập.
 * B) Lưu place_id + rating + review_count để render badge "★x · N đánh giá trên
 *    Google" (link-out, attribution) ở trang venue.
 *
 * TOS Google Places (tuân thủ):
 *   - place_id: cache vĩnh viễn.
 *   - rating/review_count: cache ngắn hạn → refresh <= --refresh-days (mặc định 25,
 *     dưới trần 30 ngày). Hiển thị luôn kèm "trên Google" + link tới listing.
 *   - KHÔNG lưu review text, KHÔNG lưu ảnh (chỉ link-out).
 *   - Places KHÔNG có giá thuê sân → script không đụng tới giá.
 *
 * Chạy local (KHÔNG deploy — API trả phí, kiểm soát bằng tay):
 *   GOOGLE_PLACES_API_KEY=... \
 *   SUPABASE_URL=https://ajvlcamxemgbxduhiqrl.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/seo/enrich-venues-google-places.mjs --limit=50 [--slugs=a,b,c] [--dry-run]
 *
 * Nhắm "top-50 theo traffic": truyền --slugs=<danh sách slug từ GSC>. Không có
 * --slugs thì fallback theo heuristic (is_verified desc, num_courts desc).
 */

import { createClient } from "@supabase/supabase-js";

// ── args ────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  }),
);
const LIMIT = Number(args.limit ?? 50);
const REFRESH_DAYS = Number(args["refresh-days"] ?? 25);
const MAX_DISTANCE_KM = Number(args["max-distance-km"] ?? 2);
const DRY_RUN = !!args["dry-run"];
const SLUGS = typeof args.slugs === "string" ? args.slugs.split(",").map((s) => s.trim()).filter(Boolean) : null;
const PACE_MS = 150; // giãn cách giữa các venue để không đụng rate-limit

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, val] of [
  ["GOOGLE_PLACES_API_KEY", API_KEY],
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
]) {
  if (!val) {
    console.error(`✗ Thiếu env ${name}`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── helpers ───────────────────────────────────────────────────────────────��─
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Haversine km giữa 2 toạ độ — chặn match nhầm sang địa điểm khác. */
function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function placesJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
  const json = await res.json();
  // Places trả status trong body — ZERO_RESULTS không phải lỗi, các status khác thì là.
  if (json.status && !["OK", "ZERO_RESULTS"].includes(json.status)) {
    throw new Error(`Places status ${json.status}${json.error_message ? `: ${json.error_message}` : ""}`);
  }
  return json;
}

/** Find Place → place_id + geometry, có locationbias nếu venue đã có toạ độ. */
async function findPlaceId(v) {
  const query = [v.name, v.district, v.city, "Vietnam"].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    input: query,
    inputtype: "textquery",
    fields: "place_id,geometry",
    language: "vi",
    key: API_KEY,
  });
  if (v.latitude != null && v.longitude != null) {
    params.set("locationbias", `point:${v.latitude},${v.longitude}`);
  }
  const json = await placesJson(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`);
  const cand = json.candidates?.[0];
  if (!cand) return null;

  // Chặn match nhầm: nếu venue có toạ độ mà candidate lệch > MAX_DISTANCE_KM → bỏ.
  if (v.latitude != null && v.longitude != null && cand.geometry?.location) {
    const d = distanceKm(v.latitude, v.longitude, cand.geometry.location.lat, cand.geometry.location.lng);
    if (d > MAX_DISTANCE_KM) return { rejected: true, distanceKm: d };
  }
  return { placeId: cand.place_id };
}

/** Place Details — chỉ field cần cho A (NAP) + B (rating). */
async function placeDetails(placeId) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "formatted_phone_number,international_phone_number,website,formatted_address,rating,user_ratings_total",
    language: "vi",
    key: API_KEY,
  });
  const json = await placesJson(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  return json.result ?? null;
}

// ── main ──────────────────────────────────────────────────────────────────��─
async function main() {
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 86400_000).toISOString();

  let q = supabase
    .from("venues")
    .select("id, slug, name, address, district, city, phone, website, latitude, longitude, google_place_id, google_synced_at")
    .limit(LIMIT);

  if (SLUGS) {
    q = q.in("slug", SLUGS);
  } else {
    // Chưa map, hoặc đã map nhưng quá hạn refresh. `or` gộp 2 điều kiện.
    q = q
      .or(`google_place_id.is.null,google_synced_at.lt.${cutoff}`)
      .order("is_verified", { ascending: false })
      .order("num_courts", { ascending: false });
  }

  const { data: venues, error } = await q;
  if (error) throw error;
  if (!venues?.length) {
    console.log("Không có venue nào cần enrich.");
    return;
  }

  console.log(
    `Enrich ${venues.length} venue${DRY_RUN ? " (DRY-RUN)" : ""} · refresh<=${REFRESH_DAYS}d · max-dist ${MAX_DISTANCE_KM}km\n`,
  );

  const stats = { matched: 0, rejectedFar: 0, noMatch: 0, filledNap: 0, ratingUpdated: 0, errors: 0 };

  for (const v of venues) {
    try {
      let placeId = v.google_place_id;
      if (!placeId) {
        const found = await findPlaceId(v);
        await sleep(PACE_MS);
        if (found?.rejected) {
          stats.rejectedFar++;
          console.log(`  ~ ${v.slug}: candidate lệch ${found.distanceKm.toFixed(1)}km → bỏ`);
          continue;
        }
        if (!found?.placeId) {
          stats.noMatch++;
          console.log(`  ? ${v.slug}: không tìm thấy trên Google`);
          continue;
        }
        placeId = found.placeId;
        stats.matched++;
      }

      const d = await placeDetails(placeId);
      await sleep(PACE_MS);

      const update = {
        google_place_id: placeId,
        google_synced_at: new Date().toISOString(),
      };
      if (d) {
        if (d.rating != null) update.google_rating = d.rating;
        if (d.user_ratings_total != null) update.google_review_count = d.user_ratings_total;
        // A) NAP: chỉ điền khi cột đang NULL — không ghi đè dữ liệu cộng đồng.
        const napPhone = d.formatted_phone_number || d.international_phone_number;
        if (!v.phone && napPhone) update.phone = napPhone;
        if (!v.website && d.website) update.website = d.website;
        if (!v.address && d.formatted_address) update.address = d.formatted_address;
      }
      const filledNap = ["phone", "website", "address"].some((k) => k in update);
      if (filledNap) stats.filledNap++;
      if ("google_rating" in update) stats.ratingUpdated++;

      if (DRY_RUN) {
        console.log(`  · ${v.slug}: ${JSON.stringify(update)}`);
      } else {
        const { error: upErr } = await supabase.from("venues").update(update).eq("id", v.id);
        if (upErr) throw upErr;
        const flags = [
          "google_rating" in update ? `★${update.google_rating}(${update.google_review_count ?? "?"})` : "",
          filledNap ? "NAP+" : "",
        ]
          .filter(Boolean)
          .join(" ");
        console.log(`  ✓ ${v.slug} ${flags}`);
      }
    } catch (e) {
      stats.errors++;
      console.error(`  ✗ ${v.slug}: ${e.message}`);
    }
  }

  console.log(
    `\nXong. matched=${stats.matched} rejected-far=${stats.rejectedFar} no-match=${stats.noMatch} ` +
      `nap-filled=${stats.filledNap} rating-updated=${stats.ratingUpdated} errors=${stats.errors}`,
  );
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
