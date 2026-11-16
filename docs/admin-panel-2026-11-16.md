# Web administration — 16 November 2026

The web-only administrator workspace is `/admin`. The account page links to it
only for administrators using the browser. Native React Native screens were not
changed; the legacy Capacitor wrapper also refuses the admin screen.

## Included

- Overview: total/active accounts, upcoming scheduled/published rides, bookings,
  pending booking requests and failed notifications created in the last 24 hours.
- Users: bounded searchable lists, access state, user type, suspension/reactivation
  with an explicit reason and confirmation. Administrator accounts are protected.
- Rides and bookings: paginated operational records and links to public ride details.
  Booking figures are seat-fare totals, not a claim of collected revenue.
- Activity log: administrator attribution, target account, previous/new status,
  reason and timestamp for each account status change.
- Blue/navy Inter design system, responsive tables/cards, loading/empty/error/retry
  and success states, metadata/noindex, logout and return-to-admin login.

## Authorization and provisioning

`/api/v1/admin/**` requires the server-issued ADMIN role, method authorization and
an active administrator record in PostgreSQL. Request bodies cannot assign roles.
Suspension revokes refresh sessions and disables push devices in the same
transaction as status/audit changes. Reactivation never restores old sessions.
Existing bookings, rides and monetary records are preserved. Replayed identical
status changes do not add duplicate audit entries; stale conflicting edits fail.

There is no default admin or new password. The user designated the existing
`acs.sagar11@gmail.com` account. The operator-only SQL in
`scripts/provision-admin.sql` accepts an explicit email, requires an existing
active account, locks it, grants ADMIN and revokes prior sessions. A fresh sign-in
is required. The script was verified against isolated local fixtures before live use.
No public bootstrap endpoint, in-app role editor or automatic startup grant exists.

Migration V26 adds the administrator status audit table and index.

## Verification

- 174 complete backend regression tests passed (zero failures/errors/skips).
- After fixing the upcoming-rides metric to include SCHEDULED offers, all 31
  focused admin/security tests passed again and the final backend package built.
- 67 web tests and the production frontend build passed.
- Local browser checks passed: guest/user denial; administrator dashboard and
  lists/search; suspension/reactivation and stale-session rejection; protected
  admins; audit reasons; 320/390/768/1440px checks on all four record sections;
  empty results, error/retry and logout. Screenshots visually inspected.
- All test-account mutations and bookings were confined to local test schemas.
  No live customer suspension or booking changes were used for testing.

Live deployment and designated-account provisioning results will be recorded
below after completion. A real-owner login remains a user acceptance step; no
password or email OTP has been requested or bypassed.
