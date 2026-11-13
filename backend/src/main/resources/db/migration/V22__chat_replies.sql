ALTER TABLE chat_messages ADD COLUMN reply_to_id bigint REFERENCES chat_messages(id) ON DELETE SET NULL;
CREATE INDEX chat_messages_reply_idx ON chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
