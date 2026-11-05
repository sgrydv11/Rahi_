CREATE TABLE wallet_ride_charges (
    booking_id UUID PRIMARY KEY REFERENCES bookings(id),
    user_id UUID NOT NULL REFERENCES wallets(user_id),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    refunded BOOLEAN NOT NULL DEFAULT FALSE
);
