ALTER TABLE group_seat_holds
    ADD COLUMN discount_percent SMALLINT NOT NULL DEFAULT 0 CHECK (discount_percent IN (0, 5, 10, 15)),
    ADD COLUMN discount_paise BIGINT NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
    ADD CHECK (fare_paise - discount_paise >= 100);

ALTER TABLE bookings ADD COLUMN paid_fare_paise BIGINT CHECK (paid_fare_paise >= 100);

CREATE TABLE ride_discount_redemptions (
    passenger_id UUID NOT NULL REFERENCES users(id),
    ride_id UUID NOT NULL REFERENCES rides(id),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    discount_percent SMALLINT NOT NULL CHECK (discount_percent IN (5, 10, 15)),
    PRIMARY KEY (passenger_id, ride_id)
);

CREATE INDEX group_discount_hold_lookup ON group_seat_holds(passenger_id, expires_at)
    WHERE status = 'HELD' AND discount_percent > 0;
