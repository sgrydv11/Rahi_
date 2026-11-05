# Phase 5 — Ride start and completion

Drivers can start their own ride at or after its scheduled departure and complete it once it is in progress. Open the ride from **My rides**. If departure passes while the page is open, select **Reload ride** to get the server’s current eligibility and version.

Passengers see the trip status in **My bookings** and in booking details on reload. Trip status and reservation status are separate. A confirmed reservation stays confirmed when the trip starts or finishes.

| Request | Result |
| --- | --- |
| POST /api/v1/rides/{id}/start | Changes a scheduled ride to IN_PROGRESS and records startedAt |
| POST /api/v1/rides/{id}/complete | Changes an in-progress ride to COMPLETED and records completedAt |

Send the driver's bearer token and a JSON body such as `{"version":2}`. Use the version returned by the latest ride response. The server returns 403 for a different authenticated owner and 409 for a stale version or invalid transition. Both operations take the same PostgreSQL row lock as booking. New seats cannot be booked at or after departure.

The service uses the nullable start and completion timestamps already defined in the initial schema. Existing trips can have unknown historical timestamps. This phase requires no new migration or environment variables.

Import [the Phase 5 Postman collection](api/Hoopr-Phase-5.postman_collection.json). Run **Setup before departure** immediately after starting the local server. It creates a disposable ride departing in two minutes, books seats, and checks that early and passenger starts are rejected. At or after the generated departure, run **Lifecycle after departure** to verify driver start, passenger progress, driver completion, passenger history, and logout.

For browser verification, create a disposable ride a few minutes in the future, book it with a separate passenger account, and switch back to the driver. After departure, reload the ride and select **Start ride**. Check that the passenger booking shows **in progress**. Complete the ride as the driver and reload the passenger booking to check that it shows **completed**.

## Verification on 5 November 2026

- Backend build and all 75 tests passed, including the PostgreSQL lifecycle and concurrent booking checks.
- Frontend build and all 36 tests passed.
- The Phase 5 collection passed 17 requests and 30 assertions. The Phase 2–4 collections passed 67 requests and 122 assertions.
- The browser walkthrough verified that the driver could start only after departure and that the passenger saw both trip status changes on reopening the booking.
