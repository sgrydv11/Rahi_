package com.hoopr.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.hoopr.auth.AuthService;
import com.hoopr.booking.BookingFailure;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bookings/{id}/payment")
public class PaymentController {
    private final JdbcTemplate jdbc;
    private final RazorpayGateway gateway;
    private final StripeGateway stripe;
    private final String defaultProvider;
    private final AuthService auth;
    private final Clock clock;

    public PaymentController(NamedParameterJdbcTemplate jdbc, RazorpayGateway gateway, StripeGateway stripe,
                             AuthService auth, Clock clock, @Value("${PAYMENT_PROVIDER:razorpay}") String defaultProvider) {
        this.jdbc = jdbc.getJdbcTemplate();
        this.gateway = gateway;
        this.stripe = stripe;
        if (!Set.of("razorpay", "stripe").contains(defaultProvider))
            throw new IllegalArgumentException("PAYMENT_PROVIDER must be razorpay or stripe");
        this.defaultProvider = defaultProvider;
        this.auth = auth;
        this.clock = clock;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public View status(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Fare fare = fare(id, jwt, false);
        return view(fare, stored(id));
    }

    @PostMapping("/order")
    @Transactional
    public View order(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Fare fare = fare(id, jwt, true);
        Payment existing = stored(id);
        String provider = provider(existing);
        requireEnabled(provider);
        if (!payable(fare) || (existing != null && existing.paymentId() != null))
            throw new BookingFailure(409, "This booking is not eligible for checkout.");
        if ("stripe".equals(provider)) return stripeOrder(id, fare, existing);
        if (existing == null) {
            JsonNode order = gateway.order(id, fare.amount());
            String orderId = providerId(order, "order");
            if (!matchesAmount(order, fare.amount()) || !"INR".equals(order.path("currency").asText()))
                throw providerMismatch();
            jdbc.update("INSERT INTO booking_payments(booking_id, order_id, amount, currency) VALUES (?, ?, ?, 'INR')",
                    id, orderId, fare.amount());
        }
        return view(fare, stored(id));
    }

    private View stripeOrder(UUID id, Fare fare, Payment existing) {
        JsonNode session = existing == null ? null : stripe.session(existing.orderId());
        if (session != null) {
            validateStripeSession(id, existing, session);
            if ("paid".equals(session.path("payment_status").asText())) {
                recordStripeCapture(id, session);
                return view(fare, stored(id));
            }
        }
        boolean create = session == null || "expired".equals(session.path("status").asText());
        if (create) {
            session = stripe.checkout(id, fare.amount(), existing == null ? null : existing.orderId());
            String sessionId = stripeId(session.path("id"), "cs_test_");
            validateStripeSession(id, new Payment("stripe", sessionId, fare.amount(), null, null, null, null), session);
        }
        if (!"open".equals(session.path("status").asText()))
            throw new BookingFailure(409, "Stripe checkout is awaiting payment confirmation.");
        String url = StripeGateway.checkoutUrl(session);
        if (create) {
            jdbc.update("""
                    INSERT INTO booking_payments(booking_id, provider, order_id, amount, currency)
                    VALUES (?, 'stripe', ?, ?, 'INR')
                    ON CONFLICT (booking_id) DO UPDATE SET order_id = EXCLUDED.order_id
                    """, id, session.path("id").asText(), fare.amount());
        }
        return view(fare, stored(id), url);
    }

    @PostMapping("/verify")
    @Transactional
    public View verify(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Verify body) {
        Fare fare = fare(id, jwt, true);
        Payment payment = requirePayment(id);
        if (!"razorpay".equals(payment.provider()))
            throw new BookingFailure(409, "Check Stripe payment status to verify this order.");
        requireEnabled(payment.provider());
        if (!gateway.validSignature(payment.orderId(), body.paymentId(), body.signature()))
            throw new BookingFailure(400, "Invalid Razorpay checkout signature.");
        if (payment.paymentId() != null) {
            if (!payment.paymentId().equals(body.paymentId()))
                throw new BookingFailure(409, "A different payment was already recorded.");
            return view(fare, payment);
        }
        JsonNode captured = gateway.payment(body.paymentId());
        if (!body.paymentId().equals(captured.path("id").asText()) || !matchesCapture(payment, captured))
            throw new BookingFailure(409, "Razorpay has not confirmed a matching captured payment.");
        recordCapture(id, captured);
        return view(fare, stored(id));
    }

    @PostMapping("/sync")
    @Transactional
    public View sync(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Fare fare = fare(id, jwt, true);
        Payment payment = requirePayment(id);
        requireEnabled(payment.provider());
        if ("stripe".equals(payment.provider())) {
            if (payment.paymentId() == null) {
                JsonNode session = stripe.session(payment.orderId());
                validateStripeSession(id, payment, session);
                if ("paid".equals(session.path("payment_status").asText())) recordStripeCapture(id, session);
            } else if ("pending".equals(payment.refundStatus())) {
                recordStripeRefund(id, payment, stripe.refundStatus(payment.refundId()));
            }
        } else if (payment.paymentId() == null) {
            JsonNode items = gateway.orderPayments(payment.orderId());
            if (!items.isArray()) throw providerMismatch();
            for (JsonNode item : items) {
                if (matchesCapture(payment, item)) {
                    recordCapture(id, item);
                    break;
                }
            }
        } else if ("pending".equals(payment.refundStatus())) {
            recordRefund(id, payment, gateway.refundStatus(payment.paymentId(), payment.refundId()));
        }
        return view(fare, stored(id));
    }

    @PostMapping("/refund")
    @Transactional
    public View refund(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Fare fare = fare(id, jwt, true);
        Payment payment = requirePayment(id);
        requireEnabled(payment.provider());
        if (payment.paymentId() == null || !fare.bookingStatus().startsWith("CANCELLED_"))
            throw new BookingFailure(409, "Only a captured payment for a cancelled booking can be refunded.");
        if (payment.refundId() == null) {
            if ("stripe".equals(payment.provider()))
                recordStripeRefund(id, payment, stripe.refund(id, payment.paymentId(), payment.amount()));
            else recordRefund(id, payment, gateway.refund(id, payment.paymentId(), payment.amount()));
        }
        return view(fare, stored(id));
    }

    private Fare fare(UUID id, Jwt jwt, boolean lock) {
        UUID passenger = auth.profile(UUID.fromString(jwt.getSubject())).id();
        return jdbc.query("""
                SELECT b.status, b.currency, b.price_per_seat_snapshot * b.seats_booked AS total,
                       r.status AS ride_status, r.departure_at
                FROM bookings b JOIN rides r ON r.id = b.ride_id
                WHERE b.id = ? AND b.passenger_id = ?
                """ + (lock ? " FOR UPDATE OF b" : ""), (row, index) -> new Fare(
                row.getBigDecimal("total").movePointRight(2).longValueExact(),
                row.getString("currency"), row.getString("status"), row.getString("ride_status"),
                row.getTimestamp("departure_at").toInstant()), id, passenger).stream().findFirst()
                .orElseThrow(() -> new BookingFailure(404, "Passenger booking not found."));
    }

    private Payment stored(UUID id) {
        return jdbc.query("SELECT * FROM booking_payments WHERE booking_id = ?", (row, index) -> {
            Timestamp paidAt = row.getTimestamp("paid_at");
            return new Payment(row.getString("provider"), row.getString("order_id"), row.getLong("amount"), row.getString("payment_id"),
                    paidAt == null ? null : paidAt.toInstant(), row.getString("refund_id"), row.getString("refund_status"));
        }, id).stream().findFirst().orElse(null);
    }

    private Payment requirePayment(UUID id) {
        Payment payment = stored(id);
        if (payment == null) throw new BookingFailure(409, "Create a checkout order first.");
        return payment;
    }

    private String provider(Payment payment) { return payment == null ? defaultProvider : payment.provider(); }

    private boolean enabled(String provider) { return "stripe".equals(provider) ? stripe.enabled() : gateway.enabled(); }

    private void requireEnabled(String provider) {
        if (!enabled(provider)) throw new BookingFailure(503, "The selected payment provider is not configured for test mode.");
    }

    private static void validateStripeSession(UUID booking, Payment payment, JsonNode session) {
        if (!payment.orderId().equals(session.path("id").asText()) ||
                !booking.toString().equals(session.path("client_reference_id").asText()) ||
                !session.path("livemode").isBoolean() || session.path("livemode").asBoolean() ||
                !"payment".equals(session.path("mode").asText()) || !"inr".equals(session.path("currency").asText()) ||
                session.path("amount_total").asLong(-1) != payment.amount())
            throw new BookingFailure(502, "Stripe returned an unexpected Checkout Session.");
    }

    private void recordStripeCapture(UUID id, JsonNode session) {
        if (!"complete".equals(session.path("status").asText()))
            throw new BookingFailure(502, "Stripe has not confirmed the completed Checkout Session.");
        jdbc.update("UPDATE booking_payments SET payment_id = ?, paid_at = CURRENT_TIMESTAMP WHERE booking_id = ?",
                stripeId(session.path("payment_intent"), "pi_"), id);
    }

    private void recordStripeRefund(UUID id, Payment payment, JsonNode refund) {
        String refundId = stripeId(refund.path("id"), "re_");
        if (!payment.paymentId().equals(refund.path("payment_intent").asText()) ||
                !matchesAmount(refund, payment.amount()) || !"inr".equals(refund.path("currency").asText()) ||
                (payment.refundId() != null && !payment.refundId().equals(refundId)))
            throw new BookingFailure(502, "Stripe returned an unexpected refund response.");
        String status = switch (refund.path("status").asText()) {
            case "succeeded" -> "processed";
            case "pending", "requires_action" -> "pending";
            case "failed", "canceled" -> "failed";
            default -> throw new BookingFailure(502, "Stripe returned an unknown refund status.");
        };
        jdbc.update("UPDATE booking_payments SET refund_id = ?, refund_status = ? WHERE booking_id = ?", refundId, status, id);
    }

    private static String stripeId(JsonNode node, String prefix) {
        String id = node.asText();
        if (!id.matches(prefix + "[A-Za-z0-9]{1,200}")) throw new BookingFailure(502, "Stripe returned an invalid reference.");
        return id;
    }

    private boolean payable(Fare fare) {
        return "INR".equals(fare.currency()) && fare.amount() >= 100 && "CONFIRMED".equals(fare.bookingStatus())
                && Set.of("SCHEDULED", "PUBLISHED").contains(fare.rideStatus()) && fare.departure().isAfter(clock.instant());
    }

    private static boolean matchesAmount(JsonNode response, long amount) {
        return response.path("amount").isIntegralNumber() && response.path("amount").canConvertToLong()
                && response.path("amount").asLong() == amount;
    }

    private static boolean matchesCapture(Payment payment, JsonNode response) {
        return payment.orderId().equals(response.path("order_id").asText()) && matchesAmount(response, payment.amount())
                && "INR".equals(response.path("currency").asText()) && "captured".equals(response.path("status").asText());
    }

    private void recordCapture(UUID id, JsonNode captured) {
        jdbc.update("UPDATE booking_payments SET payment_id = ?, paid_at = CURRENT_TIMESTAMP WHERE booking_id = ?",
                providerId(captured, "pay"), id);
    }

    private void recordRefund(UUID id, Payment payment, JsonNode refund) {
        String refundId = providerId(refund, "rfnd");
        String status = refund.path("status").asText();
        if (!payment.paymentId().equals(refund.path("payment_id").asText()) || !matchesAmount(refund, payment.amount())
                || (payment.refundId() != null && !payment.refundId().equals(refundId))
                || !Set.of("pending", "processed", "failed").contains(status)) throw providerMismatch();
        jdbc.update("UPDATE booking_payments SET refund_id = ?, refund_status = ? WHERE booking_id = ?", refundId, status, id);
    }

    private static String providerId(JsonNode response, String prefix) {
        String id = response.path("id").asText();
        if (!id.matches(prefix + "_[A-Za-z0-9]{1,64}")) throw providerMismatch();
        return id;
    }

    private static BookingFailure providerMismatch() {
        return new BookingFailure(502, "Razorpay returned an unexpected payment response.");
    }

    private View view(Fare fare, Payment payment) {
        return view(fare, payment, null);
    }

    private View view(Fare fare, Payment payment, String checkoutUrl) {
        String provider = provider(payment);
        boolean enabled = enabled(provider);
        boolean captured = payment != null && payment.paymentId() != null;
        return new View(enabled, enabled && payable(fare) && !captured,
                enabled && captured && payment.refundId() == null && fare.bookingStatus().startsWith("CANCELLED_"),
                payment == null ? fare.amount() : payment.amount(), fare.currency(), enabled && "razorpay".equals(provider) ? gateway.keyId() : null,
                payment == null ? null : payment.orderId(), captured ? payment.paymentId() : null,
                captured ? payment.paidAt() : null, payment == null ? null : payment.refundId(),
                payment == null ? null : payment.refundStatus(), provider, checkoutUrl);
    }

    private record Fare(long amount, String currency, String bookingStatus, String rideStatus, Instant departure) { }
    private record Payment(String provider, String orderId, long amount, String paymentId, Instant paidAt, String refundId, String refundStatus) { }
    public record View(boolean enabled, boolean canPay, boolean canRefund, long amount, String currency, String keyId,
                       String orderId, String paymentId, Instant paidAt, String refundId, String refundStatus,
                       String provider, String checkoutUrl) { }
    public record Verify(@NotBlank @Pattern(regexp = "pay_[A-Za-z0-9]{1,64}") String paymentId,
                         @NotBlank @Pattern(regexp = "[0-9a-fA-F]{64}") String signature) { }
}
