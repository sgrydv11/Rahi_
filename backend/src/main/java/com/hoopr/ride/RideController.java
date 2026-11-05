package com.hoopr.ride;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import static com.hoopr.ride.RideDtos.*;

@RestController @RequestMapping("/api/v1/rides")
public class RideController {
    private final RideService rides;
    public RideController(RideService rides) { this.rides = rides; }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public View create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Create body) { return rides.create(user(jwt), body); }
    @GetMapping public Results search(
            @RequestParam(required = false) @Size(max = 200) String origin,
            @RequestParam(required = false) @Size(max = 200) String destination,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate departureDate,
            @RequestParam(defaultValue = "UTC") @Size(max = 64) String timeZone,
            @RequestParam(defaultValue = "1") @Min(1) @Max(6) int minimumSeats,
            @RequestParam(required = false) @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal maximumPrice,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return rides.search(origin, destination, departureDate, timeZone, minimumSeats, maximumPrice, page, size);
    }
    @GetMapping("/me") public Results mine(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) { return rides.mine(user(jwt), page, size); }
    @GetMapping("/{id}") public View details(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return rides.details(id, user(jwt)); }
    @PatchMapping("/{id}") public View update(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Update body) {
        return rides.update(id, user(jwt), body);
    }
    @PatchMapping("/{id}/route")
    public View route(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RouteChange body) {
        return rides.updateRoute(id, user(jwt), body);
    }
    @PostMapping("/{id}/cancel") public View cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Cancel body) {
        return rides.cancel(id, user(jwt), body);
    }
    private static UUID user(Jwt jwt) { return jwt == null ? null : UUID.fromString(jwt.getSubject()); }
    @PostMapping("/{id}/start")
    public View start(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Transition body) {
        return rides.start(id, user(jwt), body.version());
    }
    @PostMapping("/{id}/complete")
    public View complete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Transition body) {
        return rides.complete(id, user(jwt), body.version());
    }
}
