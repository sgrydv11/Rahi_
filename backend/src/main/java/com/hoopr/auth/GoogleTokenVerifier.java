package com.hoopr.auth;

import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class GoogleTokenVerifier {
    private final String clientId;
    private final NimbusJwtDecoder decoder;

    @org.springframework.beans.factory.annotation.Autowired
    public GoogleTokenVerifier(@Value("${GOOGLE_CLIENT_ID:}") String clientId, Clock clock) {
        this(clientId, clock, googleDecoder());
    }
    private static NimbusJwtDecoder googleDecoder() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(4));
        factory.setReadTimeout(Duration.ofSeconds(8));
        return NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                .restOperations(new RestTemplate(factory)).build();
    }
    GoogleTokenVerifier(String clientId, Clock clock, NimbusJwtDecoder decoder) {
        this.clientId = clientId.strip();
        this.decoder = decoder;
        var timestamps = new JwtTimestampValidator(Duration.ofSeconds(30));
        timestamps.setClock(clock);
        OAuth2TokenValidator<Jwt> identity = token -> {
            String email = token.getClaimAsString("email");
            String issuer = token.getClaimAsString("iss");
            var audience = token.getAudience();
            if (token.getExpiresAt() != null && token.getSubject() != null && !token.getSubject().isBlank()
                    && token.getSubject().length() <= 255 && audience != null && audience.contains(this.clientId)
                    && ("accounts.google.com".equals(issuer) || "https://accounts.google.com".equals(issuer))
                    && Boolean.TRUE.equals(token.getClaim("email_verified"))
                    && email != null && email.length() <= 254 && email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
                return OAuth2TokenValidatorResult.success();
            return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamps, identity));
    }

    public String clientId() { return clientId; }
    public Jwt verify(String credential) {
        if (clientId.isBlank()) throw new AuthFailure(503, "Google sign-in is being configured. Please use email and password.");
        try { return decoder.decode(credential); }
        catch (JwtException failure) { throw new AuthFailure(401, "Google sign-in could not be verified. Please try again."); }
    }
}
