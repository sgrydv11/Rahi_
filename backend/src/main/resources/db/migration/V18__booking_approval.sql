ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
    'CONFIRMED', 'PENDING', 'DECLINED', 'EXPIRED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'));
ALTER TABLE bookings DROP CONSTRAINT bookings_cancellation_consistency;
ALTER TABLE bookings ADD CONSTRAINT bookings_cancellation_consistency CHECK (
    (status IN ('CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER') AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
    OR (status NOT IN ('CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER') AND cancelled_at IS NULL AND cancelled_by IS NULL)
);
ALTER TABLE bookings ADD COLUMN request_expires_at timestamptz;
ALTER TABLE bookings ADD CONSTRAINT bookings_pending_expiry_check CHECK (status <> 'PENDING' OR request_expires_at IS NOT NULL);
CREATE INDEX bookings_pending_ride_idx ON bookings (ride_id, passenger_id) WHERE status = 'PENDING';
