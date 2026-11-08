package com.hoopr.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = "/api/v1/mobile/auth", consumes = MediaType.APPLICATION_JSON_VALUE)
public class MobileAuthController {
    private final AuthService auth;
    private final LoginLimiter limiter;
    private final EmailOtpService otp;

    public MobileAuthController(AuthService auth, LoginLimiter limiter, EmailOtpService otp) {
        this.auth = auth;
        this.limiter = limiter;
        this.otp = otp;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthService.Profile> register(@Valid @RequestBody AuthController.RegisterRequest body,
                                                         HttpServletRequest request) {
        requireNativeRequest(request);
        if (body.password.length() < 12) throw new AuthFailure(400, "Password must contain at least 12 characters.");
        return ResponseEntity.status(HttpStatus.CREATED).header("Cache-Control", "no-store")
                .body(auth.register(body.email, body.password, body.fullName, body.travelPreference));
    }

    @PostMapping("/login")
    public ResponseEntity<Session> login(@Valid @RequestBody AuthController.LoginRequest body, HttpServletRequest request) {
        requireNativeRequest(request);
        limiter.check(request.getRemoteAddr());
        var issued = auth.login(body.email, body.password);
        limiter.succeeded(request.getRemoteAddr());
        return session(issued);
    }
    @PostMapping("/otp/request")
    public EmailOtpService.Challenge requestOtp(@Valid @RequestBody OtpRequests.Request body, HttpServletRequest request) {
        requireNativeRequest(request); limiter.check(request.getRemoteAddr());
        return otp.request(body.identifier, body.mobileNumber, body.travelPreference);
    }
    @PostMapping("/otp/verify")
    public ResponseEntity<Session> verifyOtp(@Valid @RequestBody OtpRequests.Verify body, HttpServletRequest request) {
        requireNativeRequest(request); limiter.check(request.getRemoteAddr());
        var issued = otp.verify(body.challengeId, body.code); limiter.succeeded(request.getRemoteAddr());
        return session(issued);
    }

    @PostMapping("/refresh")
    public ResponseEntity<Session> refresh(@Valid @RequestBody Refresh body, HttpServletRequest request) {
        requireNativeRequest(request);
        return session(auth.refresh(body.refreshToken()));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody Refresh body, HttpServletRequest request) {
        requireNativeRequest(request);
        auth.logout(body.refreshToken());
    }

    private static void requireNativeRequest(HttpServletRequest request) {
        if (request.getHeader("Origin") != null || request.getHeader("Sec-Fetch-Site") != null)
            throw new AuthFailure(403, "Use the browser sign-in endpoint.");
    }

    private static ResponseEntity<Session> session(AuthService.Issued issued) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(new Session(issued.access.accessToken(), issued.access.expiresIn(), issued.access.user(), issued.refresh));
    }

    public record Refresh(@NotBlank @Size(max = 256) String refreshToken) {
        @Override public String toString() { return "Refresh[redacted]"; }
    }

    public record Session(String accessToken, long expiresIn, AuthService.Profile user, String refreshToken) {
        @Override public String toString() { return "Session[redacted]"; }
    }
}
