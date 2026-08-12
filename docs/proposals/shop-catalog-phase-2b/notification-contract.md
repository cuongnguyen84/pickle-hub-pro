# P2b.1 — notification contract (DEFERRED, by design)

> Nothing in P2b.1 sends an email or a push. This file is the contract a
> dispatcher will consume, written now so the decision it records is
> deliberate rather than discovered later by a seller who was never told their
> product was rejected.

## Why nothing was wired

The repo's `notifications` table is a **user-facing inbox**, not an outbox:

```
notifications(user_id, type notification_type, entity_type follow_target_type,
              entity_id, related_id, title, message, is_read, created_at)
```

Two problems, neither of them cosmetic:

1. `type` and `entity_type` are **enums**. `entity_type` is
   `follow_target_type` — the things a user can follow. A product under
   moderation is not one of them. Delivering shop moderation through this table
   means widening two platform-wide enums for a closed pilot.
2. There is no delivery state, no attempt counter and no dedup key. "Retry-safe
   and deduplicated" (plan §16) cannot be expressed in it, so a retry would
   insert a second row and the seller would read the same rejection twice.

Bolting retry semantics onto the inbox table to serve one pilot feature is a
worse outcome than saying so. `notification-send` is also a skeleton returning
HTTP 200 and must not be called (recorded in the Phase 0 recon).

## What P2b.1 provides instead

`product_moderation_events` already carries everything a dispatcher needs, and
it is written **inside the decision transaction**, so a notification can never
describe a decision that did not commit:

| Column | Use |
|---|---|
| `product_id`, `shop_id` | who to tell, resolved through `shop_members` |
| `decision` | which message |
| `from_status` → `to_status` | the wording, and whether it is a state change at all |
| `applicant_note` | the seller-visible text, already written for a seller |
| `requested_targets` | the deep link — section, and the variant/media id |
| `created_at` | ordering, and the "we already told them" question |
| **`notify_key`** UNIQUE | the dedup key |

`notify_key` is `product:<id>:<decision>:<client_token>`. Because the event row
is written exactly once per decision (the client token is idempotent and there
is a unique index behind it), **a retried dispatcher cannot produce a second
logical notification** — the property is structural, not a dispatcher
convention that a redeployed worker could disagree with.

## What a dispatcher must and must not do

Must:

- read events it has not yet delivered, ordered by `created_at`;
- resolve recipients from `shop_members` at send time, not from a stored list;
- deep-link to an authorized route (`/seller/products/:id/edit`) and let
  `RequireAuth` do its job;
- treat delivery failure as its own problem — **a failed send never rolls back
  the moderation decision** (plan §16).

Must never put in a payload:

- `internal_note`, in any form;
- a storage path or a signed URL;
- the raw contact value;
- any seller document or PII;
- the buyer's anything.

The safe payload is: shop id, product id, product title, decision, and the
seller-visible note.

## Contact-channel decisions

`shop_contact_decide` writes to `audit_logs` with the channel **type** and id —
never the number or the URL. It does not currently write a
`product_moderation_events` row, because that table is keyed by product and a
contact channel belongs to a shop. If contact notifications are wanted, the
options are a sibling `shop_moderation_events` table or a nullable
`product_id`; that is a schema decision, not something to improvise inside
P2b.1.

## What is needed before this can ship

1. A Product Owner decision on channel: in-app inbox, email (Resend), push
   (FCM), or a Zalo message.
2. If in-app: either widen `notification_type` / `follow_target_type`, or give
   Shop its own inbox surface.
3. A dispatcher with delivery state and backoff — the existing
   `shop_media_cleanup_jobs` claim/complete pair is the working precedent in
   this codebase and is worth copying rather than inventing.
4. Nothing here is deployed, scheduled, or called.
