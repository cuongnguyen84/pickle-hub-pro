# Shop automatic bank payment — release and validation runbook

## Release state

The buyer sees an inline VietQR containing the platform bank account, exact
order amount and bare order code. SePay's bank webhook confirms the incoming
transfer automatically. The legacy setting name
`shop_sepay_gateway_enabled` remains the reversible kill switch.

The selected operating model is **platform merchant-of-record**: ThePickleHub
receives buyer funds and owns seller settlement, refunds, tax/invoice,
reconciliation and disputes. Per-seller automatic settlement is not included.

## Server configuration

Set these Supabase Edge Function secrets. Bank details are displayed to the
buyer but remain server-configured so a client build cannot redirect money:

```text
SEPAY_BANK_CODE=<VietQR bank short name, alias, code or BIN>
SEPAY_BANK_ACCOUNT_NUMBER=<linked platform bank account or VA>
SEPAY_BANK_ACCOUNT_NAME=<recipient name>
SEPAY_WEBHOOK_SECRET=<random HMAC-SHA256 secret configured in SePay>
```

The old `SEPAY_ENV`, `SEPAY_MERCHANT_ID` and `SEPAY_SECRET_KEY` may remain for a
future hosted card/NAPAS flow, but the inline bank-transfer flow does not use
them.

Deploy in this order:

1. Keep `shop_sepay_gateway_enabled=false`.
2. Deploy `shop-sepay-checkout` and `shop-sepay-ipn`; both authenticate
   internally, so gateway JWT verification remains disabled in
   `supabase/config.toml`.
3. In SePay Dashboard → Tích hợp → Webhooks, create a production webhook:
   - URL: `https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/shop-sepay-ipn`
   - Event: incoming money only
   - Account: the exact account in `SEPAY_BANK_ACCOUNT_NUMBER`
   - Content type: `application/json`
   - Authentication: HMAC-SHA256 using `SEPAY_WEBHOOK_SECRET`
   - Auto retry: enabled
   - Payment-code prefix: `PH`
4. Send the dashboard test. It must return HTTP 200 only when its sample maps to
   a real pending test order; an unknown sample invoice returning 404 is a safe
   reconciliation refusal, not an authentication failure.
5. Enable the DB setting only after the configuration checks pass.

## Production validation

Use a real buyer account and a low-value `bank_transfer` Shop order.

- The buyer chooses transfer once at checkout. The order page automatically
  displays the QR; there is no second “pay” button and no hosted redirect.
- QR recipient, amount and memo must exactly equal the configured platform
  account, `shop_orders.total_vnd` and the order code.
- A completed transfer must produce a signed webhook, set the attempt to
  `paid`, and set `shop_orders.payment_confirmed_at`; web and iOS poll every
  three seconds and update automatically.
- Replay the same webhook: HTTP 200, no second confirmation.
- Changed raw body, stale timestamp or invalid signature: HTTP 401.
- Wrong account, amount or invoice: non-200 and no order confirmation.
- Confirm buyer and seller receive the payment-confirmed notification. Logs and
  database must contain no secret or raw webhook body.
- Compare the order, SePay transaction and receiving bank line, then monitor
  unmatched webhooks and paid-but-unconfirmed orders for 30 minutes and again
  after 24 hours.

Emergency rollback is reversible:

```sql
UPDATE public.system_settings
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'shop_sepay_gateway_enabled';
```

It restores seller-direct VietQR for unpaid orders without deleting payment
attempt evidence or undoing confirmed payments.
