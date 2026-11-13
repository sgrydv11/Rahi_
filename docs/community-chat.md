# Ride community chat

One shared room for authenticated, active drivers and passengers. Open it from
the Chat footer tab on web or Expo. Messages are visible to every signed-in
member; this is a community room, not private direct messaging.

Members can send up to 1,000 characters and attach one of their own upcoming
scheduled rides. A ride card shows departure date and time, available seats,
fare per seat, and a link into the existing ride-details and booking flow.
Publishing, boarding/drop-off selection, passenger details, approval mode,
inventory locking, and payment rules continue to use the existing APIs.

Messages persist in PostgreSQL through Flyway migration V19. The API is
GET/POST /api/v1/chat/messages. POST requires a clientId UUID for idempotent
retries; reusing that key with different content is rejected. Active-account
checks apply to reads and writes. Sharing another driver's, cancelled, or past
ride is rejected. Sending is limited to 20 messages per member per minute.
Neither email addresses nor phone numbers are exposed by the chat response.

While the screen is open, clients fetch the latest 50 messages and current ride
availability every three seconds, without overlapping requests. The Expo client
pauses reads while backgrounded. This is near-real-time polling, not WebSocket
push. Drafts survive delivery errors, and retries retain their original key.
The API also offers an ascending `after` cursor for incremental consumers, with
up to 100 messages per page and a hasMore flag. Server message insertion is
serialized to prevent cursor gaps caused by transactions committing out of order.

Local verification:
- Backend: ChatIT covers shared messages, idempotency, conflicting retries,
  ride ownership, changing inventory, expired rides, inactive accounts, and rate
  limiting. Run alongside the backend regression suite in hoopr_test only.
- Web and Expo: existing unit suites, TypeScript checks, production web build,
  and Android/iOS Expo export.
- Browser: scripts/browser-chat-smoke.cjs exercises two separate users, sharing
  a ride, booking a seat from the card, refreshed availability, replies, reload
  persistence, and the footer at a phone-sized viewport. It requires the local
  isolated API on 8083 and web on 5174; it does not target the live database.

Release requires deployment of V19 with the backend and web changes, followed
by an updated Expo build to put Chat in installed apps. A signed device test is
still necessary. Moderation/reporting, private or invite-only groups, direct
messages, older-history browsing, unread counts, read receipts, media uploads,
and background push notifications are not included in this first version.

Verified locally on 13 November 2026: the current backend test reports total
136 passing tests after a focused rerun of ChatIT and AuthWebTest. Web tests
(54), mobile tests (22), web production build, mobile TypeScript and both
platform exports passed. The two-user browser booking-and-chat smoke passed.
The user subsequently authorized live deployment and a signed Android build
on 13 November. See PRODUCTION_READINESS_TRACKER.md and the Render/Expo release
results for deployment status.
