-- Existing accounts retain the original ability to drive and ride.
ALTER TABLE user_profiles ADD COLUMN travel_preference VARCHAR(10) NOT NULL DEFAULT 'BOTH'
    CHECK (travel_preference IN ('DRIVER', 'PASSENGER', 'BOTH'));
