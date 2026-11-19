# Booking, chat reply and driver-document verification — 19 November 2026

## Implemented in source
- Android reply now uses Ionicons return-up-back-outline instead of corrupted text. It has a distinct, accessible tap target and focuses the composer after the reply preview renders. Web reply controls also have a larger tap target.
- Private vehicle verification covers driving licence number/expiry, vehicle RC, insurance policy number/expiry, and three uploaded documents. Web and native upload pickers accept PDF/JPG/PNG, maximum 2 MB each; the backend checks decoded size and file signatures.
- Documents are stored in private database tables, not public assets or chat. Owners and authorized operations staff can retrieve them. Downloads use attachment/no-store/nosniff headers; staff document reads and review decisions are audited.
- Submission statuses: DRAFT, PENDING, APPROVED, REJECTED. Uploading alone never marks a driver verified. Approval requires a pending, complete, unexpired submission and a current revision. Self-review is forbidden.
- Admin web workspace: Vehicles → Driver document review. OWNER and OPERATIONS staff can download documents and approve/reject with a reason. Other staff scopes and ordinary passengers cannot access the documents.
- New ride offers require a selected saved vehicle with approved, unexpired driving licence and insurance plus reviewed RC. The backend enforces this independently of UI. Editing an existing offer also checks verification.
- Changing vehicle identity/capacity or replacing documents resets verification. Cancellation of existing rides remains available. Existing rides/bookings are preserved; no demo accounts are automatically approved.
- Migration V30 creates verification/document tables and extends audit actions. Production has not been migrated during this task.

## Completed functional checks
- Browser booked one seat through boarding/drop selection, passenger details, review and confirmation; availability changed from 3 to 2.
- Two separate browser sessions verified reply button focus, cancel, sending a quoted reply, delivery to the other account, and persistence after reload.
- Verification browser form passed using fictional endpoint/file fixtures: correct Base64 upload, all three required documents, licence/insurance metadata, pending-review confirmation.
- PostgreSQL integration tests separately exercised a genuinely gated offer after admin approval followed by a confirmed one-seat booking, private access, audit events, invalid/oversized uploads, expired documents, stale/self-review rejection, and approval reset after vehicle edits.
- Web tests: 71 passed. Native logic tests: 37 passed. Both TypeScript checks, web production build and Android JavaScript export passed.
- Full backend run covered 200 tests. Corrected the auth-only fixture to mock the new database-backed service, isolated the demo seed fixture from expired existing demo rows, and bounded integration-test connection pools. The 34 affected tests passed on rerun. Final verification HTTP suite passed all 6 tests, including protected uploads, attachment/no-store/nosniff download headers and PUT CORS. Aggregated final reports: 201 tests, zero failures/errors/skips.

## Local evidence
Ignored workspace artifacts: .local/booking-reply-test.json, .local/one-seat-booking-confirmed.png, .local/reply-delivery-phone.png, .local/driver-verification-phone.png, .local/verification-full-tests.log, .local/verification-retests.log, .local/verification-http-tests.log.

## Remaining release/device checks
- Not pushed, deployed or included in the existing 0.2.7 APK. A new APK is needed for the document-picker native dependency and Android reply control changes.
- Physical Android reply gestures/taps and document picking/upload still require on-device testing.
- This is manual staff review, not government/DigiLocker/transport-authority validation, identity-liveness checks or automated fraud/virus scanning. No external verification provider has been configured.
- Draft privacy/terms and document retention/deletion procedures need owner review before collecting real identity documents. No real licences, RCs or insurance files were used for tests.
