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
    public record Preview(long id,String senderName,String body) { }
    public record Group(long id,String name,boolean muted,int unreadCount,Preview latest) { }
    public record Settings(boolean muted) { }
    public record Read(@Min(0) long upToId) { }
    private final JdbcTemplate jdbc;private final AuthService auth;
    public ChatGroupsController(JdbcTemplate jdbc,AuthService auth){this.jdbc=jdbc;this.auth=auth;}
    private UUID user(Jwt jwt){return auth.profile(UUID.fromString(jwt.getSubject())).id();}
    private void initialize(UUID user){jdbc.update("INSERT INTO chat_group_preferences(user_id,group_id,last_read_id) SELECT ?,g.id,coalesce((SELECT max(m.id) FROM chat_messages m WHERE m.group_id=g.id),0) FROM chat_groups g ON CONFLICT DO NOTHING",user);}
    @GetMapping @Transactional
    public List<Group> groups(@AuthenticationPrincipal Jwt jwt){UUID id=user(jwt);initialize(id);
        return jdbc.query("""
            SELECT g.*,s.muted,
             (SELECT count(*) FROM chat_messages m WHERE m.group_id=g.id AND m.id>s.last_read_id AND m.sender_id<>? AND m.created_at>=now()-interval '7 days') unread,
             last.id latest_id,last.body latest_body,p.full_name latest_sender
            FROM chat_groups g JOIN chat_group_preferences s ON s.group_id=g.id AND s.user_id=?
            LEFT JOIN LATERAL (SELECT m.id,m.body,m.sender_id FROM chat_messages m WHERE m.group_id=g.id AND m.sender_id<>? AND m.id>s.last_read_id AND m.created_at>=now()-interval '7 days' ORDER BY m.id DESC LIMIT 1) last ON true
            LEFT JOIN user_profiles p ON p.user_id=last.sender_id ORDER BY g.id
            """,(r,n)->new Group(r.getLong("id"),r.getString("name"),r.getBoolean("muted"),r.getInt("unread"),r.getObject("latest_id")==null?null:new Preview(r.getLong("latest_id"),r.getString("latest_sender"),r.getString("latest_body"))),id,id,id);
    }
    @PostMapping("/{group}/settings") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @Transactional
    public void settings(@AuthenticationPrincipal Jwt jwt,@PathVariable long group,@RequestBody Settings body){UUID id=user(jwt);initialize(id);if(jdbc.update("UPDATE chat_group_preferences SET muted=? WHERE user_id=? AND group_id=?",body.muted(),id,group)!=1)throw new RideFailure(404,"Group not found.");}
    @PostMapping("/{group}/read") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @Transactional
    public void read(@AuthenticationPrincipal Jwt jwt,@PathVariable long group,@Valid @RequestBody Read body){UUID id=user(jwt);initialize(id);if(jdbc.update("UPDATE chat_group_preferences SET last_read_id=greatest(last_read_id,least(?,coalesce((SELECT max(id) FROM chat_messages WHERE group_id=?),0))) WHERE user_id=? AND group_id=?",body.upToId(),group,id,group)!=1)throw new RideFailure(404,"Group not found.");}
}
