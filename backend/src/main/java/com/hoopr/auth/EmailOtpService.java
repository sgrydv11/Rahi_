package com.hoopr.auth;

import com.hoopr.user.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailOtpService {
    public record Challenge(UUID challengeId, int expiresIn, String delivery) { }
    private final JdbcTemplate jdbc;
    private final OtpMailer mailer;
    private final AuthService auth;
    private final UserRepository users;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    private final byte[] key;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper=new com.fasterxml.jackson.databind.ObjectMapper();
    private final org.springframework.security.crypto.password.PasswordEncoder passwords;
    public EmailOtpService(JdbcTemplate jdbc, OtpMailer mailer, AuthService auth, UserRepository users, Clock clock, AuthSettings settings,
                           org.springframework.security.crypto.password.PasswordEncoder passwords) {
        this.jdbc = jdbc; this.mailer = mailer; this.auth = auth; this.users = users; this.clock = clock;
        this.key = Base64.getDecoder().decode(settings.jwtSecret());
        this.passwords = passwords;
    }
    public void requireLegacyRegistrationAllowed() {
        if (mailer.enabled()) throw new AuthFailure(409,"Verify your email with a code to create an account. Update the app if needed.");
    }
    @Transactional
    public Challenge requestRegistration(String email, String password, String mobile, TravelPreference preference) {
        return requestRegistration(email,password,mobile,preference,List.of());
    }
    @Transactional
    public Challenge requestRegistration(String email,String password,String mobile,TravelPreference preference,List<TravelRoutesController.Route> routes) {
        routes=TravelRoutesController.normalize(routes);
        AuthService.validatePassword(password);
        if (password.isBlank() || password.length()<12) throw new AuthFailure(400,"Use a password of at least 12 characters.");
        if (mobile==null || mobile.isBlank()) throw new AuthFailure(400,"Enter your mobile number.");
        var challenge=challenge(email,mobile,preference,passwords.encode(password),true);
        jdbc.update("UPDATE email_otp_challenges SET regular_routes=?::jsonb WHERE id=?",routeJson(routes),challenge.challengeId());
        return challenge;
    }
    public static String mobile(String value) {
        if (value == null || value.isBlank()) return null;
        String number = value.replaceAll("[ ()-]", "");
        if (number.matches("[6-9][0-9]{9}")) number = "+91" + number;
        if (!number.matches("\\+[1-9][0-9]{7,14}")) throw new AuthFailure(400, "Enter a valid mobile number with country code.");
        return number;
    }
    @Transactional
    public Challenge request(String identifier, String mobileNumber, TravelPreference preference) {
        return challenge(identifier,mobileNumber,preference,null,false);
    }
    private Challenge challenge(String identifier, String mobileNumber, TravelPreference preference, String passwordHash, boolean registering) {
        String email = AuthService.normalize(identifier);
        if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || email.length() > 254)
            throw new AuthFailure(400, "Enter a valid email address. Mobile OTP will be available after SMS setup.");
        String mobile = mobile(mobileNumber);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", "otp:" + email);
        var account=users.findByEmail(email).orElse(null);
        String purpose=registering ? (account==null?"REGISTER":"DECOY") : (account!=null && "ACTIVE".equals(account.status)?"LOGIN":"DECOY");
        var recent = jdbc.queryForObject("SELECT count(*) FROM email_otp_challenges WHERE email=? AND created_at>?", Integer.class,
                email, clock.instant().minusSeconds(60).atOffset(ZoneOffset.UTC));
        if (recent != null && recent > 0) throw new AuthFailure(429, "Please wait 60 seconds before requesting another code.");
        var hourly = jdbc.queryForObject("SELECT count(*) FROM email_otp_challenges WHERE email=? AND created_at>?", Integer.class,
                email, clock.instant().minusSeconds(3600).atOffset(ZoneOffset.UTC));
        if (hourly != null && hourly >= 10) throw new AuthFailure(429, "Too many verification requests. Please try again later.");
        UUID id = UUID.randomUUID();
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1000000));
        mailer.deliver(email, code);
        jdbc.update("UPDATE email_otp_challenges SET consumed=true WHERE email=? AND NOT consumed", email);
        jdbc.update("INSERT INTO email_otp_challenges(id,email,mobile_number,code_hash,expires_at,created_at,travel_preference,registration_password_hash,purpose) VALUES(?,?,?,?,?,?,?,?,?)",
                id, email, mobile, hash(id, code), clock.instant().plusSeconds(300).atOffset(ZoneOffset.UTC),
                clock.instant().atOffset(ZoneOffset.UTC), preference.name(), passwordHash,purpose);
        return new Challenge(id, 300, "EMAIL");
    }
    @Transactional(noRollbackFor = AuthFailure.class)
    public AuthService.Issued verify(UUID id, String code) {
        var rows = jdbc.queryForList("SELECT * FROM email_otp_challenges WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw invalid();
        var challenge = rows.get(0);
        Instant expires = ((java.sql.Timestamp) challenge.get("expires_at")).toInstant();
        if (Boolean.TRUE.equals(challenge.get("consumed")) || !expires.isAfter(clock.instant()) || ((Number) challenge.get("attempts")).intValue() >= 5)
            throw invalid();
        jdbc.update("UPDATE email_otp_challenges SET attempts=attempts+1 WHERE id=?", id);
        if (!MessageDigest.isEqual(hash(id, code).getBytes(StandardCharsets.UTF_8), challenge.get("code_hash").toString().getBytes(StandardCharsets.UTF_8))) throw invalid();
        if("DECOY".equals(challenge.get("purpose")))throw invalid();
        String email = challenge.get("email").toString();
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", "email:" + email);
        var user = users.findByEmail(email).orElse(null);
        String signupHash = (String) challenge.get("registration_password_hash");
        if ("REGISTER".equals(challenge.get("purpose")) && user!=null) throw invalid();
        if ("LOGIN".equals(challenge.get("purpose")) && user==null) throw invalid();
        if (user == null) {
            var profile = auth.register(email, UUID.randomUUID().toString(), "FlexirRides member", TravelPreference.valueOf(challenge.get("travel_preference").toString()), (String)challenge.get("mobile_number"));
            user = users.findById(profile.id()).orElseThrow();
            if (signupHash!=null) { user.passwordHash=signupHash; users.saveAndFlush(user); }
            for(var route:readRoutes(challenge.get("regular_routes").toString()))
                jdbc.update("INSERT INTO user_travel_routes(user_id,origin,destination,time_period) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",user.id,route.origin(),route.destination(),route.period().name());
        }
        if (!"ACTIVE".equals(user.status)) throw invalid();
        String mobile = (String) challenge.get("mobile_number");
        if (mobile != null && user.mobileNumber == null) { user.mobileNumber = mobile; users.saveAndFlush(user); }
        jdbc.update("UPDATE email_otp_challenges SET consumed=true WHERE id=?", id);
        return auth.newSession(user);
    }
    private String routeJson(List<TravelRoutesController.Route> routes) {
        try{return mapper.writeValueAsString(routes);}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new AuthFailure(400,"Invalid regular routes.");}
    }
    private List<TravelRoutesController.Route> readRoutes(String json) {
        try{return List.of(mapper.readValue(json,TravelRoutesController.Route[].class));}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new AuthFailure(400,"Invalid regular routes.");}
    }
    private String hash(UUID id, String code) {
        try {
            var mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(("email-otp:" + id + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException failure) { throw new IllegalStateException("OTP verification is unavailable."); }
    }
    private static AuthFailure invalid() { return new AuthFailure(401, "The code is invalid or expired. Request a new code if needed."); }
}
