# Android 0.2.3 physical-device test report

Date: 14 November 2026 (Asia/Kolkata).
Device: Samsung SM-F127G, Android 13, connected over authorized USB debugging.
Target: com.hoopr.app 0.2.3, versionCode 5. Testing stopped on the older 0.2.2 installation when the user requested a fresh build.

## Build and release identity

- Expo build: `3c80938c-3046-43d1-ba79-eb562e57eac5` — FINISHED.
- Build page: https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/3c80938c-3046-43d1-ba79-eb562e57eac5
- APK: https://expo.dev/artifacts/eas/Qek6DJHqy3iZm3KzjXagSXx3tR0VUUk18Wm-rrHONDY.apk
- Size: 91,090,460 bytes.
- SHA-256: `cc6cc8e39f7ec250c48029c5d817cabfb4594b84df5e96c1b28c41725fa11577`.
- Expo source fingerprint: `97ff065f094557da5044458d4330f0ef1aa439f5`.
- APK uploaded from the current working tree before its publication as `c01bfab`; later staging changes were whitespace-only. The build metadata's earlier Git HEAD is not proof that the old app source was uploaded: version, fingerprint and on-device group/design behavior were verified.
- Matching app/backend/design source pushed to `app_v1` at `c01bfab`. Hosted CI run 43577457202 passed.
- Follow-up web font-access correction: `daca16b`. It does not change APK code or require another APK.

## Artifact and upgrade checks — passed

- ZIP archive CRC integrity.
- Android apksigner cryptographic signature verification (v2 scheme).
- Signing certificate matches the previously installed release.
- Manifest package/version/code: com.hoopr.app / 0.2.3 / 5.
- In-place ADB upgrade returned Success; no data clearing or uninstall.
- Phone package manager independently confirms version 0.2.3 / build 5.
- Existing authenticated account restored after upgrade.
- Bundled Inter fonts render on the device.

## Physical app checks

| Area | Result and evidence |
|---|---|
| Launch | PASS: cold launch, background/resume and force-stop/restart. One ActivityManager cold launch reported 766 ms; this is not a full time-to-interactive benchmark. |
| Session retention | PASS: existing welcome/account state after resume and process restart. Account left signed in. |
| Navigation | PASS: Home, My Bookings, Offers, Chat, Account; profile, vehicles, notifications and wallet entry points. |
| Keyboard/input | PASS: origin/destination, passenger name/age and chat composer retain visible focused fields above the keyboard. Text and numeric input worked. |
| Journey date | PASS: native calendar opens, 17 November 2026 selection persists into search. |
| Time control | PASS: native AM/PM picker opens; cancellation returns to search filters. |
| Live ride search | PASS: Indore to Ujjain, 17 November returns seeded rides. |
| Sorting | PASS: price ascending/descending; first fare changes from INR 150 to INR 195. Revised Time/Price/Rating arrow controls are visible. |
| Filters | PASS: boarding options Aurobindo/Luv Kush/Vijay Nagar and drop options D-Mart/Lal Gate/Nanakheda. Selecting Aurobindo/Nanakheda yields the expected no-match state for these seeded offers. |
| Clear filters | PASS: clears selected stops/sort and restores available rides while keeping the selected journey. No AC search filter. |
| Ride details | PASS: driver, departure, fare, seat count, vehicle, pickup/drop and explicitly fictional seed notes load. |
| Booking validation | PASS: missing stops rejected; missing/invalid passenger details rejected. |
| Booking details/review | PASS: boarding/drop selection, QA passenger name/age/gender, fixed fare, dummy Direct/QR/Other options and non-scannable QR placeholder. |
| Booking confirmation | PASS: one seat booked on the explicitly labeled fictional demo commute. QR demo choice persisted; screen states no payment collected. |
| Inventory | PASS: availability 2 → 1 after confirmation, then 1 → 2 after cancellation. |
| Cleanup | PASS: only the newly created QA booking canceled through the confirmation dialog. It remains in history as canceled, not active. |
| Booking history | PASS: My Bookings shows the canceled QA reservation. |
| Notifications inbox | PASS: confirmation and cancellation events display. |
| Chat mobile numbers | PASS: registered mobile numbers visible without share-phone permission control; unverified label retained. |
| Member details | PASS: tapping a number opens member name, travel preference and membership date. No actual phone call placed. Dialer launch was not conclusively observed. |
| Groups | PASS: general room plus Indore–Ujjain, Indore–Dewas and Indore–Pithampur groups open. |
| Group mute | PASS: notification switch persists across group changes; restored to its original enabled setting and checked again after process restart. |
| Group drafts | PASS: unsent Ujjain draft does not appear in Dewas and returns when switching back. |
| Message send | PASS: exactly one user-authorized message, QATestDraftOnly, posted in Indore–Ujjain Up-Down; appears in feed, composer clears, and exactly one copy remains visible after full app restart. No other live test messages sent. |
| Reply gesture | PASS: actual right swipe opens quoted reply and focuses the composer above the keyboard. Cancel reply works; no second message sent. |
| Date grouping | PASS: Today separator shown for the authorized QA message. Seven-day expiry and older-page boundaries were covered in backend tests, not simulated by changing phone/server dates. |
| Profile/preferences | PASS: editor exposes city and India-time period choices. An unsaved default route was added then removed; original empty preferences saved with success feedback. Name/contact details unchanged. |
| Vehicles | PASS: empty list loads; blank vehicle form rejected with no vehicle created. |
| Offer ride | PASS: form loads and missing future departure rejected; no new ride published. |
| Wallet | PASS: balance/activity screen loads. No top-up, withdrawal or provider checkout initiated. |
| Crash inspection | PASS in exercised flows: app-specific crash buffer and fatal/ReactNativeJS error scan empty. Exit history shows the expected upgrade/explicit force-stop events, not a new-version crash or ANR. |

