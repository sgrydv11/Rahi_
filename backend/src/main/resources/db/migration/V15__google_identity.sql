ALTER TABLE users ADD COLUMN google_subject varchar(255);
CREATE UNIQUE INDEX users_google_subject_unique ON users (google_subject) WHERE google_subject IS NOT NULL;
