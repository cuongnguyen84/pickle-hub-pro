# Phase 2a — completion status

**Status: P2a implementation complete, verified locally, pending Product Owner
acceptance and deployment approval.**

Not production ready, and not deployed. Nothing on this branch has been applied
to a remote database, merged, or pushed. The prerequisites for a deployment
decision are listed at the end.

Branch `feat/shop-production-phase-2a`, worktree `.claude/worktrees/shop-p2a`.

---

## 1. What was built, step by step

| Step | Scope | Commits |
|---|---|---|
| 1 | Catalog schema, moderation state machine, RLS, storage buckets | `6881e0fc` |
| 2 | Media lifecycle: private original, verified rendition, cleanup outbox, worker contract | `6e19f2b2` `3153f6e5` `016eef50` `6f66b6d2` `ecaa3b39` |
| 3 | Shop profile, slug, contact channels, `/seller/settings` | `624862d4` `3e80f5ee` |
| — | **P0** browser zoom restored site-wide (WCAG 1.4.4) | `90b81e6e` |
| — | **P0** business phone accepts landlines, Zalo stays mobile-only | `c12fdbd6` |
| 4 | Product list / create / edit, default-variant atomicity, idempotent create | `0dd9636b` `9ef78d7f` `5d703020` `f68039fb` `680c4169` |
| 5 | Variants, option graph, SKU, inventory ledger | `b8d57e17` `b474d32a` `f38ad8aa` `db6253d9` |
| — | **P0** version conflicts returned 409 instead of hanging forever | `e41df739` |
| 6 | Media upload, ordering, variant media, shop logo/cover | `ed1940f6` `7136381b` `9e0c3800` `36a98b87` `17d251d3` |
| 7 | Canonical projection, preview, preflight, submit/resubmit | `01d01c6e` `8ea8c56e` `18f3b3bf` `3e3a0f85` |

## 2. Migrations

All unapplied to production. `supabase db reset` replays 345 tracked
migrations, ledger parity 345/345.

| File | What it adds |
|---|---|
| `20260811090000_shop_phase1_seller_onboarding.sql` | Phase 1 (pre-existing) |
| `20260811120000_shop_phase2a_catalog.sql` | products, variants, media, categories, RLS, buckets |
| `20260811140000_shop_phase2a_media_lifecycle.sql` | rendition contract, cleanup outbox, worker interface |
| `20260811150000_shop_media_cleanup_cron.sql` | cron schedule for the cleanup worker |
| `20260811160000_shop_service_role_grants.sql` | worker grants |
| `20260811170000_shop_draft_media_least_privilege.sql` | support loses read on draft originals |
| `20260811180000_shop_profile.sql` | shop profile columns, slug RPC, contact channels |
| `20260811190000_shop_contact_business_phone.sql` | VN mobile + landline normalisation |
| `20260811200000_shop_product_editor.sql` | product version, client token, create/update, action_rank |
| `20260811210000_shop_variants_inventory.sql` | option graph, combination identity, `stock_on_hand`, ledger |
| `20260811220000_shop_media_ordering_profile.sql` | media reorder, variant media, shop logo/cover |
| `20260811230000_shop_preview_submit.sql` | canonical projection, preflight, submit/resubmit, audit |

## 3. RPC surface added by P2a

Seller-facing: `product_create` · `product_update` · `product_slug_update` ·
`product_archive` · `product_unarchive` · `product_set_in_stock` ·
`product_variants_reconcile` · `product_variant_adjust_stock` ·
`product_variant_set_media` · `product_media_upload_init` ·
`product_media_finalize` · `product_media_delete` · `product_media_reorder` ·
`shop_profile_media_upload_init` · `shop_profile_media_finalize` ·
`shop_profile_media_set_focal` · `shop_profile_media_delete` ·
`shop_profile_update` · `shop_slug_update` · `shop_contact_upsert` ·
`shop_contact_delete` · `product_submit` · `product_submit_for_review` ·
`product_withdraw_submission` · `product_submit_preflight` ·
`product_public_projection` · `product_status_counts` · `product_edit_sections`

Worker / service-role only: `shop_media_cleanup_claim` ·
`shop_media_cleanup_complete` · `shop_media_reconcile` ·
`product_publish_prepare` · `product_publish_commit` ·
`shop_profile_media_publish_commit` · `shop_profile_media_revoke`

Admin only: `product_decide` · `shop_contact_decide`

## 4. Routes

| Route | Screen |
|---|---|
| `/seller` | Seller home (Phase 1) |
| `/seller/settings` | Shop profile, contact channels, logo & cover |
| `/seller/products` | Catalog list |
| `/seller/products/new` | Create |
| `/seller/products/:id/edit` | Edit, variants, media, preview, submit |
| `/admin/shop/applications` | Application queue (Phase 1) |

All behind `RequireAuth`, all `noindex`, all disallowed in robots.txt.

## 5. Test evidence

Built with `supabase db reset` — not `supabase start`, per the verification
standard in `production-implementation-map.md`.

| Gate | Result |
|---|---|
| `supabase db reset` | 345/345 migrations, ledger parity 345/345 |
| pgTAP | Files=29, **Tests=1018**, PASS |
| Storage integration (real local stack, real JWTs) | 33 assertions, PASS |
| Unit / component | **1740 passed**, 10 skipped, 144 files |
| `tsc -b` | clean |
| `eslint` | 0 errors (23 pre-existing warnings) |
| `BUNDLE_STRICT=1` | exit 0 |
| Prototype artifact guard | no prototype chunk in `dist` |
| `build:proto` | passes |
| Q01–Q04 prototype gate | clean, 37 screens |
| Seller route QA (320/375/414/768/1440 + axe + zoom) | clean |
| Teardown | 0 shops, 0 products, 0 events, 0 media rows, 0 cleanup jobs, 0 storage objects |

