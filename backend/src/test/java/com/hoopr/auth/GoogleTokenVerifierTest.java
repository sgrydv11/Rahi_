package com.hoopr.auth;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import java.time.*;
import java.util.Date;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import static org.junit.jupiter.api.Assertions.*;

class GoogleTokenVerifierTest {
    static RSAKey key;
    static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");
    GoogleTokenVerifier verifier;
    @BeforeAll static void signingKey() throws Exception { key = new RSAKeyGenerator(2048).generate(); }
    @BeforeEach void setup() throws Exception {
        verifier = new GoogleTokenVerifier("test-client", Clock.fixed(NOW, ZoneOffset.UTC),
                NimbusJwtDecoder.withPublicKey(key.toRSAPublicKey()).build());
    }
    JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder().issuer("https://accounts.google.com").subject("google-subject")
                .audience("test-client").expirationTime(Date.from(NOW.plusSeconds(300)))
                .claim("email", "rider@gmail.com").claim("email_verified", true);
    }
    String sign(JWTClaimsSet.Builder claims) throws Exception {
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims.build());
        jwt.sign(new RSASSASigner(key)); return jwt.serialize();
    }
    @Test void acceptsValidSignedGoogleIdentity() throws Exception {
        assertEquals("google-subject", verifier.verify(sign(claims())).getSubject());
    }
    @Test void rejectsWrongAudience() throws Exception {
        String token = sign(claims().audience("another-app"));
        assertEquals(401, assertThrows(AuthFailure.class, () -> verifier.verify(token)).status);
    }
    @Test void rejectsMissingRequiredClaims() throws Exception {
        for (var claims : java.util.List.of(claims().issuer(null), claims().audience((String) null),
                claims().expirationTime(null), claims().subject(null))) {
            String token = sign(claims);
            assertThrows(AuthFailure.class, () -> verifier.verify(token));
        }
    }
    @Test void rejectsExpiredToken() throws Exception {
        String token = sign(claims().expirationTime(Date.from(NOW.minusSeconds(120))));
        assertThrows(AuthFailure.class, () -> verifier.verify(token));
    }
    @Test void rejectsUnverifiedEmailAndWrongIssuer() throws Exception {
        String unverified = sign(claims().claim("email_verified", false));
        String wrongIssuer = sign(claims().issuer("https://attacker.test"));
        assertThrows(AuthFailure.class, () -> verifier.verify(unverified));
        assertThrows(AuthFailure.class, () -> verifier.verify(wrongIssuer));
    }
    @Test void rejectsForgedSignature() throws Exception {
        var forged = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims().build());
        forged.sign(new RSASSASigner(new RSAKeyGenerator(2048).generate()));
        assertThrows(AuthFailure.class, () -> verifier.verify(forged.serialize()));
    }
    @Test void failsClosedWhenClientIdIsNotConfigured() throws Exception {
        var disabled = new GoogleTokenVerifier("", Clock.fixed(NOW, ZoneOffset.UTC),
                NimbusJwtDecoder.withPublicKey(key.toRSAPublicKey()).build());
        assertEquals(503, assertThrows(AuthFailure.class, () -> disabled.verify("anything")).status);
    }
}
