CREATE TABLE driver_vehicle_verifications (
 vehicle_id uuid PRIMARY KEY REFERENCES vehicles(id),
 licence_number varchar(80), licence_expiry date,
 insurance_number varchar(100), insurance_expiry date,
 status varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PENDING','APPROVED','REJECTED')),
 revision bigint NOT NULL DEFAULT 0, review_reason varchar(500),
 reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE driver_vehicle_documents (
 vehicle_id uuid REFERENCES driver_vehicle_verifications(vehicle_id),
 kind varchar(16) CHECK(kind IN ('LICENCE','RC','INSURANCE')),
 media_type varchar(30) NOT NULL CHECK(media_type IN ('application/pdf','image/jpeg','image/png')),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 8 AND 2097152),
 PRIMARY KEY(vehicle_id,kind)
);

ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_action_check;
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_action_check CHECK(action IN ('USER_STATUS_CHANGED','STAFF_ROLE_CHANGED','VEHICLE_STATUS_CHANGED','CHAT_VISIBILITY_CHANGED','DOCUMENT_VIEW','DRIVER_DOCUMENT_REVIEW'));
