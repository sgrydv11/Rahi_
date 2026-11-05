ALTER TABLE bookings
    ADD COLUMN driver_rating INTEGER,
    ADD COLUMN rated_at TIMESTAMPTZ,
    ADD CONSTRAINT bookings_driver_rating_valid CHECK (
        (driver_rating IS NULL AND rated_at IS NULL)
        OR (driver_rating IS NOT NULL AND driver_rating BETWEEN 1 AND 5
            AND rated_at IS NOT NULL AND status = 'CONFIRMED')
    );
