package com.hoopr.auth;

import com.hoopr.database.TestDatabase;
import com.hoopr.user.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr-test",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
class GoogleSignInIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> TestDatabase.required("TEST_DB_URL"));
        properties.add("spring.datasource.username", () -> TestDatabase.required("TEST_DB_USERNAME"));
        properties.add("spring.datasource.password", () -> TestDatabase.required("TEST_DB_PASSWORD"));
    }
    @MockitoBean GoogleTokenVerifier verifier;
    @Autowired GoogleSignInService google;
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    String subject;
    String email;
    @BeforeEach void identity() {
        subject = UUID.randomUUID().toString(); email = subject + "@gmail.com";
        verified(email);
    }
    void verified(String address) {
        when(verifier.verify("credential")).thenReturn(Jwt.withTokenValue("verified")
                .header("alg", "RS256").subject(subject).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                .claim("email", address).claim("email_verified", true).claim("name", "Google Rider").build());
    }
    @AfterEach void cleanup() {
        var ids = jdbc.queryForList("SELECT id FROM users WHERE email = ? OR google_subject = ?", UUID.class, email, subject);
        for (UUID id : ids) {
            jdbc.update("DELETE FROM refresh_tokens WHERE session_id IN (SELECT id FROM refresh_sessions WHERE user_id = ?)", id);
            jdbc.update("DELETE FROM refresh_sessions WHERE user_id = ?", id);
            jdbc.update("DELETE FROM user_profiles WHERE user_id = ?", id);
            jdbc.update("DELETE FROM users WHERE id = ?", id);
        }
    }
    @Test void createsOneAccountAndReturnsUsableRotatingSessions() {
        var first = google.signIn("credential", TravelPreference.DRIVER);
        var second = google.signIn("credential", TravelPreference.PASSENGER);
        assertEquals(first.access.user().id(), second.access.user().id());
        assertEquals(TravelPreference.DRIVER, second.access.user().travelPreference());
        assertEquals(first.access.user().id(), auth.refresh(first.refresh).access.user().id());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE google_subject = ?", Integer.class, subject));
    }
    @Test void linksAuthoritativeGmailWithoutReplacingExistingPasswordOrPreference() {
        var existing = auth.register(email, "existing-password-123", "Existing Rider", TravelPreference.BOTH);
        assertEquals(existing.id(), google.signIn("credential", TravelPreference.PASSENGER).access.user().id());
        assertEquals(existing.id(), auth.login(email, "existing-password-123").access.user().id());
        assertEquals(TravelPreference.BOTH, auth.profile(existing.id()).travelPreference());
    }
    @Test void rejectsAutomaticLinkingForThirdPartyEmail() {
        email = subject + "@example.test"; verified(email);
        auth.register(email, "existing-password-123", "Existing Rider");
        assertEquals(409, assertThrows(AuthFailure.class, () -> google.signIn("credential", TravelPreference.BOTH)).status);
        assertNull(jdbc.queryForObject("SELECT google_subject FROM users WHERE email = ?", String.class, email));
    }
    @Test void blocksInactiveAccount() {
        var account = google.signIn("credential", TravelPreference.PASSENGER).access.user();
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE id = ?", account.id());
        assertEquals(401, assertThrows(AuthFailure.class, () -> google.signIn("credential", TravelPreference.BOTH)).status);
    }
    @Test void concurrentFirstSignInsCreateOneAccount() throws Exception {
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<UUID> signIn = () -> {
                start.await(); return google.signIn("credential", TravelPreference.PASSENGER).access.user().id();
            };
            var first = pool.submit(signIn); var second = pool.submit(signIn);
            start.countDown();
            assertEquals(first.get(20, java.util.concurrent.TimeUnit.SECONDS), second.get(20, java.util.concurrent.TimeUnit.SECONDS));
        }
    }
}
