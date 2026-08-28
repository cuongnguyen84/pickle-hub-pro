# Shop SePay — release and validation runbook

## Release state

The integration is sandbox-first and disabled by default. Existing seller-direct
VietQR remains unchanged until `shop_sepay_gateway_enabled` is explicitly set to
`true`. This matters because a Payment Gateway merchant receives the money; the
current Shop product sends money directly to each seller.

Before enabling SePay, Product Owner must choose and document one model:

1. **Platform merchant-of-record:** ThePickleHub receives buyer funds and owns
   seller settlement, refund, tax/invoice, reconciliation and dispute duties.
2. **Per-seller merchant:** each seller supplies a supported SePay merchant and
   secret. This implementation does not yet support per-seller credentials.

Do not enable the gateway for real orders until that choice is signed off. Code,
schema and sandbox testing can ship while the setting remains `false`.

## Server configuration

Set these Supabase Edge Function secrets; never add them to Vite, Swift, git or
the database:

```text
SEPAY_ENV=sandbox
SEPAY_MERCHANT_ID=<sandbox merchant id>
SEPAY_SECRET_KEY=<sandbox merchant secret>
# SePay Gateway sends the merchant SECRET KEY in X-Secret-Key.
# Do not set SEPAY_IPN_SECRET unless SePay explicitly provisions a separate IPN key.
SITE_URL=https://www.thepicklehub.net
```

Deploy in this order:

1. Apply `20260828120000_shop_sepay_gateway.sql`.
2. Deploy `shop-sepay-checkout` and `shop-sepay-ipn` with gateway JWT verification
   disabled as recorded in `supabase/config.toml`; both functions authenticate
   internally.
3. In SePay merchant management, set the IPN URL to:
   `https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/shop-sepay-ipn` and auth
   type to `SECRET_KEY`.
4. Leave `shop_sepay_gateway_enabled=false` until the sandbox checklist passes.

## Sandbox validation

Use a real buyer account and a `bank_transfer` Shop order.

- With the setting `false`, the order must show the existing seller VietQR and
  `shop-sepay-checkout` must refuse to create a checkout.
- Set the setting to `true`; the same order must show only the SePay route, never
  both seller bank details and SePay.
- Open checkout on web and iOS. Confirm the host is
  `pay-sandbox.sepay.vn`, invoice equals the Shop order code, currency is VND and
  amount equals `shop_orders.total_vnd`.
- Cancel once: the order must remain unpaid and can reopen the same invoice.
- Complete one sandbox payment. The IPN must set the attempt to `paid` and set
  `shop_orders.payment_confirmed_at`; web and iOS should update within roughly
  15 seconds.
- Replay the exact IPN: response stays HTTP 200, timestamps do not move and no
  second payment attempt/order is created.
- Send an IPN with a wrong secret: HTTP 401 and no database change.
- Send an IPN with the right secret but wrong amount/currency/invoice: non-200
  and no order confirmation.
- Confirm buyer and seller receive the payment-confirmed notification and no
  secret, card number or raw webhook body exists in logs/database.
- Turn the setting back to `false`; seller VietQR fallback must return.

Capture the order code, SePay order ID, SePay transaction ID, timestamps and
screenshots as validation evidence. Do not capture secrets or card/bank data.

## Production switch

After sandbox evidence and merchant-of-record approval:

1. Set `SEPAY_ENV=production` and production merchant/IPN secrets.
2. Confirm the production IPN configuration still uses `SECRET_KEY` and the same
   HTTPS endpoint.
3. Deploy functions while the DB setting is still `false`.
4. Run one internal low-value real payment and reconcile it against the SePay
   dashboard and receiving bank account.
5. Set `shop_sepay_gateway_enabled=true` only after that reconciliation.
6. Watch function errors, unmatched IPNs and paid-but-unconfirmed orders for at
   least 30 minutes; then review again after 24 hours.

Emergency rollback is one reversible DB setting change:

```sql
UPDATE public.system_settings
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'shop_sepay_gateway_enabled';
```

That restores seller-direct VietQR for unpaid orders without deleting payment
attempt evidence or undoing already confirmed payments.