## Findings and limits

1. **Fixed release defect:** production font URLs initially returned 401 because `/fonts/**` was absent from the public static-asset policy. Reproduced in a regression test; allowlist corrected for GET/HEAD. All 26 AuthWebTest checks pass. Correction deployed successfully: font GET is 200, its SHA-256 matches the bundled Inter asset, and the hosted stylesheet references Inter. Hosted CI run 43581552627 passed for daca16b.
2. **Google sign-in blocked by configuration:** production `/api/v1/auth/google/config` reports no client ID. Native integration alone cannot complete authentication. Existing Google Cloud setup work remains required.
3. **Accessibility follow-up:** native footer/selected-button accessibility names include private-use icon glyphs in the UI hierarchy. Explicit labels and hiding decorative icons from accessibility would improve this; TalkBack spoken output was not tested.
4. **Minor UX:** blank vehicle rejection shows generic Request validation failed rather than field-specific guidance. A canceled booking still shows an unavailable Razorpay test-checkout panel; no payment was attempted.
5. **User-requested exclusion:** keep the current session signed in. Sign-out, password login, fresh registration, email OTP delivery/verification and Google account selection were not exercised on this phone. Source tests do not substitute for those device checks.
6. Incoming-message banners/unread increments were not stimulated from a second account: authorization covered one outgoing QA message only. Matching/unread/mute scenarios previously passed isolated backend/browser tests. Background/terminated-app OS push is not implemented.
7. No real payment, provider checkout, withdrawal, actual call, new public ride, completed journey or rating submission. No offline/rotation/large-font, additional Android-model or iOS physical-device coverage is claimed.
8. This is a functional device smoke/regression run, not a penetration test, load test or full release certification.

## Data and device outcome

- User account left signed in on the latest APK; original group notification setting and travel preferences restored.
- The fictional demo seat was restored; QA booking remains canceled in history.
- The single explicitly authorized QA group message remains subject to normal history policy; it was not silently deleted.
- Screenshots/XML/logs are retained only in ignored `.local/apk-device-023`; no phone PIN, account email, mobile numbers or raw private logs are included in this report.
- No release email sent, consistent with the user's last preference to share links.

## Final deployment and verification outcome

Production web and API: https://rahi-1-c3vn.onrender.com/ . Public city catalog,
chat groups/settings and booking behavior were exercised successfully. Live HTML,
stylesheet and bundled font returned 200 after the correction; the downloaded font
matches the release asset exactly. Both hosted CI runs completed successfully.

The deployment dashboard was not inspected: automatic approval review blocked
reading a Chrome window identified as unrelated Gmail. Deployment was verified
through the actual live endpoints/assets and CI instead; no Gmail contents were read.
