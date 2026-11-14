package com.hoopr.push;

import com.hoopr.auth.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/push")
public class PushController {
 public record Device(@NotNull UUID installationId,@NotBlank @Pattern(regexp="(?:Expo|Exponent)PushToken\\[[A-Za-z0-9_-]{10,200}\\]") String token,@Pattern(regexp="android|ios") @NotNull String platform) {}
 private final PushStore store;private final AuthService auth;private final boolean enabled;
 public PushController(PushStore store,AuthService auth,@Value("${hoopr.push.enabled:false}") boolean enabled){this.store=store;this.auth=auth;this.enabled=enabled;}
 @GetMapping("/config") public Map<String,Boolean> config(@AuthenticationPrincipal Jwt jwt){auth.profile(UUID.fromString(jwt.getSubject()));return Map.of("enabled",enabled);}
 @PostMapping("/devices") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
 public void register(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Device body){if(!enabled)throw new AuthFailure(503,"Phone push delivery is awaiting server configuration.");auth.profile(UUID.fromString(jwt.getSubject()));store.register(jwt,body);}
 @PostMapping("/devices/{id}/disable") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
 public void disable(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){auth.profile(UUID.fromString(jwt.getSubject()));store.disable(jwt,id);}
}
