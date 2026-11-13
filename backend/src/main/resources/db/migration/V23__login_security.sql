ALTER TABLE users ADD COLUMN failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0);
ALTER TABLE users ADD COLUMN login_window_start timestamptz;
ALTER TABLE users ADD COLUMN login_locked_until timestamptz;
ALTER TABLE email_otp_challenges ADD COLUMN purpose varchar(10) NOT NULL DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN','REGISTER','DECOY'));
UPDATE email_otp_challenges SET purpose='REGISTER' WHERE registration_password_hash IS NOT NULL;
