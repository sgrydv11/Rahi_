# FlexirRides regression audit — 9 November 2026

Baseline: `app_v1` at `9875421`, plus local fixes from this audit. All test accounts, rides, and bookings were created in a separate PostgreSQL schema in `hoopr_test`. No production data was modified. OTP remained paused.

| Layer | Result | Coverage |
| --- | --- | --- |
| Backend | Pass — 131 tests; executable package built | Authentication, permissions, Flyway V1–V17, rides, inventory, reviews, groups, wallet and sandbox payment logic |
| Packaged HTTP smoke | Pass | Register, log in, offer, search, last-seat race, booking replay, history, cancellation and seat restoration |
| Web | Pass — 54 tests and production bundle | Navigation, auth, rides, bookings, payment UI and route helpers |
| Android/iOS source | Pass — 22 tests, TypeScript and both bundle exports | Transport, sessions, group and wallet client; no installable app built |
| Browser | Pass — core driver/passenger journey | Password signup and login, profile edits, ride publication, tomorrow search and women-only/time/stops/AC/flexible filters, guest sign-in gate, fare display, cancellation, recent passenger reuse, trip completion and rating |
| Browser | Pass — account and driver screens | Home, protected return to My Bookings, My Rides, Notifications, passenger manifest, vehicle creation, and editing a ride's price |
| Browser rating regression | Pass | An open scheduled booking catches completion without reloading; rating saves and the public review appears in future ride results |
| Narrow web viewport | Pass — 360 px | Search controls and Home, My Bookings, Offers, Account footer visible and usable |

## Fixes and reusable checks

- A booking detail screen previously began polling only after it saw `IN_PROGRESS`. If the passenger opened the screen before departure and left it open, it could miss completion. Both clients now check confirmed bookings after their scheduled departure; the web refresh keeps existing details visible while polling. Run `scripts/browser-rating-smoke.js` using Playwright CLI `run-code --filename=...`, after opening the isolated web frontend on `127.0.0.1:5174` (proxy to the isolated API on `8083`). The script creates synthetic fixtures, crosses the real departure time, and advances the browser clock to exercise polling.
- Added the existing FlexirRides icon as the web favicon and updated the home page's old Hoopr branding. A signed-out session refresh can still return an expected HTTP 401; it did not block any tested journey.
- Graphify built and queried a local AST graph under `.local/graphify-audit/graphify-out` from tracked source. SQL extraction was unavailable without the optional SQL parser; Flyway migrations were exercised by backend tests. Playwright CLI and the integrated browser were both used. The audit follows Compound Engineering's test-and-capture workflow using its published guidance; the plugin was not installed. The 21st MCP integration was not connected and no new UI components were sourced.

## Still unverified

- A physical Android or iOS device, including keyboard and gesture behavior. The previous APK still has the earlier OTP sign-in screen.
- Google sign-in, OTP/SMS, and live payment checkout. They need provider configuration; the payment tests use sandbox or mocked flows. OTP was intentionally disabled for this audit.
