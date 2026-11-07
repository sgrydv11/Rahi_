package com.hoopr.auth;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Clock;
import java.time.Duration;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
    // Classes rather than records avoid generated toString containing passwords.
    public static class LoginRequest {
        @NotBlank @Email @Size(max = 254) public String email;
        @NotBlank @Size(max = 72) public String password;
    }
    public static class RegisterRequest extends LoginRequest {
        @NotBlank @Size(max = 120) public String fullName;
        @NotNull public com.hoopr.user.TravelPreference travelPreference = com.hoopr.user.TravelPreference.BOTH;
        @Override public String toString() { return "RegisterRequest[redacted]"; }
    }
    private final AuthService auth;
    private final AuthSettings settings;
    private final LoginLimiter limiter;
    private final Clock clock;
    private final GoogleSignInService googleSignIn;
    private final GoogleTokenVerifier googleVerifier;
    public AuthController(AuthService auth, AuthSettings settings, LoginLimiter limiter, Clock clock,
            GoogleSignInService googleSignIn, GoogleTokenVerifier googleVerifier) {
        this.auth = auth; this.settings = settings; this.limiter = limiter; this.clock = clock;
        this.googleSignIn = googleSignIn; this.googleVerifier = googleVerifier;
    }
    @GetMapping("/csrf") public java.util.Map<String, String> csrf(CsrfToken token) {
        return java.util.Map.of("token", token.getToken(), "headerName", token.getHeaderName());
    }
    public static class GoogleRequest {
        @NotBlank @Size(max = 10000) public String credential;
        @NotNull public com.hoopr.user.TravelPreference travelPreference = com.hoopr.user.TravelPreference.PASSENGER;
        @Override public String toString() { return "GoogleRequest[redacted]"; }
    }
    @GetMapping("/google/config") public java.util.Map<String, String> googleConfig() {
        return java.util.Map.of("clientId", googleVerifier.clientId());
    }
    @PostMapping("/google") public AuthService.Access google(@Valid @RequestBody GoogleRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        limiter.check(request.getRemoteAddr());
        var issued = googleSignIn.signIn(body.credential, body.travelPreference);
        limiter.succeeded(request.getRemoteAddr());
        return respond(issued, response);
    }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public AuthService.Profile register(@Valid @RequestBody RegisterRequest body) {
        if (body.password.length() < 12) throw new AuthFailure(400, "Password must contain at least 12 characters.");
        return auth.register(body.email, body.password, body.fullName, body.travelPreference);
    }
    @PostMapping("/login") public AuthService.Access login(@Valid @RequestBody LoginRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        limiter.check(request.getRemoteAddr());
        var issued = auth.login(body.email, body.password);
        limiter.succeeded(request.getRemoteAddr());
        return respond(issued, response);
    }
    @PostMapping("/refresh") public AuthService.Access refresh(
            @CookieValue(name = "hoopr_refresh", required = false) String raw, HttpServletResponse response) {
        try { return respond(auth.refresh(raw), response); }
        catch (AuthFailure e) { clear(response); throw e; }
    }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@CookieValue(name = "hoopr_refresh", required = false) String raw, HttpServletResponse response) {
        auth.logout(raw); clear(response);
    }
    private AuthService.Access respond(AuthService.Issued issued, HttpServletResponse response) {
        cookie(response, issued.refresh, Duration.between(clock.instant(), issued.expiresAt));
        response.setHeader("Cache-Control", "no-store"); return issued.access;
    }
    private void clear(HttpServletResponse response) { cookie(response, "", Duration.ZERO); }
    private void cookie(HttpServletResponse response, String value, Duration age) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("hoopr_refresh", value)
                .httpOnly(true).secure(settings.cookieSecure()).sameSite(settings.cookieSameSite())
                .path("/api/v1/auth").maxAge(age).build().toString());
    }
}
