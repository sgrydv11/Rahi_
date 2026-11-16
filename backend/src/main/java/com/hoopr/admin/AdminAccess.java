package com.hoopr.admin;

import com.hoopr.auth.AuthFailure;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Staff scope is read from PostgreSQL on every operation, never trusted from a browser. */
@Service
public class AdminAccess {
 public static final Map<String,Set<String>> ROLES=Map.of(
  "OWNER",Set.of("OVERVIEW","USERS_READ","USER_HISTORY","USER_STATUS","RIDES_READ","BOOKINGS_READ","VEHICLES_READ","VEHICLE_STATUS","CHAT_READ","CHAT_MODERATE","FINANCE_READ","ANALYTICS_READ","SERVICES_READ","AUDIT_READ","STAFF_MANAGE"),
  "OPERATIONS",Set.of("OVERVIEW","USERS_READ","USER_HISTORY","USER_STATUS","RIDES_READ","BOOKINGS_READ","VEHICLES_READ","VEHICLE_STATUS","ANALYTICS_READ","SERVICES_READ","AUDIT_READ"),
  "SUPPORT",Set.of("OVERVIEW","USERS_READ","USER_HISTORY","RIDES_READ","BOOKINGS_READ"),
  "MODERATOR",Set.of("OVERVIEW","USERS_READ","CHAT_READ","CHAT_MODERATE"),
  "FINANCE",Set.of("OVERVIEW","FINANCE_READ","BOOKINGS_READ","ANALYTICS_READ"),
  "ANALYST",Set.of("OVERVIEW","ANALYTICS_READ"),
  "AUDITOR",Set.of("OVERVIEW","AUDIT_READ","SERVICES_READ")
 );
 public record Access(String staffRole,Set<String> permissions) {}
 private final JdbcTemplate jdbc;
 public AdminAccess(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public Access current(UUID actor){
  var roles=jdbc.queryForList("SELECT m.staff_role FROM admin_memberships m JOIN users u ON u.id=m.user_id WHERE u.id=? AND u.role='ADMIN' AND u.status='ACTIVE'",String.class,actor);
  if(roles.isEmpty())throw new AuthFailure(403,"An active staff membership is required.");
  String role=roles.getFirst();return new Access(role,ROLES.getOrDefault(role,Set.of()));
 }
 public void require(UUID actor,String permission){if(!current(actor).permissions().contains(permission))throw new AuthFailure(403,"Your staff role does not permit this action.");}
 public static void reason(String reason){if(reason==null||reason.strip().length()<10||reason.strip().length()>500)throw new AuthFailure(400,"Give a reason of 10–500 characters.");}
 public void audit(UUID actor,UUID target,String action,String type,String id,String before,String after,String reason){
  jdbc.update("INSERT INTO admin_audit_events(actor_user_id,target_user_id,action,entity_type,entity_id,previous_status,new_status,reason) VALUES(?,?,?,?,?,?,?,?)",actor,target,action,type,id,before,after,reason.strip());
 }
 public void revoke(UUID target){jdbc.update("UPDATE refresh_sessions SET revoked=true WHERE user_id=? AND NOT revoked",target);jdbc.update("UPDATE push_devices SET enabled=false WHERE user_id=?",target);}
}
