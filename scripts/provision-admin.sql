-- Operator-only, explicit provisioning for an EXISTING active account.
-- Usage: psql ... -v admin_email=owner@example.com -f scripts/provision-admin.sql
-- No default admin, shared password, public bootstrap endpoint or automatic promotion.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('flexir.admin_email',lower(btrim(:'admin_email')),true);
DO $$
DECLARE target users%ROWTYPE;
BEGIN
 SELECT * INTO target FROM users WHERE email=current_setting('flexir.admin_email') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Existing account not found; no account was created'; END IF;
 IF target.status<>'ACTIVE' THEN RAISE EXCEPTION 'Account is not active; no access was granted'; END IF;
 IF target.role='ADMIN' THEN RAISE NOTICE 'Account is already an administrator; no changes made'; RETURN; END IF;
 INSERT INTO admin_memberships(user_id,staff_role) VALUES(target.id,'OWNER');
 UPDATE users SET role='ADMIN',updated_at=now() WHERE id=target.id;
 UPDATE refresh_sessions SET revoked=true WHERE user_id=target.id AND NOT revoked;
 UPDATE push_devices SET enabled=false WHERE user_id=target.id;
 RAISE NOTICE 'Admin access granted. Previous sessions revoked; fresh sign-in required.';
END $$;
COMMIT;
SELECT email,role,status FROM users WHERE email=lower(btrim(:'admin_email'));
