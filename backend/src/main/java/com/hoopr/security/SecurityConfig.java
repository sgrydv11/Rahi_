package com.hoopr.security;

import com.hoopr.auth.AuthSettings;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.*;
import java.util.*;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.*;
import org.springframework.web.cors.*;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.filter.CorsFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(AuthSettings.class)
public class SecurityConfig {
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean CorsFilter corsFilter(AuthSettings settings) {
        var cors = new CorsConfiguration();
        cors.setAllowedOrigins(settings.origins()); cors.setAllowCredentials(true);
        cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN", "Idempotency-Key"));
        var source = new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**", cors);
        var filter = new CorsFilter(source);
        filter.setCorsProcessor(new DefaultCorsProcessor() {
            @Override protected void rejectRequest(org.springframework.http.server.ServerHttpResponse response) throws IOException {
                response.setStatusCode(org.springframework.http.HttpStatus.FORBIDDEN);
                response.getHeaders().setContentType(org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON);
                response.getHeaders().setCacheControl("no-store");
                response.getBody().write("{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403,\"detail\":\"Origin is not allowed.\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
                response.flush();
            }
        });
        return filter;
    }
    @Bean FilterRegistrationBean<CorsFilter> corsRegistration(CorsFilter corsFilter) {
        var registration = new FilterRegistrationBean<>(corsFilter);
        registration.setEnabled(false); return registration; // Runs only inside the security chain.
    }
    @Bean JwtEncoder jwtEncoder(AuthSettings settings) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(Base64.getDecoder().decode(settings.jwtSecret())));
    }
    @Bean JwtDecoder jwtDecoder(AuthSettings settings, Clock clock) {
        var decoder = NimbusJwtDecoder.withSecretKey(new SecretKeySpec(
                Base64.getDecoder().decode(settings.jwtSecret()), "HmacSHA256")).macAlgorithm(MacAlgorithm.HS256).build();
        var timestamp = new JwtTimestampValidator(Duration.ZERO); timestamp.setClock(clock);
        OAuth2TokenValidator<Jwt> claims = token -> {
            try {
                UUID.fromString(token.getSubject());
                if (token.getExpiresAt() != null && token.getIssuedAt() != null
                        && !token.getIssuedAt().isAfter(clock.instant())
                        && token.getExpiresAt().isAfter(token.getIssuedAt())
                        && Duration.between(token.getIssuedAt(), token.getExpiresAt()).compareTo(Duration.ofMinutes(15)) <= 0
                        && token.getAudience().contains("hoopr-api")
                        && List.of("USER", "ADMIN").contains(token.getClaimAsString("role")))
                    return OAuth2TokenValidatorResult.success();
            } catch (RuntimeException ignored) { }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamp,
                new JwtIssuerValidator(settings.issuer()), claims));
        return decoder;
    }
    @Bean SecurityFilterChain securityFilterChain(HttpSecurity http, AuthSettings settings) throws Exception {
        var csrfRepo = new CookieCsrfTokenRepository();
        csrfRepo.setCookieCustomizer(c -> c.httpOnly(true).secure(settings.cookieSecure())
                .sameSite(settings.cookieSameSite()).path("/api/v1/auth"));
        // Return CSRF in JSON, keep the matching cookie HttpOnly; no server HTTP session.
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        var authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("role"); authorities.setAuthorityPrefix("ROLE_");
        var converter = new JwtAuthenticationConverter(); converter.setJwtGrantedAuthoritiesConverter(authorities);
        return http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(c -> c.disable())
                .cors(c -> { })
                .csrf(c -> c.csrfTokenRepository(csrfRepo).csrfTokenRequestHandler(csrfHandler)
                        // Only bearer-authenticated business requests bypass CSRF, never cookie auth routes.
                        .ignoringRequestMatchers(r -> !r.getRequestURI().startsWith(r.getContextPath() + "/api/v1/auth/")
                                && r.getHeader("Authorization") != null && r.getHeader("Authorization").startsWith("Bearer ")))
                .addFilterBefore(new OncePerRequestFilter() {
                    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                            FilterChain chain) throws ServletException, IOException {
                        if ("POST".equals(request.getMethod()) && request.getRequestURI().startsWith(request.getContextPath() + "/api/v1/auth/")
                                && !settings.origins().contains(request.getHeader("Origin"))) {
                            problem(response, 403); return;
                        }
                        chain.doFilter(request, response);
                    }
                }, CsrfFilter.class)
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.GET, "/api/v1/health", "/actuator/health", "/api/v1/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login",
                                "/api/v1/auth/refresh", "/api/v1/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/users/me").hasAnyRole("USER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/rides/me").hasAnyRole("USER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/bookings/me", "/api/v1/bookings/{id}", "/api/v1/rides/{id}/bookings").hasAnyRole("USER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/rides/{id}/bookings", "/api/v1/bookings/{id}/cancel").hasAnyRole("USER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/rides", "/api/v1/rides/{id}").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/rides", "/api/v1/rides/{id}/cancel").hasAnyRole("USER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/rides/{id}/start", "/api/v1/rides/{id}/complete").hasAnyRole("USER", "ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/rides/{id}").hasAnyRole("USER", "ADMIN")
                        .anyRequest().denyAll())
                .oauth2ResourceServer(o -> o.bearerTokenResolver(request -> {
                    // Resource-server CSRF exemptions must never apply to cookie-auth endpoints.
                    if (request.getRequestURI().startsWith(request.getContextPath() + "/api/v1/auth/")) return null;
                    return new org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver().resolve(request);
                }).jwt(j -> j.jwtAuthenticationConverter(converter))
                        .authenticationEntryPoint((r, s, e) -> problem(s, 401))
                        .accessDeniedHandler((r, s, e) -> problem(s, 403)))
                .exceptionHandling(e -> e.authenticationEntryPoint((r, s, ex) -> problem(s, 401))
                        .accessDeniedHandler((r, s, ex) -> problem(s, 403)))
                .headers(h -> h.cacheControl(c -> { }))
                .build();
    }
    private static void problem(HttpServletResponse response, int status) throws IOException {
        response.setStatus(status); response.setContentType("application/problem+json");
        response.setHeader("Cache-Control", "no-store");
        String title = status == 401 ? "Unauthorized" : "Forbidden";
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"" + title
                + "\",\"status\":" + status + ",\"detail\":\"Request is not authorized.\"}");
    }
}

