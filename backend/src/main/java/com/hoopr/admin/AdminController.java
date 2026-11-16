package com.hoopr.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/admin") @PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final AdminService service;
    public AdminController(AdminService service) {this.service=service;}
    private UUID actor(Jwt jwt) {return UUID.fromString(jwt.getSubject());}
    @GetMapping("/overview") public AdminService.Overview overview(@AuthenticationPrincipal Jwt jwt) {return service.overview(actor(jwt));}
    @GetMapping("/users") public AdminService.Page<AdminService.UserRow> users(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0") int page) {return service.users(actor(jwt),q,page);}
    @GetMapping("/rides") public AdminService.Page<AdminService.RideRow> rides(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0") int page) {return service.rides(actor(jwt),q,page);}
    @GetMapping("/bookings") public AdminService.Page<AdminService.BookingRow> bookings(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0") int page) {return service.bookings(actor(jwt),q,page);}
    @GetMapping("/audit") public AdminService.Page<AdminService.AuditRow> audit(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") int page) {return service.audit(actor(jwt),page);}
    public record Status(@NotNull @Pattern(regexp="ACTIVE|DISABLED") String status,@NotNull @Pattern(regexp="ACTIVE|DISABLED") String expectedStatus,@NotBlank @Size(min=10,max=500) String reason) {}
    @PostMapping("/users/{id}/status") public AdminService.StatusResult status(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Status body) {return service.status(actor(jwt),id,body.status(),body.expectedStatus(),body.reason());}
}
