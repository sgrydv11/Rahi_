# Compact channels, demo card and signup consent — 18 November 2026

Implemented in web and native source:
- Compact group rows with circular group icons, single-line name/message preview, latest message time, mute/pin indicators and unread badge. Uses the existing Ionicons set, with no invented group photos.
- Per-group vertical menu: Pin/Unpin, Add yourself after leaving, Leave group, Enable/Disable notifications. Pins are stored per user in PostgreSQL and sorted first. Latest-message preview remains visible after messages are marked read. Existing default membership behavior remains compatible.
- Static demo card: fixed read-only 4242 4242 4242 4242, 12/30, CVC 123; editable amount; Add demo money and Withdraw demo money. Card details are never sent to the backend or stored. Only amountPaise is accepted.
- Demo balance and activity are in separate demo_wallets/demo_wallet_entries tables. They cannot fund a real booking or provider wallet. Amounts are bounded, withdrawals cannot overdraw, row locks prevent concurrent double spending, and request keys prevent duplicate retry credits/debits. This performs no card charge or bank payout.
- Demo mode is server-controlled by DEMO_WALLET_ENABLED, false by default, true only on the isolated local QA server for this task. Existing Razorpay/Stripe integrations remain separate and still need merchant credentials.
- Two separate, initially unchecked signup choices for Terms & Conditions and Privacy Policy. Google and email account creation are gated. Backend validates email registration choices, checks Google consent before creating new users, and records the draft version/time/source. Signup challenges lacking consent evidence cannot create accounts.
- Owner explicitly chose clearly marked draft policy pages. Both policies say owner review is pending; no operator identity, approved legal terms or support address was invented. Web links open draft pages; native links open an in-app draft reader. Draft text must be approved/replaced and versioned before production use.

Database:
- V29__group_pins_demo_wallet_and_consent.sql adds pin state, isolated demo tables and consent metadata/history.
- V29 applied only to local hoopr_test schemas during this task; production database was unchanged.

Validation:
- 71 frontend tests passed; frontend production build passed.
- 35 native tests passed; native TypeScript and Android Expo JavaScript export passed. No APK/device verification performed.
- 67 distinct affected backend tests passed: AuthWebTest 27, EmailOtpIT 10, GoogleSignInIT 6, PushIT 6, ChatIT 12, DemoWalletIT 6. Includes disabled demo mode, concurrent withdrawal, account isolation, card-data rejection, consent validation/evidence and private pin persistence.
- Browser channels/demo suite passed at 320/390/768/1440px: pin persistence and account privacy, mute, leave/add-yourself, read-message preview, static card non-editability, add/withdraw/reload, insufficient balance, provider isolation, no card transmission, separate required signup checkboxes and working draft links. Signup delivery was intercepted; no real email sent.
- Two-user chat/ride-sharing/booking/reply regression passed.
- Group controls/compact reply/named route/gender/resend timer regression passed.

Review artifacts:
- .local/channel-list-phone.png
- .local/demo-card-phone.png
- .local/signup-consent-phone.png
- Local QA app: http://127.0.0.1:5177 (isolated local accounts; email OTP intentionally disabled).
- http://127.0.0.1:5175 still uses the hosted backend for real email OTP; new API features require deployment before they work there.

Remaining: approve/replace draft policy text; deploy frontend/backend and V29; explicitly decide whether to enable DEMO_WALLET_ENABLED on hosted test deployment; build a new APK when requested and verify native controls on a device. No Git push, production deployment, merchant signup or APK build occurred in this task.
