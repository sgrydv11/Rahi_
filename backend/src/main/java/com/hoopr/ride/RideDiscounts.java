package com.hoopr.ride;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class RideDiscounts {
    private final JdbcClient jdbc;

    public RideDiscounts(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = JdbcClient.create(jdbc);
    }

    // Acquire after the ride lock. NO KEY UPDATE also allows foreign-key checks on users.
    public void lockRider(UUID rider) {
        jdbc.sql("SELECT id FROM users WHERE id = :id FOR NO KEY UPDATE").param("id", rider).query(UUID.class).single();
    }

    public int next(UUID rider) {
        long used = jdbc.sql("SELECT count(*) FROM ride_discount_redemptions WHERE passenger_id = :rider")
                .param("rider", rider).query(Long.class).single();
        return 5 * ((int) (used % 3) + 1);
    }

    public boolean alreadyUsed(UUID rider, UUID ride) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM ride_discount_redemptions WHERE passenger_id = :rider AND ride_id = :ride)
                """).param("rider", rider).param("ride", ride).query(Boolean.class).single();
    }

    public boolean pending(UUID rider, OffsetDateTime now) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM group_seat_holds
                WHERE passenger_id = :rider AND status = 'HELD' AND discount_percent > 0 AND expires_at > :now)
                """).param("rider", rider).param("now", now).query(Boolean.class).single();
    }

    public void consume(UUID rider, UUID ride, UUID booking, int percent) {
        jdbc.sql("""
                INSERT INTO ride_discount_redemptions(passenger_id, ride_id, booking_id, discount_percent)
                VALUES (:rider, :ride, :booking, :percent)
                """).param("rider", rider).param("ride", ride).param("booking", booking).param("percent", percent).update();
    }
}
