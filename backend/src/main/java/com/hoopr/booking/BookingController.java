package com.hoopr.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import static com.hoopr.booking.BookingDtos.*;

@RestController @RequestMapping("/api/v1")
public class BookingController {
    private final BookingService bookings;
    public BookingController(BookingService bookings) { this.bookings = bookings; }
    @PostMapping("/rides/{rideId}/bookings")
    public ResponseEntity<View> create(@PathVariable UUID rideId, @AuthenticationPrincipal Jwt jwt,
            @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody Create body) {
        Created created = bookings.create(rideId, user(jwt), key, body.seats(), body.rideVersion());
        return ResponseEntity.status(created.replayed() ? HttpStatus.OK : HttpStatus.CREATED)
                .header("Cache-Control", "no-store").body(created.booking());
    }
    @GetMapping("/bookings/me")
    public Results mine(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) { return bookings.mine(user(jwt), page, size); }
    @GetMapping("/bookings/{id}") public View details(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return bookings.details(id, user(jwt)); }
    @PostMapping("/bookings/{id}/cancel")
    public View cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Cancel body) {
        return bookings.cancel(id, user(jwt), body.reason());
    }
    @GetMapping("/rides/{rideId}/bookings")
    public Results manifest(@PathVariable UUID rideId, @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) { return bookings.manifest(rideId, user(jwt), page, size); }
    private static UUID user(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
