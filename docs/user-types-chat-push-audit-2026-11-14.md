# User types, group navigation and mobile push audit — 14 November 2026

## Request status

| Request | Implementation | Verification / remaining work |
| --- | --- | --- |
| CR-001 Driver, Passenger, Both | Selection on registration and Account; matching web/native actions; backend offer, booking and hold authorization. Existing histories remain available in Account. | Backend role tests and browser tests passed for all three types, direct routes and changing type. Previously authorized payment settlement remains supported. |
| CR-002 Groups first | Chat initially shows groups, unread counts and notification switches. No conversation is marked read merely by opening the list. | Browser list/unread/read checks passed; native bundles pass. |
| CR-003 Back to groups | Back before group heading; native header/hardware Back returns to groups. Per-group unsent drafts remain isolated and retained. | Browser Back/draft isolation passed. Physical testing of the new native implementation awaits a new APK. |
| BUG-004 Phone push | Native permission/channel/token registration, settings recovery, notification navigation and badge; authenticated session-bound devices, durable outbox, retries, provider receipts and mute/read checks; ride lifecycle notifications. | Backend gateway and PostgreSQL integration tests pass. **Not live-delivery verified:** Firebase/FCM credentials, Render enablement and a new APK are required. See mobile-push-setup.md. |

## Tests

- Backend: 169 tests passed, including role enforcement, push ownership/session validation, queue deduplication, muted/read/revoked sessions and invalid tokens; mock HTTP provider tests do not send external notifications.
- Web: 63 tests and production build passed.
- Native: 27 API/navigation tests, TypeScript and Android/iOS bundle exports passed. Bundle export is not an APK or on-device acceptance test.
- Browser: all three user types, direct-route denial, changed-type API denial, groups-first, unread preservation, selected-group read, Back, per-group drafts and 320px overflow passed.
- Website audit: 72 route/viewport checks and 21 internal links passed, including menu, metadata, contacts, favicon and success/error/logout feedback. Group/community tests passed for swipe reply, notifications/unread, mute, date separators, filters and regular-route alerts.
- Chat browser integration: two local accounts, member details, quoted reply/cancel/reload, ride sharing, booking and live seat updates passed.
- Browser fixtures use an isolated local PostgreSQL schema. No new production group messages were sent; the signed-in phone session was retained.

## Deployment and acceptance boundaries

Migration V25 adds push device, event and outbox tables. Phone push defaults off until the provider is configured. No private Firebase credential was created or committed. The current installed 0.2.3 APK predates these changes; no new APK was requested for this task and none was submitted.

Real Android background/locked-screen delivery, permission refusal/recovery, notification-tap navigation and hardware Back still require acceptance on a newly built APK. iOS additionally requires APNs credentials and signing. Provider receipts cannot prove that a phone displayed an alert; an already accepted alert cannot be recalled after logout.

The temporary Windows system/display wake request runs only while this work is active and is released on completion; persistent power settings are unchanged.
