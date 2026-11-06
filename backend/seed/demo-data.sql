-- Hoopr local demo seed (PostgreSQL 15+, application migrations V1-V14 required).
-- 100 fictional users, 30 drivers/vehicles, 180 future rides, 360 confirmed bookings.
-- Six directions, 30 rides per direction: Indore <-> Ujjain/Pithampur/Dewas.
-- Dates: tomorrow through three days from FIRST execution, in Asia/Kolkata.
-- Shared DEMO-ONLY login password: DemoRide@2026!
-- Emails: demo001@demo.hoopr.test through demo100@demo.hoopr.test.
-- These are synthetic accounts and prices, not actual people or transport quotes.
-- Run using psql against your LOCAL hoopr database (not as a Flyway migration):
--   psql -h 127.0.0.1 -U hoopr -d hoopr -W -v ON_ERROR_STOP=1 -f backend/seed/demo-data.sql
-- With this workspace's portable client, use .tools/pgsql/bin/psql.exe.
-- Re-running skips seeded users/vehicles/rides; existing rides/bookings are preserved.
-- It does not move old ride dates forward, reset passwords, or erase application data.
-- Bookings are seeded directly, without real charges or payment-provider transactions.
-- 20 example accounts (all 100 are listed by the final SELECT):
-- demo001@demo.hoopr.test | Aarav Sharma | Driver + passenger
-- demo002@demo.hoopr.test | Vivaan Sharma | Driver + passenger
-- demo003@demo.hoopr.test | Aditya Sharma | Driver + passenger
-- demo004@demo.hoopr.test | Arjun Sharma | Driver + passenger
-- demo005@demo.hoopr.test | Sai Sharma | Driver + passenger
-- demo006@demo.hoopr.test | Reyansh Sharma | Driver + passenger
-- demo007@demo.hoopr.test | Ayaan Sharma | Driver + passenger
-- demo008@demo.hoopr.test | Krishna Sharma | Driver + passenger
-- demo009@demo.hoopr.test | Ishaan Sharma | Driver + passenger
-- demo010@demo.hoopr.test | Shaurya Sharma | Driver + passenger
-- demo031@demo.hoopr.test | Ananya Patel | Passenger
-- demo032@demo.hoopr.test | Diya Patel | Passenger
-- demo033@demo.hoopr.test | Aadhya Patel | Passenger
-- demo034@demo.hoopr.test | Myra Patel | Passenger
-- demo035@demo.hoopr.test | Sara Patel | Passenger
-- demo036@demo.hoopr.test | Ira Patel | Passenger
-- demo037@demo.hoopr.test | Anika Patel | Passenger
-- demo038@demo.hoopr.test | Riya Patel | Passenger
-- demo039@demo.hoopr.test | Kavya Patel | Passenger
-- demo040@demo.hoopr.test | Meera Patel | Passenger

\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('hoopr-local-demo-v1'));

