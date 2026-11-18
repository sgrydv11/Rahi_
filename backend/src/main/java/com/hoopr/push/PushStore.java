package com.hoopr.push;

import com.hoopr.auth.AuthFailure;
import com.hoopr.booking.NotificationController;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PushStore {
 public record Delivery(long id,String token,String title,String body,String data,int badge) {}
 public record Receipt(long id,String receiptId) {}
 private final JdbcTemplate jdbc;private final NotificationController inbox;private final ObjectMapper json;
 public PushStore(JdbcTemplate jdbc,NotificationController inbox,ObjectMapper json){this.jdbc=jdbc;this.inbox=inbox;this.json=json;}
 private static UUID user(Jwt jwt){return UUID.fromString(jwt.getSubject());}
 private static UUID session(Jwt jwt){try{return UUID.fromString(jwt.getClaimAsString("sid"));}catch(Exception e){throw new AuthFailure(401,"Sign in again to register phone notifications.");}}
 @Transactional public void register(Jwt jwt,PushController.Device device){
  UUID uid=user(jwt),sid=session(jwt);jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))","push:"+device.installationId());
  boolean active=Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM refresh_sessions WHERE id=? AND user_id=? AND NOT revoked AND expires_at>now())",Boolean.class,sid,uid));if(!active)throw new AuthFailure(401,"Sign in again to enable notifications.");
  var old=jdbc.queryForList("SELECT user_id,session_id,token FROM push_devices WHERE id=? FOR UPDATE",device.installationId());
  boolean same=!old.isEmpty()&&uid.equals(old.getFirst().get("user_id"))&&sid.equals(old.getFirst().get("session_id"));
  jdbc.update("DELETE FROM push_devices WHERE token=? AND id<>?",device.token(),device.installationId());
  if(!same)jdbc.update("DELETE FROM push_devices WHERE id=?",device.installationId());
  jdbc.update("INSERT INTO push_devices(id,user_id,session_id,token,platform,last_chat_id) VALUES(?,?,?,?,?,coalesce((SELECT max(id) FROM chat_messages),0)) ON CONFLICT(id) DO UPDATE SET token=excluded.token,platform=excluded.platform,enabled=true",device.installationId(),uid,sid,device.token(),device.platform());
  if(!same)for(var n:inbox.inbox(jwt))seen(device.installationId(),n.id());
 }
 @Transactional public void disable(Jwt jwt,UUID id){jdbc.update("UPDATE push_devices SET enabled=false WHERE id=? AND user_id=? AND session_id=?",id,user(jwt),session(jwt));}
 private boolean seen(UUID device,String event){return jdbc.update("INSERT INTO push_seen_events(device_id,event_key) VALUES(?,?) ON CONFLICT DO NOTHING",device,event)==1;}
 private void queue(UUID device,UUID uid,UUID sid,String event,String title,String body,Map<String,Object> data,Long group,Long message){
  if(!seen(device,event))return;
  try{jdbc.update("INSERT INTO push_outbox(device_id,user_id,session_id,event_key,title,body,data,group_id,message_id) VALUES(?,?,?,?,?,?,?::jsonb,?,?) ON CONFLICT DO NOTHING",device,uid,sid,event,title,body,json.writeValueAsString(data),group,message);}catch(JsonProcessingException e){throw new IllegalStateException("Unable to serialize notification",e);}
 }
 @Transactional public void collect(){
  if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT pg_try_advisory_xact_lock(6173052988)",Boolean.class)))return;
  var devices=jdbc.queryForList("SELECT d.* FROM push_devices d JOIN users u ON u.id=d.user_id JOIN refresh_sessions s ON s.id=d.session_id WHERE d.enabled AND u.status='ACTIVE' AND NOT s.revoked AND s.expires_at>now() ORDER BY d.checked_at LIMIT 100 FOR UPDATE OF d SKIP LOCKED");
  for(var d:devices){UUID device=(UUID)d.get("id"),uid=(UUID)d.get("user_id"),sid=(UUID)d.get("session_id");long after=((Number)d.get("last_chat_id")).longValue();
   var messages=jdbc.queryForList("SELECT m.*,g.name,p.full_name,sender_user.mobile_number AS sender_mobile FROM chat_messages m JOIN chat_groups g ON g.id=m.group_id JOIN user_profiles p ON p.user_id=m.sender_id JOIN users sender_user ON sender_user.id=m.sender_id LEFT JOIN chat_group_preferences s ON s.user_id=? AND s.group_id=m.group_id WHERE NOT m.hidden AND m.id>? AND m.sender_id<>? AND m.created_at>now()-interval '7 days' AND s.left_at IS NULL AND NOT coalesce(s.muted,false) AND m.id>coalesce(s.last_read_id,0) ORDER BY m.id LIMIT 100",uid,after,uid);
   for(var m:messages){long group=((Number)m.get("group_id")).longValue(),id=((Number)m.get("id")).longValue();String text=Objects.toString(m.get("sender_mobile"),"Number unavailable")+": "+m.get("body");queue(device,uid,sid,"CHAT:"+id,m.get("name").toString(),text.substring(0,Math.min(300,text.length())),Map.of("link","/chat?group="+group,"groupId",group,"messageId",id),group,id);}
   // Advance in bounded ID batches; do not skip a burst larger than the batch.
   Long cursor=jdbc.queryForObject("SELECT coalesce(max(id),?) FROM (SELECT id FROM chat_messages WHERE id>? ORDER BY id LIMIT 100) batch",Long.class,after,after);
   jdbc.update("UPDATE push_devices SET last_chat_id=?,checked_at=now() WHERE id=?",cursor,device);
   var jwt=Jwt.withTokenValue("push-internal").header("alg","HS256").subject(uid.toString()).build();
   for(var n:inbox.inbox(jwt)){if(n.time().isBefore(((Timestamp)d.get("created_at")).toInstant())&&!"DEPARTURE_REMINDER".equals(n.kind())){seen(device,n.id());continue;}int route=n.kind().startsWith("TRAVEL_")?NotificationController.routeGroup(n.origin(),n.destination()):0;queue(device,uid,sid,n.id(),title(n.kind()),n.origin()+" Ã¢â€ ’ "+n.destination(),Map.of("link",n.link()),route>1?(long)route:null,null);}
  }
  jdbc.update("DELETE FROM push_seen_events WHERE created_at<now()-interval '35 days'");
  jdbc.update("DELETE FROM push_outbox WHERE created_at<now()-interval '7 days'");
 }
 private static String title(String kind){return switch(kind){case "TRAVEL_RIDE"->"Ride on your regular route";case "TRAVEL_BUDDY"->"Travel buddy available";case "RIDE_STARTED"->"Ride started";case "RIDE_COMPLETED"->"Journey completed";case "BOOKING_CONFIRMED"->"Booking confirmed";case "BOOKING_REQUESTED"->"New booking request";case "DEPARTURE_REMINDER"->"Upcoming ride";default->"Ride update";};}
 private static final String ELIGIBLE="""
  d.enabled AND d.user_id=o.user_id AND d.session_id=o.session_id AND u.status='ACTIVE' AND NOT s.revoked AND s.expires_at>now()
  AND (o.message_id IS NULL OR EXISTS(SELECT 1 FROM chat_messages m WHERE m.id=o.message_id AND NOT m.hidden))
  AND (o.group_id IS NULL OR (NOT EXISTS(SELECT 1 FROM chat_group_preferences g WHERE g.user_id=d.user_id AND g.group_id=o.group_id AND (g.left_at IS NOT NULL OR g.muted OR g.last_read_id>=o.message_id))))
  """;
 @Transactional public List<Delivery> claim(){
  return jdbc.query("""
   WITH due AS (SELECT o.id FROM push_outbox o JOIN push_devices d ON d.id=o.device_id JOIN users u ON u.id=d.user_id JOIN refresh_sessions s ON s.id=d.session_id
   WHERE o.state='PENDING' AND o.next_attempt_at<=now() AND o.attempts<6 AND o.created_at>now()-interval '1 day' AND
   """+ELIGIBLE+"""
   ORDER BY o.id LIMIT 50 FOR UPDATE OF o SKIP LOCKED)
   UPDATE push_outbox o SET attempts=attempts+1,next_attempt_at=now()+interval '90 seconds' FROM due,push_devices d
   WHERE o.id=due.id AND d.id=o.device_id RETURNING o.*,d.token,
    (SELECT count(*) FROM chat_messages m LEFT JOIN chat_group_preferences p ON p.user_id=d.user_id AND p.group_id=m.group_id WHERE NOT m.hidden AND m.sender_id<>d.user_id AND m.id>coalesce(p.last_read_id,0) AND p.left_at IS NULL AND NOT coalesce(p.muted,false) AND m.created_at>now()-interval '7 days') badge
   """,(r,n)->new Delivery(r.getLong("id"),r.getString("token"),r.getString("title"),r.getString("body"),r.getString("data"),r.getInt("badge")));
 }
 public void retryClaim(long id){jdbc.update("UPDATE push_outbox SET state=CASE WHEN attempts>=6 THEN 'FAILED' ELSE 'PENDING' END,last_error='TransportFailure',next_attempt_at=now()+interval '5 minutes' WHERE id=? AND state='PENDING'",id);}
 public void accepted(long id,String receipt){jdbc.update("UPDATE push_outbox SET state='ACCEPTED',receipt_id=?,accepted_at=now() WHERE id=?",receipt,id);}
 public void failed(long id,String error,boolean terminal){jdbc.update("UPDATE push_outbox SET state=CASE WHEN ? OR attempts>=6 THEN 'FAILED' ELSE 'PENDING' END,last_error=?,next_attempt_at=now()+interval '5 minutes' WHERE id=?",terminal,error,id);if("DeviceNotRegistered".equals(error))jdbc.update("UPDATE push_devices SET enabled=false WHERE id=(SELECT device_id FROM push_outbox WHERE id=?)",id);}
 public List<Receipt> receipts(){jdbc.update("UPDATE push_outbox SET state='FAILED',last_error='ReceiptExpired' WHERE state='ACCEPTED' AND accepted_at<now()-interval '1 day'");return jdbc.query("SELECT id,receipt_id FROM push_outbox WHERE state='ACCEPTED' AND accepted_at<now()-interval '15 minutes' ORDER BY id LIMIT 100",(r,n)->new Receipt(r.getLong("id"),r.getString("receipt_id")));}
 public void received(long id){jdbc.update("UPDATE push_outbox SET state='RECEIVED' WHERE id=?",id);}
}
