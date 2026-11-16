package com.hoopr.admin;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/admin") @PreAuthorize("hasRole('ADMIN')")
public class AdminOperationsController {
 private final AdminOperations service;
 public AdminOperationsController(AdminOperations service){this.service=service;}
 private UUID actor(Jwt jwt){return UUID.fromString(jwt.getSubject());}
 @GetMapping("/access") public Object access(@AuthenticationPrincipal Jwt jwt){return service.access(actor(jwt));}
 @GetMapping("/staff") public Object staff(@AuthenticationPrincipal Jwt jwt){return service.staff(actor(jwt));}
 public record Role(@NotBlank String role,@NotBlank String expectedRole,@NotBlank @Size(min=10,max=500) String reason){}
 @PostMapping("/staff/{id}") public void role(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Role body){service.staffRole(actor(jwt),id,body.role(),body.expectedRole(),body.reason());}
 @GetMapping("/users/{id}/history") public Object history(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.history(actor(jwt),id);}
 @GetMapping("/analytics") public Object analytics(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="30") int days){return service.analytics(actor(jwt),days);}
 @GetMapping("/vehicles") public Object vehicles(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") int page){return service.vehicles(actor(jwt),page);}
 public record Flag(@NotNull Boolean value,@NotNull Boolean expected,@NotBlank @Size(min=10,max=500) String reason){}
 @PostMapping("/vehicles/{id}/status") public void vehicle(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Flag body){service.vehicle(actor(jwt),id,body.value(),body.expected(),body.reason());}
 @GetMapping("/chat") public Object chat(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") int page){return service.chat(actor(jwt),page);}
 @PostMapping("/chat/{id}/visibility") public void chat(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody Flag body){service.chatVisibility(actor(jwt),id,body.value(),body.expected(),body.reason());}
 @GetMapping("/finance") public Object finance(@AuthenticationPrincipal Jwt jwt){return service.finance(actor(jwt));}
 @GetMapping("/services") public Object services(@AuthenticationPrincipal Jwt jwt){return service.services(actor(jwt));}
}
