ALTER TABLE bookings ADD COLUMN idempotency_key UUID;
ALTER TABLE bookings ADD COLUMN version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0);
-- Null keys preserve legacy rows. New requests require a key scoped to their passenger.
CREATE UNIQUE INDEX bookings_passenger_request_unique ON bookings(passenger_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_seat_limit CHECK (seats_booked BETWEEN 1 AND 6);
CREATE INDEX bookings_ride_history_idx ON bookings(ride_id, created_at DESC, id);
