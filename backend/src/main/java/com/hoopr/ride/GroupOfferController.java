package com.hoopr.ride;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/group/offers")
public class GroupOfferController {
    private static final String ELIGIBLE = """
            FROM rides CROSS JOIN LATERAL (
                SELECT rides.available_seats - coalesce(sum(seats), 0) AS open_seats
                FROM group_seat_holds WHERE ride_id = rides.id AND status = 'HELD' AND expires_at > :now
            ) inventory
            WHERE status IN ('SCHEDULED', 'PUBLISHED')
              AND departure_at > :now AND open_seats > 0
              AND currency = 'INR' AND price_per_seat >= 1
              AND driver_id <> :viewer
              AND strpos(lower(source_name), lower(:origin)) > 0
              AND strpos(lower(destination_name), lower(:destination)) > 0
            """;

    private final JdbcClient jdbc;
    private final Clock clock;

    public GroupOfferController(NamedParameterJdbcTemplate jdbc, Clock clock) {
        this.jdbc = JdbcClient.create(jdbc);
        this.clock = clock;
    }

    @GetMapping
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Offers list(@AuthenticationPrincipal Jwt jwt,
                       @RequestParam(defaultValue = "0") @Min(0) int page,
                       @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
                       @RequestParam(defaultValue = "") @Size(max = 200) String origin,
                       @RequestParam(defaultValue = "") @Size(max = 200) String destination) {
        var now = clock.instant().atOffset(ZoneOffset.UTC);
        var viewer = UUID.fromString(jwt.getSubject());
        long count = eligible("SELECT count(*) ", "", now, viewer, origin, destination)
                .query(Long.class).single();
        List<Offer> content = eligible("""
                SELECT id, source_name, destination_name, departure_at, open_seats AS available_seats,
                       price_per_seat * 100 AS fare_paise
                """, "ORDER BY departure_at, id LIMIT :size OFFSET :offset", now, viewer, origin, destination)
                .param("size", size).param("offset", (long) page * size)
                .query((row, index) -> new Offer(row.getObject("id", UUID.class),
                        row.getString("source_name"), row.getString("destination_name"),
                        row.getObject("departure_at", OffsetDateTime.class).toInstant(),
                        row.getInt("available_seats"), row.getLong("fare_paise"), "INR"))
                .list();
        return new Offers(content, page, (count + size - 1) / size);
    }

    private JdbcClient.StatementSpec eligible(String select, String suffix, OffsetDateTime now,
                                               UUID viewer, String origin, String destination) {
        return jdbc.sql(select + ELIGIBLE + suffix)
                .param("now", now).param("viewer", viewer)
                .param("origin", origin.strip()).param("destination", destination.strip());
    }

    public record Offer(UUID rideId, String origin, String destination, Instant departureAt,
                        int availableSeats, long farePerSeatPaise, String currency) {}
    public record Offers(List<Offer> content, int page, long totalPages) {}
}
