ALTER TABLE users ADD COLUMN mobile_number varchar(16);
ALTER TABLE users ADD COLUMN mobile_verified boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX users_mobile_unique ON users (mobile_number) WHERE mobile_number IS NOT NULL;
CREATE TABLE email_otp_challenges (
    id uuid PRIMARY KEY,
    email varchar(254) NOT NULL,
    mobile_number varchar(16),
    code_hash varchar(64) NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    consumed boolean NOT NULL DEFAULT false,
    travel_preference varchar(20) NOT NULL CHECK (travel_preference IN ('DRIVER','PASSENGER','BOTH'))
);
CREATE INDEX email_otp_recent ON email_otp_challenges(email, created_at DESC);
