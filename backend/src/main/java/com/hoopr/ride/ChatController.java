package com.hoopr.ride;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** One shared room for active members. Ride availability is read live, never copied into messages. */
@RestController @Validated @RequestMapping("/api/v1/chat/messages")
public class ChatController {
    public record Send(@NotNull UUID clientId, @NotBlank @Size(max=1000) String body, UUID rideId) { }
    public record Offer(UUID id, String origin, String destination, Instant departureAt, String timeZone,
                        int availableSeats, BigDecimal pricePerSeat, String currency, String status) { }
    public record Message(long id, UUID senderId, String senderName, String body, Instant createdAt, Offer ride) { }
    public record Messages(List<Message> content, long nextCursor, boolean hasMore) { }
    private final JdbcTemplate jdbc;
    public ChatController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String SELECT = """
        SELECT m.*, p.full_name, r.source_name, r.destination_name, r.departure_at, r.departure_time_zone,
               r.currency, r.price_per_seat, r.status AS ride_status,
               greatest(0,r.available_seats - coalesce((SELECT sum(h.seats) FROM group_seat_holds h
                 WHERE h.ride_id=r.id AND h.status='HELD' AND h.expires_at>CURRENT_TIMESTAMP),0)) AS seats
        FROM chat_messages m JOIN user_profiles p ON p.user_id=m.sender_id LEFT JOIN rides r ON r.id=m.ride_id
        """;

    @GetMapping
    @Transactional(readOnly=true)
    public Messages list(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue="0") @Min(0) long after) {
        active(jwt);
        var messages = jdbc.query(SELECT + (after == 0
            ? " WHERE m.id IN (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 50) ORDER BY m.id"
            : " WHERE m.id > ? ORDER BY m.id LIMIT 101"), (rs, row) -> map(rs), after == 0 ? new Object[0] : new Object[]{after});
        boolean more = messages.size() > 100;
        if (more) messages = messages.subList(0,100);
        return new Messages(messages, messages.isEmpty() ? after : messages.getLast().id(), more);
    }

    @PostMapping
    @Transactional
    public Message send(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Send request) {
        UUID sender = active(jwt);
        // Serialize sequence assignment with commit order so cursor polling cannot skip an uncommitted message.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(6173052901)");
        var previous = jdbc.query(SELECT + " WHERE m.sender_id=? AND m.client_id=?", (rs,row) -> map(rs), sender,request.clientId());
        String body = request.body().strip();
        if (body.isBlank()) throw new RideFailure(400,"Write a message before sending.");
        if (!previous.isEmpty()) {
            var message = previous.getFirst();
            if (!message.body().equals(body) || !Objects.equals(message.ride()==null ? null : message.ride().id(),request.rideId()))
                throw new RideFailure(409,"This message retry has different content.");
            return message;
        }
        if (jdbc.queryForObject("SELECT count(*) FROM chat_messages WHERE sender_id=? AND created_at>CURRENT_TIMESTAMP-interval '1 minute'", Integer.class,sender)>=20)
            throw new RideFailure(429,"Please slow down. You can send 20 messages per minute.");
        if (request.rideId()!=null) {
            var rides = jdbc.queryForList("SELECT id FROM rides WHERE id=? AND driver_id=? AND status='SCHEDULED' AND departure_at>CURRENT_TIMESTAMP FOR SHARE",request.rideId(),sender);
            if (rides.isEmpty()) throw new RideFailure(400,"Share one of your own upcoming published rides.");
        }
        Long id = jdbc.queryForObject("INSERT INTO chat_messages(sender_id,client_id,body,ride_id) VALUES(?,?,?,?) RETURNING id",Long.class,sender,request.clientId(),body,request.rideId());
        return jdbc.queryForObject(SELECT + " WHERE m.id=?",(rs,row)->map(rs),id);
    }
    private UUID active(Jwt jwt) {
        UUID id = UUID.fromString(jwt.getSubject());
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM users WHERE id=? AND status='ACTIVE')",Boolean.class,id)))
            throw new RideFailure(403,"Your account is unavailable.");
        return id;
    }
    private Message map(java.sql.ResultSet rs) throws java.sql.SQLException {
        UUID rideId = rs.getObject("ride_id",UUID.class);
        Offer ride = rideId==null ? null : new Offer(rideId,rs.getString("source_name"),rs.getString("destination_name"),
            rs.getTimestamp("departure_at").toInstant(),rs.getString("departure_time_zone"),rs.getInt("seats"),
            rs.getBigDecimal("price_per_seat"),rs.getString("currency"),rs.getString("ride_status"));
        return new Message(rs.getLong("id"),rs.getObject("sender_id",UUID.class),rs.getString("full_name"),
            rs.getString("body"),rs.getTimestamp("created_at").toInstant(),ride);
    }
}
