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
- [ ] Finish refreshed passenger-search browser check.
- [ ] EAS APK finished and artifact manifest/signature verified.
- [ ] Verify production backend health and compatibility after build.
- [ ] Physical-device permission dialog, notification delivery/tap and Google
  login. No Android device was attached during this run; these are not claimed.
- [ ] Real Razorpay/Stripe sandbox checkout after merchant keys are configured.

No live customer chat messages, bookings or balances were changed for tests.
First-launch permission choices are policy-tested and the APK will be inspected;
this does not replace on-device OS dialog and background-delivery acceptance.
