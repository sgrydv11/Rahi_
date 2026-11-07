package com.hoopr.auth;

import com.hoopr.user.*;
import java.time.Clock;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoogleSignInService {
    private final GoogleTokenVerifier verifier;
    private final UserRepository users;
    private final AuthService auth;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public GoogleSignInService(GoogleTokenVerifier verifier, UserRepository users, AuthService auth, JdbcTemplate jdbc, Clock clock) {
        this.verifier = verifier; this.users = users; this.auth = auth; this.jdbc = jdbc; this.clock = clock;
    }

    @Transactional
    public AuthService.Issued signIn(String credential, TravelPreference preference) {
        var token = verifier.verify(credential);
        String subject = token.getSubject();
        String email = AuthService.normalize(token.getClaimAsString("email"));
        // Serialize first sign-in/account linking without changing existing password registrations.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", "google:" + subject);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", "email:" + email);
        var user = users.findByGoogleSubject(subject).orElse(null);
        if (user == null) {
            user = users.findByEmail(email).orElse(null);
            if (user != null) {
                String domain = token.getClaimAsString("hd");
                boolean authoritative = email.endsWith("@gmail.com") || (domain != null && !domain.isBlank());
                if (user.googleSubject != null || !authoritative)
                    throw new AuthFailure(409, "This email already has an account. Please sign in with your existing method.");
            } else {
                String name = token.getClaimAsString("name");
                if (name == null || name.isBlank()) name = email.substring(0, email.indexOf('@'));
                name = name.strip();
                var profile = auth.register(email, UUID.randomUUID().toString(), name.substring(0, Math.min(120, name.length())), preference);
                user = users.findById(profile.id()).orElseThrow();
            }
            if (!"ACTIVE".equals(user.status)) throw new AuthFailure(401, "This account is unavailable.");
            user.googleSubject = subject;
            user.updatedAt = clock.instant();
            users.saveAndFlush(user);
        }
        return auth.newSession(user);
    }
}
