# Dark text, booking-only points and chat display numbers — 19 November 2026

Implemented locally:
- Website text uses dark navy, including dialogs, reply cards, dropdown options and placeholders. Buttons use pale blue surfaces so their text stays dark and readable.
- Native Typography forces dark navy text/input colors rather than inheriting Android dark-mode white text. Common buttons, badges and selected ride-date controls use light surfaces; missing icon colors are explicit.
- Boarding/drop selection removed from search and search filters in web/native. Legacy search parameters are ignored. Selection remains in seat booking and driver offer setup.
- Account displays the app version. Web build reads mobile/app.json so the displayed version stays consistent; native reads Expo configuration. Current source version: 0.2.9.
- V31 prepares unique, stable ten-digit chat display placeholders beginning 6–9 only for demo/test accounts without an actual phone. They are stored separately from mobile_number, never verified or accepted for phone login. Future demo/test missing-number inserts get the same fallback; real accounts never receive generated display numbers. Demo/test phone displays are flagged; calls to placeholders are unavailable in the new clients.
- Message, reply and member-list APIs return the same display number and placeholder indicator.

Verification:
- 14 PostgreSQL chat integration tests passed, including stable/unique demo numbers, rejection of placeholder phone login and confirmation that real accounts never receive generated numbers.
- 71 web tests and 37 native logic tests passed; web production build and native TypeScript passed.
- Browser preview passed under dark system-color preference. Captured Account, Search, Booking, Group list, Reply preview, Member details and Member list. Text color checked against dark navy; no horizontal overflow at 320/768/1440 px.
- Booking points appear only after Book Seat; no booking was submitted in this preview.

Review links (local laptop only):
- http://127.0.0.1:8091/ — screenshot gallery, opened in the in-app browser.
- http://127.0.0.1:5179/ — interactive website backed by isolated local QA database, API port 8086.

Live database status:
- Read-only audit: 107 accounts, 3 missing actual phone numbers, 0 missing demo/test numbers. All 3 missing numbers belong to real accounts.
- The proposed all-account update was rejected before any live write. The final V31 included in the deployed release is limited to demo/test accounts, matching the user clarification.
- User confirmed: keep generated numbers limited to demo/test accounts. The 3 real accounts remain without generated numbers; their users must supply actual contact numbers. Actual phone/login/verification fields remain unchanged.

Release status:
- Release 0.2.9 / Android code 11 committed and pushed as a77a1f65d52725f8134fde2aaa2996270e9d22f3 on app_v1. Render deployment dep-dbvufkcipgvc738ob5ig is Live (20 November 2026). All three CI jobs passed: https://github.com/sgrydv11/Rahi_/actions/runs/44687680978 .
- Live API health, temporary demo logins/logout, ride search, private verification access and unverified-driver offer rejection passed. Live frontend assets return 200 and contain version 0.2.9 and the updated phone fallback.
- New APK creation was attempted but Expo rejected the build because the team has exhausted its monthly free Android build quota. No 0.2.9 APK/build link exists. Expo reports reset on 1 December 2026; upgrading is an owner billing decision.
- Website: https://rahi-1-c3vn.onrender.com . Previous 0.2.8 APK remains the latest successfully built artifact; it does not include the new native changes.
- The installed 0.2.8 phone APK still has the audited dark-mode/keyboard issues until an updated APK is requested and installed. The unrelated keyboard/footer issue was not changed here.
- Phone audit is paused; its checkpoint and authorized QA-message evidence remain private in .local/phone-audit-028. The authorized demo booking/cancellation has not been performed yet.
