# Chat controls and ride presets — 18 November 2026

Implemented in web and native source:
- 60-second resend cooldown; visible countdown; compact left-aligned background-free resend control. Web countdown uses an absolute deadline, including background-tab time. Server throttling remains unchanged.
- Compact group list; notification bell at right of chat title; vertical options menu with member list, notification enable/disable and Leave group. Member rows include name, phone and joined date. Group list displays member count/join information and Join after leaving.
- V28 adds persisted joined/left timestamps. Leaving blocks message read/send/member-list access, suppresses unread/latest previews and push delivery (including queued push). Rejoin preserves the existing seven-day history. Existing default-group enrollment remains compatible; opening/sending in a legacy group initializes its membership row.
- Quoted messages and selected reply cards are 48px high, with a single-line body and ellipsis. Header is 64px, message controls are compact and text-aligned left.
- Ride selector replaces Ride preference. Six explicit city-pair presets and the account's saved regular routes fill From/To automatically. Saved morning/evening routes are labeled Office/Home; no personal addresses are invented. Manual editing remains available.
- Regular rides offer Female, Male, Other and Prefer not to say. NOT_SPECIFIED is accepted/persisted by the backend. Women-only rides still enforce Female.
- 69 local QA accounts now have unique, unverified ten-digit Indian test numbers beginning 6/7/8/9 (stored with +91). No SMS or calls sent. Existing nonempty numbers are preserved by the repeatable guarded seed in backend/seed/local-test-chat-numbers.sql. Seed is restricted to hoopr_test / admin_browser_20261116, and QA/demo email domains.

Validation:
- 71 frontend tests passed; frontend production build passed.
- 35 native tests passed; TypeScript passed; Android Expo JavaScript export passed. This is not a new APK or on-device test.
- 17 backend integration/HTTP tests passed: ChatIT 11, PushIT 6. Covers authentication on new endpoints, membership access, leave/rejoin and push suppression.
- Browser group-controls suite passed: actual local API member list, notification toggles, leave/rejoin, compact replies, no horizontal overflow at 320/390/768/1440px, named-route autofill, all four gender choices and persisted NOT_SPECIFIED booking. Resend UI was tested with intercepted delivery and a virtual clock; no real email sent in this suite.
- Compact search suite passed: presets, backend commute filters, location grant/deny fallback, sorting, edit/seats and responsive layouts.

Review:
- Local QA preview: http://127.0.0.1:5177 (local accounts and demo chats; email OTP intentionally disabled).
- Hosted-API preview: http://127.0.0.1:5175 (real accounts/email OTP; new group controls stay hidden until backend deployment).
- Screenshots: .local/chat-group-controls-phone.png and .local/named-ride-phone.png.

Remaining: deploy updated backend/web (migration V28), create a new APK only when requested, verify native contact permissions/physical-device group controls and push delivery on that build. No production database migration, live test-number seed, Git push or new APK was performed in this task.
