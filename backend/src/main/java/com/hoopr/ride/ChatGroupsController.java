package com.hoopr.ride;

import com.hoopr.auth.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/chat/groups")
public class ChatGroupsController {
    public record Preview(long id,String senderName,String body,UUID senderId,String mobileNumber,java.time.Instant createdAt) { }
    public record Group(long id,String name,boolean muted,int unreadCount,Preview latest,boolean joined,java.time.Instant joinedAt,int memberCount,boolean pinned) { }
    public record Settings(boolean muted) { }
    public record Read(@Min(0) long upToId) { }
    private final JdbcTemplate jdbc;private final AuthService auth;
    public ChatGroupsController(JdbcTemplate jdbc,AuthService auth){this.jdbc=jdbc;this.auth=auth;}
    private UUID user(Jwt jwt){return auth.profile(UUID.fromString(jwt.getSubject())).id();}
    private void initialize(UUID user){jdbc.update("INSERT INTO chat_group_preferences(user_id,group_id,last_read_id) SELECT ?,g.id,coalesce((SELECT max(m.id) FROM chat_messages m WHERE m.group_id=g.id),0) FROM chat_groups g ON CONFLICT DO NOTHING",user);}
    @GetMapping @Transactional
    public List<Group> groups(@AuthenticationPrincipal Jwt jwt){UUID id=user(jwt);initialize(id);
        return jdbc.query("""
            SELECT g.*,s.muted,s.pinned,s.left_at,s.joined_at,(SELECT count(*) FROM chat_group_preferences members JOIN users member_user ON member_user.id=members.user_id WHERE members.group_id=g.id AND members.left_at IS NULL AND member_user.status='ACTIVE') member_count,
             (SELECT count(*) FROM chat_messages m WHERE s.left_at IS NULL AND NOT m.hidden AND m.group_id=g.id AND m.id>s.last_read_id AND m.sender_id<>? AND m.created_at>=now()-interval '7 days') unread,
             last.id latest_id,last.body latest_body,coalesce(p.mobile_number,'Number unavailable') latest_sender,last.sender_id,last.created_at latest_time,p.mobile_number latest_mobile
            FROM chat_groups g JOIN chat_group_preferences s ON s.group_id=g.id AND s.user_id=?
            LEFT JOIN LATERAL (SELECT m.id,m.body,m.sender_id,m.created_at FROM chat_messages m WHERE s.left_at IS NULL AND NOT m.hidden AND m.group_id=g.id AND m.created_at>=now()-interval '7 days' ORDER BY m.id DESC LIMIT 1) last ON true
            LEFT JOIN users p ON p.id=last.sender_id ORDER BY s.pinned DESC,g.id
            """,(r,n)->new Group(r.getLong("id"),r.getString("name"),r.getBoolean("muted"),r.getInt("unread"),r.getObject("latest_id")==null?null:new Preview(r.getLong("latest_id"),r.getString("latest_sender"),r.getString("latest_body"),r.getObject("sender_id",UUID.class),r.getString("latest_mobile"),r.getTimestamp("latest_time").toInstant()),r.getObject("left_at")==null,r.getTimestamp("joined_at").toInstant(),r.getInt("member_count"),r.getBoolean("pinned")),id,id);
    }

    public record Pin(boolean pinned) { }
    @PostMapping("/{group}/pin") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @Transactional
    public void pin(@AuthenticationPrincipal Jwt jwt,@PathVariable long group,@RequestBody Pin body){UUID id=user(jwt);initialize(id);if(jdbc.update("UPDATE chat_group_preferences SET pinned=? WHERE user_id=? AND group_id=?",body.pinned(),id,group)!=1)throw new RideFailure(404,"Group not found.");}
    public record Membership(boolean joined) { }
    public record Member(UUID id,String fullName,String mobileNumber,java.time.Instant joinedAt) { }
    @GetMapping("/{group}/members") @Transactional
    public List<Member> members(@AuthenticationPrincipal Jwt jwt,@PathVariable long group){UUID id=user(jwt);initialize(id);
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM chat_group_preferences WHERE user_id=? AND group_id=? AND left_at IS NULL)",Boolean.class,id,group)))throw new RideFailure(403,"Join this group to see its members.");
        return jdbc.query("SELECT u.id,p.full_name,u.mobile_number,g.joined_at FROM chat_group_preferences g JOIN users u ON u.id=g.user_id JOIN user_profiles p ON p.user_id=u.id WHERE g.group_id=? AND g.left_at IS NULL AND u.status='ACTIVE' ORDER BY g.joined_at,u.id",(r,n)->new Member(r.getObject("id",UUID.class),r.getString("full_name"),r.getString("mobile_number"),r.getTimestamp("joined_at").toInstant()),group);
    }
    @PostMapping("/{group}/membership") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @Transactional
    public void membership(@AuthenticationPrincipal Jwt jwt,@PathVariable long group,@RequestBody Membership body){UUID id=user(jwt);initialize(id);
        int count=body.joined()?jdbc.update("UPDATE chat_group_preferences SET joined_at=CASE WHEN left_at IS NULL THEN joined_at ELSE now() END,left_at=NULL,last_read_id=coalesce((SELECT max(id) FROM chat_messages WHERE group_id=?),0) WHERE user_id=? AND group_id=?",group,id,group):jdbc.update("UPDATE chat_group_preferences SET left_at=coalesce(left_at,now()) WHERE user_id=? AND group_id=?",id,group);
        if(count!=1)throw new RideFailure(404,"Group not found.");
    }
    @PostMapping("/{group}/settings") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @Transactional
    public void settings(@AuthenticationPrincipal Jwt jwt,@PathVariable long group,@RequestBody Settings body){UUID id=user(jwt);initialize(id);if(jdbc.update("UPDATE chat_group_preferences SET muted=? WHERE user_id=? AND group_id=?",body.muted(),id,group)!=1)throw new RideFailure(404,"Group not found.");}
    @PostMapping("/{group}/read") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @Transactional
    public void read(@AuthenticationPrincipal Jwt jwt,@PathVariable long group,@Valid @RequestBody Read body){UUID id=user(jwt);initialize(id);if(jdbc.update("UPDATE chat_group_preferences SET last_read_id=greatest(last_read_id,least(?,coalesce((SELECT max(id) FROM chat_messages WHERE group_id=?),0))) WHERE user_id=? AND group_id=?",body.upToId(),group,id,group)!=1)throw new RideFailure(404,"Group not found.");}
}
