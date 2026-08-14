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
| `suspended` | **`reopen`** | **`needs_changes`** | seller-visible note **and** ≥1 validated target | seller may edit again | no | revoke re-asserted; **never re-published** | `reopen` |
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

## Q5 — the road back from `suspended` (signed 2026-08-12)

`suspended → approved` is **forbidden**. The only road back is

```
suspended → needs_changes → pending_review → approved
```

Four steps, not one button. A product an admin pulled cannot return to the
storefront without a seller changing something and an admin approving it again.

The transition is called **`reopen`**, deliberately not `restore`: it restores
the seller's ability to **edit**, not the product's ability to **sell**. It
carries the same requirements as `request_changes` — a seller-visible reason
and at least one validated structured target — because telling a seller "you
may edit again" without saying what to change asks them to guess what got them
suspended.

`reopen` re-asserts the media revocation (idempotent; covers a worker that had
not drained the queue) and **never re-publishes**. The bytes come back only
after a fresh approve followed by the worker's commit.

`allowed_decisions` returns `["reopen"]` for a suspended product, so a screen
cannot offer anything the server would refuse. Guarded by
`shop-schema-parity.test.ts`, which fails if a CASE arm ever maps `reopen` to
`approved`, and if the word `restore` appears at all.

## Contact channels — their own history (Q6)

`shop_contact_moderation_events`, keyed by `contact_channel_id` and `shop_id`.
Not a nullable `product_id` on the product table: a contact channel belongs to
a shop, and inventing a schema is worse than choosing one.

Actions: `approve` · `reject` · `disable` · `resubmitted` (written by a trigger
when a seller edits an approved value, so the history reads as a conversation
instead of a list of verdicts with unexplained gaps).

The channel **type** travels through the history. The value never does — a
history row is read in lists, exported, and eventually handed to a dispatcher,
and none of that needs the seller's phone number to say "the phone channel was
approved".

## Both histories are append-only WITHOUT making their subject undeletable

The P2a inventory-ledger lesson, which arrived on schedule: a blanket `DELETE`
refusal blocks the `ON DELETE CASCADE`, so a channel that was ever moderated
could never be removed — taking account deletion and the QA teardown with it.
The P2a profile suite caught it within minutes of the table existing.

Postgres removes the parent before the children, so inside the trigger **a
missing parent is the cascade**. History still cannot be edited or selectively
pruned; it goes only when its whole subject goes. The same fix was applied to
`product_moderation_events`, where the trap was latent only because sellers
have no DELETE policy on products.
