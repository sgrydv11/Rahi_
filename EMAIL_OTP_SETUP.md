# Email OTP setup for Render

**Paused:** Current clients use email and password. This guide is for a future OTP rollout. The backend sender is off by default; enabling it later also requires setting `EMAIL_OTP_ENABLED=true` and reintroducing the OTP screens.

Email OTP is the current release method. SMS verification is deferred. Registration collects a mobile number but does not mark it verified. Sign in with email until SMS is configured.

1. Create a [Resend account](https://resend.com/signup).
2. Open **Domains**, add a domain you own, and copy the exact DNS records Resend provides into your domain's DNS provider. Wait for verification.
3. Create an API key with **Sending access**, restricted to your sending domain. Store it securely; do not paste it in chat or commit it.
4. Open your [Render backend](https://dashboard.render.com/web/srv-dbmrvumgekts73earsag), then **Environment**. Add:

   ```text
   RESEND_API_KEY=<your private sending API key>
   OTP_EMAIL_FROM=FlexirRides <login@your-verified-domain.com>
   ```

5. Save and redeploy the backend using branch `app_v1`. The release must include database migrations V16 and V17. Keep the existing database and JWT settings.
6. Register with a real email address and mobile number. Request a code, check inbox/spam, and verify it within five minutes. Check Resend's delivery logs if no message arrives. Never share codes or keys in screenshots.
7. Confirm an incorrect code fails, the correct code signs in once, replay fails, and resend is unavailable for 60 seconds. Test signup, existing-account login and guest booking separately.

Without your own domain, initially use `FlexirRides <onboarding@resend.dev>`. Resend restricts this sender to the email address associated with your Resend account. This is a developer test, not public registration. A verified sending domain is required for other customers.

Render free services block outbound SMTP ports 25, 465 and 587. This implementation sends through Resend's HTTPS API. No Gmail app password or SMTP credentials are needed.

For local testing, set the same environment variables before starting Java. The server does not automatically load an arbitrary `.env` file. Missing configuration returns a setup-required error rather than disclosing or logging a code.

References: [Render free limitations](https://render.com/docs/free), [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Resend test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
