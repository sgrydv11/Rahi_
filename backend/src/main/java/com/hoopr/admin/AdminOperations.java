package com.hoopr.admin;

import com.hoopr.auth.AuthFailure;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Bounded operational views; credentials and authentication artifacts never leave this service. */
@Service
public class AdminOperations {
 private final JdbcTemplate db;private final AdminAccess access;private final Environment env;
 public AdminOperations(JdbcTemplate db,AdminAccess access,Environment env){this.db=db;this.access=access;this.env=env;}
 public Map<String,Object> access(UUID actor){return Map.of("membership",access.current(actor),"roles",AdminAccess.ROLES);}
 @Transactional(readOnly=true) public List<Map<String,Object>> staff(UUID actor){access.require(actor,"STAFF_MANAGE");return db.queryForList("SELECT u.id,u.email,u.status,m.staff_role FROM admin_memberships m JOIN users u ON u.id=m.user_id ORDER BY u.email");}
 @Transactional public void staffRole(UUID actor,UUID target,String role,String expected,String reason){
  access.require(actor,"STAFF_MANAGE");AdminAccess.reason(reason);
  if(!AdminAccess.ROLES.containsKey(role)&&!"NONE".equals(role))throw new AuthFailure(400,"Select a valid staff role.");
  db.queryForList("SELECT pg_advisory_xact_lock(6173052910)");
  // Recheck after the lock: a concurrent role removal must not retain management rights.
  access.require(actor,"STAFF_MANAGE");
  var users=db.queryForList("SELECT status FROM users WHERE id=? FOR UPDATE",target);
  if(users.isEmpty())throw new AuthFailure(404,"Account not found.");
  if(actor.equals(target))throw new AuthFailure(403,"Ask another owner to change your staff role.");
  if(!"ACTIVE".equals(users.getFirst().get("status")))throw new AuthFailure(409,"Activate the account before assigning staff access.");
  var roles=db.queryForList("SELECT staff_role FROM admin_memberships WHERE user_id=?",String.class,target);
  String before=roles.isEmpty()?"NONE":roles.getFirst();
  if(!before.equals(expected))throw new AuthFailure(409,"Staff role changed. Refresh before continuing.");
  if(before.equals(role))return;
  if(before.equals("OWNER")&&db.queryForObject("SELECT count(*) FROM admin_memberships m JOIN users u ON u.id=m.user_id WHERE m.staff_role='OWNER' AND u.status='ACTIVE' AND u.role='ADMIN'",Long.class)<=1)throw new AuthFailure(409,"Keep at least one active owner.");
  if(role.equals("NONE"))db.update("DELETE FROM admin_memberships WHERE user_id=?",target);
  else db.update("INSERT INTO admin_memberships(user_id,staff_role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET staff_role=excluded.staff_role,updated_at=now()",target,role);
  db.update("UPDATE users SET role=?,updated_at=now() WHERE id=?",role.equals("NONE")?"USER":"ADMIN",target);
  access.revoke(target);access.audit(actor,target,"STAFF_ROLE_CHANGED","USER",target.toString(),before,role,reason);
 }
 @Transactional(readOnly=true) public Map<String,Object> history(UUID actor,UUID target){
  access.require(actor,"USER_HISTORY");var users=db.queryForList("SELECT u.id,u.email,u.status,u.created_at,p.full_name,p.travel_preference FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=?",target);
  if(users.isEmpty())throw new AuthFailure(404,"Account not found.");
  return Map.of("account",users.getFirst(),"rides",db.queryForList("SELECT id,source_name,destination_name,departure_at,status,total_seats,available_seats FROM rides WHERE driver_id=? ORDER BY departure_at DESC LIMIT 25",target),"bookings",db.queryForList("SELECT b.id,b.ride_id,b.status,b.seats_booked,r.source_name,r.destination_name,r.departure_at FROM bookings b JOIN rides r ON r.id=b.ride_id WHERE b.passenger_id=? ORDER BY b.created_at DESC LIMIT 25",target),"vehicles",db.queryForList("SELECT id,make,model,registration_number,active,admin_blocked FROM vehicles WHERE driver_id=? ORDER BY created_at DESC LIMIT 25",target),"activeSessions",db.queryForObject("SELECT count(*) FROM refresh_sessions WHERE user_id=? AND NOT revoked AND expires_at>now()",Long.class,target));
 }
 @Transactional(readOnly=true) public Map<String,Object> analytics(UUID actor,int days){
  access.require(actor,"ANALYTICS_READ");if(!Set.of(7,30,90).contains(days))throw new AuthFailure(400,"Choose 7, 30 or 90 days.");
  String window="now()-(? * interval '1 day')";
  return Map.of("days",days,"daily",db.queryForList("SELECT d.day::date AS day,(SELECT count(*) FROM users WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date=d.day::date) AS accounts,(SELECT count(*) FROM rides WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date=d.day::date) AS rides,(SELECT count(*) FROM bookings WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date=d.day::date) AS bookings FROM generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date-(?-1),(now() AT TIME ZONE 'Asia/Kolkata')::date,interval '1 day') d(day)",days),"routes",db.queryForList("SELECT r.source_name AS origin,r.destination_name AS destination,count(*) AS rides,sum(r.total_seats) AS offered_seats,coalesce(sum(b.seats),0) AS confirmed_seats FROM rides r LEFT JOIN (SELECT ride_id,sum(seats_booked) AS seats FROM bookings WHERE status='CONFIRMED' GROUP BY ride_id)b ON b.ride_id=r.id WHERE r.created_at>"+window+" GROUP BY r.source_name,r.destination_name ORDER BY count(*) DESC LIMIT 50",days),"bookingStatuses",db.queryForList("SELECT status,count(*) AS bookings FROM bookings WHERE created_at>"+window+" GROUP BY status ORDER BY status",days));
 }
 private int offset(int page){if(page<0||page>10000)throw new AuthFailure(400,"Invalid page.");return page*25;}
 @Transactional(readOnly=true) public AdminService.Page<Map<String,Object>> vehicles(UUID actor,int page){access.require(actor,"VEHICLES_READ");return new AdminService.Page<>(db.queryForList("SELECT v.id,u.email,v.make,v.model,v.registration_number,v.passenger_capacity,v.active,v.admin_blocked FROM vehicles v JOIN users u ON u.id=v.driver_id ORDER BY v.created_at DESC,v.id LIMIT 25 OFFSET ?",offset(page)),db.queryForObject("SELECT count(*) FROM vehicles",Long.class),page,25);}
 @Transactional public void vehicle(UUID actor,UUID id,boolean blocked,boolean expected,String reason){
  access.require(actor,"VEHICLE_STATUS");AdminAccess.reason(reason);var rows=db.queryForList("SELECT driver_id,admin_blocked FROM vehicles WHERE id=? FOR UPDATE",id);
  if(rows.isEmpty())throw new AuthFailure(404,"Vehicle not found.");var row=rows.getFirst();boolean before=(Boolean)row.get("admin_blocked");if(before!=expected)throw new AuthFailure(409,"Vehicle changed. Refresh first.");if(before==blocked)return;
  db.update("UPDATE vehicles SET admin_blocked=?,updated_at=now() WHERE id=?",blocked,id);access.audit(actor,(UUID)row.get("driver_id"),"VEHICLE_STATUS_CHANGED","VEHICLE",id.toString(),before?"BLOCKED":"ALLOWED",blocked?"BLOCKED":"ALLOWED",reason);
 }
 @Transactional(readOnly=true) public AdminService.Page<Map<String,Object>> chat(UUID actor,int page){access.require(actor,"CHAT_READ");return new AdminService.Page<>(db.queryForList("SELECT m.id,m.sender_id,u.email,g.name AS group_name,m.body,m.created_at,m.hidden FROM chat_messages m JOIN users u ON u.id=m.sender_id JOIN chat_groups g ON g.id=m.group_id WHERE m.created_at>now()-interval '7 days' ORDER BY m.id DESC LIMIT 25 OFFSET ?",offset(page)),db.queryForObject("SELECT count(*) FROM chat_messages WHERE created_at>now()-interval '7 days'",Long.class),page,25);}
 @Transactional public void chatVisibility(UUID actor,long id,boolean hidden,boolean expected,String reason){
  access.require(actor,"CHAT_MODERATE");AdminAccess.reason(reason);var rows=db.queryForList("SELECT sender_id,hidden FROM chat_messages WHERE id=? AND created_at>now()-interval '7 days' FOR UPDATE",id);
  if(rows.isEmpty())throw new AuthFailure(404,"Recent message not found.");var row=rows.getFirst();boolean before=(Boolean)row.get("hidden");if(before!=expected)throw new AuthFailure(409,"Message changed. Refresh first.");if(before==hidden)return;
  db.update("UPDATE chat_messages SET hidden=?,moderated_at=now() WHERE id=?",hidden,id);
  if(hidden)db.update("UPDATE push_outbox SET state='FAILED',last_error='Moderated' WHERE message_id=? AND state='PENDING'",id);
  access.audit(actor,(UUID)row.get("sender_id"),"CHAT_VISIBILITY_CHANGED","MESSAGE",Long.toString(id),before?"HIDDEN":"VISIBLE",hidden?"HIDDEN":"VISIBLE",reason);
 }
 @Transactional(readOnly=true) public Map<String,Object> finance(UUID actor){access.require(actor,"FINANCE_READ");return Map.of("unit","paise (100 paise = INR 1); provider records, not reconciled revenue","payments",db.queryForList("SELECT provider,currency,count(*) AS orders,coalesce(sum(amount) FILTER(WHERE paid_at IS NOT NULL),0) AS paid_amount_paise,count(*) FILTER(WHERE refund_status='failed') AS failed_refunds FROM booking_payments GROUP BY provider,currency"),"wallets",db.queryForList("SELECT count(*) AS wallets,coalesce(sum(available_paise),0) AS available_paise,coalesce(sum(reserved_paise),0) AS reserved_paise FROM wallets"),"ledger",db.queryForList("SELECT id,user_id,kind,amount_paise,created_at FROM wallet_entries ORDER BY created_at DESC,id LIMIT 25"));}
 @Transactional(readOnly=true) public Map<String,Object> services(UUID actor){
  access.require(actor,"SERVICES_READ");return Map.of("database",db.queryForObject("SELECT 'UP'",String.class),"checkedAt",java.time.Instant.now(),"pushEnabled",env.getProperty("hoopr.push.enabled",Boolean.class,false),"googleConfigured",configured("GOOGLE_CLIENT_ID"),"emailApiConfigured",configured("BREVO_API_KEY")||configured("RESEND_API_KEY"),"paymentProvider",env.getProperty("PAYMENT_PROVIDER","razorpay"),"paymentCredentialsConfigured",configured("STRIPE_SECRET_KEY")||(configured("RAZORPAY_KEY_ID")&&configured("RAZORPAY_KEY_SECRET")),"notificationQueue",db.queryForList("SELECT state,count(*) AS messages FROM push_outbox WHERE created_at>now()-interval '24 hours' GROUP BY state"),"note","Configuration presence is not an external-provider uptime check. Notification counts cover the last 24 hours.");
 }
 private boolean configured(String key){return !env.getProperty(key,"").isBlank();}
}
