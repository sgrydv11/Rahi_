package com.hoopr.vehicle;
import com.hoopr.auth.AuthService;
import com.hoopr.database.TestDatabase;
import com.hoopr.ride.*;
import com.hoopr.booking.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
@SpringBootTest(properties={"hoopr.driver-verification.required=true","hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","hoopr.auth.origins=http://localhost:5173","hoopr.push.enabled=false","hoopr.group.reconcile-enabled=false"})
@AutoConfigureMockMvc @Transactional
class DriverVerificationIT {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.datasource.url",()->TestDatabase.required("TEST_DB_URL"));r.add("spring.datasource.username",()->TestDatabase.required("TEST_DB_USERNAME"));r.add("spring.datasource.password",()->TestDatabase.required("TEST_DB_PASSWORD"));}
 @Autowired DriverVerificationService verification;@Autowired VehicleController vehicles;@Autowired AuthService auth;@Autowired JdbcTemplate db;@Autowired RideService rides;@Autowired BookingService bookings;@Autowired MockMvc mvc;
 UUID driver,admin,passenger,vehicle;
 final String png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=";
 Jwt identity(UUID id){return Jwt.withTokenValue("test").header("alg","HS256").subject(id.toString()).build();}
 UUID account(){return auth.register(UUID.randomUUID()+"@verification.test","verification-test-password-long","QA Driver").id();}
 @BeforeEach void setup(){driver=account();admin=account();passenger=account();db.update("UPDATE users SET role='ADMIN' WHERE id=?",admin);db.update("INSERT INTO admin_memberships(user_id,staff_role) VALUES(?,'OPERATIONS')",admin);vehicle=vehicles.create(identity(driver),new VehicleController.Input("QA","Car","Blue","QA-TEST-ONLY",4,true)).id();}
 DriverVerificationService.Input input(){return new DriverVerificationService.Input("QA-LICENCE-ONLY",LocalDate.now().plusYears(1),"QA-INSURANCE-ONLY",LocalDate.now().plusYears(1));}
 void submitted(){verification.save(driver,vehicle,input());for(String kind:List.of("LICENCE","RC","INSURANCE"))verification.upload(driver,vehicle,kind,png);verification.submit(driver,vehicle);}
 RideDtos.Create offer(UUID id){return new RideDtos.Create("Indore","Ujjain","Vijay Nagar","Nanakheda",Instant.now().plusSeconds(86400),"Asia/Kolkata",3,new BigDecimal("120"),"INR",null,null,id,new RidePreferences(List.of("Vijay Nagar"),List.of("Nanakheda"),true,false,false,false,RidePreferences.RouteType.HOME_TO_OFFICE,false));}
 @Test void unverifiedIncompleteAndExpiredApplicationsCannotOffer(){assertThrows(RideFailure.class,()->rides.create(driver,offer(null)));assertThrows(RideFailure.class,()->rides.create(driver,offer(vehicle)));verification.save(driver,vehicle,input());assertThrows(RideFailure.class,()->verification.submit(driver,vehicle));assertThrows(RideFailure.class,()->verification.save(driver,vehicle,new DriverVerificationService.Input("QA-LICENCE",LocalDate.now().minusDays(1),"QA-POLICY",LocalDate.now().plusYears(1))));}
 @Test void approvedDriverCanOfferAndPassengerCanBookOneSeat(){submitted();var v=verification.mine(driver,vehicle);verification.review(admin,vehicle,"APPROVED",v.revision(),"Checked all three QA document fixtures");var ride=rides.create(driver,offer(vehicle));var detail=new BookingDtos.JourneyDetails("Vijay Nagar","Nanakheda",List.of(new BookingDtos.Passenger("QA Passenger",28,BookingDtos.Gender.MALE)));var booking=bookings.create(ride.id(),passenger,UUID.randomUUID(),1,ride.version(),detail);assertEquals("CONFIRMED",booking.booking().status());assertEquals(2,rides.details(ride.id(),passenger).availableSeats());}
 @Test void documentsArePrivateAndAuditAccessIsScoped()throws Exception{submitted();mvc.perform(get("/api/v1/vehicles/"+vehicle+"/verification/documents/RC")).andExpect(status().isUnauthorized());mvc.perform(get("/api/v1/vehicles/"+vehicle+"/verification/documents/RC").with(jwt().jwt(j->j.subject(passenger.toString())).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER")))).andExpect(status().isNotFound());mvc.perform(get("/api/v1/admin/driver-verifications/"+vehicle+"/documents/RC/content").with(jwt().jwt(j->j.subject(passenger.toString())).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER")))).andExpect(status().isForbidden());assertArrayEquals(Base64.getDecoder().decode(png),verification.document(admin,vehicle,"RC",true).content());assertEquals(1,db.queryForObject("SELECT count(*) FROM admin_audit_events WHERE actor_user_id=? AND action='DOCUMENT_VIEW'",Integer.class,admin));}
 @Test void invalidFilesAndStaleOrSelfReviewsAreRejected(){assertThrows(RideFailure.class,()->verification.upload(driver,vehicle,"RC",Base64.getEncoder().encodeToString("<html>unsafe</html>".getBytes())));assertThrows(RideFailure.class,()->verification.upload(driver,vehicle,"RC","!invalid!"));assertThrows(RideFailure.class,()->verification.upload(driver,vehicle,"RC",Base64.getEncoder().encodeToString(new byte[2097153])));submitted();var v=verification.mine(driver,vehicle);assertThrows(RideFailure.class,()->verification.review(admin,vehicle,"APPROVED",v.revision()-1,"Checked QA documents for stale case"));db.update("UPDATE users SET role='ADMIN' WHERE id=?",driver);db.update("INSERT INTO admin_memberships(user_id,staff_role) VALUES(?,'OWNER')",driver);assertThrows(RideFailure.class,()->verification.review(driver,vehicle,"APPROVED",v.revision(),"Attempted to review my own documents"));}
 @Test void changesAndExpiryInvalidateApproval(){submitted();var v=verification.mine(driver,vehicle);verification.review(admin,vehicle,"APPROVED",v.revision(),"Checked QA documents for expiry case");verification.requireApproved(driver,vehicle);db.update("UPDATE driver_vehicle_verifications SET insurance_expiry=current_date-1 WHERE vehicle_id=?",vehicle);assertThrows(RideFailure.class,()->verification.requireApproved(driver,vehicle));verification.save(driver,vehicle,input());verification.submit(driver,vehicle);verification.review(admin,vehicle,"APPROVED",verification.mine(driver,vehicle).revision(),"Checked corrected QA expiry details");vehicles.update(identity(driver),vehicle,new VehicleController.Input("QA","Changed Car","Blue","QA-TEST-ONLY",4,true));assertEquals("DRAFT",verification.mine(driver,vehicle).status());assertThrows(RideFailure.class,()->verification.requireApproved(driver,vehicle));}
 @Test void ownerHttpUploadIsProtectedAndPrivate()throws Exception {
  String path="/api/v1/vehicles/"+vehicle+"/verification/documents/RC";
  mvc.perform(put(path).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content("{\"content\":\""+png+"\"}")).andExpect(status().isUnauthorized());
  mvc.perform(put(path).with(jwt().jwt(j->j.subject(driver.toString())).authorities(()->"ROLE_USER")).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content("{\"content\":\""+png+"\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.documents[0]").value("RC")).andExpect(jsonPath("$.content").doesNotExist());
  mvc.perform(get(path).with(jwt().jwt(j->j.subject(driver.toString())).authorities(()->"ROLE_USER"))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(header().string("X-Content-Type-Options","nosniff")).andExpect(header().string("Content-Disposition",org.hamcrest.Matchers.startsWith("attachment")));
  mvc.perform(options(path).header("Origin","http://localhost:5173").header("Access-Control-Request-Method","PUT")).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Methods",org.hamcrest.Matchers.containsString("PUT")));
 }

}
