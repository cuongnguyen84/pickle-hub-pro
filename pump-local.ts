// ============================================================================
// pump-local.ts — máy bơm tạm thời thay cron Cloudflare (sự cố 10/09/2026:
// "Workers Cron Triggers degraded"). Chạy từ Mac bằng tsx, lặp 60s:
//   due rows → fetch bracket → parseTournamentHtml (CHÍNH adapter đã deploy)
//   → POST pro-tour-ingest (service bearer — ingest chấp nhận, xem header
//   comment của chính nó) → advance watchlist (+2' như nhịp live).
// TỰ TẮT khi status API của Cloudflare hết incident "Cron Triggers" (worker
// cron tự chạy lại, không cần đường bơm nữa) hoặc sau 2 giờ.
// File nằm ngoài git — xoá sau sự cố.
// ============================================================================
import { parseTournamentHtml } from "./src/lib/pro-tour/adapters/rsc-scraper";

const SB = "https://ajvlcamxemgbxduhiqrl.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cfCronIncidentActive(): Promise<boolean> {
  try {
    const d = await (await fetch("https://www.cloudflarestatus.com/api/v2/summary.json")).json();
    return (d.incidents ?? []).some((i: { name: string; status: string }) =>
      /cron trigger/i.test(i.name) && i.status !== "resolved");
  } catch { return true; } // status API lỗi → cứ bơm tiếp cho an toàn
}

async function tick(): Promise<void> {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const due = await (await fetch(
    `${SB}/rest/v1/pro_tour_watchlist?select=id,tournament_url&status=eq.active` +
    `&or=(and(next_scrape_at.is.null,scrape_frequency.in.(daily,weekly)),next_scrape_at.lte.${now})` +
    `&order=next_scrape_at.asc.nullsfirst&limit=4`, { headers: H })).json();
  if (!Array.isArray(due) || due.length === 0) { log("hàng đợi rỗng"); return; }
  for (const row of due) {
    const url: string = row.tournament_url.split("?")[0];
    if (!/brackets\.pickleballtournaments\.com/.test(url)) { log(`bỏ qua (không phải brackets): ${url.slice(-40)}`); continue; }
    try {
      const html = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
      if (!html.includes("__next_f")) { log(`challenge/vỏ (${html.length}B) — thử lại vòng sau: …${url.slice(-30)}`); continue; }
      const parsed = parseTournamentHtml(html, url);
      if (parsed.matches.length === 0) { log(`0 trận parse được: …${url.slice(-30)}`); continue; }
      const t0 = Date.now();
      const res = await fetch(`${SB}/functions/v1/pro-tour-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          scrape_result: parsed, triggered_by: "scheduled",
          triggered_by_user_id: null, watchlist_id: row.id,
          duration_ms: Date.now() - t0, log_id: null,
        }),
      });
      if (!res.ok) { log(`ingest ${res.status}: ${(await res.text()).slice(0, 120)}`); continue; }
      const out = await res.json();
      await fetch(`${SB}/rest/v1/pro_tour_watchlist?id=eq.${row.id}`, {
        method: "PATCH", headers: H,
        body: JSON.stringify({
          last_scraped_at: new Date().toISOString(),
          next_scrape_at: new Date(Date.now() + 2 * 60_000).toISOString(),
        }),
      });
      log(`OK ${parsed.tournament_name.slice(0, 30)} · ${parsed.matches.length} trận · imported ${out.matches_imported ?? "?"}`);
    } catch (e) {
      log(`lỗi …${url.slice(-30)}: ${e instanceof Error ? e.message.slice(0, 100) : e}`);
    }
  }
}

(async () => {
  log("PUMP START — thay cron CF đến khi incident hồi (tối đa 2h)");
  for (let i = 0; i < 120; i++) {
    if (i % 5 === 0 && !(await cfCronIncidentActive())) {
      log("CF báo incident Cron Triggers đã hồi — PUMP EXIT, cron worker tự chạy lại");
      return;
    }
    await tick().catch((e) => log(`tick lỗi: ${e}`));
    await sleep(60_000);
  }
  log("PUMP hết 2h — nếu CF chưa hồi, chạy lại lệnh pump");
})();
