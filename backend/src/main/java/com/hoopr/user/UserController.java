package com.hoopr.user;
import com.hoopr.auth.AuthService;
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
}
