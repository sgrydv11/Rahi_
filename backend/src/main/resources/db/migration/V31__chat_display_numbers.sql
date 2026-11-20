-- Only demo/test accounts receive generated display numbers. These never become login identifiers or verified contact numbers.
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_display_number varchar(10)
 CHECK(chat_display_number IS NULL OR chat_display_number ~ '^[6-9][0-9]{9}$');
CREATE UNIQUE INDEX IF NOT EXISTS users_chat_display_number_unique ON users(chat_display_number);
CREATE OR REPLACE FUNCTION assign_chat_display_number() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate text;
BEGIN
 IF (NEW.email LIKE 'demo%@demo.hoopr.test' OR NEW.email LIKE '%@qa.example.test')
    AND nullif(btrim(NEW.mobile_number),'') IS NULL AND NEW.chat_display_number IS NULL THEN
  LOOP
   candidate := (6+floor(random()*4))::int::text || lpad(floor(random()*1000000000)::bigint::text,9,'0');
   EXIT WHEN NOT EXISTS(SELECT 1 FROM users WHERE chat_display_number=candidate OR mobile_number LIKE '%'||candidate);
  END LOOP;
  NEW.chat_display_number := candidate;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_chat_display_number ON users;
CREATE TRIGGER users_chat_display_number BEFORE INSERT OR UPDATE OF mobile_number,chat_display_number
 ON users FOR EACH ROW EXECUTE FUNCTION assign_chat_display_number();
UPDATE users SET chat_display_number=chat_display_number
 WHERE (email LIKE 'demo%@demo.hoopr.test' OR email LIKE '%@qa.example.test')
 AND nullif(btrim(mobile_number),'') IS NULL AND chat_display_number IS NULL;
