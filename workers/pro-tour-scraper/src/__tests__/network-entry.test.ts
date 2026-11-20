import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import worker from "../index";
import { BROWSER_REQUEST_ALLOWLIST } from "../safe-fetch";
const env = { SUPABASE_URL: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role", SCRAPER_AUTH_SECRET: "fixture-signature", CLOUDFLARE_ACCOUNT_ID: "fixture-account", CLOUDFLARE_API_TOKEN: "fixture-browser-token" };
const ppa = "https://brackets.pickleballtournaments.com/tournaments/ppa-tour-2026-ppa-finals/events/74E8F47A-1E6D-475D-BA42-0D1180B0A851/elimination/69CBE305-F4E2-4F4D-B2E7-D7946A838262";
function signed(url: string) {
  const body=JSON.stringify({ tournament_url:url,triggered_by:"manual" });
  return new Request("https://scraper.example/scrape",{method:"POST",body,headers:{"X-Scraper-Signature":createHmac("sha256",env.SCRAPER_AUTH_SECRET).update(body).digest("hex")}});
}
afterEach(()=>vi.restoreAllMocks());
describe("actual scraper entry network guards",()=>{
  it("rejects excessive unsigned input before signature work or network",async()=>{
    const fetcher=vi.spyOn(globalThis,"fetch");
    expect((await worker.fetch(new Request("https://scraper.example/scrape",{method:"POST",body:"x".repeat(65537)}),env)).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["https://127.0.0.1/","https://%62rackets.pickleballtournaments.com/tournaments/x", "https://user@majorleaguepickleball.co/events-2026/test/"])("rejects signed unsafe scrape input %s",async(url)=>{
    const fetcher=vi.spyOn(globalThis,"fetch");expect((await worker.fetch(signed(url),env)).status).toBe(422);expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves PPA fixture ingestion and sends provider request restrictions",async()=>{
    const html=readFileSync(new URL("../../__fixtures__/2026-ppa-finals-mens-doubles.html",import.meta.url),"utf8");
    const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{"content-type":"application/json"}});
    const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(json({success:true,result:html})).mockResolvedValueOnce(json({log_id:"fixture-log",matches_imported:3}));
    const res=await worker.fetch(signed(ppa),env);expect(res.status).toBe(200);expect(await res.json()).toMatchObject({ok:true,matches_extracted:3});
    const options=fetcher.mock.calls[0][1]!;expect(options.redirect).toBe("manual");expect(JSON.parse(options.body as string)).toMatchObject({url:ppa,allowRequestPattern:BROWSER_REQUEST_ALLOWLIST});expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
