package com.hoopr.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.hoopr.booking.BookingFailure;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class RazorpayGateway {
    private final RestClient api;
    private final String keyId;
    private final String secret;

    public RazorpayGateway(@Value("${RAZORPAY_KEY_ID:}") String keyId,
                           @Value("${RAZORPAY_KEY_SECRET:}") String secret) {
        this.keyId = keyId;
        this.secret = secret;
        var factory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(Duration.ofSeconds(4));
        factory.setReadTimeout(Duration.ofSeconds(8));
        api = RestClient.builder().baseUrl("https://api.razorpay.com/v1").requestFactory(factory)
                .defaultHeaders(headers -> { if (enabled()) headers.setBasicAuth(keyId, secret); }).build();
    }

    public boolean enabled() { return keyId.matches("rzp_test_[A-Za-z0-9]+") && !secret.isBlank(); }
    public String keyId() { return keyId; }

    public JsonNode order(UUID booking, long amount) {
        return call(() -> api.post().uri("/orders").body(Map.of("amount", amount, "currency", "INR",
                "receipt", booking.toString())).retrieve().body(JsonNode.class));
    }

    public JsonNode payment(String id) {
        return call(() -> api.get().uri("/payments/{id}", id).retrieve().body(JsonNode.class));
    }

    public JsonNode orderPayments(String order) {
        return call(() -> api.get().uri("/orders/{id}/payments", order).retrieve().body(JsonNode.class)).path("items");
    }

    public JsonNode refund(UUID booking, String payment, long amount) {
        return call(() -> api.post().uri("/payments/{id}/refund", payment)
                .header("X-Refund-Idempotency", booking.toString())
                .body(Map.of("amount", amount, "receipt", booking.toString()))
                .retrieve().body(JsonNode.class));
    }

    public JsonNode refundStatus(String payment, String refund) {
        return call(() -> api.get().uri("/payments/{payment}/refunds/{refund}", payment, refund)
                .retrieve().body(JsonNode.class));
    }

    public boolean validSignature(String order, String payment, String signature) {
        if (!signature.matches("[0-9a-fA-F]{64}") || !enabled()) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal((order + "|" + payment).getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(expected, HexFormat.of().parseHex(signature));
        } catch (GeneralSecurityException failure) {
            throw new IllegalStateException("Payment signature verification is unavailable", failure);
        }
    }

    private JsonNode call(Supplier<JsonNode> request) {
        if (!enabled()) throw new BookingFailure(503, "Razorpay test mode is not configured.");
        try {
            JsonNode result = request.get();
            if (result != null) return result;
        } catch (RestClientException failure) {
            throw new BookingFailure(502, "Razorpay could not confirm the request. Check payment status before retrying.");
        }
        throw new BookingFailure(502, "Razorpay returned an empty response.");
    }
}
