ALTER TABLE chat_group_preferences ADD COLUMN joined_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE chat_group_preferences ADD COLUMN left_at timestamptz;
CREATE INDEX chat_active_members_idx ON chat_group_preferences(group_id) WHERE left_at IS NULL;
