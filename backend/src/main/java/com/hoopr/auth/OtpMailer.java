package com.hoopr.auth;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class OtpMailer {
    private final RestClient client;
    private final String apiKey;
    private final String from;
    public OtpMailer(@Value("${RESEND_API_KEY:}") String apiKey, @Value("${OTP_EMAIL_FROM:}") String from) {
        this.apiKey = apiKey; this.from = from;
        var factory = new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method); connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(Duration.ofSeconds(4)); factory.setReadTimeout(Duration.ofSeconds(8));
        client = RestClient.builder().baseUrl("https://api.resend.com").requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + apiKey).build();
    }
    public void deliver(String email, String code) {
        if (apiKey.isBlank() || from.isBlank())
            throw new AuthFailure(503, "Email verification is awaiting email delivery setup. Please try again later.");
        try {
            var result = client.post().uri("/emails").body(Map.of("from", from, "to", List.of(email),
                    "subject", "Your FlexirRides sign-in code", "text", "Your FlexirRides code is " + code
                            + ". It expires in 5 minutes. Do not share it. If you did not request this code, ignore this email."))
                    .retrieve().body(JsonNode.class);
            if (result == null || result.path("id").asText().isBlank()) throw unavailable();
        } catch (RestClientException failure) { throw unavailable(); }
    }
    private static AuthFailure unavailable() { return new AuthFailure(503, "We could not send your verification email. Please try again later."); }
}
