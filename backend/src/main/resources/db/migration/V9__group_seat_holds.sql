CREATE TABLE group_seat_holds (
    id UUID PRIMARY KEY,
    ride_id UUID NOT NULL REFERENCES rides(id),
    passenger_id UUID NOT NULL REFERENCES users(id),
    request_key UUID NOT NULL,
    seats SMALLINT NOT NULL CHECK (seats BETWEEN 1 AND 6),
    fare_paise BIGINT NOT NULL CHECK (fare_paise >= 100),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('HELD', 'EXPIRED', 'CANCELLED')),
    UNIQUE (passenger_id, request_key)
);
CREATE INDEX group_seat_holds_active ON group_seat_holds(ride_id, expires_at) WHERE status = 'HELD';
