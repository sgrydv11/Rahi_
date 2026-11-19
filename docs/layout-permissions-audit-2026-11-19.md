# Layout, icons and first-open access audit — 19 November 2026

## Completed in source
- Removed the Chats heading and extra group-list top padding in web and native.
- Anchored web navigation at the viewport bottom. Native safe-area padding is inside the footer rather than below it; Android system navigation remains controlled by Android.
- Standardized all footer icons to 22 px and labels to 10 px, including My Bookings. Positioned unread badges without shifting labels.
- Added a native Choose a ride dropdown; existing web dropdown uses the same label. Choosing a named route fills cities; clearing the selection preserves manually entered cities.
- Added an accessible current-city icon beside From City, retaining manual entry and location-denial feedback.
- Loaded the Ionicons font before rendering native screens and fixed the corrupted rupee character in native ride prices. Checked native literal icon names and rendered web SVG content.
- Added first-open optional contacts, notifications and foreground-location access setup. OS prompts run sequentially; declining one does not block the others. No contacts are uploaded and no background location is requested. Access can be declined; notification token registration still requires opt-in and an authenticated account.

## Live database completed
- Audited 107 accounts: 103 had no phone number, including 100 demo accounts.
- Filled only the 100 missing demo/test numbers with unique +91-prefixed ten-digit values starting 6–9. All generated numbers remain unverified.
- Three non-demo accounts without phone numbers were left unchanged. Existing numbers were preserved.
- Generated numbers are fictional demo placeholders and must not be used for SMS/calls or treated as verified identities. No schema change was required.

## Verification
- Native TypeScript passed; 37 native logic tests passed, including sequential permission requests, denial isolation and unselected permissions.
- Web production build and 71 web tests passed.
- Android JavaScript/Hermes export passed (875 modules); Inter and Ionicons font assets were included. This was a bundle check, not an APK build.
- Browser layout checks passed at widths 320, 390, 768 and 1440: no horizontal overflow, no Chats heading/title gap, footer fixed at bottom, consistent icon/label dimensions and alignment.
- Browser ride regression passed: named route autofill, sort/edit/seats, supported-city detection with simulated location, denied-location manual fallback, and responsive layouts.
- Group regression passed: pin persistence, mute/unmute, leave/join and compact rows. These tests used the isolated local QA database, not production chats.
- Phone-size browser previews: .local/layout-chat-phone.png, .local/ride-search-phone-form.png, .local/ride-search-phone-results.png.

## Not completed / release checks remaining
- Source commit 9f7df78 is deployed to the combined Render frontend/backend service. Android 0.2.7 (versionCode 9) finished successfully and passed APK artifact/signature checks; see release-0.2.7-2026-11-19.md for its download link and evidence.
- Android OS permission dialogs, icon rendering, contact-name matching, gesture navigation/safe areas and background push delivery need verification on a freshly installed updated APK/device.
- Browser mobile previews do not substitute for Android device verification. iOS permission behavior has not been tested on an iPhone.
- Real users must supply their own missing phone numbers; no generated values were added to them.
