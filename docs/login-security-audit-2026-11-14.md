# Login security checklist — 14 November 2026

Scope: the supplied 20-point image, current backend/web/native source and
isolated PostgreSQL tests. This is an implementation audit, not a certification
or evidence that the live deployment has these changes.

| # | Checklist item | Finding / action |
|---|---|---|
| 1 | Unlimited OTP attempts | Already limited to five verification attempts per challenge, 60-second resend interval, ten requests per email/hour and an additional process-local IP budget. Database row locks and committed failure counts enforce the code-attempt limit. |
| 2 | OTP returned in API | Challenge DTO contains only challengeId, expiresIn and delivery; code is sent through the mailer. Added HTTP regression assertions that code/otp fields are absent. |
| 3 | OTP never expires | Already expires after five minutes and is single-use. Expiry/replay regression tests retained. |
| 4 | Account enumeration | Fixed OTP login and verified-signup request differences. Existing/missing/inactive accounts receive the same challenge response shape; unusable challenges cannot authenticate or create accounts. Delivery follows the same mailer path. Password failures remain generic. |
| 5 | No wrong-password lockout | Added persistent account-level counters: five failures within 15 minutes lock password login for 15 minutes. Email and mobile aliases share the same user row and budget; row locking prevents concurrent lost updates. Successful login resets counters after any lock has expired. Email OTP remains an independent recovery sign-in method. |
| 6 | Frontend-only authentication | Already verifies credentials and access to business APIs on the server. Client validation is supplementary. |
| 7 | JWT secret is `secret` | No such default exists in runtime configuration. Startup requires Base64 key material of at least 32 bytes. Added weak-key rejection test. Operators must generate a random secret; length validation cannot prove entropy. All-zero keys in test annotations are isolated test fixtures only. |
| 8 | JWT only decoded | Already verifies HS256 signature, issuer, audience, subject, role and bounded timestamps. Added required session ID and live database checks for active account, matching role, session expiry and revocation. |
| 9 | Token in localStorage | Web access token stays in memory, refresh token in HttpOnly/Secure/SameSite cookie. Native refresh token uses SecureStore; no browser token persistence was found. |
| 10 | Refresh token never rotated | Already rotates opaque random tokens, stores only hashes and revokes the entire family on replay. Concurrent-refresh regression retained. |
| 11 | Logout leaves session active | Fixed immediate bearer revocation: JWT carries sid; every protected request checks the server session. Logout and refresh replay now invalidate unexpired access tokens too. |
| 12 | Client controls isAdmin | Registration assigns USER server-side. Profile edits reject unknown role/email fields. Added regression for these payloads; JWT role must also match the current database role. |
| 13 | Reset link works twice | No password-reset link endpoint exists; not a current exploit path. Future reset must be expiring and single-use. |
| 14 | Guessable reset token | No reset-token implementation exists; no vulnerable token generator to change. Refresh tokens already use SecureRandom with 256 bits. |
| 15 | Unauthenticated email change | Email changes are not supported by the profile endpoint, which explicitly rejects the field. Added HTTP regression. Future email-change functionality needs reauthentication and verification. |
| 16 | Old sessions after reset | Password reset is not implemented. The new live session check supports immediate revocation, but a future reset flow must explicitly revoke all sessions and pending authentication challenges. |
| 17 | Missing OAuth state | Current Google integration exchanges a signed ID token from Google Identity Services/native SDK; it does not implement an authorization-code redirect/state flow. Browser exchange already requires trusted Origin and CSRF token. Native endpoint rejects Origin/Sec-Fetch-Site requests. Signature, audience, issuer, verified-email and expiry tests retained. Google configuration/device acceptance still pending. |
| 18 | Admin page hidden only in UI | No administrative endpoint/UI exists. Unknown routes are denied by the backend. Added admin-route denial regression. Existing business APIs enforce user/ownership checks. |
| 19 | Default admin/admin123 | No default admin seed or admin123 credential found in runtime Java/SQL or setup scripts searched. This is a source finding, not an audit of every live account. Demo users are not administrator credentials. |
| 20 | Admin without 2FA | Administrative MFA is not implemented. There is currently no administrative product surface. MFA enrollment, recovery and server enforcement remain required before adding privileged administration; this item is not claimed complete. |

## Implementation and rollout

V23 adds password failure/window/lock fields to users and an OTP purpose field.
Request purposes are LOGIN, REGISTER or DECOY. Login challenges can never create
an account; signup creates one only after successful email verification. A
duplicate signup request cannot replace an existing password. Valid email
requests use the same delivery path whether eligible or not; delivery outages
and format validation remain explicit errors for all accounts.

The password lock persists in PostgreSQL across process restarts and across
web/native requests and IP changes. The outer IP limiter remains per-process;
it is not advertised as a distributed edge/WAF rate limit. Temporary password
lockout can be abused to inconvenience a known account, so email-code sign-in
remains available. No permanent lockout or insecure unlock endpoint was added.

All signed API tokens now require sid. On deployment, older access tokens
without it receive 401; clients can rotate their existing valid refresh token
to obtain a session-bound token. Existing session rows are preserved. Session
checks add one indexed database read per authenticated request and deliberately
fail closed when the session/account cannot be verified. This change needs
deployment capacity/latency monitoring; no performance load claim is made.

No new password-reset/email-change/admin/MFA feature was silently added. No
production credentials, account data, database or provider settings were changed
by this audit. No new APK was requested or created.

Regression evidence is recorded in PRODUCTION_READINESS_TRACKER.md after the
final test run. Real Google sign-in on a phone still awaits Google Cloud setup.

References:
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
