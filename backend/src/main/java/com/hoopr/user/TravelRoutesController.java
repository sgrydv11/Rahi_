package com.hoopr.user;

import com.hoopr.auth.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
public class TravelRoutesController {
    public enum Period { MORNING, AFTERNOON, EVENING, NIGHT }
    public record Route(@NotBlank @Size(max=80) String origin,@NotBlank @Size(max=80) String destination,@NotNull Period period) { }
    public record Preferences(@NotNull @Size(max=6) List<@NotNull @Valid Route> routes) { }
    private final JdbcTemplate jdbc; private final AuthService auth;
    public TravelRoutesController(JdbcTemplate jdbc,AuthService auth){this.jdbc=jdbc;this.auth=auth;}
    public static String city(String value) {
        if(value==null)throw new AuthFailure(400,"Select a city.");
        return switch(value.strip().toLowerCase(Locale.ROOT)) {
            case "indore" -> "Indore"; case "ujjain" -> "Ujjain"; case "dewas" -> "Dewas";
            case "pithampur","pethampur","petampur","pitampur" -> "Pithampur";
            default -> throw new AuthFailure(400,"Choose Indore, Ujjain, Dewas or Pithampur.");
        };
    }
    public static List<Route> normalize(List<Route> routes) {
        if(routes==null)return List.of();
        if(routes.size()>6)throw new AuthFailure(400,"Save at most six regular routes.");
        var result=new LinkedHashSet<Route>();
        for(var r:routes){if(r==null || r.period()==null)throw new AuthFailure(400,"Select a travel time period.");
            var normalized=new Route(city(r.origin()),city(r.destination()),r.period());
            if(normalized.origin().equals(normalized.destination()))throw new AuthFailure(400,"Choose different route cities.");result.add(normalized);}
        return List.copyOf(result);
    }
    @GetMapping("/api/v1/locations")
    public Map<String,List<String>> locations(){
        var result=new LinkedHashMap<String,List<String>>();
        jdbc.query("SELECT city,name FROM city_points ORDER BY city,name",(org.springframework.jdbc.core.RowCallbackHandler)rs->result.computeIfAbsent(rs.getString("city"),k->new ArrayList<>()).add(rs.getString("name")));return result;
    }
    @GetMapping("/api/v1/travel-preferences")
    public List<Route> get(@AuthenticationPrincipal Jwt jwt){return load(auth.profile(UUID.fromString(jwt.getSubject())).id());}
    public List<Route> load(UUID user){return jdbc.query("SELECT * FROM user_travel_routes WHERE user_id=? ORDER BY origin,destination,time_period",(r,n)->new Route(r.getString("origin"),r.getString("destination"),Period.valueOf(r.getString("time_period"))),user);}
    @PostMapping("/api/v1/travel-preferences") @Transactional
    public List<Route> save(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Preferences body){
        UUID id=auth.profile(UUID.fromString(jwt.getSubject())).id(); var routes=normalize(body.routes());
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))","travel:"+id);
        jdbc.update("DELETE FROM user_travel_routes WHERE user_id=?",id);
        for(var r:routes)jdbc.update("INSERT INTO user_travel_routes(user_id,origin,destination,time_period) VALUES(?,?,?,?)",id,r.origin(),r.destination(),r.period().name());return routes;
    }
}
