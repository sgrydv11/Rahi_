CREATE TABLE booking_payments (
    booking_id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE RESTRICT,
    order_id VARCHAR(80) NOT NULL UNIQUE,
    amount BIGINT NOT NULL CHECK (amount >= 100),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'INR'),
    payment_id VARCHAR(80) UNIQUE,
    paid_at TIMESTAMPTZ,
    refund_id VARCHAR(80) UNIQUE,
    refund_status VARCHAR(20) CHECK (refund_status IN ('pending', 'processed', 'failed')),
    CHECK ((payment_id IS NULL) = (paid_at IS NULL)),
    CHECK ((refund_id IS NULL) = (refund_status IS NULL)),
    CHECK (refund_id IS NULL OR payment_id IS NOT NULL)
);
