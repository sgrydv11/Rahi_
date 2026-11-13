package com.hoopr.auth;

import com.hoopr.user.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthServiceTest {
    UserRepository users = mock(UserRepository.class);
    ProfileRepository profiles = mock(ProfileRepository.class);
    SessionRepository sessions = mock(SessionRepository.class);
    TokenRepository tokens = mock(TokenRepository.class);
    BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(4);
    JwtEncoder encoder = mock(JwtEncoder.class);
    Instant now = Instant.parse("2026-01-01T00:00:00Z");
    AuthSettings settings = new AuthSettings(Base64.getEncoder().encodeToString(new byte[32]), "hoopr",
            List.of("http://localhost:5173"), true, "Lax", Duration.ofDays(30));
    AuthService service;
    UserAccount user;
    @BeforeEach void setup() {
        service = new AuthService(users, profiles, sessions, tokens, passwords, encoder, settings, Clock.fixed(now, ZoneOffset.UTC));
        user = new UserAccount(); user.id = UUID.randomUUID(); user.email = "alice@example.test";
        user.passwordHash = passwords.encode("long-password-123"); user.status = "ACTIVE"; user.role = "USER";
        when(users.findByEmail(user.email)).thenReturn(Optional.of(user));
        when(users.findById(user.id)).thenReturn(Optional.of(user));
        when(users.findForLoginByEmail(user.email)).thenReturn(Optional.of(user));
        when(encoder.encode(any())).thenReturn(Jwt.withTokenValue("test-access").header("alg", "HS256")
                .subject(user.id.toString()).issuedAt(now).expiresAt(now.plusSeconds(900)).build());
    }
    @Test void registrationNormalizesEmailHashesPasswordAndAssignsUser() {
        when(users.findByEmail("new@example.test")).thenReturn(Optional.empty());
        var profile = service.register(" NEW@Example.Test ", "long-password-123", " New User ");
        var saved = org.mockito.ArgumentCaptor.forClass(UserAccount.class);
        verify(users).saveAndFlush(saved.capture());
        assertEquals("new@example.test", profile.email()); assertEquals("USER", profile.role());
        assertEquals(TravelPreference.BOTH, profile.travelPreference());
        assertNotEquals("long-password-123", saved.getValue().passwordHash);
        assertTrue(passwords.matches("long-password-123", saved.getValue().passwordHash));
        verify(profiles).save(any(UserProfile.class));
    }
    @ParameterizedTest @EnumSource(TravelPreference.class)
    void registrationSavesChosenTravelPreferenceWithoutChangingSecurityRole(TravelPreference preference) {
        var profile = service.register("new@example.test", "long-password-123", "New User", preference);
        var saved = org.mockito.ArgumentCaptor.forClass(UserProfile.class);
        verify(profiles).save(saved.capture());
        assertEquals(preference, saved.getValue().travelPreference);
        assertEquals(preference, profile.travelPreference());
        assertEquals("USER", profile.role());
    }
    @Test void duplicateEmailIsConflict() {
        assertEquals(409, assertThrows(AuthFailure.class,
                () -> service.register(" ALICE@example.test ", "long-password-123", "Alice")).status);
    }
    @Test void loginIssuesOpaqueHashOnlyAndFifteenMinuteJwt() {
        var issued = service.login("ALICE@example.test", "long-password-123");
        assertEquals(43, issued.refresh.length()); assertEquals(900, issued.access.expiresIn());
        var saved = org.mockito.ArgumentCaptor.forClass(RefreshToken.class);
        verify(tokens).save(saved.capture());
        assertEquals(AuthService.hash(issued.refresh), saved.getValue().tokenHash);
        assertNotEquals(issued.refresh, saved.getValue().tokenHash);
        var claims = org.mockito.ArgumentCaptor.forClass(JwtEncoderParameters.class);
        verify(encoder).encode(claims.capture());
        assertEquals(now.plusSeconds(900), claims.getValue().getClaims().getExpiresAt());
        assertEquals(saved.getValue().sessionId.toString(),claims.getValue().getClaims().getClaim("sid"));
    }
    @Test void mobileLoginNormalizesIndianAndInternationalNumbers() {
        when(users.findForLoginByMobileNumber("+919876543210")).thenReturn(Optional.of(user));
        assertEquals(user.id, service.login("9876543210", "long-password-123").access.user().id());
        assertEquals(user.id, service.login("+91 98765-43210", "long-password-123").access.user().id());
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.login("9876543210", "wrong")).status);
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.login("not-a-number", "long-password-123")).status);
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.login("9876543211", "long-password-123")).status);
    }
    @Test void badAndUnknownCredentialsAndDisabledAccountsAreRejected() {
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.login(user.email, "wrong")).status);
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.login("none@example.test", "wrong")).status);
        user.status = "DISABLED";
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.login(user.email, "long-password-123")).status);
    }
    private RefreshSession family(String raw) {
        RefreshSession family = new RefreshSession(); family.id = UUID.randomUUID(); family.userId = user.id;
        family.expiresAt = now.plusSeconds(3000);
        RefreshToken token = new RefreshToken(); token.sessionId = family.id; token.tokenHash = AuthService.hash(raw);
        when(tokens.findFamily(token.tokenHash)).thenReturn(Optional.of(family.id));
        when(tokens.findById(token.tokenHash)).thenReturn(Optional.of(token));
        when(sessions.lockById(family.id)).thenReturn(Optional.of(family));
        return family;
    }
    @Test void rotationConsumesOldTokenAndReplayRevokesFamily() {
        String raw = "a".repeat(43); RefreshSession family = family(raw);
        var issued = service.refresh(raw);
        assertNotEquals(raw, issued.refresh);
        assertTrue(tokens.findById(AuthService.hash(raw)).orElseThrow().consumed);
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.refresh(raw)).status);
        assertTrue(family.revoked);
    }
    @Test void logoutRevokesFamilyAndIsIdempotent() {
        String raw = "b".repeat(43); RefreshSession family = family(raw);
        service.logout(raw); service.logout(raw); service.logout(null);
        assertTrue(family.revoked);
        assertEquals(401, assertThrows(AuthFailure.class, () -> service.refresh(raw)).status);
    }
    @Test void expiredFamilyIsRejectedAndRevoked() {
        String raw = "c".repeat(43); RefreshSession family = family(raw); family.expiresAt = now;
        assertThrows(AuthFailure.class, () -> service.refresh(raw)); assertTrue(family.revoked);
    }
    @Test void passwordFailuresLockAccountAcrossEmailAndPhoneAndUnlockAfterWindow() {
        when(users.findForLoginByMobileNumber("+919876543210")).thenReturn(Optional.of(user));
        for(int i=0;i<5;i++)assertEquals(401,assertThrows(AuthFailure.class,()->service.login(user.email,"wrong")).status);
        assertEquals(5,user.failedLoginCount);
        assertEquals(now.plusSeconds(900),user.loginLockedUntil);
        assertEquals(401,assertThrows(AuthFailure.class,()->service.login("9876543210","long-password-123")).status);
        var later=new AuthService(users,profiles,sessions,tokens,passwords,encoder,settings,Clock.fixed(now.plusSeconds(900),ZoneOffset.UTC));
        later.login(user.email,"long-password-123");
        assertEquals(0,user.failedLoginCount);assertNull(user.loginLockedUntil);
    }
    @Test void bcryptByteLimitIsEnforced() {
        assertThrows(AuthFailure.class, () -> service.register("new@example.test", "é".repeat(37), "Name"));
    }
    @Test void successfulLoginsReleaseOnlyTheirOwnAttemptAndKeepFailureProtection() {
        var limiter = new LoginLimiter(Clock.fixed(now, ZoneOffset.UTC));
        for (int i=0; i<30; i++) { limiter.check("shared-ip"); limiter.succeeded("shared-ip"); }
        for (int i=0; i<19; i++) limiter.check("shared-ip");
        limiter.check("shared-ip"); limiter.succeeded("shared-ip");
        limiter.check("shared-ip");
        assertEquals(429, assertThrows(AuthFailure.class, () -> limiter.check("shared-ip")).status);
    }
    @Test void limiterCapsAttemptsAndExpires() {
        var clock = mock(Clock.class); when(clock.instant()).thenReturn(now);
        var limiter = new LoginLimiter(clock);
        for (int i = 0; i < 20; i++) limiter.check("127.0.0.1");
        assertEquals(429, assertThrows(AuthFailure.class, () -> limiter.check("127.0.0.1")).status);
        when(clock.instant()).thenReturn(now.plusSeconds(901)); limiter.check("127.0.0.1");
    }
}
