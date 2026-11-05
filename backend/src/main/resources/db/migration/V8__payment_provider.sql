ALTER TABLE booking_payments
    ADD COLUMN provider VARCHAR(10) NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay', 'stripe')),
    ALTER COLUMN order_id TYPE VARCHAR(255);
