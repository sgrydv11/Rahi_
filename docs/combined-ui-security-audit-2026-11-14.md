# Combined website, mobile and login-security audit

Updated 14 November 2026. Branch: app_v1. Scope: the 20 website requests and
the previous 20-point login/security screenshot. The table records local implementation and testing. The subsequent 0.2.2
rollout is recorded in release-0.2.2.md: source is pushed and the combined
web/backend deployment is Live, including additive database migrations. The Android APK is also finished and download-verified. No production account data or provider settings were
changed by the audit.

**Implemented** means source code exists and the stated local checks passed.
**Partial** means external setup, device verification or a scope limit remains.
**Not implemented** is not counted as completed merely because a feature is absent.

## Website and mobile checklist

| ID | Request | Status | What was checked / changed |
|---|---|---|---|
| WEB-01 | Remove horizontal scrolling | Implemented for tested web layouts | No document-level horizontal overflow across 18 route cases at 320, 375, 768 and 1280 px, including long unbroken names/notes. Fixed flex/grid minimum widths, wrapping and small-screen ride cards/date controls. |
| WEB-02 | Find broken links | Implemented for internal links | Browser crawl checked 22 internal destinations collected from rendered routes. Protected destinations use the sign-in flow. Packaged deep links now include /chat and /help. External provider availability is not certified by this crawl. |
| WEB-03 | Add a mobile menu | Implemented | Accessible Open/Close menu control exposes the existing navigation on small screens. Escape closes it and restores focus; navigation closes it. Existing footer tabs retained. |
| WEB-04 | Add a favicon | Implemented | Dedicated 64×64 favicon.png (2,636 bytes), plus touch icon; packaged HTTP and browser checks passed. |
| WEB-05 | Fix page titles | Implemented in SPA | Route-specific browser titles for all registered page families and the custom 404; fixed route matching distinguishes /rides/new and /rides/mine from IDs. |
| WEB-06 | Add meta descriptions | Implemented in SPA | Route-specific descriptions and noindex for account/private/unknown pages. No private user data in metadata. Server-rendered social previews/prerendering are not implemented. |
| WEB-07 | Fix footer links | Implemented | Clickable home brand plus Home, Find a ride and Help destinations, visible on mobile too. No fake privacy/support destinations were added. |
| WEB-08 | Add a custom 404 page | Implemented | Existing branded recovery screen now has its own title/description. Unknown HTML routes render it with real HTTP 404 in the packaged server; static assets still load and unknown API/actuator routes remain closed. |
| WEB-09 | Fix copyright year | Implemented | Footer year derives from the current date; browser checked 2026. |
| WEB-10 | Compress images | Implemented for current web assets | Replaced the 117,500-byte web icon with a 10,566-byte 192 px touch icon; favicon is 2,636 bytes (about 98% smaller than the prior favicon download). Hero artwork is CSS, not a large image. Native source icon retained at its original resolution. |
| WEB-11 | Fix broken buttons | Partial | Verified menu, Escape, home/logo, profile save, injected save failure, logout, and contact link actions. Earlier chat/booking/calendar/signup regression retained. Google sign-in still requires Cloud configuration and a rebuilt Android binary; real payment-provider/device acceptance is not claimed. Deliberately disabled controls explain availability. |
| WEB-12 | Add success messages | Implemented for audited flows | Existing profile/vehicle/ride/booking confirmations retained; added explicit chat-send acknowledgment and logout confirmation. Browser exercised profile and logout success. |
| WEB-13 | Add error messages | Implemented for audited flows | Existing accessible alerts retained; browser injected a 503 save failure and checked the visible error. Corrected chat retry wording so it does not imply failed sends retry themselves. Native contact-launch failures surface an error. |
| WEB-14 | Remove placeholder text | Implemented for identified dummy copy | Replaced generic hero route labels with Indore–Ujjain and removed the technical account role from the web profile. Useful form hints, empty/loading messages and the intentionally requested Rentals coming-soon state remain. No fake contact addresses, reviews or discounts added. |
| WEB-15 | Remove unused navigation | Implemented for current web navigation | Every displayed destination maps to a real route or valid authentication redirect. Help is functional; no rental booking link or dead “#” menu items added. Skip-to-content #main is intentional. |
| WEB-16 | Fix mobile overflow | Implemented for tested web layouts | Same 72-case responsive scan passed with zero document overflow and zero browser page errors. Wrap constraints preserve content instead of hiding overflow. |
| WEB-17 | Make logo clickable | Implemented | Web header/footer brands link home; native header logo resets navigation to Home. Browser verified web brand navigation. |
| WEB-18 | Make phone clickable | Implemented; device launch pending | Shared-number tap still opens the requested basic member card; card adds a tel: Call link on web and a native dialer action. Numbers stay opt-in and labelled unverified. Browser verified the exact tel: destination; no actual call placed. |
| WEB-19 | Make email clickable | Implemented; device launch pending | Registered account email uses mailto: on web and the email app action in native profile. Browser checked the exact address. No unprovided public support email was invented. |
| WEB-20 | Make every page mobile optimized | Partial acceptance | All 18 current web route cases passed at the four stated widths; mobile TypeScript, 24 tests and both platform exports passed. Physical Android/iOS checks, keyboard/device font scaling, platform mail/dialer handling and signed iOS acceptance remain pending. |

