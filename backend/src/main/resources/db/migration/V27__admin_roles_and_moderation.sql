CREATE TABLE admin_memberships (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 staff_role varchar(20) NOT NULL CHECK(staff_role IN ('OWNER','OPERATIONS','SUPPORT','MODERATOR','FINANCE','ANALYST','AUDITOR')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Preserve existing trusted administrators; no ordinary account is promoted.
INSERT INTO admin_memberships(user_id,staff_role) SELECT id,'OWNER' FROM users WHERE role='ADMIN';
ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_action_check;
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_action_check
 CHECK(action IN ('USER_STATUS_CHANGED','STAFF_ROLE_CHANGED','VEHICLE_STATUS_CHANGED','CHAT_VISIBILITY_CHANGED'));
ALTER TABLE admin_audit_events ADD COLUMN entity_type varchar(20) NOT NULL DEFAULT 'USER';
ALTER TABLE admin_audit_events ADD COLUMN entity_id varchar(80);
UPDATE admin_audit_events SET entity_id=target_user_id::text;
ALTER TABLE admin_audit_events ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE vehicles ADD COLUMN admin_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN hidden boolean NOT NULL DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN moderated_at timestamptz;
CREATE INDEX chat_visible_recent_idx ON chat_messages(group_id,id) WHERE NOT hidden;
