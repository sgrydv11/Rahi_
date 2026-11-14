package com.hoopr.ride;

import com.hoopr.auth.AuthService;
import com.hoopr.database.TestDatabase;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "hoopr.auth.issuer=hoopr-test","hoopr.auth.origins=http://localhost:5173",
    "hoopr.auth.cookie-secure=true","hoopr.auth.cookie-same-site=Lax","hoopr.auth.refresh-lifetime=30d"})
class ChatIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->TestDatabase.required("TEST_DB_URL"));
        r.add("spring.datasource.username",()->TestDatabase.required("TEST_DB_USERNAME"));
        r.add("spring.datasource.password",()->TestDatabase.required("TEST_DB_PASSWORD"));
    }
    @Autowired ChatController chat;
    @Autowired ChatGroupsController groups;
    @Autowired com.hoopr.user.TravelRoutesController preferences;
    @Autowired com.hoopr.booking.NotificationController notifications;
    @Autowired AuthService auth;
    @Autowired RideService rides;
    @Autowired JdbcTemplate jdbc;
    List<UUID> members=new ArrayList<>();
    Jwt member() {
        var id=auth.register(UUID.randomUUID()+"@chat.test","test-password-long","Chat Member").id();
        members.add(id);
        return Jwt.withTokenValue("test").header("alg","HS256").subject(id.toString()).build();
    }
    @AfterEach void cleanup() {
        for(var id:members) {
            jdbc.update("DELETE FROM chat_messages WHERE sender_id=?",id);
            jdbc.update("DELETE FROM rides WHERE driver_id=?",id);
            jdbc.update("DELETE FROM driver_profiles WHERE user_id=?",id);
            jdbc.update("DELETE FROM user_profiles WHERE user_id=?",id);
            jdbc.update("DELETE FROM users WHERE id=?",id);
        }
    }
    @Test void membersShareMessagesAndRetriesDoNotDuplicateOrChangeThem() {
        var a=member();var b=member();var key=UUID.randomUUID();
        var sent=chat.send(a,new ChatController.Send(key,"Hello passengers",null));
        assertEquals(sent.id(),chat.send(a,new ChatController.Send(key,"Hello passengers",null)).id());
        assertTrue(chat.list(b,0).content().stream().anyMatch(m->m.id()==sent.id()));
        assertEquals(409,assertThrows(RideFailure.class,()->chat.send(a,new ChatController.Send(key,"Changed",null))).status);
        var reply=chat.send(b,new ChatController.Send(UUID.randomUUID(),"I need two seats",null));
        assertTrue(chat.list(a,sent.id()).content().stream().anyMatch(m->m.id()==reply.id()));
        assertThrows(jakarta.validation.ConstraintViolationException.class,
            ()->chat.send(a,new ChatController.Send(UUID.randomUUID(),"   ",null)));
    }
    @Test void registeredMobileIsAlwaysVisibleWithoutSharingFlag() {
        var a=member();var b=member();var id=UUID.fromString(a.getSubject());
        assertNull(chat.send(a,new ChatController.Send(UUID.randomUUID(),"No number",null)).mobileNumber());
        jdbc.update("UPDATE users SET mobile_number='+919876543210',mobile_verified=false WHERE id=?",id);
        var key=UUID.randomUUID();var sent=chat.send(a,new ChatController.Send(key,"Contact me",null,false));
        assertEquals("+919876543210",sent.mobileNumber());assertFalse(sent.mobileVerified());assertTrue(sent.phoneShared());
        assertEquals(sent.id(),chat.send(a,new ChatController.Send(key,"Contact me",null,true)).id());
        assertEquals("+919876543210",chat.list(b,0).content().stream().filter(m->m.id()==sent.id()).findFirst().orElseThrow().mobileNumber());
    }
    @Test void repliesPersistOriginalMessageAndRetryTargetCannotChange() {
        var a=member();var b=member();
        var original=chat.send(a,new ChatController.Send(UUID.randomUUID(),"Leaving at seven",null));
        var key=UUID.randomUUID();
        var request=new ChatController.Send(key,"One seat please",null,false,original.id());
        var reply=chat.send(b,request);
        assertEquals(original.id(),reply.replyTo().id());
        assertEquals(original.senderId(),reply.replyTo().senderId());
        assertEquals(original.body(),reply.replyTo().body());
        assertEquals(reply.id(),chat.send(b,request).id());
        assertEquals(409,assertThrows(RideFailure.class,()->chat.send(b,new ChatController.Send(key,"One seat please",null,false,null))).status);
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(b,new ChatController.Send(UUID.randomUUID(),"Missing",null,false,Long.MAX_VALUE))).status);
        var persisted=chat.list(a,original.id()).content().stream().filter(m->m.id()==reply.id()).findFirst().orElseThrow();
        assertEquals(original.body(),persisted.replyTo().body());
        assertNull(persisted.mobileNumber());
        assertEquals("Chat Member",persisted.member().fullName());
        assertEquals("BOTH",persisted.member().travelPreference());
        assertNotNull(persisted.member().memberSince());
        assertThrows(jakarta.validation.ConstraintViolationException.class,()->chat.send(b,new ChatController.Send(UUID.randomUUID(),"Invalid",null,false,-1L)));
    }
    @Test void onlyOwnersShareUpcomingRidesAndAvailabilityUpdatesLive() {
        var a=member();var b=member();
        var ride=rides.create(UUID.fromString(a.getSubject()),new RideDtos.Create("Indore","Ujjain",null,null,
            Instant.now().plusSeconds(86400),"Asia/Kolkata",3,new BigDecimal("100"),"INR","Test car",null,null));
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(b,new ChatController.Send(UUID.randomUUID(),"Fake offer",ride.id()))).status);
        var sent=chat.send(a,new ChatController.Send(UUID.randomUUID(),"Three seats tomorrow",ride.id()));
        assertEquals(3,sent.ride().availableSeats());
        assertEquals(2,chat.send(a,new ChatController.Send(UUID.randomUUID(),"Ujjain route",ride.id(),false,null,2L)).groupId());
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(a,new ChatController.Send(UUID.randomUUID(),"Wrong route",ride.id(),false,null,3L))).status);
        jdbc.update("UPDATE rides SET available_seats=1 WHERE id=?",ride.id());
        var updated=chat.list(b,0).content().stream().filter(m->m.id()==sent.id()).findFirst().orElseThrow();
        assertEquals(1,updated.ride().availableSeats());
        jdbc.update("UPDATE rides SET departure_at=now()-interval '1 hour' WHERE id=?",ride.id());
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(a,new ChatController.Send(UUID.randomUUID(),"Old ride",ride.id()))).status);
    }
    @Test void routeGroupsIsolateRepliesUnreadCursorsAndMutePerUser() {
        var a=member();var b=member();groups.groups(a);groups.groups(b);
        var sent=chat.send(a,new ChatController.Send(UUID.randomUUID(),"Ujjain tomorrow",null,false,null,2L));
        assertFalse(chat.list(b,0,3,0).content().stream().anyMatch(m->m.id()==sent.id()));
        assertEquals(1,groups.groups(b).stream().filter(g->g.id()==2).findFirst().orElseThrow().unreadCount());
        assertEquals(0,groups.groups(a).stream().filter(g->g.id()==2).findFirst().orElseThrow().unreadCount());
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(b,new ChatController.Send(UUID.randomUUID(),"Wrong group",null,false,sent.id(),3L))).status);
        groups.settings(b,2,new ChatGroupsController.Settings(true));
        assertTrue(groups.groups(b).stream().filter(g->g.id()==2).findFirst().orElseThrow().muted());
        assertFalse(groups.groups(a).stream().filter(g->g.id()==2).findFirst().orElseThrow().muted());
        groups.read(b,2,new ChatGroupsController.Read(sent.id()));groups.read(b,2,new ChatGroupsController.Read(0));
        assertEquals(0,groups.groups(b).stream().filter(g->g.id()==2).findFirst().orElseThrow().unreadCount());
        assertEquals(404,assertThrows(RideFailure.class,()->chat.list(b,0,999,0)).status);
    }
    @Test void historyAndQuotesExcludeMessagesOlderThanSevenDaysAndPagesDoNotOverlap() {
        var a=member();var old=chat.send(a,new ChatController.Send(UUID.randomUUID(),"Old",null));
        var reply=chat.send(a,new ChatController.Send(UUID.randomUUID(),"Reply",null,false,old.id()));
        jdbc.update("UPDATE chat_messages SET created_at=now()-interval '8 days' WHERE id=?",old.id());
        var current=chat.list(a,0);
        assertFalse(current.content().stream().anyMatch(m->m.id()==old.id()));
        assertNull(current.content().stream().filter(m->m.id()==reply.id()).findFirst().orElseThrow().replyTo());
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(a,new ChatController.Send(UUID.randomUUID(),"Old quote",null,false,old.id()))).status);
        for(int i=0;i<65;i++)jdbc.update("INSERT INTO chat_messages(sender_id,client_id,body,group_id) VALUES(?,?,?,4)",UUID.fromString(a.getSubject()),UUID.randomUUID(),"History "+i);
        var first=chat.list(a,0,4,0);var older=chat.list(a,0,4,first.olderCursor());
        assertEquals(50,first.content().size());assertTrue(first.hasOlder());assertEquals(15,older.content().size());assertFalse(older.hasOlder());
        assertTrue(older.nextCursor()<first.olderCursor());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM chat_messages WHERE id=?",Integer.class,old.id()));
    }
    @Test void regularRoutesValidateMatchIndianTimeAndRespectGroupMute() {
        var a=member();var b=member();var morning=com.hoopr.user.TravelRoutesController.Period.MORNING;
        var route=new com.hoopr.user.TravelRoutesController.Route("indore","Ujjain",morning);
        var saved=preferences.save(b,new com.hoopr.user.TravelRoutesController.Preferences(List.of(route,route)));
        assertEquals(1,saved.size());assertEquals("Indore",saved.getFirst().origin());
        preferences.save(a,new com.hoopr.user.TravelRoutesController.Preferences(List.of(route)));
        var tomorrow=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).plusDays(1);
        var ride=rides.create(UUID.fromString(a.getSubject()),new RideDtos.Create("Indore","Ujjain",null,null,tomorrow.atTime(8,0).atZone(java.time.ZoneId.of("Asia/Kolkata")).toInstant(),"Asia/Kolkata",3,new BigDecimal("100"),"INR","Test car",null,null));
        var notices=notifications.inbox(b);
        assertTrue(notices.stream().anyMatch(n->n.kind().equals("TRAVEL_RIDE")&&n.link().equals("/rides/"+ride.id())));
        assertTrue(notices.stream().anyMatch(n->n.kind().equals("TRAVEL_BUDDY")&&n.link().equals("/chat?group=2")));
        groups.settings(b,2,new ChatGroupsController.Settings(true));
        assertFalse(notifications.inbox(b).stream().anyMatch(n->n.kind().startsWith("TRAVEL_")));
        assertTrue(preferences.locations().get("Ujjain").containsAll(List.of("Nanakheda","D-Mart","Lal Gate")));
        assertTrue(preferences.locations().get("Indore").containsAll(List.of("Aurobindo","Luv Kush","Vijay Nagar")));
        assertThrows(com.hoopr.auth.AuthFailure.class,()->preferences.save(a,new com.hoopr.user.TravelRoutesController.Preferences(List.of(new com.hoopr.user.TravelRoutesController.Route("Indore","Indore",morning)))));
        groups.settings(b,2,new ChatGroupsController.Settings(false));
        preferences.save(b,new com.hoopr.user.TravelRoutesController.Preferences(List.of(new com.hoopr.user.TravelRoutesController.Route("Indore","Ujjain",com.hoopr.user.TravelRoutesController.Period.EVENING))));
        assertFalse(notifications.inbox(b).stream().anyMatch(n->n.kind().equals("TRAVEL_RIDE")));
    }
    @Test void inactiveMembersCannotReadOrSendAndRateLimitIsEnforced() {
        var a=member();
        for(int i=0;i<20;i++)chat.send(a,new ChatController.Send(UUID.randomUUID(),"Message "+i,null));
        assertEquals(429,assertThrows(RideFailure.class,()->chat.send(a,new ChatController.Send(UUID.randomUUID(),"Too many",null))).status);
        jdbc.update("UPDATE users SET status='DISABLED' WHERE id=?",UUID.fromString(a.getSubject()));
        assertEquals(403,assertThrows(RideFailure.class,()->chat.list(a,0)).status);
        assertEquals(403,assertThrows(RideFailure.class,()->chat.send(a,new ChatController.Send(UUID.randomUUID(),"Blocked",null))).status);
    }
}
