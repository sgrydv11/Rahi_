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
    @Test void onlyOwnersShareUpcomingRidesAndAvailabilityUpdatesLive() {
        var a=member();var b=member();
        var ride=rides.create(UUID.fromString(a.getSubject()),new RideDtos.Create("Indore","Ujjain",null,null,
            Instant.now().plusSeconds(86400),"Asia/Kolkata",3,new BigDecimal("100"),"INR","Test car",null,null));
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(b,new ChatController.Send(UUID.randomUUID(),"Fake offer",ride.id()))).status);
        var sent=chat.send(a,new ChatController.Send(UUID.randomUUID(),"Three seats tomorrow",ride.id()));
        assertEquals(3,sent.ride().availableSeats());
        jdbc.update("UPDATE rides SET available_seats=1 WHERE id=?",ride.id());
        var updated=chat.list(b,0).content().stream().filter(m->m.id()==sent.id()).findFirst().orElseThrow();
        assertEquals(1,updated.ride().availableSeats());
        jdbc.update("UPDATE rides SET departure_at=now()-interval '1 hour' WHERE id=?",ride.id());
        assertEquals(400,assertThrows(RideFailure.class,()->chat.send(a,new ChatController.Send(UUID.randomUUID(),"Old ride",ride.id()))).status);
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
