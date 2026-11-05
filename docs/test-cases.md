# Hoopr regression test cases

Use the local frontend at http://localhost:5173 and the backend at http://localhost:8080. Use disposable driver and passenger accounts with distinct emails. Use the dedicated `hoopr_test` database for automated PostgreSQL tests. See [SETUP.md](../SETUP.md) for environment setup and build commands.

| ID | Scenario | Steps and expected result | Coverage |
| --- | --- | --- | --- |
| FND-01 | Services and schema | Open the frontend, check API and actuator health, and verify the frontend API proxy. Expect HTTP 200 and healthy PostgreSQL. | Live smoke, database integration |
| AUTH-01 | Account and profile | Register with each travel preference across disposable accounts. Log in and reload. The profile shows the saved preference and USER role, and the session restores. | Backend, frontend, API, browser |
| AUTH-02 | Invalid input and access | Submit invalid credentials, duplicate email with different case, and an attempted ADMIN registration. Request a protected resource while signed out. Expect validation and authorization responses. | Backend, frontend, API |
| AUTH-03 | Token rotation and logout | Refresh a session, replay the consumed refresh token, then verify that the replacement is revoked. Check that untrusted origins and missing CSRF tokens fail. Log out of a fresh session and verify refresh fails. | Backend, API |
| RIDE-01 | Offer and search | As driver, offer a future ride with two seats. As visitor, filter by origin and destination and open details. Verify price, availability and public fields. | Backend, frontend, API, browser |
| RIDE-02 | Edit, ownership and cancellation | Update a future unbooked ride with its current version. Retry with an old version, then try another owner's ride. Cancel as the owner and verify search excludes the ride. | Backend, API |
| BOOK-01 | Reserve seats | As passenger, select two seats and check the quoted total. Confirm, check booking history, and verify available seats drop by two. | Backend, frontend, API, browser |
| BOOK-02 | Retries and capacity | Replay the same idempotency key and body, then change the body under that key. Expect one booking and a conflict for the changed payload. Race two passengers for the last seat and verify only one allocation. | PostgreSQL integration, frontend, API |
| BOOK-03 | Passenger cancellation | Cancel a booking and repeat the cancellation. Verify the seats return once and history records passenger cancellation. | Backend, API, browser |
| BOOK-04 | Driver manifest and cancellation | Verify only the driver can open the ride manifest. Cancel a ride with an active reservation and verify the passenger sees driver cancellation. | Backend, API, browser |
| LIFE-01 | Timing and roles | Attempt start before departure, complete before start, and start or complete as a different user. Expect 409 for timing/state conflicts and 403 for the wrong owner. | Backend, API, browser timing |
| LIFE-02 | Start and complete | After departure, reload the driver's ride and start it. Reopen the passenger booking and verify **in progress**. Complete as driver and reopen the passenger booking to verify **completed** and **confirmed**. | Backend, API, browser |
| LIFE-03 | Version and repeated transitions | Send a missing, negative, fractional or stale version. Expect 400 for malformed versions and 409 for stale versions. Repeat start or completion and expect 409. | Backend integration |
| LIFE-04 | History and seat availability | Verify completion preserves the start timestamp, records completion at or after start, and retains the ride in driver history. Confirm completed rides are absent from search and that departed, in-progress and completed rides offer no booking controls. | Backend and frontend regression tests |
| LIFE-05 | Departure race | Race driver start and a last-seat request at departure. Expect the ride to start, the booking to fail, and availability to remain unchanged. | PostgreSQL integration |
| RATE-01 | Submit after completion | Open a confirmed booking after its trip completes, select a score from 1 to 5, and submit. Reload as the passenger and then open that booking as the driver. Both see the saved score. | Backend integration, frontend, browser |
| RATE-02 | Eligibility and access | Attempt to rate before completion or with a cancelled booking. Expect 409. As the driver or an unrelated account, try to submit for the passenger. Expect 403. Signed-out requests must fail. | Backend integration, frontend |
| RATE-03 | Input validation | Submit a missing, out-of-range or fractional score, or supply an extra driver identity field. Expect 400 and an unrated booking. | Backend integration |
| RATE-04 | Retry and concurrent writes | Submit the same score twice and verify the timestamp and version stay stable on replay. Submit a different score or race two different scores. Expect one persisted score and a conflict for the other. | PostgreSQL integration |
| NOTIFY-01 | Booking notifications | Open Notifications as the passenger and driver after creating a booking. Both see the confirmation and can open the booking. Cancel it and refresh. Both see the cancellation. | PostgreSQL integration |
| NOTIFY-02 | Reminder eligibility and privacy | Book a ride leaving within 24 hours. Verify a departure reminder appears for each participant. Cancel the booking and verify the passenger reminder disappears. Verify an unrelated account has an empty inbox and signed-out requests fail. | PostgreSQL integration |
| PROFILE-01 | Edit own profile | Change name and travel preference, then reload. Verify they persist. Send an extra role field and expect HTTP 400 with the role unchanged. | PostgreSQL integration |
| VEHICLE-01 | Save and use a private vehicle | Add an active vehicle, select it on a ride offer, and inspect the public ride. Verify make, model and colour are visible and the registration number stays private. | PostgreSQL integration |
| VEHICLE-02 | Ownership, capacity and archive | Try to list or modify another driver's vehicles and select one on your ride. Verify ownership is enforced. Reduce capacity below the linked ride's seats and expect a conflict. Archive the vehicle and verify new ride offers cannot select it. | PostgreSQL integration |
| MAP-01 | Save and display route pins | On a future ride with no active bookings, save both coordinate pairs. Reload the ride and check the two pins, distance estimate, and driving directions link. Confirm booking details expose the same pins. | PostgreSQL integration, frontend |
| MAP-02 | Protect route updates | Send an out-of-bounds coordinate, a stale version, an update from a different owner, and an update after booking. Verify each fails and the saved route stays intact. | PostgreSQL integration |
| PAY-01 | Calculate and verify a test fare | On a confirmed INR booking, request checkout twice. Verify one order and the fare from the stored seats and price. Reject invalid signatures and incorrect capture amounts. A verified capture exposes a receipt. | PostgreSQL integration with simulated Razorpay |
| PAY-02 | Refund a cancelled booking | Attempt refund before cancellation and expect a conflict. Cancel, request a full refund twice, and check that the same refund is returned. Refresh pending status and verify it becomes processed after provider confirmation. | PostgreSQL integration with simulated Razorpay |
| PAY-03 | Provider configuration and privacy | With test keys absent or a live key supplied, checkout is disabled. An unrelated user cannot read or create payment state. | Backend tests |
| PAY-04 | Stripe checkout and provider continuity | Select Stripe and verify hosted Checkout uses HTTPS on the Stripe host. Switch the default to Razorpay and check an existing Stripe order. An unpaid or wrong-amount session must not generate a receipt. Verify an exact capture and a cancelled booking refund still use Stripe. | Backend integration with simulated Stripe and redirect validation tests |
| WEB-01 | Mobile browser layout | Open the home, search, and sign-in pages at phone width. Verify navigation wraps, form controls remain visible, and the page has no horizontal overflow. | Browser smoke |

