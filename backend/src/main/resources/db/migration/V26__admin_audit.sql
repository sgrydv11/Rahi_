CREATE TABLE admin_audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id uuid NOT NULL REFERENCES users(id),
 target_user_id uuid NOT NULL REFERENCES users(id),
 action varchar(40) NOT NULL CHECK(action='USER_STATUS_CHANGED'),
 previous_status varchar(20) NOT NULL,
 new_status varchar(20) NOT NULL,
 reason varchar(500) NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_recent_idx ON admin_audit_events(created_at DESC,id DESC);
