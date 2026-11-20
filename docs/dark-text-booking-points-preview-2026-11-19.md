# Dark text, booking-only points and chat display numbers — 19 November 2026

Implemented locally:
- Website text uses dark navy, including dialogs, reply cards, dropdown options and placeholders. Buttons use pale blue surfaces so their text stays dark and readable.
- Native Typography forces dark navy text/input colors rather than inheriting Android dark-mode white text. Common buttons, badges and selected ride-date controls use light surfaces; missing icon colors are explicit.
- Boarding/drop selection removed from search and search filters in web/native. Legacy search parameters are ignored. Selection remains in seat booking and driver offer setup.
- Account displays the app version. Web build reads mobile/app.json so the displayed version stays consistent; native reads Expo configuration. Current source version: 0.2.8.
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
- No live data or schema was modified for this update. Automatic approval review rejected the proposed all-account V31 change because earlier user approval limited generated numbers to demo/test accounts.
- User confirmed: keep generated numbers limited to demo/test accounts. The 3 real accounts remain without generated numbers; their users must supply actual contact numbers. Actual phone/login/verification fields remain unchanged.

Release status:
- Not pushed/deployed or included in a new APK. V31 is idempotent so an explicitly approved pre-application can later be recorded by Flyway without changing existing placeholders.
- The installed 0.2.8 phone APK still has the audited dark-mode/keyboard issues until an updated APK is requested and installed. The unrelated keyboard/footer issue was not changed here.
- Phone audit is paused; its checkpoint and authorized QA-message evidence remain private in .local/phone-audit-028. The authorized demo booking/cancellation has not been performed yet.
