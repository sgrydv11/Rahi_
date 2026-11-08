ALTER TABLE rides ADD COLUMN preferences jsonb;
ALTER TABLE rides ADD CONSTRAINT ride_preferences_object CHECK (preferences IS NULL OR jsonb_typeof(preferences) = 'object');
ALTER TABLE bookings ADD COLUMN journey_details jsonb;
ALTER TABLE bookings ADD CONSTRAINT booking_journey_object CHECK (journey_details IS NULL OR jsonb_typeof(journey_details) = 'object');
ALTER TABLE bookings ADD COLUMN review_text varchar(1000);
CREATE INDEX booking_driver_review_lookup ON bookings (ride_id, rated_at DESC) WHERE driver_rating IS NOT NULL;
