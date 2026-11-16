package com.hoopr.admin;

import com.hoopr.auth.*;
import com.hoopr.database.TestDatabase;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"hoopr.push.enabled=false","hoopr.group.reconcile-enabled=false","hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","hoopr.auth.issuer=hoopr-test","hoopr.auth.origins=http://localhost:5173","hoopr.auth.cookie-secure=true","hoopr.auth.cookie-same-site=Lax","hoopr.auth.refresh-lifetime=30d"})
@AutoConfigureMockMvc @Transactional
class AdminIT {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.datasource.url",()->TestDatabase.required("TEST_DB_URL"));r.add("spring.datasource.username",()->TestDatabase.required("TEST_DB_USERNAME"));r.add("spring.datasource.password",()->TestDatabase.required("TEST_DB_PASSWORD"));}
 @Autowired AdminService admin;@Autowired AuthService auth;@Autowired JwtDecoder decoder;@Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;
 @Autowired com.hoopr.ride.RideService rides;@Autowired com.hoopr.booking.BookingService bookings;
 @Autowired jakarta.persistence.EntityManager entities;
 UUID account(boolean elevated){var u=auth.register(UUID.randomUUID()+"@admin.test","admin-test-password-long","Admin Test User");if(elevated){jdbc.update("UPDATE users SET role='ADMIN' WHERE id=?",u.id());entities.clear();}return u.id();}
 AuthService.Issued session(UUID id){String email=jdbc.queryForObject("SELECT email FROM users WHERE id=?",String.class,id);return auth.login(email,"admin-test-password-long");}
 String token(UUID id){return session(id).access.accessToken();}
 @Test void anonymousAndOrdinaryUsersCannotAccessAnyAdminDataOrMutation() throws Exception {
  UUID user=account(false);String token=token(user);
  for(String path:List.of("overview","users","rides","bookings","audit")){
   mvc.perform(get("/api/v1/admin/"+path)).andExpect(status().isUnauthorized());
   mvc.perform(get("/api/v1/admin/"+path).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
  }
  mvc.perform(post("/api/v1/admin/users/"+user+"/status").header("Authorization","Bearer "+token).contentType("application/json").content("{\"status\":\"DISABLED\",\"expectedStatus\":\"ACTIVE\",\"reason\":\"Test unauthorized change\"}")).andExpect(status().isForbidden());
  assertEquals(403,assertThrows(AuthFailure.class,()->admin.overview(user)).status);
 }
 @Test void adminReadsBoundedListsAndLiteralSearchWithoutSecrets() throws Exception {
  UUID actor=account(true),user=account(false);String email=jdbc.queryForObject("SELECT email FROM users WHERE id=?",String.class,user);
  mvc.perform(get("/api/v1/admin/users").param("q",email).header("Authorization","Bearer "+token(actor))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].email").value(email)).andExpect(jsonPath("$.items[0].passwordHash").doesNotExist()).andExpect(jsonPath("$.pageSize").value(25));
  assertEquals(0,admin.users(actor,"%_",0).total());
  assertThrows(AuthFailure.class,()->admin.users(actor,"",-1));
  assertThrows(AuthFailure.class,()->admin.users(actor,"a".repeat(121),0));
  long beforeUpcoming=admin.overview(actor).upcomingRides();
  UUID driver=account(false);var ride=rides.create(driver,new com.hoopr.ride.RideDtos.Create("Indore","Ujjain",null,null,Instant.now().plusSeconds(86400),"Asia/Kolkata",3,new BigDecimal("100"),"INR",null,null));
  assertEquals(beforeUpcoming+1,admin.overview(actor).upcomingRides());
  bookings.create(ride.id(),user,UUID.randomUUID(),1);
  assertTrue(admin.rides(actor,"Ujjain",0).items().stream().anyMatch(r->r.id().equals(ride.id())));
  assertTrue(admin.bookings(actor,email,0).items().stream().anyMatch(b->b.rideId().equals(ride.id())));
  assertTrue(admin.overview(actor).bookings()>0);
  assertEquals(0,admin.audit(actor,0).items().stream().filter(a->a.actor().equals(email)).count());
 }
 @Test void suspensionRevokesSessionsAndPushButPreservesHistoryAndIsAuditedOnce() {
  UUID actor=account(true),user=account(false);String old=token(user);UUID sid=UUID.fromString(decoder.decode(old).getClaimAsString("sid"));
  jdbc.update("INSERT INTO push_devices(id,user_id,session_id,token,platform) VALUES(?,?,?,?,'android')",UUID.randomUUID(),user,sid,"ExponentPushToken["+UUID.randomUUID().toString().replace("-","")+"]");
  var first=admin.status(actor,user,"DISABLED","ACTIVE","Repeated abusive behavior");assertTrue(first.changed());
  assertThrows(JwtException.class,()->decoder.decode(old));
  assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM push_devices WHERE user_id=? AND enabled",Integer.class,user));
  assertFalse(admin.status(actor,user,"DISABLED","ACTIVE","Repeated abusive behavior").changed());
  assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE target_user_id=?",Integer.class,user));
  assertTrue(admin.status(actor,user,"ACTIVE","DISABLED","Reviewed appeal and reinstated").changed());
  assertThrows(JwtException.class,()->decoder.decode(old));assertDoesNotThrow(()->decoder.decode(token(user)));
  assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE target_user_id=?",Integer.class,user));
 }
 @Test void protectedAdminsAndInvalidOrStaleChangesAreRejected() {
  UUID actor=account(true),otherAdmin=account(true),user=account(false);
  assertEquals(403,assertThrows(AuthFailure.class,()->admin.status(actor,actor,"DISABLED","ACTIVE","Cannot suspend own account")).status);
  assertEquals(403,assertThrows(AuthFailure.class,()->admin.status(actor,otherAdmin,"DISABLED","ACTIVE","Cannot suspend another admin")).status);
  assertEquals(400,assertThrows(AuthFailure.class,()->admin.status(actor,user,"DISABLED","ACTIVE","short")).status);
  assertEquals(409,assertThrows(AuthFailure.class,()->admin.status(actor,user,"DISABLED","DISABLED","Stale version of this account")).status);
  assertEquals(404,assertThrows(AuthFailure.class,()->admin.status(actor,UUID.randomUUID(),"DISABLED","ACTIVE","Unknown account test reason")).status);
 }
 @Test void adminHttpMutationValidatesAndRecordsTheChange() throws Exception {
  UUID actor=account(true),user=account(false);String jwt=token(actor),path="/api/v1/admin/users/"+user+"/status";
  mvc.perform(post(path).header("Authorization","Bearer "+jwt).contentType("application/json").content("{\"status\":\"DISABLED\",\"expectedStatus\":\"ACTIVE\",\"reason\":\"short\"}")).andExpect(status().isBadRequest());
  mvc.perform(post(path).header("Authorization","Bearer "+jwt).contentType("application/json").content("{\"status\":\"DISABLED\",\"expectedStatus\":\"ACTIVE\",\"reason\":\"Confirmed policy violation\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.changed").value(true));
  assertEquals("DISABLED",jdbc.queryForObject("SELECT status FROM users WHERE id=?",String.class,user));
  assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE target_user_id=?",Integer.class,user));
 }
}
