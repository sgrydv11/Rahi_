package com.hoopr.auth;

import com.hoopr.database.TestDatabase;
import com.hoopr.user.TravelPreference;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr-test",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
class EmailOtpIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> TestDatabase.required("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> TestDatabase.required("TEST_DB_USERNAME"));
        registry.add("spring.datasource.password", () -> TestDatabase.required("TEST_DB_PASSWORD"));
    }
    @Autowired EmailOtpService otp;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean OtpMailer mailer;
    String email;
    String mobile;
    AtomicReference<String> code;
    @BeforeEach void setup() {
        email = UUID.randomUUID() + "@otp.example.test";
        mobile = "+919" + String.format(Locale.ROOT, "%09d", new java.security.SecureRandom().nextInt(1000000000));
        code = new AtomicReference<>();
        doAnswer(call -> { code.set(call.getArgument(1)); return null; }).when(mailer).deliver(eq(email), anyString());
    }
    @AfterEach void cleanup() {
        for (UUID user : jdbc.queryForList("SELECT id FROM users WHERE email=?", UUID.class, email)) {
            jdbc.update("DELETE FROM refresh_tokens WHERE session_id IN (SELECT id FROM refresh_sessions WHERE user_id=?)", user);
            jdbc.update("DELETE FROM refresh_sessions WHERE user_id=?", user);
            jdbc.update("DELETE FROM user_profiles WHERE user_id=?", user);
            jdbc.update("DELETE FROM users WHERE id=?", user);
        }
        jdbc.update("DELETE FROM email_otp_challenges WHERE email=?", email);
    }
    @Test void verifiesOnceCreatesNoNameAccountAndRecordsUnverifiedMobile() {
        var challenge = otp.request(email, mobile, TravelPreference.PASSENGER);
        assertTrue(code.get().matches("[0-9]{6}"));
        assertNotEquals(code.get(), jdbc.queryForObject("SELECT code_hash FROM email_otp_challenges WHERE id=?", String.class, challenge.challengeId()));
        var issued = otp.verify(challenge.challengeId(), code.get());
        assertEquals(email, issued.access.user().email());
        assertEquals("FlexirRides member", issued.access.user().fullName());
        assertEquals(mobile, jdbc.queryForObject("SELECT mobile_number FROM users WHERE id=?", String.class, issued.access.user().id()));
        assertEquals(false, jdbc.queryForObject("SELECT mobile_verified FROM users WHERE id=?", Boolean.class, issued.access.user().id()));
        assertThrows(AuthFailure.class, () -> otp.verify(challenge.challengeId(), code.get()));
    }
    @Test void persistsFailedAttemptsAndLocksAfterFive() {
        var challenge = otp.request(email, mobile, TravelPreference.PASSENGER);
        String wrong = code.get().equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) assertThrows(AuthFailure.class, () -> otp.verify(challenge.challengeId(), wrong));
        assertEquals(5, jdbc.queryForObject("SELECT attempts FROM email_otp_challenges WHERE id=?", Integer.class, challenge.challengeId()));
        assertThrows(AuthFailure.class, () -> otp.verify(challenge.challengeId(), code.get()));
    }
    @Test void rejectsExpiredAndThrottlesResend() {
        var challenge = otp.request(email, mobile, TravelPreference.PASSENGER);
        assertEquals(429, assertThrows(AuthFailure.class, () -> otp.request(email, mobile, TravelPreference.PASSENGER)).status);
        jdbc.update("UPDATE email_otp_challenges SET expires_at=now()-interval '1 second' WHERE id=?", challenge.challengeId());
        assertThrows(AuthFailure.class, () -> otp.verify(challenge.challengeId(), code.get()));
    }
    @Test void failedDeliveryCreatesNoUsableChallenge() {
        doThrow(new AuthFailure(503, "Unavailable")).when(mailer).deliver(eq(email), anyString());
        assertThrows(AuthFailure.class, () -> otp.request(email, mobile, TravelPreference.PASSENGER));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM email_otp_challenges WHERE email=?", Integer.class, email));
    }
}
