# Razorpay and Stripe test wallet

Both providers can be selected for wallet top-ups without changing the server's
default booking provider. `/api/v1/wallet/options` reports test-key configuration
flags to an authenticated user; it never returns secret keys. Existing clients
that omit `provider` continue to use `PAYMENT_PROVIDER`.

Web: Account → Test wallet (`/wallet`). Native: existing Wallet screen.
Amounts are INR 1–10,000, with up to two decimal places. Only server-verified
captured/paid provider responses credit the wallet. A client checkout callback
alone cannot add balance. Repeated syncs do not credit twice; idempotency keys
cannot be reused with a different explicitly selected provider or amount.

## Render setup

Checked 16 November 2026: no Razorpay or Stripe environment keys were present.
The owner has said they will configure the test keys. Merchant verification and
actual sandbox checkout remain pending until that is done.

Save these directly in the Render service Environment page:

| Variable | Value |
| --- | --- |
| RAZORPAY_KEY_ID | Your merchant test key beginning `rzp_test_` |
| RAZORPAY_KEY_SECRET | Its matching private test secret |
| STRIPE_SECRET_KEY | Your sandbox secret beginning `sk_test_` |
| STRIPE_FRONTEND_ORIGIN | `https://rahi-1-c3vn.onrender.com` |
| PAYMENT_PROVIDER | `razorpay` or `stripe` for older clients and booking default |

Use Razorpay Dashboard → Test Mode → Account/Settings → API Keys and Stripe
Dashboard → sandbox → Developers/API keys. Do not use live keys, commit secrets,
or paste them into chat. If the account lacks access, the merchant owner must
complete account setup. Save/deploy the Render configuration, then refresh the
wallet: the selected provider should report that test checkout is configured.
That flag validates key format/presence, not merchant API authentication.

## Published test cards

| Provider | Card number | CVV | Expiry |
| --- | --- | --- | --- |
| Razorpay | 4100 2800 0000 1007 | 123 | Any future date |
| Stripe | 4242 4242 4242 4242 | 123 | Any future date |

Sources: [Razorpay test cards](https://razorpay.com/docs/payments/payments/test-card-details)
and [Stripe testing](https://docs.stripe.com/testing). Enter these only in the
provider's test checkout. The app displays reference numbers but does not collect
or save a card number, CVV or expiry. For Razorpay, use the mock bank success or
failure flow shown by Checkout. In Stripe, finish Checkout, return to `/wallet`
and select **Check top-up status**. An unfinished checkout can be resumed.

## Withdrawal scope

Withdrawals are explicitly **simulated** against the sandbox wallet. They reserve
available funds, then the existing worker marks success or releases funds on
failure. They do not send money to a card/bank or call RazorpayX/Stripe Connect
payout APIs. Payment test cards are not bank payout destinations. Real payouts
need a separately designed merchant payout integration and verified recipients.

No schema migration is needed: existing top-ups already persist the provider,
and withdrawals already have reservation/settlement records. Native source
changes appear in the next explicitly requested APK build; this task does not
automatically create an APK.

## Verification

- Web production build, 68 web tests, native TypeScript and 28 native tests pass.
- Local browser checks pass: missing-key gate, provider/card selection, mocked
  Razorpay checkout, insufficient balance, simulated withdrawal/status and
  widths 320/390/768/1440. No real payment information was submitted.
- Backend coverage includes provider selection, invalid provider rejection,
  server-verified credit, duplicate sync and withdrawal settlement.
- Actual provider checkout remains unverified until merchant test keys are saved.

## Published release

Application commit `eb8abbb919f87948f6edf035d1d34ecd53a26016` pushed to `app_v1`.
Render deployment `dep-dbtdr4e417fc738gq0ug` reported Live on 16 November 2026.
Database schema remained V27; no migration was necessary. Live `/wallet` returned
200 with the new wallet bundle, health UP, and anonymous `/api/v1/wallet/options`
returned 401. No live customer funds or payment records were modified for testing.

Final targeted backend rerun: 31 passed after fixing the options route allowlist.
The complete hosted backend, frontend and mobile jobs passed:
https://github.com/sgrydv11/Rahi_/actions/runs/43850934850

Native source is updated and typechecked; no APK build was requested or started.
Merchant test-key setup and actual provider checkout remain owner follow-up;
configuration presence alone does not establish a successful provider transaction.
