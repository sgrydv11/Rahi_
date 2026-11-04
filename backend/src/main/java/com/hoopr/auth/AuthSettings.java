package com.hoopr.auth;

import java.net.URI;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("hoopr.auth")
public record AuthSettings(String jwtSecret, String issuer, List<String> origins,
        boolean cookieSecure, String cookieSameSite, Duration refreshLifetime) {
    @Override public String toString() { return "AuthSettings[secrets redacted]"; }
    public AuthSettings {
        if (jwtSecret == null || Base64.getDecoder().decode(jwtSecret).length < 32)
            throw new IllegalArgumentException("JWT_SECRET must be base64 with at least 32 random bytes");
        if (issuer == null || issuer.isBlank() || origins == null || origins.isEmpty())
            throw new IllegalArgumentException("Auth issuer and explicit origins are required");
        for (String origin : origins) {
            URI uri = URI.create(origin);
            if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                    || uri.getHost() == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                    || uri.getRawFragment() != null || (uri.getRawPath() != null && !uri.getRawPath().isEmpty()))
                throw new IllegalArgumentException("Origins must be exact HTTP(S) origins without paths");
        }
        if (!List.of("Strict", "Lax", "None").contains(cookieSameSite)
                || ("None".equals(cookieSameSite) && !cookieSecure))
            throw new IllegalArgumentException("SameSite must be Strict/Lax/None; None requires Secure");
        if (refreshLifetime == null || refreshLifetime.isNegative() || refreshLifetime.isZero()
                || refreshLifetime.compareTo(Duration.ofDays(90)) > 0)
            throw new IllegalArgumentException("Refresh lifetime must be positive and at most 90 days");
    }
}
