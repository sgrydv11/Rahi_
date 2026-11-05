package com.hoopr.ride;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Inventory operations run under the same ride lock as regular bookings. */
@Repository
public class GroupSeatInventory {
    private final JdbcClient jdbc;

    public GroupSeatInventory(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = JdbcClient.create(jdbc);
    }

    public int heldSeats(UUID ride, Instant now) {
        return jdbc.sql("""
                SELECT coalesce(sum(seats), 0) FROM group_seat_holds
                WHERE ride_id = :ride AND status = 'HELD' AND expires_at > :now
                """).param("ride", ride).param("now", now.atOffset(ZoneOffset.UTC)).query(Integer.class).single();
    }

    public boolean hasHold(UUID ride, UUID passenger, OffsetDateTime now) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM group_seat_holds
                WHERE ride_id = :ride AND passenger_id = :passenger AND status = 'HELD' AND expires_at > :now)
                """).param("ride", ride).param("passenger", passenger).param("now", now).query(Boolean.class).single();
    }

    public void cancelForRide(UUID ride) {
        jdbc.sql("UPDATE group_seat_holds SET status = 'CANCELLED' WHERE ride_id = :ride AND status = 'HELD'")
                .param("ride", ride).update();
    }
}
