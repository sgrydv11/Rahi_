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

The [API collections](api/README.md) cover authentication, rides and bookings. Run the [Phase 5 collection](api/Hoopr-Phase-5.postman_collection.json) in two folders as described in the [lifecycle guide](phase-5-ride-lifecycle.md).

Run the backend suite from the backend directory after setting the test database environment variables:

```powershell
mvn -B '-Dmaven.repo.local=../.maven-repository' '-Dtest=*Test,*IT' verify
```

Run the frontend suite and production build from the frontend directory:

```powershell
npm.cmd test
npm.cmd run build
```
