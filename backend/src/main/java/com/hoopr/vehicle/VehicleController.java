package com.hoopr.vehicle;

import com.hoopr.auth.AuthService;
import com.hoopr.ride.RideFailure;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vehicles")
public class VehicleController {
    private static final RowMapper<Vehicle> VEHICLE = (row, index) -> new Vehicle(
            row.getObject("id", UUID.class), row.getString("make"), row.getString("model"),
            row.getString("color"), row.getString("registration_number"),
            row.getInt("passenger_capacity"), row.getBoolean("active"));
    private final JdbcTemplate jdbc;
    private final AuthService auth;

    public VehicleController(NamedParameterJdbcTemplate jdbc, AuthService auth) {
        this.jdbc = jdbc.getJdbcTemplate();
        this.auth = auth;
    }

    @GetMapping
    public List<Vehicle> list(@AuthenticationPrincipal Jwt jwt) {
        return jdbc.query("SELECT * FROM vehicles WHERE driver_id = ? ORDER BY active DESC, created_at, id",
                VEHICLE, owner(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Vehicle create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Input body) {
        UUID owner = owner(jwt);
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO driver_profiles(user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING", owner);
        return jdbc.queryForObject("""
                INSERT INTO vehicles(id, driver_id, make, model, color, registration_number, passenger_capacity, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
                """, VEHICLE, id, owner, body.make().strip(), body.model().strip(), color(body),
                body.registrationNumber().strip(), body.passengerCapacity(), body.active());
    }

    @PatchMapping("/{id}")
    @Transactional
    public Vehicle update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody Input body) {
        UUID owner = owner(jwt);
        if (jdbc.query("SELECT * FROM vehicles WHERE id = ? AND driver_id = ? FOR UPDATE", VEHICLE, id, owner).isEmpty())
            throw new RideFailure(404, "Vehicle not found.");
        Boolean conflict = jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM rides WHERE vehicle_id = ?
                  AND status IN ('SCHEDULED', 'PUBLISHED', 'IN_PROGRESS') AND total_seats > ?)
                """, Boolean.class, id, body.passengerCapacity());
        if (Boolean.TRUE.equals(conflict))
            throw new RideFailure(409, "Capacity cannot be reduced below the seats on a linked ride.");
        return jdbc.queryForObject("""
                UPDATE vehicles SET make = ?, model = ?, color = ?, registration_number = ?,
                    passenger_capacity = ?, active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND driver_id = ? RETURNING *
                """, VEHICLE, body.make().strip(), body.model().strip(), color(body),
                body.registrationNumber().strip(), body.passengerCapacity(), body.active(), id, owner);
    }

    private UUID owner(Jwt jwt) { return auth.profile(UUID.fromString(jwt.getSubject())).id(); }
    private static String color(Input body) { return body.color() == null ? null : body.color().strip(); }

    public record Input(@NotBlank @Size(max = 80) String make, @NotBlank @Size(max = 80) String model,
                        @Size(max = 40) String color, @NotBlank @Size(max = 32) String registrationNumber,
                        @NotNull @Min(1) @Max(6) Integer passengerCapacity, @NotNull Boolean active) { }
    public record Vehicle(UUID id, String make, String model, String color, String registrationNumber,
                          int passengerCapacity, boolean active) { }
}
