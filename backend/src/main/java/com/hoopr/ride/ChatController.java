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
    public record Send(@NotNull UUID clientId, @NotBlank @Size(max=1000) String body, UUID rideId, boolean sharePhone, @Positive Long replyToId, @Positive Long groupId) {
        public Send(UUID clientId,String body,UUID rideId) { this(clientId,body,rideId,false,null,null); }
        public Send(UUID clientId,String body,UUID rideId,boolean sharePhone) { this(clientId,body,rideId,sharePhone,null,null); }
        public Send(UUID clientId,String body,UUID rideId,boolean sharePhone,Long replyToId) { this(clientId,body,rideId,sharePhone,replyToId,null); }
    }
    public record Reply(long id, UUID senderId, String senderName, String body) { }
    public record Member(String fullName, String travelPreference, Instant memberSince) { }
    public record Offer(UUID id, String origin, String destination, Instant departureAt, String timeZone,
                        int availableSeats, BigDecimal pricePerSeat, String currency, String status) { }
    public record Message(long id, UUID senderId, String senderName, String body, Instant createdAt, Offer ride,
                          boolean phoneShared, String mobileNumber, boolean mobileVerified, Reply replyTo, Member member, long groupId) { }
    public record Messages(List<Message> content, long nextCursor, boolean hasMore, long olderCursor, boolean hasOlder) { }
    private final JdbcTemplate jdbc;
    public ChatController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String SELECT = """
        SELECT m.*, p.full_name, p.travel_preference, u.created_at AS member_since,
               parent.id AS parent_id, parent.sender_id AS parent_sender, parent.body AS parent_body, parent_profile.full_name AS parent_name,
               u.mobile_number AS sender_mobile,
               u.mobile_verified AS sender_mobile_verified,
               r.source_name, r.destination_name, r.departure_at, r.departure_time_zone,
               r.currency, r.price_per_seat, r.status AS ride_status,
               greatest(0,r.available_seats - coalesce((SELECT sum(h.seats) FROM group_seat_holds h
                 WHERE h.ride_id=r.id AND h.status='HELD' AND h.expires_at>CURRENT_TIMESTAMP),0)) AS seats
        FROM chat_messages m JOIN user_profiles p ON p.user_id=m.sender_id JOIN users u ON u.id=m.sender_id LEFT JOIN rides r ON r.id=m.ride_id
        LEFT JOIN chat_messages parent ON parent.id=m.reply_to_id AND parent.group_id=m.group_id AND parent.created_at>=CURRENT_TIMESTAMP-interval '7 days' LEFT JOIN user_profiles parent_profile ON parent_profile.user_id=parent.sender_id
        """;

    public Messages list(Jwt jwt,long after) { return list(jwt,after,1,0); }
    @GetMapping @Transactional(readOnly=true)
    public Messages list(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") @Min(0) long after,
                         @RequestParam(defaultValue="1") @Min(1) long groupId,@RequestParam(defaultValue="0") @Min(0) long before) {
        active(jwt); requireGroup(groupId);
        var args=new ArrayList<Object>();args.add(groupId);
        String where=" WHERE m.group_id=? AND m.created_at>=CURRENT_TIMESTAMP-interval '7 days'";
        if(after>0){where+=" AND m.id>?";args.add(after);}else if(before>0){where+=" AND m.id<?";args.add(before);}
        boolean ascending=after>0;int limit=ascending?100:50;
        var messages=new ArrayList<>(jdbc.query(SELECT+where+" ORDER BY m.id "+(ascending?"ASC":"DESC")+" LIMIT "+(limit+1),(rs,n)->map(rs),args.toArray()));
        boolean more=messages.size()>limit;if(more)messages.removeLast();if(!ascending)Collections.reverse(messages);
        long oldest=messages.isEmpty()?0:messages.getFirst().id();
        boolean older=oldest>0 && Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM chat_messages WHERE group_id=? AND id<? AND created_at>=CURRENT_TIMESTAMP-interval '7 days')",Boolean.class,groupId,oldest));
        return new Messages(messages,messages.isEmpty()?after:messages.getLast().id(),ascending&&more,oldest,older);
    }
    private void requireGroup(long group) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM chat_groups WHERE id=?)",Boolean.class,group)))throw new RideFailure(404,"Group not found.");
    }

    @PostMapping
    @Transactional
    public Message send(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Send request) {
        UUID sender = active(jwt);
        long group=request.groupId()==null?1:request.groupId();requireGroup(group);
        // Serialize sequence assignment with commit order so cursor polling cannot skip an uncommitted message.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(6173052901)");
        var previous = jdbc.query(SELECT + " WHERE m.sender_id=? AND m.client_id=?", (rs,row) -> map(rs), sender,request.clientId());
        String body = request.body().strip();
        if (body.isBlank()) throw new RideFailure(400,"Write a message before sending.");
        if (!previous.isEmpty()) {
            var message = previous.getFirst();
            if (!message.body().equals(body) || message.groupId()!=group || !Objects.equals(message.replyTo()==null ? null : message.replyTo().id(),request.replyToId()) || !Objects.equals(message.ride()==null ? null : message.ride().id(),request.rideId()))
                throw new RideFailure(409,"This message retry has different content.");
            return message;
        }
        if (jdbc.queryForObject("SELECT count(*) FROM chat_messages WHERE sender_id=? AND created_at>CURRENT_TIMESTAMP-interval '1 minute'", Integer.class,sender)>=20)
            throw new RideFailure(429,"Please slow down. You can send 20 messages per minute.");
        if (request.rideId()!=null) {
            var rides = jdbc.queryForList("SELECT id,lower(source_name) AS source_key,lower(destination_name) AS destination_key FROM rides WHERE id=? AND driver_id=? AND status='SCHEDULED' AND departure_at>CURRENT_TIMESTAMP FOR SHARE",request.rideId(),sender);
            if (rides.isEmpty()) throw new RideFailure(400,"Share one of your own upcoming published rides.");
            if(group!=1 && !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM chat_groups WHERE id=? AND ((lower(origin)=? AND lower(destination)=?) OR (lower(origin)=? AND lower(destination)=?)))",Boolean.class,group,rides.getFirst().get("source_key"),rides.getFirst().get("destination_key"),rides.getFirst().get("destination_key"),rides.getFirst().get("source_key"))))throw new RideFailure(400,"Share a ride matching this group's route.");
        }
        if(request.replyToId()!=null && !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM chat_messages WHERE id=? AND group_id=? AND created_at>=CURRENT_TIMESTAMP-interval '7 days')",Boolean.class,request.replyToId(),group)))
            throw new RideFailure(400,"The message you are replying to is unavailable.");
        Long id = jdbc.queryForObject("INSERT INTO chat_messages(sender_id,client_id,body,ride_id,share_phone,reply_to_id,group_id) VALUES(?,?,?,?,?,?,?) RETURNING id",Long.class,sender,request.clientId(),body,request.rideId(),true,request.replyToId(),group);
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
            rs.getString("body"),rs.getTimestamp("created_at").toInstant(),ride,true,rs.getString("sender_mobile"),rs.getBoolean("sender_mobile_verified"),
            rs.getObject("parent_id")==null ? null : new Reply(rs.getLong("parent_id"),rs.getObject("parent_sender",UUID.class),rs.getString("parent_name"),rs.getString("parent_body")),
            new Member(rs.getString("full_name"),rs.getString("travel_preference"),rs.getTimestamp("member_since").toInstant()),rs.getLong("group_id"));
    }
}
