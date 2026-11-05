ALTER TABLE group_seat_holds
    DROP CONSTRAINT group_seat_holds_status_check,
    ADD CHECK (status IN ('HELD', 'EXPIRED', 'CANCELLED', 'CONFIRMED', 'REFUND_PENDING', 'REFUNDED')),
    ADD COLUMN checkout_key UUID,
    ADD COLUMN provider VARCHAR(10) CHECK (provider IN ('razorpay', 'stripe')),
    ADD COLUMN order_id VARCHAR(255) UNIQUE,
    ADD COLUMN checkout_url TEXT,
    ADD COLUMN payment_id VARCHAR(80) UNIQUE,
    ADD COLUMN refund_id VARCHAR(80) UNIQUE,
    ADD COLUMN booking_id UUID UNIQUE REFERENCES bookings(id),
    ADD COLUMN last_checked_at TIMESTAMPTZ;

CREATE INDEX group_hold_reconcile ON group_seat_holds(last_checked_at, id)
    WHERE order_id IS NOT NULL AND status NOT IN ('CONFIRMED', 'REFUNDED');
