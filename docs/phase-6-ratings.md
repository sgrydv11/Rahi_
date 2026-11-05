# Phase 6 — Post-trip driver ratings

A passenger can give the driver one score from 1 to 5 on each confirmed booking after the ride is completed. Open **My bookings**, select the completed trip, and use **Rate your driver**. The passenger and driver can see the score on the booking details page. The form tells the passenger who can see it before submission.

Use `POST /api/v1/bookings/{id}/rating` with the passenger's bearer token and a JSON body such as `{"score":4}`. A successful submission returns the booking with `rating.score` and `rating.ratedAt`. A retry with the same score returns the original rating. A different score after submission returns 409. Missing, fractional, or out-of-range scores return 400. The wrong account receives 403. Incomplete rides and cancelled bookings receive 409.

Flyway migration V6 adds optional rating fields and a score constraint to the booking table. Existing bookings can be rated when they meet the same eligibility rules. Rating updates use the existing ride lock and booking version. This phase requires no new environment variables.

See [regression cases RATE-01 through RATE-04](test-cases.md) for verification steps.

## Verification on 5 November 2026

- The Phase 1–5 baseline passed 76 backend and 39 frontend tests.
- With Phase 6, 78 backend and 42 frontend tests passed. Both builds passed.
- Live API checks passed 89 requests and 159 assertions across the earlier collections and the combined lifecycle and rating run.
- The browser walkthrough confirmed that the passenger could submit a score, that it persisted after reload, and that the driver could see the score on the booking.
