package com.hoopr.booking;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class NotificationController {
    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;
    private final com.hoopr.auth.AuthService auth;

    public NotificationController(NamedParameterJdbcTemplate jdbc, Clock clock, com.hoopr.auth.AuthService auth) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.auth = auth;
    }

    @GetMapping("/api/v1/notifications")
    public List<Notice> inbox(@AuthenticationPrincipal Jwt jwt) {
        UUID user = auth.profile(UUID.fromString(jwt.getSubject())).id();
        Instant now = clock.instant();
        var params = new MapSqlParameterSource("user", user)
                .addValue("now", Timestamp.from(now))
                .addValue("until", Timestamp.from(now.plus(24, ChronoUnit.HOURS)));
        return jdbc.query("""
                WITH visible_bookings AS (
                    SELECT b.id, b.passenger_id, b.created_at, b.updated_at, b.cancelled_at, b.status, b.request_expires_at,
                           r.id AS ride_id, r.driver_id, r.source_name, r.destination_name,
                           r.departure_at, r.status AS ride_status
                    FROM bookings b JOIN rides r ON r.id = b.ride_id
                    WHERE b.passenger_id = :user OR r.driver_id = :user
                ), events AS (
                    SELECT id, ride_id, driver_id, source_name, destination_name,
                           'BOOKING_CONFIRMED' AS kind, created_at AS event_at
                    FROM visible_bookings WHERE request_expires_at IS NULL
                    UNION ALL
                    SELECT id, ride_id, driver_id, source_name, destination_name,
                           CASE WHEN status = 'CONFIRMED' THEN 'BOOKING_CONFIRMED'
                                WHEN status = 'DECLINED' THEN 'BOOKING_DECLINED'
                                WHEN request_expires_at <= :now THEN 'BOOKING_EXPIRED'
                                ELSE 'BOOKING_REQUESTED' END,
                           CASE WHEN status = 'PENDING' AND request_expires_at <= :now THEN request_expires_at ELSE updated_at END
                    FROM visible_bookings WHERE request_expires_at IS NOT NULL AND status IN ('PENDING', 'CONFIRMED', 'DECLINED')
                    UNION ALL
                    SELECT id, ride_id, driver_id, source_name, destination_name, status, cancelled_at
                    FROM visible_bookings WHERE cancelled_at IS NOT NULL
                    UNION ALL
                    SELECT id, ride_id, driver_id, source_name, destination_name,
                           'DEPARTURE_REMINDER', departure_at
                    FROM visible_bookings
                    WHERE passenger_id = :user AND status = 'CONFIRMED'
                      AND ride_status IN ('SCHEDULED', 'PUBLISHED') AND departure_at > :now AND departure_at <= :until
                    UNION ALL
                    SELECT NULL, id, driver_id, source_name, destination_name, 'DEPARTURE_REMINDER', departure_at
                    FROM rides
                    WHERE driver_id = :user AND status IN ('SCHEDULED', 'PUBLISHED')
                      AND departure_at > :now AND departure_at <= :until
                )
                SELECT * FROM events ORDER BY (kind = 'DEPARTURE_REMINDER') DESC,
                    CASE WHEN kind = 'DEPARTURE_REMINDER' THEN event_at END ASC,
                    event_at DESC, ride_id, id, kind LIMIT 100
                """, params, (row, index) -> {
                    UUID booking = row.getObject("id", UUID.class);
                    UUID ride = row.getObject("ride_id", UUID.class);
                    boolean driver = user.equals(row.getObject("driver_id", UUID.class));
                    String kind = row.getString("kind");
                    return new Notice(kind + ":" + (booking == null ? ride : booking), kind,
                            row.getString("source_name"), row.getString("destination_name"),
                            row.getTimestamp("event_at").toInstant(),
                            driver && booking == null ? "/rides/" + ride : "/bookings/" + booking);
                });
    }

    public record Notice(String id, String kind, String origin, String destination, Instant time, String link) { }
}
