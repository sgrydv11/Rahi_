package com.hoopr.push;
import com.hoopr.auth.*;
import com.hoopr.ride.*;
import com.hoopr.database.TestDatabase;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(properties={"hoopr.push.enabled=false","hoopr.group.reconcile-enabled=false","hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","hoopr.auth.issuer=hoopr-test","hoopr.auth.origins=http://localhost:5173","hoopr.auth.cookie-secure=true","hoopr.auth.cookie-same-site=Lax","hoopr.auth.refresh-lifetime=30d"})
class PushIT {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.datasource.url",()->TestDatabase.required("TEST_DB_URL"));r.add("spring.datasource.username",()->TestDatabase.required("TEST_DB_USERNAME"));r.add("spring.datasource.password",()->TestDatabase.required("TEST_DB_PASSWORD"));}
 @Autowired AuthService auth;@Autowired JwtDecoder decoder;@Autowired JdbcTemplate jdbc;@Autowired PushStore push;@Autowired ChatController chat;@Autowired ChatGroupsController groups;
 List<UUID> users=new ArrayList<>();
 Jwt member(){String email=UUID.randomUUID()+"@push.test";var u=auth.register(email,"push-test-password-long","Push Tester");users.add(u.id());return decoder.decode(auth.login(email,"push-test-password-long").access.accessToken());}
 PushController.Device device(UUID id){return new PushController.Device(id,"ExponentPushToken["+id.toString().replace("-","")+"]","android");}
 ChatController.Message message(Jwt sender,long group){return chat.send(sender,new ChatController.Send(UUID.randomUUID(),"QA notification",null,false,null,group));}
 @AfterEach void cleanup(){for(var u:users){jdbc.update("DELETE FROM chat_messages WHERE sender_id=?",u);jdbc.update("DELETE FROM push_devices WHERE user_id=?",u);jdbc.update("DELETE FROM refresh_tokens WHERE session_id IN(SELECT id FROM refresh_sessions WHERE user_id=?)",u);jdbc.update("DELETE FROM refresh_sessions WHERE user_id=?",u);jdbc.update("DELETE FROM user_profiles WHERE user_id=?",u);jdbc.update("DELETE FROM users WHERE id=?",u);}}
 @Test void registrationBaselinesHistoryAndNewMessagesQueueOnce(){var a=member();var b=member();message(a,2);UUID id=UUID.randomUUID();push.register(b,device(id));groups.groups(b);push.collect();assertTrue(push.claim().isEmpty());message(a,2);push.collect();var batch=push.claim();assertEquals(1,batch.size());assertEquals(1,batch.getFirst().badge());assertTrue(batch.getFirst().data().contains("groupId"));push.collect();assertTrue(push.claim().isEmpty());assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM push_outbox WHERE device_id=?",Integer.class,id));}
 @Test void queuedMessagesRespectMuteReadAndRevokedSession(){var a=member();var b=member();UUID id=UUID.randomUUID();push.register(b,device(id));groups.groups(b);var sent=message(a,3);push.collect();groups.settings(b,3,new ChatGroupsController.Settings(true));assertTrue(push.claim().isEmpty());groups.settings(b,3,new ChatGroupsController.Settings(false));jdbc.update("UPDATE refresh_sessions SET revoked=true WHERE id=?",UUID.fromString(b.getClaimAsString("sid")));assertTrue(push.claim().isEmpty());jdbc.update("UPDATE refresh_sessions SET revoked=false WHERE id=?",UUID.fromString(b.getClaimAsString("sid")));groups.read(b,3,new ChatGroupsController.Read(sent.id()));assertTrue(push.claim().isEmpty());}
 @Test void ownershipTransferClearsOldQueueAndRejectsForeignSessions(){var a=member();var b=member();UUID id=UUID.randomUUID();push.register(b,device(id));groups.groups(b);message(a,4);push.collect();assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM push_outbox WHERE device_id=?",Integer.class,id));push.register(a,device(id));assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM push_outbox WHERE device_id=?",Integer.class,id));var foreign=Jwt.withTokenValue("test").header("alg","HS256").subject(b.getSubject()).claim("sid",a.getClaimAsString("sid")).build();assertThrows(AuthFailure.class,()->push.register(foreign,device(UUID.randomUUID())));}
 @Test void providerRejectionDisablesDeviceAndRetryIsBounded(){var a=member();var b=member();UUID id=UUID.randomUUID();push.register(b,device(id));message(a,2);push.collect();var d=push.claim().getFirst();push.failed(d.id(),"DeviceNotRegistered",true);assertFalse(jdbc.queryForObject("SELECT enabled FROM push_devices WHERE id=?",Boolean.class,id));assertEquals("FAILED",jdbc.queryForObject("SELECT state FROM push_outbox WHERE id=?",String.class,d.id()));}
}
