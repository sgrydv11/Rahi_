package com.hoopr.wallet;

import com.fasterxml.jackson.databind.JsonNode;
import com.hoopr.auth.AuthService;
import com.hoopr.payment.RazorpayGateway;
import com.hoopr.payment.StripeGateway;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/wallet")
public class WalletController {
    private final JdbcClient jdbc;
    private final AuthService auth;
    private final RazorpayGateway razorpay;
    private final StripeGateway stripe;
    private final String provider;

    public WalletController(NamedParameterJdbcTemplate jdbc, AuthService auth, RazorpayGateway razorpay,
                            StripeGateway stripe, @Value("${PAYMENT_PROVIDER:razorpay}") String provider) {
        this.jdbc = JdbcClient.create(jdbc);
        this.auth = auth;
        this.razorpay = razorpay;
        this.stripe = stripe;
        this.provider = provider;
    }

    @GetMapping
    public Balance balance(@AuthenticationPrincipal Jwt jwt) {
        return jdbc.sql("SELECT available_paise, reserved_paise FROM wallets WHERE user_id = :user")
                .param("user", user(jwt)).query((row, index) -> new Balance("INR", row.getLong(1), row.getLong(2)))
                .optional().orElse(new Balance("INR", 0, 0));
    }

    @GetMapping("/transactions")
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public History history(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "0") @Min(0) int page,
                           @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        UUID user = user(jwt);
        long count = jdbc.sql("SELECT count(*) FROM wallet_entries WHERE user_id = :user")
                .param("user", user).query(Long.class).single();
        var entries = jdbc.sql("""
                SELECT id, amount_paise, kind, created_at FROM wallet_entries WHERE user_id = :user
                ORDER BY created_at DESC, id LIMIT :size OFFSET :offset
                """).param("user", user).param("size", size).param("offset", (long) page * size)
                .query((row, index) -> new Entry(row.getObject("id", UUID.class), row.getLong("amount_paise"),
                        row.getString("kind"), row.getTimestamp("created_at").toInstant())).list();
        return new History(entries, page, (count + size - 1) / size);
    }

    @PostMapping("/top-ups")
    @Transactional
    public TopUp start(@AuthenticationPrincipal Jwt jwt, @RequestHeader("Idempotency-Key") UUID key,
                       @Valid @RequestBody Amount request) {
        UUID user = user(jwt);
        lockWallet(user);
        long amount = request.amountPaise();
        Stored existing = find(user, "request_key", key);
        if (existing != null) {
            if (existing.amount() != amount)
                throw new Failure(409, "IDEMPOTENCY_CONFLICT", "Use a new key for a different amount.");
            return response(existing);
        }
        boolean useStripe = "stripe".equals(provider);
        if (!(useStripe ? stripe.enabled() : razorpay.enabled()))
            throw new Failure(503, "PROVIDER_UNAVAILABLE", "Test checkout is unavailable.");
        UUID id = UUID.randomUUID();
        JsonNode order = useStripe ? stripe.walletCheckout(id, amount) : razorpay.order(id, amount);
        String orderId = reference(order, "id", useStripe ? "cs_test_" : "order_", 255);
        String url = null;
        if (useStripe) {
            validateStripe(id, orderId, amount, order);
            url = StripeGateway.checkoutUrl(order);
        } else if (!matchesAmount(order, "amount", amount, "INR")) throw mismatch();
        jdbc.sql("""
                INSERT INTO wallet_top_ups(id, user_id, request_key, amount_paise, provider, order_id, checkout_url)
                VALUES (:id, :user, :key, :amount, :provider, :order, :url)
                """).param("id", id).param("user", user).param("key", key).param("amount", amount)
                .param("provider", provider).param("order", orderId).param("url", url).update();
        return response(find(user, "id", id));
    }

    @GetMapping("/top-ups/{id}")
    public TopUp topUp(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        Stored topUp = find(user(jwt), "id", id);
        if (topUp == null) throw new Failure(404, "NOT_FOUND", "Top-up not found.");
        return response(topUp);
    }

    @PostMapping("/top-ups/{id}/sync")
    @Transactional
    public Operation sync(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return reconcile(user(jwt), id);
    }

    private Operation reconcile(UUID user, UUID id) {
        Stored topUp = find(user, "id", id);
        if (topUp == null) throw new Failure(404, "NOT_FOUND", "Top-up not found.");
        if (topUp.payment() != null) return operation(topUp);
        String capture = capture(topUp);
        if (capture == null) return operation(topUp);

        lockWallet(user);
        topUp = find(user, "id", id);
        if (topUp.payment() != null) return operation(topUp);
        jdbc.sql("UPDATE wallet_top_ups SET payment_id = :payment WHERE id = :id")
                .param("payment", capture).param("id", id).update();
        jdbc.sql("UPDATE wallets SET available_paise = available_paise + :amount WHERE user_id = :user")
                .param("amount", topUp.amount()).param("user", user).update();
        jdbc.sql("""
                INSERT INTO wallet_entries(id, user_id, amount_paise, kind)
                VALUES (:id, :user, :amount, 'TOP_UP')
                """).param("id", id).param("user", user).param("amount", topUp.amount()).update();
        return operation(find(user, "id", id));
    }

    private String capture(Stored topUp) {
        if ("stripe".equals(topUp.provider())) {
            JsonNode session = stripe.session(topUp.order());
            validateStripe(topUp.id(), topUp.order(), topUp.amount(), session);
            if (!"paid".equals(session.path("payment_status").asText())) return null;
            if (!"complete".equals(session.path("status").asText())) throw mismatch();
            return reference(session, "payment_intent", "pi_", 80);
        }
        JsonNode items = razorpay.orderPayments(topUp.order());
        if (!items.isArray()) throw mismatch();
        for (JsonNode item : items) {
            if (topUp.order().equals(item.path("order_id").asText()) &&
                    "captured".equals(item.path("status").asText()) && matchesAmount(item, "amount", topUp.amount(), "INR"))
                return reference(item, "id", "pay_", 80);
        }
        return null;
    }

    private void lockWallet(UUID user) {
        jdbc.sql("INSERT INTO wallets(user_id) VALUES (:user) ON CONFLICT DO NOTHING").param("user", user).update();
        jdbc.sql("SELECT user_id FROM wallets WHERE user_id = :user FOR UPDATE").param("user", user).query(UUID.class).single();
    }

    private Stored find(UUID user, String column, UUID value) {
        return jdbc.sql("SELECT * FROM wallet_top_ups WHERE user_id = :user AND " + column + " = :value")
                .param("user", user).param("value", value).query((row, index) -> new Stored(row.getObject("id", UUID.class),
                        row.getLong("amount_paise"), row.getString("provider"), row.getString("order_id"),
                        row.getString("checkout_url"), row.getString("payment_id"))).optional().orElse(null);
    }

    private TopUp response(Stored row) {
        boolean useStripe = "stripe".equals(row.provider());
        return new TopUp(operation(row), new Checkout(row.provider(), row.url(), useStripe ? null : razorpay.keyId(),
                useStripe ? null : row.order()));
    }

    private static Operation operation(Stored row) {
        return new Operation(row.id(), row.amount(), row.payment() == null ? "PENDING" : "SUCCEEDED");
    }

    private static void validateStripe(UUID id, String order, long amount, JsonNode session) {
        if (!order.equals(session.path("id").asText()) || !id.toString().equals(session.path("client_reference_id").asText()) ||
                !session.path("livemode").isBoolean() || session.path("livemode").asBoolean() ||
                !"payment".equals(session.path("mode").asText()) || !matchesAmount(session, "amount_total", amount, "inr"))
            throw mismatch();
    }

    private static boolean matchesAmount(JsonNode value, String field, long amount, String currency) {
        return value.path(field).isIntegralNumber() && value.path(field).asLong(-1) == amount &&
                currency.equals(value.path("currency").asText());
    }

    private static String reference(JsonNode node, String field, String prefix, int limit) {
        String value = node.path(field).asText();
        if (value.length() > limit || !value.matches(prefix + "[A-Za-z0-9_]+")) throw mismatch();
        return value;
    }

    private UUID user(Jwt jwt) { return auth.profile(UUID.fromString(jwt.getSubject())).id(); }
    private static Failure mismatch() {
        return new Failure(502, "PROVIDER_RESPONSE_INVALID", "Payment provider returned an unexpected response.");
    }

    @ExceptionHandler(Failure.class)
    ProblemDetail problem(Failure failure) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(failure.status), failure.getMessage());
        detail.setProperty("code", failure.code);
        return detail;
    }

    private static final class Failure extends RuntimeException {
        final int status;
        final String code;
        Failure(int status, String code, String message) {
            super(message);
            this.status = status;
            this.code = code;
        }
    }

    private record Stored(UUID id, long amount, String provider, String order, String url, String payment) {}
    public record Amount(@NotNull @Min(100) @Max(1000000) Long amountPaise) {}
    public record Balance(String currency, long availablePaise, long reservedPaise) {}
    public record Entry(UUID id, long amountPaise, String kind, Instant createdAt) {}
    public record History(List<Entry> content, int page, long totalPages) {}
    public record Operation(UUID id, long amountPaise, String status) {}
    public record Checkout(String provider, String checkoutUrl, String keyId, String orderId) {}
    public record TopUp(Operation operation, Checkout checkout) {}
}
