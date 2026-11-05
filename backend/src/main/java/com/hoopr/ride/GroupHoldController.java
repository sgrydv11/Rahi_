package com.hoopr.ride;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.ProblemDetail;
import org.springframework.http.HttpStatusCode;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/group/holds")
public class GroupHoldController {
    private final RideRepository rides;
    private final GroupSeatInventory inventory;
    private final JdbcClient jdbc;
    private final Clock clock;

    public GroupHoldController(RideRepository rides, GroupSeatInventory inventory, NamedParameterJdbcTemplate jdbc, Clock clock) {
        this.rides = rides;
        this.inventory = inventory;
        this.jdbc = JdbcClient.create(jdbc);
        this.clock = clock;
    }

    @PostMapping
    @Transactional
    public Hold create(@AuthenticationPrincipal Jwt jwt, @RequestHeader("Idempotency-Key") UUID key,
                       @Valid @RequestBody Request request) {
        UUID passenger = user(jwt);
        var existing = replay(passenger, key);
        if (existing.isPresent()) return match(existing.get(), request);
        Ride ride = rides.lockById(request.rideId()).orElseThrow(GroupHoldController::missing);
        existing = replay(passenger, key);
        if (existing.isPresent()) return match(existing.get(), request);
        Instant now = clock.instant();
        if (ride.driverId.equals(passenger) || !"INR".equals(ride.currency) ||
                ride.pricePerSeat.movePointRight(2).longValueExact() < 100)
            throw new Failure(400, "INVALID_REQUEST", "Choose an eligible seat offer.");
        if (!("SCHEDULED".equals(ride.status) || "PUBLISHED".equals(ride.status)) || !ride.departureAt.isAfter(now))
            throw new Failure(409, "SOLD_OUT", "This ride is no longer available.");
        if (inventory.hasHold(ride.id, passenger, utc(now)))
            throw new Failure(409, "ACTIVE_HOLD", "You already have a seat hold on this ride.");
        boolean booked = jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM bookings
                WHERE ride_id = :ride AND passenger_id = :passenger AND status = 'CONFIRMED')
                """).param("ride", ride.id).param("passenger", passenger).query(Boolean.class).single();
        if (booked) throw new Failure(409, "ACTIVE_BOOKING", "You already have a booking on this ride.");
        if (ride.availableSeats - inventory.heldSeats(ride.id, now) < request.seats())
            throw new Failure(409, "SOLD_OUT", "There are not enough seats available.");
        Instant deadline = now.plusSeconds(300);
        Instant expiresAt = deadline.isBefore(ride.departureAt) ? deadline : ride.departureAt;
        long fare = ride.pricePerSeat.movePointRight(2).longValueExact() * request.seats();
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO group_seat_holds (id, ride_id, passenger_id, request_key, seats, fare_paise, expires_at, status)
                VALUES (:id, :ride, :passenger, :key, :seats, :fare, :expires, 'HELD')
                ON CONFLICT (passenger_id, request_key) DO NOTHING
                """).param("id", id).param("ride", ride.id).param("passenger", passenger).param("key", key)
                .param("seats", request.seats()).param("fare", fare).param("expires", utc(expiresAt)).update();
        return match(replay(passenger, key).orElseThrow(), request);
    }

    @GetMapping("/{id}")
    public Hold get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return owned(user(jwt), id);
    }

    @PostMapping("/{id}/cancel")
    @Transactional
    public Hold cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        UUID passenger = user(jwt);
        Hold hold = owned(passenger, id);
        rides.lockById(hold.rideId()).orElseThrow(GroupHoldController::missing);
        jdbc.sql("""
                UPDATE group_seat_holds SET status = 'CANCELLED'
                WHERE id = :id AND status = 'HELD' AND expires_at > :now
                """).param("id", id).param("now", utc(clock.instant())).update();
        return owned(passenger, id);
    }

    private Hold owned(UUID passenger, UUID id) {
        return select("id", passenger, id).orElseThrow(GroupHoldController::missing);
    }

    private Optional<Hold> replay(UUID passenger, UUID key) {
        return select("request_key", passenger, key);
    }

    private Optional<Hold> select(String column, UUID passenger, UUID value) {
        Instant now = clock.instant();
        return jdbc.sql("SELECT * FROM group_seat_holds WHERE passenger_id = :passenger AND " + column + " = :value")
                .param("passenger", passenger).param("value", value).query((row, index) -> {
                    Instant expires = row.getObject("expires_at", OffsetDateTime.class).toInstant();
                    String status = row.getString("status");
                    if ("HELD".equals(status) && !expires.isAfter(now)) status = "EXPIRED";
                    long fare = row.getLong("fare_paise");
                    return new Hold(row.getObject("id", UUID.class), row.getObject("ride_id", UUID.class),
                            row.getInt("seats"), expires, status, new Quote(fare, 0, 0, fare, "INR"));
                }).optional();
    }

    private static Hold match(Hold hold, Request request) {
        if (!hold.rideId().equals(request.rideId()) || hold.seats() != request.seats())
            throw new Failure(409, "IDEMPOTENCY_CONFLICT", "Use a new key for a different seat request.");
        return hold;
    }

    private static UUID user(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private static OffsetDateTime utc(Instant now) { return now.atOffset(ZoneOffset.UTC); }
    private static Failure missing() { return new Failure(404, "NOT_FOUND", "Seat hold or ride not found."); }

    @ExceptionHandler(Failure.class)
    ProblemDetail problem(Failure failure) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(failure.status), failure.getMessage());
        detail.setProperty("code", failure.code);
        return detail;
    }

    private static final class Failure extends RuntimeException {
        final int status;
        final String code;
        Failure(int status, String code, String message) {
            super(message);
            this.status = status;
            this.code = code;
        }
    }

    public record Request(@NotNull UUID rideId, @NotNull @Min(1) @Max(6) Integer seats) {}
    public record Hold(UUID id, UUID rideId, int seats, Instant expiresAt, String status, Quote quote) {}
    public record Quote(long farePaise, int discountPercent, long discountPaise, long totalPaise, String currency) {}
}
