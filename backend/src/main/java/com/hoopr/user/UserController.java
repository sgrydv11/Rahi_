package com.hoopr.user;
import com.hoopr.auth.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController
public class UserController {
    private final AuthService auth;
    public UserController(AuthService auth) { this.auth = auth; }
    @GetMapping("/api/v1/users/me")
    public AuthService.Profile me(@AuthenticationPrincipal Jwt jwt) {
        return auth.profile(UUID.fromString(jwt.getSubject()));
    }
    @PatchMapping("/api/v1/users/me")
    public AuthService.Profile update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody EditProfile body) {
        return auth.updateProfile(UUID.fromString(jwt.getSubject()), body.fullName(), body.travelPreference());
    }
    public record EditProfile(@NotBlank @Size(max = 120) String fullName,
                              @NotNull TravelPreference travelPreference) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String field, Object value) { throw new IllegalArgumentException("Unknown profile field"); }
    }
}
