CREATE TABLE wallet_withdrawals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES wallets(user_id),
    request_key UUID NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise BETWEEN 100 AND 1000000),
    status VARCHAR(10) NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, request_key)
);
CREATE INDEX wallet_withdrawals_pending ON wallet_withdrawals(created_at, id) WHERE status = 'PENDING';
