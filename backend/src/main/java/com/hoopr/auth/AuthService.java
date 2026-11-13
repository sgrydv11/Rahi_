package com.hoopr.auth;

import com.hoopr.user.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    public record Profile(UUID id, String email, String fullName, String role, TravelPreference travelPreference) { }
    public record Access(String accessToken, String tokenType, long expiresIn, Profile user) { }
    // No generated toString: this container holds raw secrets only for the response.
    public static final class Issued {
        public final Access access;
        public final String refresh;
        public final Instant expiresAt;
        Issued(Access access, String refresh, Instant expiresAt) {
            this.access = access; this.refresh = refresh; this.expiresAt = expiresAt;
        }
    }
    private final UserRepository users;
    private final ProfileRepository profiles;
    private final SessionRepository sessions;
    private final TokenRepository tokens;
    private final PasswordEncoder passwords;
    private final JwtEncoder jwt;
    private final AuthSettings settings;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    private final String dummyHash;
    public AuthService(UserRepository users, ProfileRepository profiles, SessionRepository sessions,
            TokenRepository tokens, PasswordEncoder passwords, JwtEncoder jwt, AuthSettings settings, Clock clock) {
        this.users = users; this.profiles = profiles; this.sessions = sessions; this.tokens = tokens;
        this.passwords = passwords; this.jwt = jwt; this.settings = settings; this.clock = clock;
        dummyHash = passwords.encode(UUID.randomUUID().toString());
    }
    public static String normalize(String email) { return email.strip().toLowerCase(Locale.ROOT); }
    public static void validatePassword(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new AuthFailure(400, "Password must be at most 72 UTF-8 bytes.");
    }
    @Transactional
    public Profile register(String email, String password, String name) {
        return register(email, password, name, TravelPreference.BOTH);
    }
    @Transactional
    public Profile register(String email, String password, String name, TravelPreference travelPreference) {
        return register(email, password, name, travelPreference, null);
    }
    @Transactional
    public Profile register(String email, String password, String name, TravelPreference travelPreference, String mobileNumber) {
        Objects.requireNonNull(travelPreference, "Travel preference is required");
        validatePassword(password);
        email = normalize(email);
        if (users.findByEmail(email).isPresent()) throw new AuthFailure(409, "Email is already registered.");
        UserAccount user = new UserAccount();
        user.mobileNumber = EmailOtpService.mobile(mobileNumber);
        if (user.mobileNumber != null && users.existsByMobileNumber(user.mobileNumber))
            throw new AuthFailure(409, "Mobile number is already registered.");
        user.id = UUID.randomUUID(); user.email = email; user.passwordHash = passwords.encode(password);
        user.role = "USER"; user.status = "ACTIVE"; user.createdAt = user.updatedAt = clock.instant();
        users.saveAndFlush(user);
        UserProfile profile = new UserProfile(); profile.userId = user.id; profile.fullName = name.strip();
        profile.travelPreference = travelPreference;
        profile.createdAt = profile.updatedAt = clock.instant(); profiles.save(profile);
        return new Profile(user.id, user.email, profile.fullName, user.role, profile.travelPreference);
    }
    @Transactional(noRollbackFor = AuthFailure.class)
    public Issued login(String email, String password) {
        validatePassword(password);
        UserAccount user = null;
        if (email.contains("@")) user = users.findForLoginByEmail(normalize(email)).orElse(null);
        else {
            try { String mobile=EmailOtpService.mobile(email); if(mobile!=null)user=users.findForLoginByMobileNumber(mobile).orElse(null); }
            catch(AuthFailure invalidNumber) { /* Match the same generic credential failure below. */ }
        }
        boolean matches = passwords.matches(password, user == null ? dummyHash : user.passwordHash);
        Instant now=clock.instant();
        if(user!=null && user.loginLockedUntil!=null && user.loginLockedUntil.isAfter(now))
            throw new AuthFailure(401, "Invalid email or password.");
        if(user!=null && (user.loginWindowStart==null || !user.loginWindowStart.plusSeconds(900).isAfter(now))) {
            user.failedLoginCount=0;user.loginWindowStart=now;user.loginLockedUntil=null;
        }
        if (!matches || user == null || !"ACTIVE".equals(user.status)) {
            if(user!=null && "ACTIVE".equals(user.status)) {
                user.failedLoginCount++;
                if(user.failedLoginCount>=5)user.loginLockedUntil=now.plusSeconds(900);
                users.save(user);
            }
            throw new AuthFailure(401, "Invalid email or password.");
        }
        user.failedLoginCount=0;user.loginWindowStart=null;user.loginLockedUntil=null;users.save(user);
        return newSession(user);
    }
    Issued newSession(UserAccount user) {
        if (!"ACTIVE".equals(user.status)) throw new AuthFailure(401, "This account is unavailable.");
        RefreshSession session = new RefreshSession(); session.id = UUID.randomUUID(); session.userId = user.id;
        session.expiresAt = clock.instant().plus(settings.refreshLifetime()); sessions.save(session);
        return issue(user, session);
    }
    // Commit revocation even when replay raises an authentication error.
    @Transactional(noRollbackFor = AuthFailure.class)
    public Issued refresh(String raw) {
        RefreshToken token = lookup(raw);
        RefreshSession session = sessions.lockById(token.sessionId).orElseThrow(AuthService::invalidSession);
        if (token.consumed || session.revoked || !session.expiresAt.isAfter(clock.instant())) {
            session.revoked = true; throw invalidSession();
        }
        UserAccount user = users.findById(session.userId).orElseThrow(AuthService::invalidSession);
        if (!"ACTIVE".equals(user.status)) { session.revoked = true; throw invalidSession(); }
        token.consumed = true; tokens.save(token);
        return issue(user, session);
    }
    @Transactional
    public void logout(String raw) {
        if (raw == null || raw.length() > 128) return;
        tokens.findFamily(hash(raw)).flatMap(sessions::lockById).ifPresent(s -> s.revoked = true);
    }
    private RefreshToken lookup(String raw) {
        if (raw == null || !raw.matches("[A-Za-z0-9_-]{43}")) throw invalidSession();
        String hashed = hash(raw);
        UUID family = tokens.findFamily(hashed).orElseThrow(AuthService::invalidSession);
        sessions.lockById(family).orElseThrow(AuthService::invalidSession);
        return tokens.findById(hashed).orElseThrow(AuthService::invalidSession);
    }
    @Transactional(readOnly = true)
    public Profile profile(UUID id) {
        UserAccount user = users.findById(id).filter(u -> "ACTIVE".equals(u.status))
                .orElseThrow(AuthService::invalidSession);
        UserProfile profile = profiles.findById(id).orElse(null);
        return new Profile(user.id, user.email, profile == null ? "" : profile.fullName, user.role,
                profile == null ? TravelPreference.BOTH : profile.travelPreference);
    }
    @Transactional
    public Profile updateProfile(UUID id, String fullName, TravelPreference preference) {
        Profile current = profile(id);
        UserProfile profile = profiles.findById(id).orElseGet(() -> {
            UserProfile created = new UserProfile();
            created.userId = id;
            created.createdAt = clock.instant();
            return created;
        });
        profile.fullName = fullName.strip();
        profile.travelPreference = preference;
        profile.updatedAt = clock.instant();
        profiles.save(profile);
        return new Profile(id, current.email(), profile.fullName, current.role(), preference);
    }
    private Issued issue(UserAccount user, RefreshSession session) {
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken token = new RefreshToken(); token.tokenHash = hash(raw); token.sessionId = session.id;
        tokens.save(token);
        Instant now = clock.instant();
        var claims = JwtClaimsSet.builder().issuer(settings.issuer()).subject(user.id.toString())
                .audience(List.of("hoopr-api")).issuedAt(now).expiresAt(now.plusSeconds(900))
                .id(UUID.randomUUID().toString()).claim("sid",session.id.toString()).claim("role", user.role).build();
        String access = jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new Issued(new Access(access, "Bearer", 900, profile(user.id)), raw, session.expiresAt);
    }
    public static String hash(String raw) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
    private static AuthFailure invalidSession() { return new AuthFailure(401, "Session expired or invalid. Please log in."); }
}
