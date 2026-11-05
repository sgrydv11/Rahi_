package com.hoopr.auth;

import com.hoopr.user.UserRepository;
import jakarta.servlet.http.Cookie;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Explicitly run on a dedicated PostgreSQL database. Never cleans or drops a schema. */
@SpringBootTest(properties = {
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr-test",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
@AutoConfigureMockMvc
class AuthenticationIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> required("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> required("TEST_DB_USERNAME"));
        registry.add("spring.datasource.password", () -> required("TEST_DB_PASSWORD"));
    }
    static String required(String name) {
        return com.hoopr.database.TestDatabase.required(name);
    }
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    UUID userId;
    String email;
    @BeforeEach void register() {
        email = "phase2-" + UUID.randomUUID() + "@example.test";
        userId = auth.register(email, "test-password-long", "Integration User").id();
    }
    @AfterEach void removeOnlyThisTestFixture() {
        if (userId == null) return;
        removeFixture(userId);
    }
    void removeFixture(UUID userId) {
        jdbc.update("DELETE FROM refresh_tokens WHERE session_id IN (SELECT id FROM refresh_sessions WHERE user_id = ?)", userId);
        jdbc.update("DELETE FROM refresh_sessions WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM user_profiles WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }
    @Test void mobileLoginRefreshAndLogoutUseExplicitTokensWithoutCookies() throws Exception {
        var json = new com.fasterxml.jackson.databind.ObjectMapper();
        String path = "/api/v1/mobile/auth";
        String credentials = json.writeValueAsString(Map.of("email", email, "password", "test-password-long"));
        mvc.perform(post(path + "/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", "short", "fullName", "Test User"))))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path + "/login").header("Origin", "http://localhost:5173")
                .contentType(MediaType.APPLICATION_JSON).content(credentials)).andExpect(status().isForbidden());
        var response = mvc.perform(post(path + "/login").contentType(MediaType.APPLICATION_JSON).content(credentials))
                .andExpect(status().isOk()).andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse();
        var session = json.readTree(response.getContentAsString());
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + session.path("accessToken").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
        var refreshed = mvc.perform(post(path + "/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("refreshToken", session.path("refreshToken").asText()))))
                .andExpect(status().isOk()).andExpect(header().doesNotExist("Set-Cookie")).andReturn().getResponse();
        String rotated = json.readTree(refreshed.getContentAsString()).path("refreshToken").asText();
        assertNotEquals(session.path("refreshToken").asText(), rotated);
        String token = json.writeValueAsString(Map.of("refreshToken", rotated));
        mvc.perform(post(path + "/logout").contentType(MediaType.APPLICATION_JSON).content(token))
                .andExpect(status().isNoContent());
        mvc.perform(post(path + "/refresh").contentType(MediaType.APPLICATION_JSON).content(token))
                .andExpect(status().isUnauthorized());
    }
    @Test void travelPreferencesPersistAcrossLoginRefreshAndProfile() {
        for (var preference : com.hoopr.user.TravelPreference.values()) {
            var account = auth.register("preference-" + UUID.randomUUID() + "@example.test", "test-password-long", "Preference User", preference);
            try {
                assertEquals(preference.name(), jdbc.queryForObject(
                        "SELECT travel_preference FROM user_profiles WHERE user_id = ?", String.class, account.id()));
                var login = auth.login(account.email(), "test-password-long");
                assertEquals(preference, login.access.user().travelPreference());
                assertEquals(preference, auth.refresh(login.refresh).access.user().travelPreference());
                assertEquals(preference, auth.profile(account.id()).travelPreference());
                assertEquals("USER", auth.profile(account.id()).role());
            } finally { removeFixture(account.id()); }
        }
    }
    @Test void persistenceUniquenessRotationAndReplayCommit() {
        assertTrue(users.findById(userId).orElseThrow().passwordHash.startsWith("$2"));
        assertEquals(409, assertThrows(AuthFailure.class,
                () -> auth.register(email.toUpperCase(Locale.ROOT), "test-password-long", "Duplicate")).status);
        var login = auth.login(email, "test-password-long");
        var rotated = auth.refresh(login.refresh);
        assertNotEquals(login.refresh, rotated.refresh);
        assertEquals(401, assertThrows(AuthFailure.class, () -> auth.refresh(login.refresh)).status);
        // A separate transaction must see family revocation despite the previous exception.
        assertEquals(401, assertThrows(AuthFailure.class, () -> auth.refresh(rotated.refresh)).status);
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE token_hash = ?", Integer.class, login.refresh));
    }
    @Test void concurrentRefreshHasOneWinnerAndRevokesOnReplay() throws Exception {
        var login = auth.login(email, "test-password-long");
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<AuthService.Issued> task = () -> {
                start.await();
                try { return auth.refresh(login.refresh); } catch (AuthFailure expected) { return null; }
            };
            var first = executor.submit(task); var second = executor.submit(task); start.countDown();
            var a = first.get(15, TimeUnit.SECONDS); var b = second.get(15, TimeUnit.SECONDS);
            assertTrue((a == null) != (b == null));
            var winner = a == null ? b : a;
            assertThrows(AuthFailure.class, () -> auth.refresh(winner.refresh));
        }
    }
    @Test void logoutPersistsRevocationAndDisabledUsersCannotRefresh() {
        var login = auth.login(email, "test-password-long"); auth.logout(login.refresh);
        assertThrows(AuthFailure.class, () -> auth.refresh(login.refresh));
        var next = auth.login(email, "test-password-long");
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE id = ?", userId);
        assertThrows(AuthFailure.class, () -> auth.refresh(next.refresh));
    }
    @Test void actualCookieCsrfLoginAndHealthFlow() throws Exception {
        var csrf = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse();
        String token = new com.fasterxml.jackson.databind.ObjectMapper().readTree(csrf.getContentAsString()).get("token").asText();
        var login = mvc.perform(post("/api/v1/auth/login").header("Origin", "http://localhost:5173")
                .cookie(csrf.getCookie("XSRF-TOKEN")).header("X-XSRF-TOKEN", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"test-password-long\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String access = new com.fasterxml.jackson.databind.ObjectMapper().readTree(login.getContentAsString()).get("accessToken").asText();
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(userId.toString()));
        mvc.perform(post("/api/v1/auth/logout").header("Origin", "http://localhost:5173")
                .cookie(csrf.getCookie("XSRF-TOKEN"), login.getCookie("hoopr_refresh")).header("X-XSRF-TOKEN", token))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
