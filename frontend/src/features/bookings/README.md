# Bookings

Phase 4 implements seat review/confirmation, protected history/details, passenger cancellation and the owner manifest. Requests use the centralized refresh-aware bearer client. Request keys and reviewed ride versions remain stable during uncertain retries; no tokens are persisted in browser storage. See docs/phase-4-bookings.md for API semantics, tests and limitations.
