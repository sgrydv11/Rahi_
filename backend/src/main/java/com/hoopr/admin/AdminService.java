package com.hoopr.admin;

import com.hoopr.auth.AuthFailure;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {
    private final JdbcTemplate jdbc;
    public AdminService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Page<T>(List<T> items,long total,int page,int pageSize) {}
    public record Overview(long users,long activeUsers,long upcomingRides,long bookings,long pendingBookings,long failedNotifications) {}
    public record UserRow(UUID id,String email,String fullName,String role,String status,String travelPreference,Instant createdAt) {}
    public record RideRow(UUID id,String driverName,String origin,String destination,Instant departureAt,String status,int availableSeats,int totalSeats,BigDecimal pricePerSeat,String currency) {}
    public record BookingRow(UUID id,UUID rideId,String passengerName,String email,String origin,String destination,Instant departureAt,String status,int seats,BigDecimal total,String currency) {}
    public record AuditRow(long id,String actor,String target,String previousStatus,String newStatus,String reason,Instant createdAt) {}
    public record StatusResult(boolean changed,String status) {}
    private void requireAdmin(UUID actor) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM users WHERE id=? AND role='ADMIN' AND status='ACTIVE')",Boolean.class,actor)))
            throw new AuthFailure(403,"Administrator access is required.");
    }
    private static String term(String value) {
        if(value==null)return "%";
        if(value.length()>120)throw new AuthFailure(400,"Search must be at most 120 characters.");
        return "%"+value.strip().replace("!","!!").replace("%","!%").replace("_","!_")+"%";
    }
    private static int offset(int page) {
        if(page<0||page>10000)throw new AuthFailure(400,"Page must be between 0 and 10000.");
        return page*25;
    }
    @Transactional(readOnly=true) public Overview overview(UUID actor) {
        requireAdmin(actor);
        return jdbc.queryForObject("""
            SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM users WHERE status='ACTIVE'),
              (SELECT count(*) FROM rides WHERE status IN ('SCHEDULED','PUBLISHED') AND departure_at>now()),
              (SELECT count(*) FROM bookings), (SELECT count(*) FROM bookings WHERE status='PENDING'),
              (SELECT count(*) FROM push_outbox WHERE state='FAILED' AND created_at>now()-interval '24 hours')
            """,(r,n)->new Overview(r.getLong(1),r.getLong(2),r.getLong(3),r.getLong(4),r.getLong(5),r.getLong(6)));
    }
    @Transactional(readOnly=true) public Page<UserRow> users(UUID actor,String query,int page) {
        requireAdmin(actor);int offset=offset(page);String q=term(query);
        String where=" FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE (u.email ILIKE ? ESCAPE '!' OR p.full_name ILIKE ? ESCAPE '!')";
        long total=jdbc.queryForObject("SELECT count(*)"+where,Long.class,q,q);
        var rows=jdbc.query("SELECT u.id,u.email,p.full_name,u.role,u.status,p.travel_preference,u.created_at"+where+" ORDER BY u.created_at DESC,u.id LIMIT 25 OFFSET ?",
            (r,n)->new UserRow(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getTimestamp(7).toInstant()),q,q,offset);
        return new Page<>(rows,total,page,25);
    }
    @Transactional(readOnly=true) public Page<RideRow> rides(UUID actor,String query,int page) {
        requireAdmin(actor);int offset=offset(page);String q=term(query);
        String where=" FROM rides r JOIN user_profiles p ON p.user_id=r.driver_id WHERE (r.source_name ILIKE ? ESCAPE '!' OR r.destination_name ILIKE ? ESCAPE '!' OR p.full_name ILIKE ? ESCAPE '!')";
        long total=jdbc.queryForObject("SELECT count(*)"+where,Long.class,q,q,q);
        var rows=jdbc.query("SELECT r.id,p.full_name,r.source_name,r.destination_name,r.departure_at,r.status,r.available_seats,r.total_seats,r.price_per_seat,r.currency"+where+" ORDER BY r.departure_at DESC,r.id LIMIT 25 OFFSET ?",
            (r,n)->new RideRow(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getString(4),r.getTimestamp(5).toInstant(),r.getString(6),r.getInt(7),r.getInt(8),r.getBigDecimal(9),r.getString(10)),q,q,q,offset);
        return new Page<>(rows,total,page,25);
    }
    @Transactional(readOnly=true) public Page<BookingRow> bookings(UUID actor,String query,int page) {
        requireAdmin(actor);int offset=offset(page);String q=term(query);
        String where=" FROM bookings b JOIN rides r ON r.id=b.ride_id JOIN users u ON u.id=b.passenger_id JOIN user_profiles p ON p.user_id=u.id WHERE (u.email ILIKE ? ESCAPE '!' OR r.source_name ILIKE ? ESCAPE '!' OR r.destination_name ILIKE ? ESCAPE '!')";
        long total=jdbc.queryForObject("SELECT count(*)"+where,Long.class,q,q,q);
        var rows=jdbc.query("SELECT b.id,b.ride_id,p.full_name,u.email,r.source_name,r.destination_name,r.departure_at,b.status,b.seats_booked,b.price_per_seat_snapshot*b.seats_booked,b.currency"+where+" ORDER BY b.created_at DESC,b.id LIMIT 25 OFFSET ?",
            (r,n)->new BookingRow(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getTimestamp(7).toInstant(),r.getString(8),r.getInt(9),r.getBigDecimal(10),r.getString(11)),q,q,q,offset);
        return new Page<>(rows,total,page,25);
    }
    @Transactional(readOnly=true) public Page<AuditRow> audit(UUID actor,int page) {
        requireAdmin(actor);int offset=offset(page);
        var rows=jdbc.query("""
            SELECT a.id,u.email,t.email,a.previous_status,a.new_status,a.reason,a.created_at
            FROM admin_audit_events a JOIN users u ON u.id=a.actor_user_id JOIN users t ON t.id=a.target_user_id
            ORDER BY a.id DESC LIMIT 25 OFFSET ?
            """,(r,n)->new AuditRow(r.getLong(1),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getTimestamp(7).toInstant()),offset);
        return new Page<>(rows,jdbc.queryForObject("SELECT count(*) FROM admin_audit_events",Long.class),page,25);
    }
    @Transactional public StatusResult status(UUID actor,UUID target,String status,String expectedStatus,String reason) {
        requireAdmin(actor);
        if(status==null||expectedStatus==null||!Set.of("ACTIVE","DISABLED").contains(status)||!Set.of("ACTIVE","DISABLED").contains(expectedStatus)||reason==null||reason.strip().length()<10||reason.strip().length()>500)
            throw new AuthFailure(400,"Select a valid status and give a reason of 10–500 characters.");
        var rows=jdbc.queryForList("SELECT role,status FROM users WHERE id=? FOR UPDATE",target);
        if(rows.isEmpty())throw new AuthFailure(404,"Account not found.");
        var user=rows.getFirst();
        if(actor.equals(target)||"ADMIN".equals(user.get("role")))throw new AuthFailure(403,"Administrator accounts cannot be changed here.");
        String before=user.get("status").toString();
        if(before.equals(status))return new StatusResult(false,status);
        if(!before.equals(expectedStatus))throw new AuthFailure(409,"Account changed. Refresh and review its current status.");
        jdbc.update("UPDATE users SET status=?,updated_at=now() WHERE id=?",status,target);
        if("DISABLED".equals(status)) {
            jdbc.update("UPDATE refresh_sessions SET revoked=true WHERE user_id=? AND NOT revoked",target);
            jdbc.update("UPDATE push_devices SET enabled=false WHERE user_id=?",target);
        }
        jdbc.update("INSERT INTO admin_audit_events(actor_user_id,target_user_id,action,previous_status,new_status,reason) VALUES(?,?,'USER_STATUS_CHANGED',?,?,?)",actor,target,before,status,reason.strip());
        return new StatusResult(true,status);
    }
}
