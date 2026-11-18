ALTER TABLE chat_group_preferences ADD COLUMN pinned boolean NOT NULL DEFAULT false;
CREATE TABLE demo_wallets(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,balance_paise bigint NOT NULL DEFAULT 0 CHECK(balance_paise BETWEEN 0 AND 10000000));
CREATE TABLE demo_wallet_entries(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES demo_wallets(user_id) ON DELETE CASCADE,request_key uuid NOT NULL,kind varchar(12) NOT NULL CHECK(kind IN ('TOP_UP','WITHDRAWAL')),amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 100 AND 1000000),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,request_key));
CREATE INDEX demo_wallet_recent_idx ON demo_wallet_entries(user_id,created_at DESC);
ALTER TABLE email_otp_challenges ADD COLUMN consent_version varchar(64);
ALTER TABLE email_otp_challenges ADD COLUMN consent_at timestamptz;
CREATE TABLE user_legal_consents(user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,terms_version varchar(64) NOT NULL,privacy_version varchar(64) NOT NULL,accepted_at timestamptz NOT NULL,source varchar(16) NOT NULL,PRIMARY KEY(user_id,terms_version,privacy_version));
