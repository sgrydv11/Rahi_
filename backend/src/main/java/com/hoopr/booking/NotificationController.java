package com.hoopr.booking;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
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
                .addValue("until", Timestamp.from(now.plus(24, ChronoUnit.HOURS)))
                .addValue("routeUntil",Timestamp.from(now.plus(30,ChronoUnit.DAYS)));
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
                    UNION ALL
                    SELECT r.id,r.id,r.driver_id,r.source_name,r.destination_name,'TRAVEL_RIDE',greatest(r.created_at,p.created_at)
                    FROM rides r JOIN user_travel_routes p ON p.user_id=:user AND lower(r.source_name)=lower(p.origin) AND lower(r.destination_name)=lower(p.destination)
                    WHERE r.driver_id<>:user AND r.status='SCHEDULED' AND r.departure_at>:now AND r.departure_at<:routeUntil
                      AND r.available_seats-coalesce((SELECT sum(h.seats) FROM group_seat_holds h WHERE h.ride_id=r.id AND h.status='HELD' AND h.expires_at>:now),0)>0
                      AND p.time_period=CASE WHEN extract(hour FROM r.departure_at AT TIME ZONE 'Asia/Kolkata') BETWEEN 5 AND 11 THEN 'MORNING'
                          WHEN extract(hour FROM r.departure_at AT TIME ZONE 'Asia/Kolkata') BETWEEN 12 AND 16 THEN 'AFTERNOON'
                          WHEN extract(hour FROM r.departure_at AT TIME ZONE 'Asia/Kolkata') BETWEEN 17 AND 20 THEN 'EVENING' ELSE 'NIGHT' END
                      AND NOT EXISTS(SELECT 1 FROM chat_group_preferences s JOIN chat_groups g ON g.id=s.group_id WHERE s.user_id=:user AND s.muted AND
                        ((lower(g.origin)=lower(p.origin) AND lower(g.destination)=lower(p.destination)) OR (lower(g.origin)=lower(p.destination) AND lower(g.destination)=lower(p.origin))))
                    UNION ALL
                    SELECT md5(b.user_id::text||b.origin||b.destination||b.time_period)::uuid,NULL::uuid,b.user_id,p.origin,p.destination,'TRAVEL_BUDDY',greatest(p.created_at,b.created_at)
                    FROM user_travel_routes p JOIN user_travel_routes b ON b.user_id<>p.user_id AND b.origin=p.origin AND b.destination=p.destination AND b.time_period=p.time_period
                    JOIN users u ON u.id=b.user_id AND u.status='ACTIVE'
                    WHERE p.user_id=:user AND NOT EXISTS(SELECT 1 FROM chat_group_preferences s JOIN chat_groups g ON g.id=s.group_id WHERE s.user_id=:user AND s.muted AND
                        ((g.origin=p.origin AND g.destination=p.destination) OR (g.origin=p.destination AND g.destination=p.origin)))
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
                            "TRAVEL_RIDE".equals(kind)?"/rides/"+ride:"TRAVEL_BUDDY".equals(kind)?"/chat?group="+routeGroup(row.getString("source_name"),row.getString("destination_name")):
                            driver && booking == null ? "/rides/" + ride : "/bookings/" + booking);
                });
    }

    private static int routeGroup(String a,String b){var pair=Set.of(a,b);return pair.equals(Set.of("Indore","Ujjain"))?2:pair.equals(Set.of("Indore","Dewas"))?3:pair.equals(Set.of("Indore","Pithampur"))?4:1;}
    public record Notice(String id, String kind, String origin, String destination, Instant time, String link) { }
}
