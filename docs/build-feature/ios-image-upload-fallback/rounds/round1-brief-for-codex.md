# Brief: iOS Safari JPEG fallback for shop product/profile image pipeline

You are a prompt engineer. Based on this brief, write a technical prompt (English or Vietnamese OK) for a coding agent that will execute directly on the codebase. The prompt must include: exact files to change with per-file change content, constraints, and numbered measurable acceptance criteria. The coding agent must NOT have to re-discover anything — the investigation below is complete and authoritative.

## Defect

Sellers on iPhone cannot upload shop product photos. iOS Safari does not encode WebP via `canvas.toBlob(cb, "image/webp")` (returns PNG-typed blob instead). The client pipeline intentionally rejects at `src/lib/shop/imagePipeline.ts` line 160-165 with message "Trình duyệt này chưa tạo được ảnh WebP. Thử trình duyệt khác." Vietnamese sellers are ~all on iPhone → Wave-1 blocker.

## Agreed fix (do not deviate)

JPEG fallback end-to-end: client tries WebP first (Chrome/Android behavior unchanged); if the returned `blob.type` is not `image/webp`, re-run the encode ladder with `image/jpeg` (every browser encodes JPEG). Server side: accept `image/jpeg` renditions alongside `image/webp`. NO new dependencies (no WASM encoder). Do NOT weaken the verification model: `product_media_finalize()` / `shop_profile_media_finalize()` still read the real MIME from `storage.objects`; only the list of valid rendition MIMEs is widened. EXIF stripping still happens naturally via canvas re-encode.

**Key architectural decision (already made, coder must follow):** all object paths/keys KEEP the `.webp` suffix even when the bytes are JPEG (`rendition.webp`, `<media>-v<n>.webp`, `profile/.../live.webp`). Rationale: paths are stored in DB rows and clients build URLs only from DB values (`publicMediaUrl`); browsers render by Content-Type header, not extension; and `shop_media_reconcile` (migration 20260814110000, line ~109) derives the DETERMINISTIC expected public key with `.webp` hardcoded — per-type extensions would break reconcile and touch 5+ functions for zero user value. The coder must add a short comment where relevant noting "extension is a claim; MIME in storage.objects is the truth".

## Complete investigation results (file → required change)

