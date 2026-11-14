# Route communities: 16 change requests

Implemented on `app_v1`, 14 November 2026. Status refers to local source and tests, not the installed APK or production deployment.

| Request | Implemented behavior | Verification / remaining limits |
|---|---|---|
| CR-001 | Swipe/drag right to quote a message, explicit Reply fallback, reply preview/cancel, retained group drafts, stable feed and earlier-message paging on web/native. | Two-account browser drag/reply/reload tested. Native physical gesture testing pending. Open-app updates poll every 3 seconds. |
| CR-002 | Registered mobile number always shown with messages and clickable member details. No share-phone switch. | Authenticated access only; unverified label retained. Existing accounts without numbers show “Mobile number not added”. |
| CR-003 | App-wide new-message alerts and unread total on Chat navigation. | Per-user database read cursor; own messages excluded; muted groups excluded from badge. Foreground only. |
| CR-004 | Top in-app banner with sender/text and direct group link; dismiss control. | Mobile browser tested. Background/terminated-app OS push is not implemented. |
| CR-005 | Optional regular routes and Morning/Afternoon/Evening/Night during signup, editable in profile. Matching rides and travel buddies appear in notifications; new matches alert in the open app. | Preferences persist only after valid signup OTP. Up to six distinct routes; timings use Asia/Kolkata. Ride matches must be scheduled, future within 30 days, and have seats. |
| CR-006 | Booking review offers Direct / QR / Other dummy choices; saved in booking details. | QR is an explicitly non-scannable demo placeholder. No money collected, provider called, or paid state granted. QR booking browser test passed. |
| CR-007 | Ujjain: Nanakheda, D-Mart, Lal Gate. | V24 seeded city-point catalog, offer suggestions and filter dropdown. |
| CR-008 | Indore: Aurobindo, Luv Kush, Vijay Nagar. | Same catalog and controls. |
| CR-009 | Dewas: Bus Stand, AB Road, Industrial Area. Pithampur: Bus Stand, Sector 1, Sector 3. | Suggested labels only; no fabricated coordinates. Driver explicitly adds offered stops; passenger can book only offered stops. |
| CR-010 | Show/hide notifications per group, saved per account. | Immediate toggle, rollback/error on failure. Mute also suppresses matching route alerts; messages remain accessible. |
| CR-011 | Indore–Ujjain, Indore–Dewas, Indore–Pithampur Up-Down groups. Existing Ride community retained. | Isolated feeds/replies/read cursors. Attached ride must match the route in either direction. |
| CR-012 | Separate Time / Price / Rating arrow toggles, ascending/descending. | Removed sort dropdown from filters. Browser URL and sorting controls tested. |
| CR-013 | Clear filters resets time, stops, women, flexible-drop, passenger count and sort while preserving journey cities/date. | Browser resets verified. |
| CR-014 | AC removed from ride search filters and outgoing new-client searches. | Offered vehicle AC attribute and legacy API compatibility retained. |
| CR-015 | City-aware boarding/drop dropdowns, including driver-entered stops on returned rides. | Web select and native modal dropdown; suggestions also available when offering a ride. |
| CR-016 | Today / Yesterday / older India-date separators; only last 7 days served. | Server cutoff also hides older quoted content. Pagination loads earlier messages within window; database history is retained. |

## Database and compatibility

V24 adds chat groups, per-user mute/read state, group IDs on messages, city points,
regular travel routes, and regular-route snapshots on signup OTP challenges.
Existing messages remain in group 1 and old clients default to that group.
Initial unread cursors baseline existing messages to avoid historical notification floods.
Existing booking JSON stores the optional demo payment method; old records default
to DIRECT when deserialized. No payment integration is enabled by this work.

## Testing

- Backend: **160 passed**, full unit/integration suite using dedicated local PostgreSQL schema `communities_20261114` in `hoopr_test`.
- Web: **60 passed**; native API: **25 passed**. TypeScript checks, web production build, and Android/iOS bundle exports passed.
- **Passed** `scripts/browser-chat-smoke.cjs`: two accounts, mobile-number sign-in, public member card, quoted replies, ride attachment, QR-demo booking persistence, live seat count, reload and mobile footer.
- **Passed** `scripts/browser-communities-smoke.cjs`: top banner/unread/read, route-group switching/drafts, drag reply, Today separator, saved mute/silence, city dropdowns, no AC, sorting, clear filters, registration/profile preference save/reload, new matching-ride banner and phone-width overflow.
- Browser fixtures use separate schema `community_browser_20261114`; no production user, ride, booking or historical dates are changed.
- Final local API checks: public locations 200; unauthenticated groups, travel preferences and messages 401. V24 migration applied to isolated schemas successfully.
- Android/iOS JavaScript bundle export passes. An installed-device interaction check remains necessary for native gestures/keyboard and lifecycle behavior.

## Release work remaining

No new APK was requested or created for this change. Source is not yet pushed or deployed.
Deploy the backend with V24 before distributing updated clients. Then validate
production chat/groups, preferences and locations, deploy the frontend, and create
an APK only when requested. Background OS push requires provider/device-token setup;
foreground notifications are the implemented scope.