Shop-specific pgTAP files: `shop_phase1_rls` (35) · `shop_phase2a_catalog` (70)
· `shop_phase2a_media_lifecycle` (54) · `shop_phase2a_profile` (77) ·
`shop_phase2a_product_editor` (70) · `shop_phase2a_variants` (90) ·
`shop_phase2a_media_ordering` (73) · `shop_phase2a_submit` (84).

## 6. Bundle

Backstop **1970 KB gz — not raised** (D4).

| Step | Total gz | Delta |
|---|---|---|
| after step 3 | 1932.8 | — |
| step 4 | 1946.7 | +13.9 |
| step 5 | 1952.8 | +6.1 |
| step 6 | 1960.8 | +8.0 |
| step 7 | **1965.2** | +4.4 |

Headroom **4.8 KB**. Every heavy surface is a separate lazy chunk fetched at its
interaction boundary: `VariantEditor` 4.1 KB, `MediaEditor` 6.6 KB,
`ProductPreview` 2.4 KB. None of them is reachable from the product list or the
initial path.

## 7. Defects found by tests, not by review

1. **Version conflicts hung forever.** `serialization_failure` (40001) means
   "transient, retry me", so PostgREST retried a permanent condition and the
   request never returned. The conflict UI shipped in steps 3–5 had never been
   reachable. Fixed with `PT409` → HTTP 409. Found by the first test to send a
   conflict through PostgREST *with a clock on it*.
2. **`ON DELETE SET NULL` on a composite key** nulls every column in it,
   including a NOT NULL one — deleting any photo a variant used failed outright.
3. **The append-only ledger trigger blocked its own cascade**, so a shop that
   had ever moved stock could not be deleted.
4. **An append-only assertion passed with the trigger dropped**, because a
   missing GRANT answered first.
5. **`now()` is the transaction timestamp**, so six ledger rows written by one
   reconcile were unorderable.
6. **QA teardown removed rows but not bytes**, leaving objects behind while
   reporting success.
7. **`option_groups` was missing from the product query**, so the editor treated
   a matrix product as a simple one.
8. **A section heading is not focusable**, so "đi tới chỗ cần sửa" was a silent
   no-op.

## 8. Deferred to P2b — explicitly not built

- Admin moderation UI: the approve / reject / request-changes screens.
  `product_decide`, `shop_contact_decide` and the queue RLS exist and are
  tested; nothing renders them. **A pilot moderator must use SQL until P2b.**
- Public discovery, the public PDP route, and the public shop page.
  `product_public_projection(_id, false)` is the contract they will read.
- Contact CTA on the PDP (D2). `shop_contact_decide` exists; no screen calls it.
- Structured request-changes authoring. The seller side resolves deep links
  today; the moderator side that *sends* them is P2b.
- Cart, checkout, orders, payments, returns, disputes, reviews — Phase 3.

## 9. Deployment prerequisites

None of these is done, and none should be assumed:

1. **The media cleanup worker and its cron are not deployed.** Until they are,
   `shop_media_cleanup_jobs` accumulates and revoked objects stay addressable
   by anyone holding a URL. Deploying the schema without the worker ships the
   revocation hole this design exists to close.
2. **`shop_pilot_members` is empty.** No seller can reach any of this until the
   Product Owner adds the pilot accounts.
3. **No admin moderation UI**, so anything submitted needs a SQL round trip.
4. Migrations must be applied in order; `20260811210000` renames a column.
5. `npx supabase gen types` should be re-run after the migrations land, and
   `shop-schema.ts` + `shop-client.ts` deleted — they exist only because the
   generated types cannot describe unapplied tables.

## 10. Manual test script for the Product Owner

Prerequisites: `supabase start && supabase db reset`, then the dev server
pointed at the local stack:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev
```

Add your account to `shop_pilot_members` and create a shop with yourself as
owner, then:

1. `/seller/settings` — change the shop name. The URL must NOT change. Change
   the URL separately; the warning must say the old link stops working.
2. Add a contact channel with your shop's landline (`028 …`). It must be
   accepted. Add it as a Zalo channel; it must be refused, in Zalo's own words.
3. Open **Logo & ảnh bìa**, upload a photo from your phone. It must appear;
   the badge must say it is not public yet.
4. `/seller/products` → **Thêm** → fill name, category, price → **Lưu nháp**.
   You should land on the edit screen.
5. Add 2–3 photos. Watch the per-file states. Reorder them; the first is the
   main image. Delete one; nothing else should be disturbed.
6. Turn on **Nhiều phiên bản**, add Màu sắc: Trắng, Đen and Kích cỡ: 39, 40.
   Six rows. Set a price on one, then use **Áp cho tất cả**; it must say how
   many rows changed and offer Hoàn tác.
7. Reorder the option groups. Every row must keep its price and SKU.
8. Give two variants different photos.
9. Press **Gửi duyệt** with the description empty. The checklist must name it
   and **Đi tới chỗ cần sửa** must land on the description box.
10. Fill it in, save, then **Xem trước như người mua**. Changing colour must
    change the photo; a sold-out size must not be selectable; the buy button
    must be disabled.
11. **Gửi duyệt**. Reload. It must still say pending, and the fields must be
    read-only.
12. On a phone (or 375px), repeat steps 4–11. Nothing should scroll sideways,
    and pinch-zoom must work everywhere.

Report anything that surprises you, especially anything that claims success
without having done something.
