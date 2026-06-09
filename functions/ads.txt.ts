/**
 * Serves /ads.txt directly via a Pages Function so the SPA catch-all
 * (/* -> /index.html) can't shadow it. Required for Google AdSense to
 * verify the site and authorise ad serving. Mirrors the dedicated-Function
 * pattern already used by sitemap.xml.ts.
 *
 * Publisher: ca-pub-1555585348817758
 */
const ADS_TXT = "google.com, pub-1555585348817758, DIRECT, f08c47fec0942fa0\n";

export const onRequest: PagesFunction = () =>
  new Response(ADS_TXT, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
