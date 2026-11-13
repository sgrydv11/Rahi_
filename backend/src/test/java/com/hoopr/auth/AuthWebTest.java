package com.hoopr.auth;

import com.hoopr.security.SecurityConfig;
import com.hoopr.user.UserController;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "hoopr.group.reconcile-enabled=false", "hoopr.wallet.sandbox-withdrawals-enabled=false",
    "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration",
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
@AutoConfigureMockMvc
class AuthWebTest {
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired JwtDecoder decoder;
    @MockitoBean AuthService auth;
    @MockitoBean GoogleSignInService googleSignIn;
    @MockitoBean EmailOtpService emailOtp;
    @MockitoBean com.hoopr.ride.RideService rides;
    @MockitoBean com.hoopr.ride.ChatController chat;
    @MockitoBean com.hoopr.ride.RideRepository rideRepository;
    @MockitoBean com.hoopr.booking.BookingService bookings;
    @MockitoBean org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate notificationJdbc;
    private final UUID id = UUID.randomUUID();
    private AuthService.Profile profile() { return new AuthService.Profile(id, "alice@example.test", "Alice", "USER", com.hoopr.user.TravelPreference.BOTH); }
    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder write(String path) throws Exception {
        var response = mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse();
        String token = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response.getContentAsString()).get("token").asText();
        return post("/api/v1/auth/" + path).header("Origin", "http://localhost:5173")
                .cookie(response.getCookie("XSRF-TOKEN")).header("X-XSRF-TOKEN", token);
    }
    @Test void bothHealthEndpointsRemainPublic() throws Exception {
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }
    @Test void communityChatRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/chat/messages")).andExpect(status().isUnauthorized());
    }
    @Test void verifiedSignupRequestReturnsAChallengeWithoutRegisteringAnAccount() throws Exception {
        var challenge=UUID.randomUUID();
        when(emailOtp.requestRegistration(anyString(),anyString(),anyString(),org.mockito.ArgumentMatchers.any(com.hoopr.user.TravelPreference.class)))
            .thenReturn(new EmailOtpService.Challenge(challenge,300,"EMAIL"));
        mvc.perform(write("registration/request").contentType(MediaType.APPLICATION_JSON)
            .content("{\"identifier\":\"new@example.test\",\"password\":\"long-password-123\",\"mobileNumber\":\"+919876543210\",\"travelPreference\":\"PASSENGER\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.challengeId").value(challenge.toString()));
        verifyNoInteractions(auth);
    }
    @Test void csrfEndpointIsPublicAndCookieIsSecure() throws Exception {
        mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(cookie().secure("XSRF-TOKEN", true)).andExpect(cookie().httpOnly("XSRF-TOKEN", true))
                .andExpect(result -> org.junit.jupiter.api.Assertions.assertEquals("Lax",
                        result.getResponse().getCookie("XSRF-TOKEN").getAttribute("SameSite")));
    }
    @Test void registrationUsesValidationAndReturnsCreated() throws Exception {
        when(auth.register(anyString(), anyString(), anyString(), org.mockito.ArgumentMatchers.any(com.hoopr.user.TravelPreference.class))).thenReturn(profile());
        mvc.perform(write("register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alice@example.test\",\"password\":\"long-password-123\",\"fullName\":\"Alice\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("USER"));
        verify(auth).register("alice@example.test", "long-password-123", "Alice", com.hoopr.user.TravelPreference.BOTH);
        mvc.perform(write("register")
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"bad\",\"password\":\"\",\"fullName\":\"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(com.hoopr.user.TravelPreference.class)
    void registrationAcceptsEachTravelPreference(com.hoopr.user.TravelPreference preference) throws Exception {
        when(auth.register(anyString(), anyString(), anyString(), eq(preference)))
                .thenReturn(new AuthService.Profile(id, "alice@example.test", "Alice", "USER", preference));
        mvc.perform(write("register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alice@example.test\",\"password\":\"long-password-123\",\"fullName\":\"Alice\",\"travelPreference\":\"" + preference + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.travelPreference").value(preference.name()))
                .andExpect(jsonPath("$.role").value("USER"));
        verify(auth).register("alice@example.test", "long-password-123", "Alice", preference);
    }
    @Test void invalidAndNullTravelPreferencesAreRejected() throws Exception {
        for (String preference : List.of("\"ADMIN\"", "null", "\"\""))
            mvc.perform(write("register").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"alice@example.test\",\"password\":\"long-password-123\",\"fullName\":\"Alice\",\"travelPreference\":" + preference + "}"))
                    .andExpect(status().isBadRequest());
        verifyNoInteractions(auth);
    }
    @Test void loginCookieAndLogoutDeletionAreSecure() throws Exception {
        when(auth.login(anyString(), anyString())).thenReturn(new AuthService.Issued(
                new AuthService.Access("test-access", "Bearer", 900, profile()), "a".repeat(43), Instant.now().plusSeconds(1000)));
        mvc.perform(write("login")
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"alice@example.test\",\"password\":\"long-password-123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Set-Cookie", allOf(containsString("HttpOnly"), containsString("Secure"),
                        containsString("SameSite=Lax"), containsString("Path=/api/v1/auth"))));
        mvc.perform(write("logout"))
                .andExpect(status().isNoContent()).andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
    }
    @Test void googleSignInUsesTheSameSecureSessionCookie() throws Exception {
        when(googleSignIn.signIn("verified-credential", com.hoopr.user.TravelPreference.PASSENGER))
                .thenReturn(new AuthService.Issued(new AuthService.Access("google-access", "Bearer", 900, profile()),
                        "b".repeat(43), Instant.now().plusSeconds(1000)));
        mvc.perform(write("google").contentType(MediaType.APPLICATION_JSON)
                .content("{\"credential\":\"verified-credential\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").value("google-access"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().string("Set-Cookie", allOf(containsString("HttpOnly"), containsString("Secure"))));
        mvc.perform(get("/api/v1/auth/google/config")).andExpect(status().isOk()).andExpect(jsonPath("$.clientId").value(""));
    }
    @Test void cookieWritesRequireCsrfAndTrustedOriginEvenWithBearerHeader() throws Exception {
        for (String path : List.of("register", "login", "refresh", "logout", "google", "otp/request", "otp/verify")) {
            mvc.perform(post("/api/v1/auth/" + path).header("Origin", "http://localhost:5173"))
                    .andExpect(status().isForbidden());
            mvc.perform(write(path).with(r -> { r.removeHeader("Origin"); return r; })).andExpect(status().isForbidden());
            mvc.perform(write(path).with(r -> { r.removeHeader("Origin"); r.addHeader("Origin", "https://evil.test"); return r; }))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/auth/logout").header("Origin", "http://localhost:5173").header("Authorization", "Bearer anything"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(auth);
    }
    @Test void emailOtpUsesSecureWebSessionAndValidatesCodes() throws Exception {
        UUID challenge = UUID.randomUUID();
        when(emailOtp.request("alice@example.test", "+919876543210", com.hoopr.user.TravelPreference.PASSENGER))
                .thenReturn(new EmailOtpService.Challenge(challenge, 300, "EMAIL"));
        mvc.perform(write("otp/request").contentType(MediaType.APPLICATION_JSON)
                .content("{\"identifier\":\"alice@example.test\",\"mobileNumber\":\"+919876543210\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.delivery").value("EMAIL"));
        when(emailOtp.verify(challenge, "123456")).thenReturn(new AuthService.Issued(
                new AuthService.Access("otp-access", "Bearer", 900, profile()), "c".repeat(43), Instant.now().plusSeconds(1000)));
        mvc.perform(write("otp/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"challengeId\":\"" + challenge + "\",\"code\":\"123456\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").value("otp-access"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().string("Set-Cookie", allOf(containsString("HttpOnly"), containsString("Secure"))));
        mvc.perform(write("otp/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"challengeId\":\"" + challenge + "\",\"code\":\"bad\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test void corsPermitsOnlyTrustedOrigins() throws Exception {
        mvc.perform(options("/api/v1/auth/login").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type,x-xsrf-token"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(options("/api/v1/auth/login").header("Origin", "https://evil.test")
                .header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
    @Test void profileRequiresAuthenticationAndBothRolesAreAccepted() throws Exception {
        mvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized());
        when(auth.profile(id)).thenReturn(profile());
        for (String role : List.of("USER", "ADMIN"))
            mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token(role, Instant.now().minusSeconds(1), Instant.now().plusSeconds(600))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("alice@example.test"));
        mvc.perform(get("/api/v1/users/me").with(jwt().authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_OTHER"))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/bookings").with(jwt())).andExpect(status().isForbidden());
    }
    private String token(String role, Instant issued, Instant expires) {
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), JwtClaimsSet.builder()
                .issuer("hoopr").subject(id.toString()).audience(List.of("hoopr-api")).issuedAt(issued).expiresAt(expires)
                .claim("role", role).build())).getTokenValue();
    }
    @Test void jwtValidatesSignatureExpiryAndRole() throws Exception {
        String valid = token("USER", Instant.now().minusSeconds(1), Instant.now().plusSeconds(600));
        org.junit.jupiter.api.Assertions.assertEquals(id.toString(), decoder.decode(valid).getSubject());
        String expired = token("USER", Instant.now().minusSeconds(1000), Instant.now().minusSeconds(100));
        String invalidRole = token("OTHER", Instant.now().minusSeconds(1), Instant.now().plusSeconds(600));
        String tampered = valid.substring(0, valid.lastIndexOf('.') + 1) + "A".repeat(43);
        for (String bad : List.of(expired, invalidRole, tampered))
            mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + bad)).andExpect(status().isUnauthorized());
    }
    @Test void invalidCookieConfigurationFailsClosed() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> new AuthSettings(
                Base64.getEncoder().encodeToString(new byte[32]), "hoopr", List.of("http://localhost:5173"), false, "None", Duration.ofDays(30)));
    }
    @Test void authErrorsAreConsistentAndDoNotExposeCredentials() throws Exception {
        when(auth.login(anyString(), anyString())).thenThrow(new AuthFailure(401, "Invalid email or password."));
        mvc.perform(write("login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alice@example.test\",\"password\":\"long-password-123\"}"))
                .andExpect(status().isUnauthorized()).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("Invalid email or password."))
                .andExpect(content().string(not(containsString("long-password-123"))));
        when(auth.register(anyString(), anyString(), anyString(), org.mockito.ArgumentMatchers.any(com.hoopr.user.TravelPreference.class))).thenThrow(new AuthFailure(409, "Email is already registered."));
        mvc.perform(write("register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alice@example.test\",\"password\":\"long-password-123\",\"fullName\":\"Alice\"}"))
                .andExpect(status().isConflict());
    }
}