## Previous login/security checklist

| ID | Screenshot issue | Status | Evidence / remaining work |
|---|---|---|---|
| SEC-01 | OTP has no rate limit | Implemented | Five verification attempts, 60-second resend cooldown, ten email requests/hour, additional process-local IP budget. DB-backed OTP counters retained. Distributed edge limits are an operations task. |
| SEC-02 | OTP shown in response | Implemented | Challenge response contains only challenge ID, lifetime and delivery type; HTTP tests check code/otp fields are absent. |
| SEC-03 | OTP never expires | Implemented | Five-minute expiry and single-use verification tests pass. |
| SEC-04 | Email-not-found reveals users | Implemented for OTP/password flows | Generic OTP challenge behavior with LOGIN/REGISTER/DECOY purposes; generic password failures. Legacy unverified registration is blocked when production OTP is enabled; it remains available for isolated local compatibility tests when explicitly disabled. |
| SEC-05 | No wrong-password lockout | Implemented | Five failures within 15 minutes lock password login for 15 minutes across email/mobile/IP changes; persisted counters and concurrent requests tested. |
| SEC-06 | Frontend-only login check | Implemented | Server credentials, authorization and ownership checks; frontend validation is supplementary. |
| SEC-07 | JWT secret is weak/default | Partial operational verification | No runtime “secret” default; minimum 32-byte Base64 key enforced and weak-key test passes. Production key randomness/rotation was not audited or changed. |
| SEC-08 | JWT decoded without verification | Implemented | Cryptographic signature/claims checks plus required sid and current database session, user status and role checks. |
| SEC-09 | Tokens in localStorage | Implemented | Web access token in memory, refresh in HttpOnly/Secure/SameSite cookie; native refresh in SecureStore. |
| SEC-10 | Refresh token never rotates | Implemented | Random opaque token rotation, hashed storage and family revocation on replay/concurrent reuse. |
| SEC-11 | Logout does not kill session | Implemented locally | Immediate access and refresh rejection after logout verified against packaged server. |
| SEC-12 | isAdmin supplied by frontend | Implemented | USER assigned server-side, profile role/email injection rejected; signed role must match current DB role. |
| SEC-13 | Reset link reusable | Not implemented / no current reset feature | A future reset flow needs expiring single-use tokens and tests; do not count this as a completed reset feature. |
| SEC-14 | Reset token guessable | Not implemented / no current reset feature | Future reset must use cryptographically random tokens and hashed storage. |
| SEC-15 | Email change without password | Blocked; change flow not implemented | Profile endpoint rejects email changes. Reauthentication and email verification required before adding that feature. |
| SEC-16 | Old sessions alive after reset | Not implemented | No reset flow yet. Future reset must revoke every session and pending authentication challenge. |
| SEC-17 | OAuth state not checked | Partial acceptance | Current Google integration is ID-token exchange rather than redirect/code/state. Browser Origin+CSRF and verified Google token checks exist. Cloud client setup and real Android acceptance remain pending. |
| SEC-18 | Admin only hidden in UI | No admin product surface; server denial checked | No admin UI/endpoints currently exist; unknown admin routes denied by backend. Future privileged endpoints need explicit authorization and MFA. |
| SEC-19 | Default admin/admin123 | Source checked; live audit pending | None found in runtime/setup sources searched. Every live account has not been audited. |
| SEC-20 | No admin 2FA | Not implemented | MFA enrollment, recovery and enforcement required before privileged administration is introduced. |

## Verification and remaining release work

- Backend: 157 current test reports passing, combining the prior full regression
  with focused auth/health/ride-web reruns after adding the browser route/404 test.
- Web: 57 tests and production build pass. `scripts/browser-site-audit.cjs`
  passed 72 route/viewport combinations, 22 internal destinations, menu behavior,
  browser title/description, favicon size/availability, mailto/tel destinations,
  profile success/error and logout feedback. Browser console had no page errors.
- Packaged web/API: HTML deep links, favicon, JavaScript assets and real HTTP
  404 recovery passed; unknown API/actuator endpoints remain unauthorized.
- Native: 24 tests, TypeScript and Android/iOS bundle exports pass. A bundle
  export is not a signed APK, installed-device test or iOS release.
- Local fixtures and provider mocks only. No real email, call, payment,
  production account mutation or production data migration performed.
- Screenshots/results are local under `.local/site-*-mobile.png` and
  `.local/site-audit-results.json`; they contain only generated local fixtures.

Release 0.2.2 is pushed, deployed and its Android APK verified. Still pending: Google OAuth setup;
real provider/device acceptance; production signing-key/default-admin checks;
admin MFA; secure reset and email-change product flows if they are to be offered.
No public support email/phone, legal policy or SLA was provided; none was made up.

Detailed security reasoning: [Login security audit](login-security-audit-2026-11-14.md).
