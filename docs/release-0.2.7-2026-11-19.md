# FlexiRides 0.2.7 release — 19 November 2026

Source commit: 9f7df785579a23009f4fc875a9d04b41b7c08e74
Branch: app_v1
Live website/API: https://rahi-1-c3vn.onrender.com
Render deployment: dep-dbva8fqvcj2c73ca7io0
Render reported Deploy succeeded / Live (3m 28s).
GitHub regression workflow: https://github.com/sgrydv11/Rahi_/actions/runs/44479410495 — all three jobs passed.

## Included changes
- Compact groups-first chat, no Chats heading and no header separator above the group box.
- Fixed bottom navigation with matching My Bookings icon and label dimensions.
- Choose a ride dropdown, current-city action beside From City, native Ionicons font loading and correct rupee glyph.
- Optional first-open contacts, notifications and foreground-location permission setup; OS prompts run sequentially.
- Wallet Coming soon in web and native; transaction controls removed from these screens. Backend wallet records and APIs are preserved.
- Android release version 0.2.7, versionCode 9, package com.hoopr.app, existing signing identity.

## Completed verification
- 71 web tests, 37 native tests, TypeScript, web build and Android JavaScript export passed.
- Isolated-browser checks passed for chat pin/mute/join/leave, wallet Coming soon, signup consent, footer alignment, no overflow at 320/390/768/1440 px, ride route autofill, sorting/editing and granted/denied location.
- Live backend health UP, temporary demo login, four chat groups, ride search, Google client configuration, missing-consent validation and anonymous-wallet access denial passed. Temporary session revoked; no live chat, ride booking or wallet transactions created.
- Live web asset checks confirmed the new Wallet Coming soon text, Choose a ride and chat-only header separator removal.
- Live database: filled only 100 missing demo-user phone numbers; all remain unverified. Three real users without numbers left unchanged. No schema migration required.

## Android artifact
Build: https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/df969c50-6a65-46ea-9a79-5085006255b2
Build finished successfully.
APK: https://expo.dev/artifacts/eas/DxCAwQt0PAKnxR0UlVht2Am6jkcjJNv1Rl5WSSyuBEc.apk
SHA-256: 0a64485b786ad5b5cb454974f8ded76c4012101f98583cf945dcc829a829b38f
Size: 91673674 bytes.
Signature verified (v2), existing signing certificate retained. Package/version, production API, Google native module, push/contacts/location native modules and permissions, Firebase project configuration, pin menu, signup consent, Wallet Coming soon, first-open access setup, ride dropdown and current-city strings all passed artifact checks. No on-device installation/test was performed during this release.

## Remaining checks
Fresh-install Android permission dialogs, contact matching, background notifications and device safe-area behavior require on-device verification. iOS device verification is pending. Terms and Privacy pages remain drafts for owner review. Razorpay and Stripe merchant credentials are not configured; Wallet is marked Coming soon.
