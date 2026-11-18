-- LOCAL QA ONLY. Fictional/unverified UI data; never send SMS or make calls to these numbers.
-- Refuse production/development databases. This targets only the isolated browser-QA schema.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'hoopr_test' THEN RAISE EXCEPTION 'This seed requires hoopr_test'; END IF;
END $$;
WITH missing AS (
 SELECT id,row_number() OVER(ORDER BY email) n FROM admin_browser_20261116.users
 WHERE mobile_number IS NULL AND (email LIKE '%@qa.example.test' OR email LIKE 'demo%@demo.hoopr.test')
), candidates AS (
 SELECT '+91'||(((6+(n-1)%4)::bigint*1000000000+100000000+(n-1)/4+1)::bigint)::text phone,n
 FROM generate_series(1,10000) n
), available AS (
 SELECT phone,row_number() OVER(ORDER BY n) n FROM candidates c
 WHERE NOT EXISTS(SELECT 1 FROM admin_browser_20261116.users u WHERE u.mobile_number=c.phone)
)
UPDATE admin_browser_20261116.users u SET mobile_number=a.phone,mobile_verified=false
FROM missing m JOIN available a ON a.n=m.n WHERE u.id=m.id;
SELECT substring(mobile_number from 4 for 1) starts_with,count(*) accounts
FROM admin_browser_20261116.users WHERE email LIKE '%@qa.example.test' OR email LIKE 'demo%@demo.hoopr.test'
GROUP BY 1 ORDER BY 1;
COMMIT;
