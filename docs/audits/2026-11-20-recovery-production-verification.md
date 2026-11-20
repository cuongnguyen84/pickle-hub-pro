# Recovery ownership fix: deployed evidence — 20 November 2026

Merge: `6a060661bf3f276bf35fbb2a2e4dd424ecba5e89` (PR1076).

## Edge function: verified deployed source

Specific push deploy-guard run **44763225691** completed successfully. Its actual detection/deploy log lists only `request-recovery-link`. No other function deployment was included in that run.

A read-only Supabase Management API GET of the deployed function body returned ESZIP2.3. Modules were decoded in memory; hashes/check results only are retained in `2026-11-20-recovery-deployed-source-manifest.json`, not raw bundles or credentials. The deployed index module is 9,869 bytes, SHA256 `fd2e73463a9ef1cd87f85bd617c1eb792cc67f87bb68118ffd5f5fdec417ba17`. Confirmed source guards: uniform `registered_channel` response, independently confirmed Auth email matching profile channel, finite/unexpired secret expiry, and no old response branch returning token/recovery URL. This proves deployed source properties, not end-to-end delivery.

## Frontend: initial stale observation (superseded below)

Production SPA asset discovery at 15:29 UTC referenced `/assets/RecoveryRegistration-BMHaP2dC.js`, SHA256 `1b4137d122b1ec306d146b9ab5957b9b1de6c649ef1d6d91e933702411843ff4`. That asset still contains old `captcha_solved`, `magic_token`, and `recovery_url` code and lacks `registered_channel`. Latest recheck is recorded in `2026-11-20-recovery-production-assets.json`. Do not claim frontend deployment from deploy-guard: it deploys Supabase functions, not Pages. With the fixed server's uniform response, the old UI should fall into its generic error branch rather than gain token access; the acknowledgement UX still needs the new frontend asset.

No synthetic recovery request, user-data lookup, notification/provider call, config change, cache purge or deployment was performed. Public GET asset inspection and function source retrieval only. No physical device or delivery-channel ownership test is claimed.

## Follow-up: frontend converged at 15:35 UTC

Read-only Cloudflare Pages API established the earlier stale UI was a deployment queue/build delay: canonical production was main 30ce267f while 6a060661 was still building (build started 15:33:25 UTC). Subsequent production custom-domain and pickle-hub-pro.pages.dev exact/unique-query GETs with Cache-Control:no-cache both referenced index-BU3kxHAk-mwp52l5e.js. The previous immutable deployment alias correctly kept its old artifact. This rules out a required browser service-worker explanation for the observed public HTTP results.

Production recovery chunk is now RecoveryRegistration-CH_ALUcE.js, SHA256 eb2f4998eb3590516e9afedafb6dcaac3f1847d88df145839e5bb509aa2b09c1: registered_channel present; captcha_solved, magic_token and recovery_url absent. See updated production-assets JSON plus recovery-pages-status/aliases JSON. Both Edge source and sampled frontend asset now pass static deployment verification; no interactive recovery/provider test is claimed.
