# Phase 10 — Razorpay test checkout

Hoopr also supports Stripe Checkout in test mode. Set `PAYMENT_PROVIDER=stripe`,
`STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_FRONTEND_ORIGIN=http://localhost:5173`
in `backend/.env`, then restart the backend. Use your actual frontend origin for
the hosted checkout return URL. Set `PAYMENT_PROVIDER=razorpay` to select
Razorpay for new orders. Existing orders retain their original provider and
require that provider’s test credentials for reconciliation and refunds.

For Stripe, choose **Pay test fare**, finish hosted Checkout, then select
**Check payment status** on the booking. Hoopr fetches its stored Checkout
Session and checks booking reference, amount, currency and payment status
before showing the receipt. The existing refund flow uses the stored Stripe
PaymentIntent. [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create) ·
[Stripe refunds](https://docs.stripe.com/api/refunds/create)

Hoopr enables checkout when the backend receives both `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` and the key ID starts with `rzp_test_`. Set them in the local `backend/.env` using your Razorpay test dashboard, then restart the backend using the environment-loading steps in [SETUP.md](../SETUP.md). Keep the secret local. The frontend receives the public test key ID when checkout is configured.

Use automatic capture in the Razorpay test dashboard for this walkthrough. Hoopr records payment only once the provider reports a captured fare.

1. Create a future ride with an INR fare and book it as a separate passenger. Open **My bookings** and select **Pay test fare** on the booking. Hoopr calculates the amount from the stored fare and seat count. Test checkout requires at least ₹1.
2. Complete the test transaction in Razorpay Checkout. Hoopr validates the signature against the stored order and records a receipt after Razorpay confirms the matching capture. If the browser closes or capture takes time, use **Check payment status** to recover it.
3. Cancel the booking through the existing passenger or driver flow. The passenger can request a full test refund on a captured payment. Check a pending refund with **Check payment status** until Razorpay reports its result.

| Method and path under `/api/v1/bookings/{id}/payment` | Behavior |
| --- | --- |
| GET on the base path | Read checkout eligibility, receipt and refund status |
| POST `/order` | Create or reuse the booking's Razorpay order |
| POST `/verify` | Validate `paymentId` and `signature` and verify capture |
| POST `/sync` | Reconcile capture or pending refund with Razorpay |
| POST `/refund` | Request one full refund for a cancelled booking |

Only the booked passenger can access these endpoints. An unpaid booking continues to reserve its seats under the existing booking rules. Phase 10 uses user-initiated status reconciliation. It does not operate a webhook, collect live payments, or distribute payouts to drivers.

V7 adds the `booking_payments` table. The regression suite tests capture, mismatched amounts, invalid signatures, recovery after a missed callback, ownership, refund eligibility and retries using simulated Razorpay responses. The separate gateway test checks HMAC verification against a known digest. See [payment test cases](test-cases.md).

[Razorpay Checkout and signature verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) · [Fetch payments for an order](https://razorpay.com/docs/api/orders/fetch-payments/) · [Razorpay normal refunds](https://razorpay.com/docs/api/refunds/create-normal/)
