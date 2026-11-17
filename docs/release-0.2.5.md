# FlexirRides 0.2.5 — first-launch notifications and regression testing

Android package `com.hoopr.app`, version code 7. Branch `app_v1`.

First launch now explains message, booking and ride alerts and offers Enable
notifications / Not now. Enable creates the Android channel before the system
permission request. The app remains usable when declined. The choice is saved;
Account retains manual enable/settings controls. Permission can be requested
before login or a backend connection. Push tokens remain tied to authenticated
sessions and register only after an explicit opt-in. Already granted OS permission
on older Android versions still receives the app's initial opt-in choice.

This APK also includes the previously published Razorpay/Stripe test wallet and
current mobile changes. Payment keys were absent when last checked; actual
merchant checkout still requires the owner's test-key configuration. Withdrawals
remain simulations. Admin is web-only.

## Completed checks

- Full backend suite: 181 tests, zero failures/errors/skips; packaged successfully.
- Web: 68 tests and production build passed.
- Native: 32 tests, TypeScript check, Android and iOS bundle exports passed.
- Browser email-code login, signup verification, password visibility, calendar,
  groups/chat replies, unread notifications, wallet and admin checks passed.
- Website audit: 72 route/viewport checks and 28 internal links passed.
- Driver/Passenger/Both permissions and groups-first navigation passed on rerun.
- Booking request/driver acceptance and notification flow passed.

Browser harness corrections: wait for session restoration before forcing a full
navigation; use current email/mobile label, sort arrow controls and boarding
filters. AC filtering is intentionally absent. Admin fixture provisioning was
rerun after the backend test suite released local database connections.

## Remaining verification

- [x] Journey-rating popup, review persistence and appearance in results.
- [x] Passenger search: minimum seats, sort, boarding filter and sign-in preserve two-seat booking.
- [x] EAS APK finished; manifest, package/version, CRC, signing certificate, Firebase modules, production API URL and notification opt-in strings verified.
- [x] Live backend health UP; `/wallet` 200; anonymous wallet options 401.
- [ ] Physical-device permission dialog, notification delivery/tap and Google
  login. No Android device was attached during this run; these are not claimed.
- [ ] Real Razorpay/Stripe sandbox checkout after merchant keys are configured.

No live customer chat messages, bookings or balances were changed for tests.
First-launch permission choices are policy-tested and the APK will be inspected;
this does not replace on-device OS dialog and background-delivery acceptance.

## Completed release — 17 November 2026

- APK source: `8847c40dbea53e0a22201db83e0c996612d73603`, branch `app_v1`.
- Expo build: [10f2bc2f-ef07-45f1-b8bc-f0572e2be5e0](https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/10f2bc2f-ef07-45f1-b8bc-f0572e2be5e0), FINISHED.
- [Download Android APK 0.2.5](https://expo.dev/artifacts/eas/3CPvRStLplt_KU7ZpZDCtPmNsEEAECWkivNWtSxY6ZU.apk).
- Artifact size: 91,511,619 bytes. SHA-256:
  `84f38c1537f8a6bd9bdf6b08fbd5b3f90b69f047b1023b97613bd78bf2d740b0`.
- Signing certificate matches previous APK; Android version code 7.
- All 11 browser suites passed after documented harness corrections. Final local
  evidence: `.local/release-025-browser-final.json` and
  `.local/release-025-apk-verification.json`.
- [Hosted regression run](https://github.com/sgrydv11/Rahi_/actions/runs/43856791776)
  completed successfully for the exact APK source commit.
- Render continues serving backend/web commit `eb8abbb`; this release changes
  native code and browser tests only, so no backend redeploy/migration was needed.
- Initial terminal health probes were slow; the completed checks and browser both
  confirmed UP. `.local/release-025-live-checks.json` records final HTTP results.
- `adb devices` detected no phone on 17 November. On-device notification dialog,
  actual background delivery/tap, Google login and merchant checkout remain
  acceptance checks; they are not claimed as passed.

The EAS submission logged a fingerprint-upload DNS error after creating the build.
Its existing build was checked rather than resubmitted; it finished successfully.
Account-usage approval-review interruptions delayed checks but did not change
release source. Documentation/test-only follow-up uses `[skip render] [skip ci]`.
