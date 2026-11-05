# Open Ride Group and wallet API contract

Phase 1 defines the contract for Phases 2–4. The mobile authentication endpoints are implemented. Authenticated group offers, holds, provider checkout and reconciliation are available. Wallet and discount endpoints below are reserved.

Mobile authentication uses JSON requests to `POST /api/v1/mobile/auth/register` with `email`, `password`, `fullName` and optional `travelPreference`, and to `POST /api/v1/mobile/auth/login` with `email` and `password`. Login returns `accessToken`, `expiresIn`, `refreshToken` and `user`. The `refresh` and `logout` endpoints under the same prefix accept the current `refreshToken` in the body. Refresh rotates the token and returns a new session. Logout revokes it and returns 204. The native app stores the refresh token in device secure storage. These endpoints do not set session cookies and reject browser-origin requests.

Use the existing `/api/v1` prefix and a mobile access token in the bearer header. Amounts are integer INR paise. Timestamps are ISO 8601 UTC. Each create or confirm request requires a UUID `Idempotency-Key`. A retry with the same key and payload returns the same operation. A changed payload with the same key returns `409 IDEMPOTENCY_CONFLICT`.

| Method and path | Request | Response |
| --- | --- | --- |
| GET `/group/offers?page=0&size=20` | Optional `origin` and `destination` | Paged offers with ride ID, route, departure, available seats and fare per seat |
| POST `/group/holds` | `rideId`, `seats` | Hold with ID, expiration, state, immutable quote and optional booking ID |
| GET `/group/holds/{id}` | — | Current hold owned by the rider |
| POST `/group/holds/{id}/checkout` | `method` of `PROVIDER` or `WALLET` | Updated hold and optional provider checkout details |
| POST `/group/holds/{id}/sync` | — | Hold after server verification and reconciliation |
| POST `/group/holds/{id}/cancel` | — | Updated hold, with the cancellation result |
| GET `/wallet` | — | Currency, available and reserved balances |
| GET `/wallet/transactions?page=0&size=20` | — | Paged ledger entries |
| POST `/wallet/top-ups` | `amountPaise` | Pending operation and provider checkout details |
| POST `/wallet/top-ups/{id}/sync` | — | Updated top-up status |
| POST `/wallet/withdrawals` | `amountPaise` | Sandbox withdrawal operation and status |
| GET `/wallet/withdrawals/{id}` | — | Updated withdrawal status |
| GET `/ride-discounts/next` | — | Next discount percentage |

Paged results use `content`, `page` and `totalPages`. Hold states are `HELD`, `PAYMENT_PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED`, `REFUND_PENDING` and `REFUNDED`. A quote contains `farePaise`, `discountPercent`, `discountPaise`, `totalPaise` and `currency`. The quote holds the discount until that checkout completes or releases it. Phase 2 quotes use a zero discount until Phase 4 enables the cycle.

Checkout details use the existing provider shapes. Stripe returns `provider: "stripe"` and `checkoutUrl`. Razorpay returns `provider: "razorpay"`, `keyId` and `orderId`. Group sync uses the stored provider order or session to verify capture server-side. The background reconciliation job also checks unresolved orders. A late capture enters `REFUND_PENDING` and becomes `REFUNDED` after the provider confirms the refund. Wallet operations use `PENDING`, `SUCCEEDED` or `FAILED`.

Use problem JSON with `status`, `detail` and stable `code`. Expected cases include `400 INVALID_REQUEST`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` for missing or non-owned operations, `409 SOLD_OUT`, `409 HOLD_EXPIRED`, `409 INSUFFICIENT_FUNDS`, and `503 PROVIDER_UNAVAILABLE`. Repeat sync and cancel requests are safe. Only a confirmed hold has a booking ID, even if a late capture requires a refund.
