-- Preserve existing ride history and vehicle ownership linkage; a new offer need not have a saved vehicle.
ALTER TABLE rides ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE rides ADD COLUMN pickup_description VARCHAR(500);
ALTER TABLE rides ADD COLUMN dropoff_description VARCHAR(500);
ALTER TABLE rides ADD COLUMN vehicle_details VARCHAR(300);
ALTER TABLE rides ADD COLUMN notes VARCHAR(2000);

ALTER TABLE rides DROP CONSTRAINT rides_status_check;
ALTER TABLE rides ADD CONSTRAINT rides_status_check CHECK
    (status IN ('SCHEDULED', 'DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
ALTER TABLE rides ALTER COLUMN status SET DEFAULT 'SCHEDULED';

-- Validate historical data first. Migration fails rather than truncating/changing existing capacities.
ALTER TABLE rides ADD CONSTRAINT rides_offer_seat_limit CHECK (total_seats BETWEEN 1 AND 6);
CREATE INDEX rides_available_departure_idx ON rides(departure_at, id)
    WHERE status IN ('SCHEDULED', 'PUBLISHED') AND available_seats > 0;
CREATE INDEX rides_origin_text_idx ON rides(lower(source_name) text_pattern_ops);
CREATE INDEX rides_destination_text_idx ON rides(lower(destination_name) text_pattern_ops);
CREATE INDEX rides_status_departure_idx ON rides(status, departure_at, id);
