package com.hoopr.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.hoopr.booking.BookingFailure;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class StripeGateway {
    private final RestClient api;
    private final String key;
    private final String frontendOrigin;

    public StripeGateway(@Value("${STRIPE_SECRET_KEY:}") String key,
                         @Value("${STRIPE_FRONTEND_ORIGIN:http://localhost:5173}") String frontendOrigin) {
        this.key = key;
        this.frontendOrigin = frontendOrigin;
        var factory = new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(4000);
        factory.setReadTimeout(8000);
        api = RestClient.builder().baseUrl("https://api.stripe.com/v1").requestFactory(factory)
                .defaultHeaders(headers -> { if (enabled()) headers.setBearerAuth(key); }).build();
    }

    public boolean enabled() { return key.matches("(sk|rk)_test_[A-Za-z0-9]+"); }

    public JsonNode checkout(UUID booking, long amount, String previous) {
        return checkout(booking, amount, previous, "/bookings/" + booking);
    }

    public JsonNode groupCheckout(UUID hold, long amount) {
        return checkout(hold, amount, null, "/");
    }

    private JsonNode checkout(UUID booking, long amount, String previous, String returnPath) {
        String returnUrl = frontendOrigin.replaceFirst("/+$", "") + returnPath;
        var form = new LinkedMultiValueMap<String, String>();
        form.add("mode", "payment");
        form.add("payment_method_types[0]", "card");
        form.add("line_items[0][quantity]", "1");
        form.add("line_items[0][price_data][currency]", "inr");
        form.add("line_items[0][price_data][unit_amount]", Long.toString(amount));
        form.add("line_items[0][price_data][product_data][name]", "Hoopr test ride fare");
        form.add("client_reference_id", booking.toString());
        form.add("success_url", returnUrl);
        form.add("cancel_url", returnUrl);
        return call(() -> api.post().uri("/checkout/sessions")
                .header("Idempotency-Key", booking + "-checkout-" + (previous == null ? "initial" : previous))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(JsonNode.class));
    }

    public JsonNode session(String id) {
        return call(() -> api.get().uri("/checkout/sessions/{id}", id).retrieve().body(JsonNode.class));
    }

    public JsonNode refund(UUID booking, String payment, long amount) {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("payment_intent", payment);
        form.add("amount", Long.toString(amount));
        return call(() -> api.post().uri("/refunds").header("Idempotency-Key", booking + "-refund")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(JsonNode.class));
    }

    public JsonNode refundStatus(String refund) {
        return call(() -> api.get().uri("/refunds/{id}", refund).retrieve().body(JsonNode.class));
    }

    public static String checkoutUrl(JsonNode session) {
        String value = session.path("url").asText();
        try {
            URI uri = URI.create(value);
            if ("https".equals(uri.getScheme()) && "checkout.stripe.com".equals(uri.getHost()) &&
                    uri.getUserInfo() == null && uri.getPort() == -1) return value;
        } catch (IllegalArgumentException ignored) {
            // Treat malformed URLs like any other unexpected provider response.
        }
        throw new BookingFailure(502, "Stripe did not return a valid Checkout URL.");
    }

    private JsonNode call(Supplier<JsonNode> request) {
        if (!enabled()) throw new BookingFailure(503, "Stripe test mode is not configured.");
        try {
            JsonNode result = request.get();
            if (result != null) return result;
        } catch (RestClientException failure) {
            throw new BookingFailure(502, "Stripe could not confirm the request. Check payment status before retrying.");
        }
        throw new BookingFailure(502, "Stripe returned an empty response.");
    }
}