The [API collections](api/README.md) cover authentication, rides and bookings. Run the [Phase 5 collection](api/Hoopr-Phase-5.postman_collection.json) in two folders as described in the [lifecycle guide](phase-5-ride-lifecycle.md).

For rating requests and expected responses, see the [Phase 6 guide](phase-6-ratings.md).

To exercise checkout and refunds with Razorpay or Stripe test credentials, follow the [sandbox walkthrough](phase-10-razorpay.md).

## Phase gates on 5 November 2026

| Phase | Backend tests | Frontend tests | Manual check |
| --- | ---: | ---: | --- |
| 7 | 79 | 42 | Booking confirmation and cancellation in the inbox, with working booking links |
| 8 | 81 | 42 | Profile changes persisted after reload, saved vehicle appeared on the offer form |
| 9 | 82 | 44 | Saved coordinates and distance persisted after reload, directions link contained the correct pins |
| 10 | 86 | 44 | Checkout was disabled without keys. Capture, receipts and refunds passed with simulated provider responses |

Both builds passed at each gate. After V7 migrated the running database, the Phase 2–4 collections passed 67 requests and 122 assertions. The frontend, frontend API proxy and backend health endpoint returned HTTP 200. End-to-end Razorpay sandbox verification requires local test credentials.

Run the backend suite from the backend directory after setting the test database environment variables:

```powershell
mvn -B '-Dmaven.repo.local=../.maven-repository' '-Dtest=*Test,*IT' verify
```

Run the frontend suite and production build from the frontend directory:

```powershell
npm.cmd test
npm.cmd run build
```
