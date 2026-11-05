package com.hoopr.ride;

import com.fasterxml.jackson.databind.JsonNode;
import com.hoopr.auth.AuthService;
import com.hoopr.booking.BookingService;
import com.hoopr.payment.RazorpayGateway;
import com.hoopr.payment.StripeGateway;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.ProblemDetail;
import org.springframework.http.HttpStatusCode;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/group/holds")
public class GroupHoldController {
    private final RideRepository rides;
    private final GroupSeatInventory inventory;
    private final JdbcClient jdbc;
    private final Clock clock;
    private final BookingService bookings;
    private final AuthService auth;
    private final RazorpayGateway razorpay;
    private final StripeGateway stripe;
    private final String provider;

    public GroupHoldController(RideRepository rides, GroupSeatInventory inventory, NamedParameterJdbcTemplate jdbc, Clock clock,
                               BookingService bookings, AuthService auth, RazorpayGateway razorpay, StripeGateway stripe,
                               @Value("${PAYMENT_PROVIDER:razorpay}") String provider) {
        this.rides = rides;
        this.inventory = inventory;
        this.jdbc = JdbcClient.create(jdbc);
        this.clock = clock;
        this.bookings = bookings;
        this.auth = auth;
        this.razorpay = razorpay;
        this.stripe = stripe;
        this.provider = provider;
    }

