# P2b.1 — product moderation state machine

> One machine, extended. P2a owns `status` (moderation) and `is_published`
> (publication); P2b.1 adds one status value and five decisions. There is no
> second machine and no parallel status column.

## The three ideas that are not one boolean

| Idea | Where it lives | Who writes it |
|---|---|---|
| moderation decided | `products.status` | `product_decide` (admin, AAL2) |
| bytes published | `product_media.public_path` | the worker, via `product_publish_commit` |
| publicly visible | `status='approved' AND is_published AND shop.state='active'` | derived; nobody writes it |

`product_moderation_detail()` returns all three separately, so a moderator sees
"approved, waiting on images" rather than guessing from one flag.

## Transitions

`actor` is **admin with AAL2** for every row below; `is_admin()` carries the 2FA
requirement, and it is checked inside the function, not in the route guard.

| From | Action | To | Required | Side effects | Public after | Media | Event |
|---|---|---|---|---|---|---|---|
| `pending_review` | `approve` | `approved` | preflight clean | `decided_at/by`; publication requested | **no** — not until the worker commits | rendition prepared, not yet public | `approve` |
| `pending_review` | `reject` | `rejected` | seller-visible note | `is_published=false` | no | renditions revoked, cleanup enqueued | `reject` |
| `pending_review` | `request_changes` | `needs_changes` | seller-visible note **and** ≥1 validated target | targets stored; `requested_fields` derived for the P2a seller UI | no | renditions revoked | `request_changes` |
| `needs_changes` | seller resubmits | `pending_review` | P2a `product_submit` | unchanged | no | — | `resubmitted` (P2a table) |
| `approved` + published | `unpublish` | `approved` | seller-visible note | `is_published=false` | no | renditions revoked | `unpublish` |
| `approved` | `suspend` | `suspended` | seller-visible note | `is_published=false` (forced by CHECK) | no | renditions revoked | `suspend` |
| `suspended` | — | — | — | — | — | — | **see blocker** |
| any | seller `archive` | `archived` | P2a `product_archive` | seller's own withdrawal | no | revoked | P2a |

Everything not in this table raises `22023` naming the current state, so the
caller learns what it did wrong rather than getting a silent no-op.

## Guards on every transition

- admin + AAL2, checked in the function
- `SELECT ... FOR UPDATE` row lock
- `_expected_version` compared against `products.version` → `PT409` on stale
- guarded `UPDATE` with the status in the `WHERE`
- `_client_token` replay returns the first answer, before the lock
- exactly one append-only `product_moderation_events` row
- `UNIQUE (product_id, client_token)` behind the replay check, so idempotency
  survives the guard being bypassed
- one `audit_logs` row, ids only — never the internal note

## Approve preflight

Approve re-asks everything, because everything can have changed while the
product sat in the queue:

- the whole of `product_submit_preflight` **except** `wrong_status` (which asks
  about submitting, and a queued product is by definition already submitted)
- **the category is still active** (Q3 — the taxonomy is the platform's and can
  move underneath the queue)
- the shop is still `active`

A failed preflight returns `{ok: false, problems: [...]}` as **data**. It does
not raise: the moderator needs the whole list to decide whether to request
changes instead, exactly as the seller does.

## Structured correction targets

Same shape the seller side already resolves — `product_submit_preflight` emits
it and `src/lib/shop/submitProblems.ts` focuses it:

```json
{ "section": "media", "field": null, "variant_id": null, "media_id": "…" }
```

Server-validated: the section must be one of `product_edit_sections()`; a
`variant_id` or `media_id` must belong to **this** product; and `index`,
`position` and `nth` are refused outright — a position points at a different
photo the moment the seller reorders them.

`name` and `slug` are `{section:"basics", field:"name"|"slug"}`; return notes
are `{section:"shipping", field:"return_note"}`. Those controls live inside
sections the editor can already open, so no new anchors were invented.

## Blocker — there is no `restore`

Coming back from `suspended` has more than one defensible destination:

- straight to `approved` — the takedown was a mistake, and the product returns
  to sale without anyone looking at it again;
- to `needs_changes` — the seller must fix the problem and resubmit.

They differ in whether a suspended product can reappear unreviewed. The brief is
explicit that a transition whose consequence is undecided is reported, not
invented, so it is reported.

Until the Product Owner decides, a suspended product stays suspended.
`allowed_decisions` returns `[]` for it, so no screen can offer a button the
server would refuse. Nothing is lost — the row, its variants, its media and its
whole history are intact, and the recovery path can be added later with no
backfill. `shop-schema-parity.test.ts` fails if `'restore'` appears in the
migrations, so adding it is a decision somebody has to make on purpose.
