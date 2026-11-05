CREATE TABLE wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    available_paise BIGINT NOT NULL DEFAULT 0 CHECK (available_paise >= 0),
    reserved_paise BIGINT NOT NULL DEFAULT 0 CHECK (reserved_paise >= 0)
);

CREATE TABLE wallet_entries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES wallets(user_id),
    amount_paise BIGINT NOT NULL CHECK (amount_paise <> 0),
    kind VARCHAR(24) NOT NULL CHECK (kind IN ('TOP_UP','RIDE_DEBIT','RIDE_REFUND','WITHDRAWAL','WITHDRAWAL_RELEASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX wallet_entries_history ON wallet_entries(user_id, created_at DESC, id);

CREATE TABLE wallet_top_ups (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES wallets(user_id),
    request_key UUID NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise BETWEEN 100 AND 1000000),
    provider VARCHAR(10) NOT NULL CHECK (provider IN ('razorpay','stripe')),
    order_id VARCHAR(255) NOT NULL UNIQUE,
    checkout_url TEXT,
    payment_id VARCHAR(80) UNIQUE,
    UNIQUE (user_id, request_key)
);
