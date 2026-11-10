package com.hoopr.auth;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.util.HtmlUtils;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class OtpMailer {
    private final RestClient client;
    private final String apiKey;
    private final String from;
    private final boolean enabled;
    private final boolean brevo;
    private final String senderName;
    private final String template;

    public OtpMailer(@Value("${BREVO_API_KEY:}") String brevoKey, @Value("${RESEND_API_KEY:}") String resendKey,
                     @Value("${OTP_EMAIL_FROM:}") String from,
                     @Value("${OTP_EMAIL_FROM_NAME:FlexirRides}") String senderName,
                     @Value("${EMAIL_OTP_ENABLED:false}") boolean enabled) {
        this.enabled = enabled;
        this.brevo = !brevoKey.isBlank();
        this.apiKey = brevo ? brevoKey : resendKey;
        this.from = from;
        this.senderName = senderName;
        try {
            template = new ClassPathResource("email/otp.html").getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException failure) {
            throw new IllegalStateException("Could not load verification email template", failure);
        }
        var factory = new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method); connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(Duration.ofSeconds(4)); factory.setReadTimeout(Duration.ofSeconds(8));
        client = RestClient.builder().baseUrl(brevo ? "https://api.brevo.com" : "https://api.resend.com")
                .requestFactory(factory)
                .defaultHeader(brevo ? "api-key" : "Authorization", brevo ? apiKey : "Bearer " + apiKey).build();
    }
    public void deliver(String email, String code) {
        if (!enabled) throw new AuthFailure(503, "Email OTP is paused. Sign in with your email and password.");
        if (apiKey.isBlank() || from.isBlank())
            throw new AuthFailure(503, "Email verification is awaiting email delivery setup. Please try again later.");
        try {
            String subject = "Your FlexirRides verification code";
            String text = "Your FlexirRides code is " + code
                    + ". It expires in 5 minutes. Do not share it. If you did not request this code, ignore this email.";
            String html = template.replace("{{CODE}}", HtmlUtils.htmlEscape(code));
            var payload = brevo
                    ? Map.of("sender", Map.of("email", from, "name", senderName), "to", List.of(Map.of("email", email)),
                            "subject", subject, "textContent", text, "htmlContent", html)
                    : Map.of("from", from, "to", List.of(email), "subject", subject, "text", text, "html", html);
            var result = client.post().uri(brevo ? "/v3/smtp/email" : "/emails").body(payload)
                    .retrieve().body(JsonNode.class);
            if (result == null || result.path(brevo ? "messageId" : "id").asText("").isBlank()) throw unavailable();
        } catch (RestClientException failure) { throw unavailable(); }
    }
    private static AuthFailure unavailable() { return new AuthFailure(503, "We could not send your verification email. Please try again later."); }
}
