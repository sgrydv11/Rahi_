CREATE TABLE push_devices (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES refresh_sessions(id) ON DELETE CASCADE,
 token varchar(255) NOT NULL UNIQUE, platform varchar(10) NOT NULL CHECK(platform IN ('android','ios')),
 enabled boolean NOT NULL DEFAULT true, last_chat_id bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE push_seen_events(device_id uuid NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,event_key varchar(160) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(device_id,event_key));
CREATE TABLE push_outbox (
 id bigserial PRIMARY KEY,device_id uuid NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,session_id uuid NOT NULL,event_key varchar(160) NOT NULL,
 title varchar(160) NOT NULL,body varchar(400) NOT NULL,data jsonb NOT NULL,
 group_id bigint REFERENCES chat_groups(id),message_id bigint,
 state varchar(12) NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),receipt_id varchar(100),accepted_at timestamptz,
 last_error varchar(100),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(device_id,event_key));
CREATE INDEX push_pending_idx ON push_outbox(next_attempt_at,id) WHERE state='PENDING';
CREATE INDEX push_receipts_idx ON push_outbox(accepted_at) WHERE state='ACCEPTED';