### Client
1. `src/lib/shop/imagePipeline.ts`
   - `IMAGE_LIMITS.renditionType: "image/webp"` stays (preferred). Add `renditionFallbackType: "image/jpeg"` (or a `renditionTypes` tuple — coder's choice, but the mirror comment referencing `shop_media_limits()` must stay true).
   - `processImage()` quality ladder (lines 154-169): currently one loop over qualities [0.82, 0.7, 0.6, 0.5] encoding WebP, throwing ImageRejected if `blob.type !== renditionType`. New behavior: try WebP at first quality; if returned type is wrong, switch the encoder type to `image/jpeg` for the whole ladder and restart the ladder (don't mix types mid-ladder). If JPEG also comes back with wrong type or null → throw ImageRejected with UPDATED copy (old message mentions only WebP; new message must not tell the user to switch browsers for the JPEG-capable case — e.g. "Trình duyệt này không nén được ảnh. Hãy thử cập nhật trình duyệt hoặc chọn ảnh khác."). The returned `ProcessedImage.blob.type` is now either image/webp or image/jpeg.
2. `src/hooks/shop/useMediaUpload.ts` line 207: rendition upload currently `contentType: IMAGE_LIMITS.renditionType` — must become `processed.blob.type` (the storage-recorded mimetype is what finalize verifies). Nothing else changes here (original upload at line ~198 already uses file.type; init RPC `_content_type` is the ORIGINAL's type, already accepts jpeg).
3. `src/components/shop/MediaEditor.tsx` — no functional change (ACCEPT list is input types, unchanged). Leave alone.

### SQL — ONE new migration file (never edit old migrations), e.g. `supabase/migrations/20260816XXXXXX_shop_media_jpeg_rendition_fallback.sql`
4. Re-CREATE OR REPLACE `public.shop_media_limits()` (original in 20260811140000 line 105): add key `'rendition_content_types', jsonb_build_array('image/webp','image/jpeg')`. Keep the existing singular `rendition_content_type` = 'image/webp' key (documented as the preferred type) so nothing unknown breaks.
5. Re-CREATE OR REPLACE `public.product_media_finalize(_media_id UUID, _width INTEGER DEFAULT NULL, _height INTEGER DEFAULT NULL)` (original 20260811140000 line 382): replace the single-MIME equality check (line 425) with membership in `rendition_content_types` (e.g. `IF NOT (_lim -> 'rendition_content_types') ? coalesce(_rend_meta->>'mimetype','')`). Everything else byte-identical (size, dimension, idempotency, privileged_write toggles). Keep identical signature incl. DEFAULTs (CREATE OR REPLACE cannot drop defaults — 42P13).
6. Same for `public.shop_profile_media_finalize(_media_id UUID, _width INTEGER DEFAULT NULL, _height INTEGER DEFAULT NULL)` (original 20260811220000 line 357, MIME check at line 401).
7. NOT changed (verified): storage buckets already allow `image/jpeg` (20260811120000 lines 499-510); `product_media_upload_init` validates ORIGINAL types (already jpeg-friendly); `product_publish_prepare/commit`, `shop_media_reconcile`, cleanup functions, `shop_media_health` — none pin rendition MIME; public read model returns paths from DB rows.

### Edge function (trusted byte verifier)
8. `supabase/functions/shop-media-lifecycle/index.ts` publish(): currently calls `inspectWebp(bytes)` (line 97) and uploads with hardcoded `contentType: "image/webp"` (line 109). New: sniff the leading bytes — RIFF/WEBP → `inspectWebp`, FFD8 → new `inspectJpeg`, else reject `rendition_not_webp`-style error (rename reason appropriately, e.g. `rendition_not_image`). Upload contentType = the detected type. Dimension check unchanged.
9. NEW `supabase/functions/shop-media-lifecycle/jpeg.ts` — Deno-free JPEG inspector mirroring `webp.ts` style: verify SOI (FFD8), walk segments; reject on APP1 (Exif or XMP — that's the metadata a canvas re-encode never produces) with reason `metadata_present`; read width/height from SOF0/1/2 (any 0xC0–0xCF except C4/C8/CC); reason `truncated` / `not_jpeg` analogues. No dependency.
10. Note for coder: edge function deploy is NOT their job (no commit/push); vitest covers the inspector, pgTAP covers SQL.

### Tests
11. `src/lib/shop/__tests__/imagePipeline.test.ts`
    - `stubCanvas(sizes, type)` currently returns ONE fixed type for all toBlob calls; extend so per-call types are possible AND the stub records the encoder type requested per call (toBlob's 2nd arg).
    - REWRITE the test at line ~190 "refuses a browser that hands back something other than WebP" → becomes the Safari-simulation fallback test: first call returns PNG-typed blob (Safari behavior), pipeline must re-encode as JPEG; assert final `blob.type === "image/jpeg"`, assert the toBlob type argument sequence was webp-then-jpeg, assert Chrome path (webp succeeds first try) still produces webp and never requests jpeg.
    - Add: quality ladder still steps down within the JPEG fallback; both-formats-fail case throws the NEW message.
12. `src/hooks/shop/__tests__/useMediaUpload.test.tsx` — mocked processImage returns `new Blob(["r"])` (type ""); after the change the rendition upload passes `processed.blob.type` — update mocks to return typed blobs (e.g. `new Blob(["r"], {type: "image/webp"})`) and assert the storage upload's contentType equals the processed blob type (add one assertion for a jpeg-typed processed blob).
13. NEW `supabase/functions/_shared/__tests__/shop-media-jpeg.test.ts` mirroring `shop-media-webp.test.ts` (which runs under vitest, imports `../../shop-media-lifecycle/webp.ts`): minimal JPEG byte builder; cases: valid canvas-style JPEG (SOI+DQT+SOF0+scan) → ok with dims; APP1 Exif present → metadata_present; truncated; not-jpeg.
14. pgTAP `supabase/tests/shop_phase2a_media_lifecycle.test.sql` lines 185-196: the "client lies about re-encoding" negative currently uploads rendition with mimetype `image/jpeg` and expects 22023 — **this flips to green under the fix**. Change that fixture to a mime that stays invalid (`image/png`) and keep the test. ADD positive coverage: a rendition with mimetype `image/jpeg` finalizes successfully (new media row/token so idempotency of tok-A isn't disturbed), and profile finalize accepts jpeg too. May live in the new migration's own test file `supabase/tests/shop_media_jpeg_rendition.test.sql` where cleaner — but the flipped negative in the existing file MUST be fixed in place.
15. `src/lib/__tests__/shop-schema-parity.test.ts` — no change needed (new migration file isn't in its lists; all asserted functions still exist in the P2a files). Do not add it.

## Constraints for the coder
- Worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button` has an UNCOMMITTED diff of an unrelated feature (shop activation button: src/main.tsx, src/pages/shop/*, src/pages/admin/shop/*, applicationState.ts, useShopApplicationQueue.ts, ProductCard/ProductPreview, migration 20260816090000_shop_activate_rpc.sql, tests). Do NOT touch those files. None of them intersects this fix (verified).
- No commit, no push, no deploy. No new dependencies.
- Dev server on port 8080 is serving Cuong from this worktree (HMR fine).
- `supabase db reset --local` wipes Cuong's manual-test data → run pgTAP as the LAST step, and afterwards run `node scripts/shop-p2b-fixture.mjs down || true` then `node scripts/shop-p2b-fixture.mjs up` to reseed.
- Order for pgTAP: `supabase db reset --local` then `supabase test db --local` (supabase start alone does NOT apply all migrations).

## Acceptance criteria to include (numbered, all must be verifiable by command)
1. `npm run lint` clean; 2. `npx tsc -b` (or the repo's typecheck) clean; 3. `npm run test` all green including the new fallback tests and jpeg inspector tests; 4. `supabase db reset --local && supabase test db --local` all green including flipped negative + new jpeg-positive pgTAP; 5. `npm run build` + `node scripts/check-bundle-size.mjs` green; 6. `grep -rn "image/webp" src/lib/shop src/hooks/shop supabase/functions/shop-media-lifecycle` shows no remaining single-MIME enforcement point (each remaining hit is either the preferred-type constant, the sniffer, or a comment); 7. fixture reseeded (`shop-p2b-fixture.mjs up` exits 0) after pgTAP.
