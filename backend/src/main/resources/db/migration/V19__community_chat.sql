CREATE TABLE chat_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES users(id),
    client_id UUID NOT NULL,
    body VARCHAR(1000) NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
    ride_id UUID REFERENCES rides(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, client_id)
);
CREATE INDEX chat_messages_sender_created_idx ON chat_messages(sender_id, created_at);
