CREATE TABLE chat_groups (id bigint PRIMARY KEY, name varchar(100) NOT NULL, origin varchar(80), destination varchar(80));
INSERT INTO chat_groups VALUES (1,'Ride community',NULL,NULL),(2,'Indore–Ujjain Up-Down','Indore','Ujjain'),(3,'Indore–Dewas Up-Down','Indore','Dewas'),(4,'Indore–Pithampur Up-Down','Indore','Pithampur');
ALTER TABLE chat_messages ADD COLUMN group_id bigint NOT NULL DEFAULT 1 REFERENCES chat_groups(id);
CREATE INDEX chat_messages_group_recent_idx ON chat_messages(group_id,created_at,id);
CREATE TABLE chat_group_preferences (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 group_id bigint NOT NULL REFERENCES chat_groups(id), muted boolean NOT NULL DEFAULT false,
 last_read_id bigint NOT NULL DEFAULT 0 CHECK(last_read_id>=0), PRIMARY KEY(user_id,group_id));
INSERT INTO chat_group_preferences(user_id,group_id,last_read_id)
 SELECT u.id,g.id,coalesce((SELECT max(m.id) FROM chat_messages m WHERE m.group_id=g.id),0) FROM users u CROSS JOIN chat_groups g;
CREATE TABLE city_points(city varchar(80) NOT NULL,name varchar(120) NOT NULL,PRIMARY KEY(city,name));
INSERT INTO city_points VALUES ('Ujjain','Nanakheda'),('Ujjain','D-Mart'),('Ujjain','Lal Gate'),('Indore','Aurobindo'),('Indore','Luv Kush'),('Indore','Vijay Nagar'),('Dewas','Bus Stand'),('Dewas','AB Road'),('Dewas','Industrial Area'),('Pithampur','Bus Stand'),('Pithampur','Sector 1'),('Pithampur','Sector 3');
CREATE TABLE user_travel_routes (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, origin varchar(80) NOT NULL,destination varchar(80) NOT NULL,
 time_period varchar(16) NOT NULL CHECK(time_period IN ('MORNING','AFTERNOON','EVENING','NIGHT')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,origin,destination,time_period), CHECK(origin<>destination));
ALTER TABLE email_otp_challenges ADD COLUMN regular_routes jsonb NOT NULL DEFAULT '[]'::jsonb;