DO $seed$
DECLARE
    first_names text[] := ARRAY['Aarav','Vivaan','Aditya','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan','Shaurya','Ananya','Diya','Aadhya','Myra','Sara','Ira','Anika','Riya','Kavya','Meera'];
    surnames text[] := ARRAY['Sharma','Patel','Verma','Jain','Yadav'];
    towns text[] := ARRAY['Ujjain','Pithampur','Dewas'];
    fares numeric[] := ARRAY[150,100,120];
    makes text[] := ARRAY['Maruti Suzuki','Hyundai','Tata'];
    models text[] := ARRAY['Dzire','Aura','Tigor'];
    colors text[] := ARRAY['White','Silver','Blue'];
    password_hash text := '$2a$12$DweCC0Yeu3YALNzWCSNmTOt5TCdG1xozB14JuIcUNVsTb0r9cgDCK';
    base_date date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
    i integer; d integer; day_offset integer; direction integer; n integer;
    route integer; ride_number integer; booking_count integer; occupied integer; seat_count integer;
    uid uuid; vid uuid; rid uuid; inserted_ride uuid; passenger uuid;
    origin_name text; destination_name text;
    departure timestamptz;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version='14' AND success) THEN
        RAISE EXCEPTION 'Start the backend and apply migrations through V14 before seeding.';
    END IF;

    FOR i IN 1..100 LOOP
        uid := md5('hoopr-demo-v1:user:' || i)::uuid;
        INSERT INTO users (id,email,password_hash,status,role)
        VALUES (uid,'demo' || lpad(i::text,3,'0') || '@demo.hoopr.test',password_hash,'ACTIVE','USER')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO user_profiles (user_id,full_name,bio,travel_preference)
        VALUES (uid, first_names[1+(i-1)%20] || ' ' || surnames[1+(i-1)/20],
            'Fictional demo commuter. Enjoys shared journeys around Indore.',
            CASE WHEN i<=30 THEN 'BOTH' ELSE 'PASSENGER' END)
        ON CONFLICT (user_id) DO NOTHING;
        IF i<=30 THEN
            INSERT INTO driver_profiles (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
            route := 1+(i-1)%3;
            INSERT INTO vehicles (id,driver_id,make,model,color,registration_number,passenger_capacity)
            VALUES (md5('hoopr-demo-v1:vehicle:' || i)::uuid,uid,makes[route],models[route],colors[route],
                'DEMO-MP09-' || lpad(i::text,4,'0'),4)
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END LOOP;

    FOR day_offset IN 1..3 LOOP
        FOR d IN 1..30 LOOP
            route := 1+(d-1)%3;
            uid := md5('hoopr-demo-v1:user:' || d)::uuid;
            vid := md5('hoopr-demo-v1:vehicle:' || d)::uuid;
            FOR direction IN 0..1 LOOP
                ride_number := (day_offset-1)*60+(d-1)*2+direction+1;
                rid := md5('hoopr-demo-v1:ride:' || ride_number)::uuid;
                origin_name := CASE WHEN direction=0 THEN 'Indore' ELSE towns[route] END;
                destination_name := CASE WHEN direction=0 THEN towns[route] ELSE 'Indore' END;
                departure := ((base_date+day_offset) + make_time(
                    CASE WHEN direction=0 THEN 7 ELSE 17 END, ((d-1)/3)*5, 0)) AT TIME ZONE 'Asia/Kolkata';
                booking_count := 1+(ride_number%3);
                occupied := booking_count + CASE WHEN ride_number%4=0 THEN 1 ELSE 0 END;
                inserted_ride := NULL;
                INSERT INTO rides (id,driver_id,vehicle_id,source_name,source_locality_id,
                    destination_name,destination_locality_id,departure_at,departure_time_zone,
                    total_seats,available_seats,price_per_seat,currency,status,
                    pickup_description,dropoff_description,vehicle_details,notes)
                VALUES (rid,uid,vid,origin_name,encode(sha256(convert_to(lower(origin_name),'UTF8')),'hex'),
                    destination_name,encode(sha256(convert_to(lower(destination_name),'UTF8')),'hex'),
                    departure,'Asia/Kolkata',4,4-occupied,fares[route]+((d-1)/3)*5,'INR','SCHEDULED',
                    'Demo pickup: ' || origin_name || ' central meeting point',
                    'Demo drop-off: ' || destination_name || ' central meeting point',
                    makes[route] || ' ' || models[route] || ' / ' || colors[route],
                    '[hoopr-demo-v1] Fictional commute. Please arrive 10 minutes early.')
                ON CONFLICT (id) DO NOTHING RETURNING id INTO inserted_ride;
                -- Do not replenish seats or recreate bookings on a ride that users already changed.
                IF inserted_ride IS NULL THEN CONTINUE; END IF;
                FOR n IN 1..booking_count LOOP
                    passenger := md5('hoopr-demo-v1:user:' || (31+((ride_number-1)*3+n-1)%70))::uuid;
                    seat_count := CASE WHEN n=1 AND ride_number%4=0 THEN 2 ELSE 1 END;
                    INSERT INTO bookings (id,ride_id,passenger_id,seats_booked,price_per_seat_snapshot,
                        currency,status,idempotency_key)
                    VALUES (md5('hoopr-demo-v1:booking:' || ride_number || ':' || n)::uuid,
                        rid,passenger,seat_count,fares[route]+((d-1)/3)*5,'INR','CONFIRMED',
                        md5('hoopr-demo-v1:request:' || ride_number || ':' || n)::uuid);
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;
END
$seed$;

-- Display every demo login and a route summary after successful inserts.
SELECT u.email,p.full_name,p.travel_preference
FROM users u JOIN user_profiles p ON p.user_id=u.id
WHERE u.email ~ '^demo[0-9]{3}@demo\.hoopr\.test$' ORDER BY u.email;

SELECT r.source_name AS origin,r.destination_name AS destination,
       count(DISTINCT r.id) AS rides,count(b.id) AS bookings,
       min(r.departure_at AT TIME ZONE 'Asia/Kolkata') AS first_departure_ist
FROM rides r LEFT JOIN bookings b ON b.ride_id=r.id
WHERE r.notes LIKE '[hoopr-demo-v1]%'
GROUP BY r.source_name,r.destination_name ORDER BY origin,destination;

COMMIT;