    @PostMapping
    @Transactional
    public Hold create(@AuthenticationPrincipal Jwt jwt, @RequestHeader("Idempotency-Key") UUID key,
                       @Valid @RequestBody Request request) {
        UUID passenger = auth.profile(user(jwt)).id();
        var existing = replay(passenger, key);
        if (existing.isPresent()) return match(existing.get(), request);
        Ride ride = rides.lockById(request.rideId()).orElseThrow(GroupHoldController::missing);
        existing = replay(passenger, key);
        if (existing.isPresent()) return match(existing.get(), request);
        Instant now = clock.instant();
        if (ride.driverId.equals(passenger) || !"INR".equals(ride.currency) ||
                ride.pricePerSeat.movePointRight(2).longValueExact() < 100)
            throw new Failure(400, "INVALID_REQUEST", "Choose an eligible seat offer.");
        if (!("SCHEDULED".equals(ride.status) || "PUBLISHED".equals(ride.status)) || !ride.departureAt.isAfter(now))
            throw new Failure(409, "SOLD_OUT", "This ride is no longer available.");
        if (inventory.hasHold(ride.id, passenger, utc(now)))
            throw new Failure(409, "ACTIVE_HOLD", "You already have a seat hold on this ride.");
        boolean booked = jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM bookings
                WHERE ride_id = :ride AND passenger_id = :passenger AND status = 'CONFIRMED')
                """).param("ride", ride.id).param("passenger", passenger).query(Boolean.class).single();
        if (booked) throw new Failure(409, "ACTIVE_BOOKING", "You already have a booking on this ride.");
        if (ride.availableSeats - inventory.heldSeats(ride.id, now) < request.seats())
            throw new Failure(409, "SOLD_OUT", "There are not enough seats available.");
        Instant deadline = now.plusSeconds(300);
        Instant expiresAt = deadline.isBefore(ride.departureAt) ? deadline : ride.departureAt;
        long fare = ride.pricePerSeat.movePointRight(2).longValueExact() * request.seats();
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO group_seat_holds (id, ride_id, passenger_id, request_key, seats, fare_paise, expires_at, status)
                VALUES (:id, :ride, :passenger, :key, :seats, :fare, :expires, 'HELD')
                ON CONFLICT (passenger_id, request_key) DO NOTHING
                """).param("id", id).param("ride", ride.id).param("passenger", passenger).param("key", key)
                .param("seats", request.seats()).param("fare", fare).param("expires", utc(expiresAt)).update();
        return match(replay(passenger, key).orElseThrow(), request);
    }

    @GetMapping("/{id}")
    public Hold get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return owned(user(jwt), id);
    }

    @PostMapping("/{id}/cancel")
    @Transactional
    public Hold cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        UUID passenger = auth.profile(user(jwt)).id();
        Hold hold = owned(passenger, id);
        rides.lockById(hold.rideId()).orElseThrow(GroupHoldController::missing);
        jdbc.sql("""
                UPDATE group_seat_holds SET status = 'CANCELLED'
                WHERE id = :id AND status = 'HELD' AND expires_at > :now
                """).param("id", id).param("now", utc(clock.instant())).update();
        return owned(passenger, id);
    }

    @PostMapping("/{id}/checkout")
    @Transactional
    public Checkout checkout(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                             @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody CheckoutRequest request) {
        UUID passenger = auth.profile(user(jwt)).id();
        lock(passenger, id);
        Hold hold = owned(passenger, id);
        Payment payment = payment(id);
        if (!"PROVIDER".equals(request.method())) {
            if (key.equals(payment.key())) throw new Failure(409, "IDEMPOTENCY_CONFLICT", "Checkout method changed.");
            throw new Failure(409, "METHOD_UNAVAILABLE", "Wallet checkout is unavailable.");
        }
        if (!active(hold)) throw new Failure(409, "HOLD_EXPIRED", "This hold is no longer payable.");
        if (payment.order() == null) {
            boolean useStripe = "stripe".equals(provider);
            if (!(useStripe ? stripe.enabled() : razorpay.enabled()))
                throw new Failure(503, "PROVIDER_UNAVAILABLE", "Test checkout is unavailable.");
            long amount = hold.quote().totalPaise();
            JsonNode result = useStripe ? stripe.groupCheckout(id, amount) : razorpay.order(id, amount);
            String order = reference(result, "id", useStripe ? "cs_test_" : "order_", 255);
            String url = useStripe ? StripeGateway.checkoutUrl(result) : null;
            if (useStripe) {
                validateStripe(id, order, amount, result);
            } else if (!amountMatches(result, "amount", amount, "INR")) throw mismatch();
            jdbc.sql("""
                    UPDATE group_seat_holds SET checkout_key = :key, provider = :provider,
                        order_id = :order, checkout_url = :url WHERE id = :id
                    """).param("key", key).param("provider", provider).param("order", order)
                    .param("url", url).param("id", id).update();
            payment = payment(id);
        }
        boolean useStripe = "stripe".equals(payment.provider());
        return new Checkout(owned(passenger, id), new CheckoutDetails(payment.provider(), payment.url(),
                useStripe ? null : razorpay.keyId(), useStripe ? null : payment.order()));
    }

    @PostMapping("/{id}/sync")
    @Transactional
    public Hold sync(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return reconcile(user(jwt), id);
    }

    @Transactional
    public Hold reconcile(UUID passenger, UUID id) {
        Ride ride = lock(passenger, id);
        Hold hold = owned(passenger, id);
        Payment payment = payment(id);
        if (payment.order() == null || "CONFIRMED".equals(hold.status()) || "REFUNDED".equals(hold.status())) return hold;
        long amount = hold.quote().totalPaise();
        boolean useStripe = "stripe".equals(payment.provider());
        if ("REFUND_PENDING".equals(hold.status())) {
            refund(id, payment, amount, useStripe);
            return owned(passenger, id);
        }
        String capture = capture(id, payment, amount, useStripe);
        if (capture == null) return owned(passenger, id);

        hold = owned(passenger, id);
        Instant now = clock.instant();
        boolean accountActive = jdbc.sql("SELECT status = 'ACTIVE' FROM users WHERE id = :id")
                .param("id", passenger).query(Boolean.class).single();
        if (!accountActive || !active(hold) || !ride.departureAt.isAfter(now) ||
                !("SCHEDULED".equals(ride.status) || "PUBLISHED".equals(ride.status))) {
            jdbc.sql("UPDATE group_seat_holds SET status = 'REFUND_PENDING', payment_id = :capture WHERE id = :id")
                    .param("id", id).param("capture", capture).update();
            return owned(passenger, id);
        }

        // Remove our hold from inventory inside the transaction before using the regular booking path.
        jdbc.sql("UPDATE group_seat_holds SET status = 'CONFIRMED', payment_id = :capture WHERE id = :id")
                .param("id", id).param("capture", capture).update();
        UUID booking = bookings.create(ride.id, passenger, id, hold.seats()).booking().id();
        jdbc.sql("""
                INSERT INTO booking_payments (booking_id, provider, order_id, amount, currency, payment_id, paid_at)
                VALUES (:booking, :provider, :order, :amount, 'INR', :capture, :now)
                """).param("booking", booking).param("provider", payment.provider()).param("order", payment.order())
                .param("amount", amount).param("capture", capture).param("now", utc(now)).update();
        jdbc.sql("UPDATE group_seat_holds SET booking_id = :booking WHERE id = :id")
                .param("id", id).param("booking", booking).update();
        return owned(passenger, id);
    }

    private String capture(UUID id, Payment payment, long amount, boolean useStripe) {
        if (useStripe) {
            JsonNode session = stripe.session(payment.order());
            validateStripe(id, payment.order(), amount, session);
            if (!"paid".equals(session.path("payment_status").asText())) return null;
            if (!"complete".equals(session.path("status").asText())) throw mismatch();
            return reference(session, "payment_intent", "pi_", 80);
        }
        JsonNode items = razorpay.orderPayments(payment.order());
        if (!items.isArray()) throw mismatch();
        for (JsonNode item : items) {
            if (payment.order().equals(item.path("order_id").asText()) &&
                    "captured".equals(item.path("status").asText()) && amountMatches(item, "amount", amount, "INR"))
                return reference(item, "id", "pay_", 80);
        }
        return null;
    }

    private void refund(UUID id, Payment payment, long amount, boolean useStripe) {
        JsonNode result;
        if (useStripe) result = payment.refund() == null ? stripe.refund(id, payment.capture(), amount) : stripe.refundStatus(payment.refund());
        else result = payment.refund() == null ? razorpay.refund(id, payment.capture(), amount) :
                razorpay.refundStatus(payment.capture(), payment.refund());
        String refund = reference(result, "id", useStripe ? "re_" : "rfnd_", 80);
        if ((payment.refund() != null && !payment.refund().equals(refund)) ||
                !payment.capture().equals(result.path(useStripe ? "payment_intent" : "payment_id").asText()) ||
                !(useStripe ? amountMatches(result, "amount", amount, "inr") : result.path("amount").asLong(-1) == amount))
            throw mismatch();
        boolean done = (useStripe ? "succeeded" : "processed").equals(result.path("status").asText());
        jdbc.sql("UPDATE group_seat_holds SET refund_id = :refund, status = :status WHERE id = :id")
                .param("id", id).param("refund", refund).param("status", done ? "REFUNDED" : "REFUND_PENDING").update();
    }

    private Ride lock(UUID passenger, UUID id) {
        return rides.lockById(owned(passenger, id).rideId()).orElseThrow(GroupHoldController::missing);
    }

    private Payment payment(UUID id) {
        return jdbc.sql("SELECT checkout_key, provider, order_id, checkout_url, payment_id, refund_id FROM group_seat_holds WHERE id = :id")
                .param("id", id).query((row, index) -> new Payment(row.getObject("checkout_key", UUID.class),
                        row.getString("provider"), row.getString("order_id"), row.getString("checkout_url"),
                        row.getString("payment_id"), row.getString("refund_id"))).single();
    }

    private static boolean active(Hold hold) {
        return "HELD".equals(hold.status()) || "PAYMENT_PENDING".equals(hold.status());
    }

    private static void validateStripe(UUID id, String order, long amount, JsonNode session) {
        if (!order.equals(session.path("id").asText()) ||
                !id.toString().equals(session.path("client_reference_id").asText()) ||
                !session.path("livemode").isBoolean() || session.path("livemode").asBoolean() ||
                !"payment".equals(session.path("mode").asText()) || !amountMatches(session, "amount_total", amount, "inr"))
            throw mismatch();
    }

    private static boolean amountMatches(JsonNode node, String field, long amount, String currency) {
        return node.path(field).isIntegralNumber() && node.path(field).asLong(-1) == amount &&
                currency.equals(node.path("currency").asText());
    }

    private static String reference(JsonNode node, String field, String prefix, int limit) {
        String value = node.path(field).asText();
        if (value.length() > limit || !value.matches(prefix + "[A-Za-z0-9_]+")) throw mismatch();
        return value;
    }

    private static Failure mismatch() {
        return new Failure(502, "PROVIDER_RESPONSE_INVALID", "Payment provider returned an unexpected response.");
    }

    private record Payment(UUID key, String provider, String order, String url, String capture, String refund) {}
    public record CheckoutRequest(@NotNull String method) {}
    public record Checkout(Hold hold, CheckoutDetails checkout) {}
    public record CheckoutDetails(String provider, String checkoutUrl, String keyId, String orderId) {}

    private Hold owned(UUID passenger, UUID id) {
        return select("id", passenger, id).orElseThrow(GroupHoldController::missing);
    }

    private Optional<Hold> replay(UUID passenger, UUID key) {
        return select("request_key", passenger, key);
    }

    private Optional<Hold> select(String column, UUID passenger, UUID value) {
        Instant now = clock.instant();
        return jdbc.sql("SELECT * FROM group_seat_holds WHERE passenger_id = :passenger AND " + column + " = :value")
                .param("passenger", passenger).param("value", value).query((row, index) -> {
                    Instant expires = row.getObject("expires_at", OffsetDateTime.class).toInstant();
                    String status = row.getString("status");
                    if ("HELD".equals(status) && !expires.isAfter(now)) status = "EXPIRED";
                    long fare = row.getLong("fare_paise");
                    return new Hold(row.getObject("id", UUID.class), row.getObject("ride_id", UUID.class),
                            row.getInt("seats"), expires, "HELD".equals(status) && row.getString("order_id") != null
                                    ? "PAYMENT_PENDING" : status, new Quote(fare, 0, 0, fare, "INR"),
                            row.getObject("booking_id", UUID.class));
                }).optional();
    }

    private static Hold match(Hold hold, Request request) {
        if (!hold.rideId().equals(request.rideId()) || hold.seats() != request.seats())
            throw new Failure(409, "IDEMPOTENCY_CONFLICT", "Use a new key for a different seat request.");
        return hold;
    }

    private static UUID user(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private static OffsetDateTime utc(Instant now) { return now.atOffset(ZoneOffset.UTC); }
    private static Failure missing() { return new Failure(404, "NOT_FOUND", "Seat hold or ride not found."); }

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

    public record Request(@NotNull UUID rideId, @NotNull @Min(1) @Max(6) Integer seats) {}
    public record Hold(UUID id, UUID rideId, int seats, Instant expiresAt, String status, Quote quote, UUID bookingId) {}
    public record Quote(long farePaise, int discountPercent, long discountPaise, long totalPaise, String currency) {}
}
