# Admin roles and operational coverage

Updated 16 November 2026. Web panel: `/admin`. Source branch: `app_v1`.

## Role analysis and implemented access

Consumer Driver / Passenger / Both describes travel behavior. Staff roles are
separate memberships; a consumer cannot obtain staff access through registration,
profile editing or a client-supplied role. Every admin operation reads the active
membership from PostgreSQL. The existing approved administrator is preserved as
Owner by migration V27. No ordinary accounts are automatically promoted.

| Staff role | Intended responsibility | Implemented access |
| --- | --- | --- |
| Super Admin / Owner | Platform ownership and staff access | All views and audited controls; assign/revoke scoped staff roles |
| Operations | Daily ride operations | Users and history, suspension/reactivation, rides, bookings, vehicles and blocking, analytics, services and audit |
| Customer Support | Investigate customer journeys | Users, account history, rides and bookings, read-only |
| Community Moderator | Investigate chat abuse | Users read-only; seven-day group message review; hide/restore with a reason |
| Finance Viewer | Financial investigation | Booking records, provider payment summaries, wallet balances and latest ledger entries, analytics; read-only |
| Analyst | Business trends without customer lists | Aggregate dashboard and 7/30/90-day analytics |
| Security Auditor | Operational accountability | Aggregate dashboard, service configuration/queue checks and audit log; read-only |

All roles can view the aggregate overview. Role permissions are returned by
`GET /api/v1/admin/access`, displayed in Staff roles, and independently enforced
by the API. Hidden navigation is not the authorization boundary. Only Owner can
assign staff. Role changes require an existing active account, expected current
role and a 10–500-character reason. Self-role changes are blocked, an active
owner is preserved, and affected sessions/push registrations are revoked.

## Implemented tracking and controls

- **Overview:** total/active accounts, future SCHEDULED/PUBLISHED rides, booking
  counts, pending requests and failed notifications in the last 24 hours.
- **People:** bounded user search, account status and travel type; individual
  account history with the latest 25 offers, bookings and vehicles, and active
  session count. Tokens, passwords, OTPs and private credentials are excluded.
- **Journeys:** paginated rides, departures, seats, fares, status and bookings.
  Vehicle registry and audited blocks prevent that saved vehicle being used for
  new offers; an owner cannot reactivate a blocked vehicle. Existing journeys
  remain intact. This is activity tracking, not live GPS surveillance.
- **Analytics:** daily registrations, offers and bookings in India Standard
  Time; selected-window booking statuses; up to 50 route aggregates showing
  offered and confirmed seats for offers created in that window. These are real
  database counts, not fabricated charts or collected-revenue claims.
- **Community:** recent seven-day messages across groups; audited hide/restore.
  Hidden message bodies and reply quotes are redacted, ride attachments removed,
  new replies rejected, and hidden messages excluded from unread counts and push
  eligibility. Pending notifications are marked failed when hidden.
- **Finance:** provider order/paid amount and failed-refund summaries, wallet
  balances and latest 25 wallet ledger entries. Amounts explicitly use paise.
  Provider records are not bank settlement reconciliation.
- **Services:** live DB query, server check time, Google/email/payment credential
  presence flags, push-enabled flag and notification states for the last 24 hours.
  Secrets never appear. Configured does not mean externally healthy.
- **Audit:** actor, target, entity type/ID, prior/new value, reason and timestamp
  for account, staff, vehicle and message changes. No delete/edit audit endpoint.
- **UI:** five main navigation groups, permission-filtered subtabs, searchable
  lists where supported, pagination, confirmation/reason forms, success/error,
  retry, responsive table-to-card layout and web-only access.

## Deliberate limits / future production work

- No refunds, transfers, balance edits, impersonation, hard deletion or arbitrary
  database console from this panel. Introduce financial approvals and provider
  reconciliation before adding money-moving roles.
- No KYC/document verification workflow, support ticket/dispute queue, fleet
  company/city-scoped tenant roles or CMS role: their underlying workflows are
  not implemented. Add them only with defined ownership and retention rules.
- No automatic ride cancellation by staff; driver/passenger cancellation rules
  remain authoritative. A staff cancellation workflow needs explicit financial
  effects, passenger alerts and audit design.
- No live GPS map, external-provider uptime probes, export jobs or configurable
  role builder. Analytics windows are 7/30/90 days; lists are paginated at 25.
- Moderation cannot recall delivered notifications or erase text already cached
  on an older client. Current feeds redact on refresh. Hiding a message does not
  remove the underlying audit evidence.
- This release does not add staff MFA or reauthentication before sensitive
  actions. Those, alerts for staff activity and backup/restore drills remain
  security hardening work before broad staff onboarding.
- Application audit events share the application database. An external immutable
  audit sink and auditing of sensitive record reads are not implemented.

## Validation and release tracking

- [x] Migration V27 applied in isolated local test schemas.
- [x] Seven-role permission matrix, role revocation and stale/self/disabled checks.
- [x] User history, analytics, finance and service queries exercised.
- [x] Vehicle owner bypass and message feed/reply/retry redaction checks.
- [x] Browser: all ten main sections at 320/390/768/1440 px; user history, staff
  assignment, support restrictions, revocation, status controls and error/retry.
- [x] Frontend unit tests and production build.
- [x] Full backend regression: 180 tests, zero failures/errors/skips.
- [x] Web: 67 tests; production build; local browser workflow and responsive checks.
- [ ] Publish and verify Render migration V27 / live admin bundle.
- [ ] Owner acceptance using their real sign-in (no credentials/OTP bypassed).

For a fresh deployment with no administrator, the operator-only
`scripts/provision-admin.sql` explicitly provisions an existing active account.
It is not a public bootstrap mechanism. Existing staff are not silently upgraded
by that script. Additional staff accounts must be selected by the Owner.
