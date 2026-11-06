package com.hoopr.booking;

import com.hoopr.auth.AuthService;
import com.hoopr.database.TestDatabase;
import com.hoopr.ride.*;
import com.hoopr.payment.RazorpayGateway;
import com.hoopr.payment.StripeGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
    "hoopr.group.reconcile-enabled=false", "hoopr.wallet.sandbox-withdrawals-delay=3600000",
    "PAYMENT_PROVIDER=razorpay",
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr-test",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
@AutoConfigureMockMvc
class BookingIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> TestDatabase.required("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> TestDatabase.required("TEST_DB_USERNAME"));
        registry.add("spring.datasource.password", () -> TestDatabase.required("TEST_DB_PASSWORD"));
    }
    @Autowired AuthService auth;
    @Autowired BookingService bookings;
    @Autowired RideService rides;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired com.hoopr.wallet.WalletController wallet;
    @Autowired ObjectMapper json;
    @MockitoBean RazorpayGateway gateway;
    @MockitoBean StripeGateway stripe;
    UUID owner, passenger, stranger;
    String ownerToken, passengerToken, strangerToken;
    Instant departure;
    @BeforeEach void setup() {
        departure = Instant.now().plusSeconds(172800);
        String a = "booking-" + UUID.randomUUID() + "@example.test";
        String b = "booking-" + UUID.randomUUID() + "@example.test";
        String c = "booking-" + UUID.randomUUID() + "@example.test";
        owner = auth.register(a, "booking-test-password", "Driver PrivateSurname").id();
        passenger = auth.register(b, "booking-test-password", "Passenger PrivateSurname").id();
        stranger = auth.register(c, "booking-test-password", "Other PrivateSurname").id();
        ownerToken = "Bearer " + auth.login(a, "booking-test-password").access.accessToken();
        passengerToken = "Bearer " + auth.login(b, "booking-test-password").access.accessToken();
        strangerToken = "Bearer " + auth.login(c, "booking-test-password").access.accessToken();
    }
    @AfterEach void cleanup() {
        if (owner != null) jdbc.update("""
                DELETE FROM booking_payments WHERE booking_id IN
                    (SELECT b.id FROM bookings b JOIN rides r ON r.id = b.ride_id WHERE r.driver_id = ?)
                """, owner);
        if (owner != null) jdbc.update("DELETE FROM group_seat_holds WHERE ride_id IN (SELECT id FROM rides WHERE driver_id = ?)", owner);
        if (owner != null) jdbc.update("DELETE FROM wallet_ride_charges WHERE booking_id IN (SELECT b.id FROM bookings b JOIN rides r ON r.id = b.ride_id WHERE r.driver_id = ?)", owner);
        if (owner != null) jdbc.update("DELETE FROM ride_discount_redemptions WHERE ride_id IN (SELECT id FROM rides WHERE driver_id = ?)", owner);
        if (owner != null) jdbc.update("DELETE FROM bookings WHERE ride_id IN (SELECT id FROM rides WHERE driver_id = ?)", owner);
        for (UUID user : Arrays.asList(owner, passenger, stranger)) {
            if (user == null) continue;
            jdbc.update("DELETE FROM rides WHERE driver_id = ?", user);
            jdbc.update("DELETE FROM driver_profiles WHERE user_id = ?", user);
            jdbc.update("DELETE FROM refresh_tokens WHERE session_id IN (SELECT id FROM refresh_sessions WHERE user_id = ?)", user);
            jdbc.update("DELETE FROM refresh_sessions WHERE user_id = ?", user);
            jdbc.update("DELETE FROM user_profiles WHERE user_id = ?", user);
            jdbc.update("DELETE FROM wallet_entries WHERE user_id = ?", user);
            jdbc.update("DELETE FROM wallet_top_ups WHERE user_id = ?", user);
            jdbc.update("DELETE FROM wallet_withdrawals WHERE user_id = ?", user);
            jdbc.update("DELETE FROM wallets WHERE user_id = ?", user);
            jdbc.update("DELETE FROM users WHERE id = ?", user);
        }
    }
    RideDtos.View offer(int seats) { return rides.create(owner, new RideDtos.Create("Mumbai", "Pune", null, null, departure, "Asia/Kolkata", seats, new BigDecimal("125.50"), "INR", null, null)); }
    @Test void discountCycleAdvancesOnlyForNewPaidRidesAndRoundsToPaise() throws Exception {
        String next = "/api/v1/ride-discounts/next";
        mvc.perform(get(next)).andExpect(status().isUnauthorized());
        jdbc.update("INSERT INTO wallets(user_id, available_paise) VALUES (?, 100000)", passenger);
        UUID expiredRide = offer(1).id();
        String expired = newWalletHold(expiredRide);
        UUID expiredId = UUID.fromString(expired.substring(expired.lastIndexOf('/') + 1));
        jdbc.update("UPDATE group_seat_holds SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = ?", expiredId);
        assertEquals(409, walletCheckoutStatus(expired));

        UUID firstRide = null;
        for (int percent : List.of(5, 10, 15, 5, 10, 15)) {
            mvc.perform(get(next).header("Authorization", passengerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.discountPercent").value(percent));
            UUID ride = offer(1).id();
            if (firstRide == null) firstRide = ride;
            String path = newWalletHold(ride);
            long reduction = (12550L * percent + 50) / 100;
            mvc.perform(get(path).header("Authorization", passengerToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.quote.discountPercent").value(percent))
                    .andExpect(jsonPath("$.quote.discountPaise").value(reduction))
                    .andExpect(jsonPath("$.quote.totalPaise").value(12550 - reduction));
            if (percent == 5) {
                UUID overlapping = offer(1).id();
                mvc.perform(post("/api/v1/group/holds").header("Authorization", passengerToken)
                                .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                                .content("{\"rideId\":\"" + overlapping + "\",\"seats\":1}"))
                        .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DISCOUNT_HELD"));
            }
            assertEquals(200, walletCheckoutStatus(path));
            assertEquals(200, walletCheckoutStatus(path));
        }
        assertEquals(6, jdbc.queryForObject("SELECT count(*) FROM ride_discount_redemptions WHERE passenger_id = ?", Integer.class, passenger));
        UUID original = jdbc.queryForObject("SELECT booking_id FROM ride_discount_redemptions WHERE passenger_id = ? AND ride_id = ?", UUID.class, passenger, firstRide);
        bookings.cancel(original, passenger, null);
        String repeat = newWalletHold(firstRide);
        mvc.perform(get(repeat).header("Authorization", passengerToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.quote.discountPercent").value(0));
        assertEquals(200, walletCheckoutStatus(repeat));
        mvc.perform(get(next).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.discountPercent").value(5));
    }

    @Test void concurrentWalletCheckoutsCannotSpendTheSameBalance() throws Exception {
        jdbc.update("INSERT INTO wallets(user_id, available_paise) VALUES (?, 12550)", passenger);
        // Simulate pre-migration holds, which remain payable at their undiscounted quote.
        String first = newWalletHold(offer(1).id());
        jdbc.update("UPDATE group_seat_holds SET discount_percent = 0, discount_paise = 0 WHERE passenger_id = ?", passenger);
        String second = newWalletHold(offer(1).id());
        jdbc.update("UPDATE group_seat_holds SET discount_percent = 0, discount_paise = 0 WHERE passenger_id = ?", passenger);
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> a = pool.submit(() -> { start.await(); return walletCheckoutStatus(first); });
            Future<Integer> b = pool.submit(() -> { start.await(); return walletCheckoutStatus(second); });
            start.countDown();
            assertEquals(Set.of(200, 409), Set.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS)));
        }
        assertEquals(0L, jdbc.queryForObject("SELECT available_paise FROM wallets WHERE user_id = ?", Long.class, passenger));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM wallet_entries WHERE user_id = ?", Integer.class, passenger));
    }

    private String newWalletHold(UUID ride) throws Exception {
        String root = "/api/v1/group/holds";
        String response = mvc.perform(post(root).header("Authorization", passengerToken)
                        .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rideId\":\"" + ride + "\",\"seats\":1}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return root + "/" + json.readTree(response).path("id").asText();
    }

    private int walletCheckoutStatus(String hold) throws Exception {
        return mvc.perform(post(hold + "/checkout").header("Authorization", passengerToken)
                        .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"method\":\"WALLET\"}"))
                .andReturn().getResponse().getStatus();
    }

    @Test void sandboxWithdrawalReservesFundsAndSettlesExactlyOnce() throws Exception {
        String root = "/api/v1/wallet/withdrawals";
        jdbc.update("INSERT INTO wallets(user_id, available_paise) VALUES (?, 1000)", passenger);
        for (boolean succeeds : List.of(false, true)) {
            var request = post(root).header("Authorization", passengerToken)
                    .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"amountPaise\":700}");
            String pending = mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"))
                    .andReturn().getResponse().getContentAsString();
            UUID id = UUID.fromString(json.readTree(pending).path("id").asText());
            mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id.toString()));
            mvc.perform(get(root + "/" + id).header("Authorization", strangerToken)).andExpect(status().isNotFound());
            assertEquals(700L, jdbc.queryForObject("SELECT reserved_paise FROM wallets WHERE user_id = ?", Long.class, passenger));
            wallet.settleWithdrawal(passenger, id, succeeds);
            wallet.settleWithdrawal(passenger, id, succeeds);
            mvc.perform(get(root + "/" + id).header("Authorization", passengerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(succeeds ? "SUCCEEDED" : "FAILED"));
            assertEquals(0L, jdbc.queryForObject("SELECT reserved_paise FROM wallets WHERE user_id = ?", Long.class, passenger));
            assertEquals(succeeds ? 300L : 1000L,
                    jdbc.queryForObject("SELECT available_paise FROM wallets WHERE user_id = ?", Long.class, passenger));
        }
        mvc.perform(post(root).header("Authorization", passengerToken).header("Idempotency-Key", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountPaise\":301}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_FUNDS"));
    }

    @Test void walletBookingRollsBackOnLowBalanceAndRefundsOnlyOnce() throws Exception {
        UUID ride = offer(1).id();
        String root = "/api/v1/group/holds";
        String created = mvc.perform(post(root).header("Authorization", passengerToken)
                        .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rideId\":\"" + ride + "\",\"seats\":1}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String path = root + "/" + json.readTree(created).path("id").asText();
        var checkout = post(path + "/checkout").header("Authorization", passengerToken)
                .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"method\":\"WALLET\"}");
        mvc.perform(checkout).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_FUNDS"));
        mvc.perform(get(path).header("Authorization", passengerToken)).andExpect(jsonPath("$.status").value("HELD"));
        jdbc.update("INSERT INTO wallets(user_id, available_paise) VALUES (?, 11922)", passenger);
        String paid = mvc.perform(checkout).andExpect(status().isOk()).andExpect(jsonPath("$.hold.status").value("CONFIRMED"))
                .andReturn().getResponse().getContentAsString();
        UUID booking = UUID.fromString(json.readTree(paid).path("hold").path("bookingId").asText());
        mvc.perform(checkout).andExpect(status().isOk()).andExpect(jsonPath("$.hold.bookingId").value(booking.toString()));
        mvc.perform(get("/api/v1/bookings/" + booking + "/payment").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.provider").value("wallet"))
                .andExpect(jsonPath("$.canPay").value(false));
        assertEquals(0L, jdbc.queryForObject("SELECT available_paise FROM wallets WHERE user_id = ?", Long.class, passenger));
        bookings.cancel(booking, passenger, null);
        bookings.cancel(booking, passenger, null);
        assertEquals(11922L, jdbc.queryForObject("SELECT available_paise FROM wallets WHERE user_id = ?", Long.class, passenger));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM wallet_entries WHERE user_id = ?", Integer.class, passenger));
    }

    @Test void verifiedTopUpFundsDiscountedBookingAndCancellationRefund() throws Exception {
        String root = "/api/v1/wallet";
        mvc.perform(get(root)).andExpect(status().isUnauthorized());
        mvc.perform(get(root).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.availablePaise").value(0));
        when(gateway.enabled()).thenReturn(true);
        when(gateway.keyId()).thenReturn("rzp_test_fixture");
        when(gateway.order(any(UUID.class), eq(12550L))).thenReturn(json.readTree("""
                {"id":"order_wallet","amount":12550,"currency":"INR"}
                """));
        UUID key = UUID.randomUUID();
        var request = post(root + "/top-ups").header("Authorization", passengerToken)
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON);
        String body = mvc.perform(request.content("{\"amountPaise\":12550}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.operation.status").value("PENDING")).andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).path("operation").path("id").asText();
        mvc.perform(request.content("{\"amountPaise\":12550}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.operation.id").value(id));
        mvc.perform(request.content("{\"amountPaise\":12551}")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
        String sync = root + "/top-ups/" + id + "/sync";
        mvc.perform(post(sync).header("Authorization", strangerToken)).andExpect(status().isNotFound());
        when(gateway.orderPayments("order_wallet")).thenReturn(json.readTree("""
                [{"id":"pay_wallet","order_id":"order_wallet","amount":100,"currency":"INR","status":"captured"}]
                """));
        mvc.perform(post(sync).header("Authorization", passengerToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
        when(gateway.orderPayments("order_wallet")).thenReturn(json.readTree("""
                [{"id":"pay_wallet","order_id":"order_wallet","amount":12550,"currency":"INR","status":"captured"}]
                """));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post(sync).header("Authorization", passengerToken)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCEEDED"));
        }
        mvc.perform(get(root).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.availablePaise").value(12550));
        mvc.perform(get(root + "/transactions").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].kind").value("TOP_UP"))
                .andExpect(jsonPath("$.content[0].amountPaise").value(12550));
        UUID ride = offer(1).id();
        String hold = newWalletHold(ride);
        String paid = mvc.perform(post(hold + "/checkout").header("Authorization", passengerToken)
                        .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"method\":\"WALLET\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.hold.quote.totalPaise").value(11922))
                .andExpect(jsonPath("$.hold.status").value("CONFIRMED")).andReturn().getResponse().getContentAsString();
        UUID booking = UUID.fromString(json.readTree(paid).path("hold").path("bookingId").asText());
        mvc.perform(get(root).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.availablePaise").value(628));
        var currentRide = rides.details(ride, owner);
        rides.cancel(ride, owner, new RideDtos.Cancel(currentRide.version(), "Release test"));
        mvc.perform(get(root).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.availablePaise").value(12550));
        mvc.perform(get("/api/v1/bookings/" + booking).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED_BY_DRIVER"));
        mvc.perform(get("/api/v1/ride-discounts/next").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.discountPercent").value(10));
        assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM wallet_entries WHERE user_id = ?", Integer.class, passenger));
        verify(gateway, times(1)).order(any(UUID.class), eq(12550L));
    }

    @Test void onlyOneConcurrentGroupHoldWinsTheLastSeat() throws Exception {
        UUID ride = offer(1).id();
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> first = pool.submit(() -> placeGroupHold(ride, passengerToken, start));
            Future<Integer> second = pool.submit(() -> placeGroupHold(ride, strangerToken, start));
            start.countDown();
            assertEquals(Set.of(200, 409), Set.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)));
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM group_seat_holds WHERE ride_id = ?", Integer.class, ride));
    }

    private int placeGroupHold(UUID ride, String token, CountDownLatch start) throws Exception {
        start.await();
        return mvc.perform(post("/api/v1/group/holds").header("Authorization", token)
                        .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rideId\":\"" + ride + "\",\"seats\":1}"))
                .andReturn().getResponse().getStatus();
    }

    @Test void groupCheckoutConfirmsOnlyTheVerifiedFareAndReplaysWithoutAnotherOrder() throws Exception {
        UUID ride = offer(1).id();
        String path = startGroupCheckout(ride);
        when(gateway.orderPayments("order_group")).thenReturn(json.readTree("""
                [{"id":"pay_group","order_id":"order_group","amount":100,"currency":"INR","status":"captured"}]
                """));
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PAYMENT_PENDING"))
                .andExpect(jsonPath("$.bookingId").doesNotExist());
        groupCapture();
        String result = mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andReturn().getResponse().getContentAsString();
        UUID booking = UUID.fromString(json.readTree(result).path("bookingId").asText());
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bookingId").value(booking.toString()));
        assertEquals("pay_group", jdbc.queryForObject("SELECT payment_id FROM booking_payments WHERE booking_id = ?", String.class, booking));
        mvc.perform(get("/api/v1/bookings/" + booking).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalPrice").value(119.22));
        mvc.perform(get("/api/v1/ride-discounts/next").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.discountPercent").value(10));
        verify(gateway, times(1)).order(any(UUID.class), eq(11922L));
    }

    @Test void lateGroupPaymentIsRefundedWithoutReclaimingTheSeat() throws Exception {
        UUID ride = offer(1).id();
        String path = startGroupCheckout(ride);
        UUID hold = UUID.fromString(path.substring(path.lastIndexOf('/') + 1));
        jdbc.update("UPDATE group_seat_holds SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = ?", hold);
        bookings.create(ride, stranger, UUID.randomUUID(), 1);
        groupCapture();
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REFUND_PENDING"));
        when(gateway.refund(hold, "pay_group", 11922)).thenReturn(json.readTree("""
                {"id":"rfnd_group","payment_id":"pay_group","amount":11922,"status":"processed"}
                """));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REFUNDED"))
                    .andExpect(jsonPath("$.bookingId").doesNotExist());
        }
        verify(gateway, times(1)).refund(hold, "pay_group", 11922);
        mvc.perform(get("/api/v1/ride-discounts/next").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.discountPercent").value(5));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM bookings WHERE ride_id = ?", Integer.class, ride));
    }

    private String startGroupCheckout(UUID ride) throws Exception {
        String root = "/api/v1/group/holds";
        String created = mvc.perform(post(root).header("Authorization", passengerToken)
                        .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rideId\":\"" + ride + "\",\"seats\":1}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String path = root + "/" + json.readTree(created).path("id").asText();
        mvc.perform(post(path + "/checkout").header("Authorization", passengerToken)
                        .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"method\":\"PROVIDER\"}"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("PROVIDER_UNAVAILABLE"));
        when(gateway.enabled()).thenReturn(true);
        when(gateway.keyId()).thenReturn("rzp_test_fixture");
        when(gateway.order(any(UUID.class), eq(11922L))).thenReturn(json.readTree("""
                {"id":"order_group","amount":11922,"currency":"INR"}
                """));
        UUID key = UUID.randomUUID();
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post(path + "/checkout").header("Authorization", passengerToken)
                            .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"method\":\"PROVIDER\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.checkout.orderId").value("order_group"));
        }
        return path;
    }

    private void groupCapture() throws Exception {
        when(gateway.orderPayments("order_group")).thenReturn(json.readTree("""
                [{"id":"pay_group","order_id":"order_group","amount":11922,"currency":"INR","status":"captured"}]
                """));
    }

    @Test void groupHoldReplaysAndReleasesInventoryForOtherRiders() throws Exception {
        var ride = offer(1);
        String key = UUID.randomUUID().toString();
        String path = "/api/v1/group/holds";
        String body = "{\"rideId\":\"" + ride.id() + "\",\"seats\":1}";
        var create = post(path).header("Authorization", passengerToken)
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(body);
        String result = mvc.perform(create).andExpect(status().isOk())
                .andExpect(jsonPath("$.quote.totalPaise").value(11922))
                .andExpect(jsonPath("$.status").value("HELD")).andReturn().getResponse().getContentAsString();
        String id = json.readTree(result).path("id").asText();
        mvc.perform(create).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(get(path + "/" + id).header("Authorization", strangerToken)).andExpect(status().isNotFound());
        assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), stranger, UUID.randomUUID(), 1));
        mvc.perform(post(path).header("Authorization", strangerToken).header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SOLD_OUT"));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post(path + "/" + id + "/cancel").header("Authorization", passengerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        }
        assertNotNull(bookings.create(ride.id(), stranger, UUID.randomUUID(), 1));
    }

    @Test void ordinarySearchAndDetailsSubtractActiveHoldsAndRestoreCancelledHolds() throws Exception {
        var ride = offer(1);
        var response = mvc.perform(post("/api/v1/group/holds").header("Authorization", passengerToken)
                .header("Idempotency-Key", UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rideId", ride.id(), "seats", 1))))
                .andExpect(status().isOk()).andReturn().getResponse();
        String hold = json.readTree(response.getContentAsString()).path("id").asText();
        mvc.perform(get("/api/v1/rides/" + ride.id())).andExpect(status().isOk())
                .andExpect(jsonPath("$.availableSeats").value(0));
        mvc.perform(get("/api/v1/rides").param("origin", "Mumbai"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.id == '"+ride.id()+"')]").isEmpty());
        mvc.perform(post("/api/v1/group/holds/"+hold+"/cancel").header("Authorization", passengerToken))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/rides/" + ride.id())).andExpect(status().isOk())
                .andExpect(jsonPath("$.availableSeats").value(1));
    }
    @Test void groupFeedRequiresLoginAndShowsOnlyMatchingBookableSeats() throws Exception {
        var ride = offer(1);
        String path = "/api/v1/group/offers?origin=mUmBaI&destination=PUNE&size=1";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).header("Authorization", passengerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].rideId").value(ride.id().toString()))
                .andExpect(jsonPath("$.content[0].availableSeats").value(1))
                .andExpect(jsonPath("$.content[0].farePerSeatPaise").value(12550))
                .andExpect(jsonPath("$.totalPages").value(1));
        mvc.perform(get(path).header("Authorization", ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(get(path + "&page=1").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        bookings.create(ride.id(), passenger, UUID.randomUUID(), 1);
        mvc.perform(get(path).header("Authorization", strangerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
    }

    @Test void razorpayCaptureAndRefundAreVerifiedAndRetrySafe() throws Exception {
        var ride = offer(3);
        UUID booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 2).booking().id();
        String path = "/api/v1/bookings/" + booking + "/payment";
        mvc.perform(get(path).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
        mvc.perform(post(path + "/order").header("Authorization", passengerToken))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(post(path + "/order").header("Authorization", strangerToken)).andExpect(status().isNotFound());
        when(gateway.enabled()).thenReturn(true);
        when(gateway.keyId()).thenReturn("rzp_test_fixture");
        when(gateway.order(booking, 25100)).thenReturn(json.readTree("""
                {"id":"order_fixture","amount":25100,"currency":"INR"}
                """));
        for (int attempt = 0; attempt < 2; attempt++)
            mvc.perform(post(path + "/order").header("Authorization", passengerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.orderId").value("order_fixture"))
                    .andExpect(jsonPath("$.amount").value(25100));
        verify(gateway, times(1)).order(booking, 25100);

        String signature = "a".repeat(64);
        String body = "{\"paymentId\":\"pay_fixture\",\"signature\":\"" + signature + "\"}";
        mvc.perform(post(path + "/verify").header("Authorization", passengerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        when(gateway.validSignature("order_fixture", "pay_fixture", signature)).thenReturn(true);
        when(gateway.payment("pay_fixture")).thenReturn(json.readTree("""
                {"id":"pay_fixture","order_id":"order_fixture","amount":100,"currency":"INR","status":"captured"}
                """));
        mvc.perform(post(path + "/verify").header("Authorization", passengerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        when(gateway.payment("pay_fixture")).thenReturn(json.readTree("""
                {"id":"pay_fixture","order_id":"order_fixture","amount":25100,"currency":"INR","status":"captured"}
                """));
        mvc.perform(post(path + "/verify").header("Authorization", passengerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("pay_fixture")).andExpect(jsonPath("$.paidAt").isNotEmpty());
        mvc.perform(post(path + "/refund").header("Authorization", passengerToken)).andExpect(status().isConflict());
        bookings.cancel(booking, passenger, "Payment test");
        when(gateway.refund(booking, "pay_fixture", 25100)).thenReturn(json.readTree("""
                {"id":"rfnd_fixture","payment_id":"pay_fixture","amount":25100,"status":"pending"}
                """));
        for (int attempt = 0; attempt < 2; attempt++)
            mvc.perform(post(path + "/refund").header("Authorization", passengerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.refundStatus").value("pending"));
        verify(gateway, times(1)).refund(booking, "pay_fixture", 25100);
        when(gateway.refundStatus("pay_fixture", "rfnd_fixture")).thenReturn(json.readTree("""
                {"id":"rfnd_fixture","payment_id":"pay_fixture","amount":25100,"status":"processed"}
                """));
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.refundStatus").value("processed"));
        invariant(ride.id());
    }

    @Test void syncRecoversOnlyAnExactCapturedPaymentFromTheStoredOrder() throws Exception {
        var ride = offer(2);
        UUID booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking().id();
        String path = "/api/v1/bookings/" + booking + "/payment";
        when(gateway.enabled()).thenReturn(true);
        when(gateway.order(booking, 12550)).thenReturn(json.readTree("""
                {"id":"order_sync","amount":12550,"currency":"INR"}
                """));
        mvc.perform(post(path + "/order").header("Authorization", passengerToken)).andExpect(status().isOk());
        when(gateway.orderPayments("order_sync")).thenReturn(json.readTree("""
                [{"id":"pay_wrong","order_id":"order_other","amount":12550,"currency":"INR","status":"captured"},
                 {"id":"pay_pending","order_id":"order_sync","amount":12550,"currency":"INR","status":"authorized"}]
                """));
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paymentId").doesNotExist());
        when(gateway.orderPayments("order_sync")).thenReturn(json.readTree("""
                [{"id":"pay_sync","order_id":"order_sync","amount":12550,"currency":"INR","status":"captured"}]
                """));
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paymentId").value("pay_sync"));
    }

    @Test void storedStripeProviderControlsCheckoutCaptureAndRefund() throws Exception {
        var ride = offer(2);
        UUID booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking().id();
        jdbc.update("""
                INSERT INTO booking_payments (booking_id, provider, order_id, amount, currency)
                VALUES (?, 'stripe', 'cs_test_fixture', 12550, 'INR')
                """, booking);
        String path = "/api/v1/bookings/" + booking + "/payment";
        when(stripe.enabled()).thenReturn(true);
        String session = """
                {"id":"cs_test_fixture","client_reference_id":"%s","livemode":false,"mode":"payment",
                 "currency":"inr","amount_total":12550,"status":"open","payment_status":"unpaid",
                 "url":"https://checkout.stripe.com/c/pay/fixture"}
                """.formatted(booking);
        when(stripe.session("cs_test_fixture")).thenReturn(json.readTree(session));
        mvc.perform(post(path + "/order").header("Authorization", passengerToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("stripe"))
                .andExpect(jsonPath("$.checkoutUrl").value("https://checkout.stripe.com/c/pay/fixture"));
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").doesNotExist());
        String paid = session.replace("\"open\"", "\"complete\"").replace("\"unpaid\"", "\"paid\"")
                .replace("\"url\"", "\"payment_intent\":\"pi_fixture\",\"url\"");
        when(stripe.session("cs_test_fixture")).thenReturn(json.readTree(paid.replace("12550", "100")));
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken)).andExpect(status().isBadGateway());
        when(stripe.session("cs_test_fixture")).thenReturn(json.readTree(paid));
        mvc.perform(post(path + "/sync").header("Authorization", passengerToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("pi_fixture"));
        bookings.cancel(booking, passenger, "Stripe test");
        when(stripe.refund(booking, "pi_fixture", 12550)).thenReturn(json.readTree("""
                {"id":"re_fixture","payment_intent":"pi_fixture","amount":12550,"currency":"inr","status":"succeeded"}
                """));
        mvc.perform(post(path + "/refund").header("Authorization", passengerToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.refundStatus").value("processed"));
        verifyNoInteractions(gateway);
    }

    @Test void expiredStripeSessionIsReplacedAndTheReplacementIsReused() throws Exception {
        var ride = offer(2);
        UUID booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking().id();
        jdbc.update("""
                INSERT INTO booking_payments (booking_id, provider, order_id, amount, currency)
                VALUES (?, 'stripe', 'cs_test_expired', 12550, 'INR')
                """, booking);
        when(stripe.enabled()).thenReturn(true);
        String session = """
                {"id":"cs_test_expired","client_reference_id":"%s","livemode":false,"mode":"payment",
                 "currency":"inr","amount_total":12550,"status":"expired","payment_status":"unpaid"}
                """.formatted(booking);
        var replacement = json.readTree("""
                {"id":"cs_test_replacement","client_reference_id":"%s","livemode":false,"mode":"payment",
                 "currency":"inr","amount_total":12550,"status":"open","payment_status":"unpaid",
                 "url":"https://checkout.stripe.com/c/pay/replacement"}
                """.formatted(booking));
        when(stripe.session("cs_test_expired")).thenReturn(json.readTree(session));
        when(stripe.checkout(booking, 12550, "cs_test_expired")).thenReturn(replacement);
        when(stripe.session("cs_test_replacement")).thenReturn(replacement);
        String path = "/api/v1/bookings/" + booking + "/payment/order";
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post(path).header("Authorization", passengerToken)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.orderId").value("cs_test_replacement"))
                    .andExpect(jsonPath("$.paymentId").doesNotExist());
        }
        verify(stripe, times(1)).checkout(booking, 12550, "cs_test_expired");
        verifyNoInteractions(gateway);
    }

    @Test void inboxIsPrivateAndRemindersFollowCurrentBookingState() throws Exception {
        departure = Instant.now().plusSeconds(3600);
        var ride = offer(2);
        var booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking();
        String inbox = "/api/v1/notifications";
        mvc.perform(get(inbox)).andExpect(status().isUnauthorized());
        mvc.perform(get(inbox).header("Authorization", strangerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(inbox).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].kind").value("DEPARTURE_REMINDER"))
                .andExpect(jsonPath("$[1].kind").value("BOOKING_CONFIRMED"))
                .andExpect(jsonPath("$[1].link").value("/bookings/" + booking.id()));
        mvc.perform(get(inbox).header("Authorization", ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].link").value("/rides/" + ride.id()));
        bookings.cancel(booking.id(), passenger, "Plans changed");
        mvc.perform(get(inbox).header("Authorization", passengerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].kind").value("CANCELLED_BY_PASSENGER"));
        mvc.perform(get(inbox).header("Authorization", ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[1].kind").value("CANCELLED_BY_PASSENGER"));
    }
    void finishRide(UUID id) {
        jdbc.update("UPDATE rides SET departure_at = CURRENT_TIMESTAMP - interval '1 minute' WHERE id = ?", id);
        var started = rides.start(id, owner, rides.details(id, owner).version());
        rides.complete(id, owner, started.version());
    }

    @Test void ratingRequiresConfirmedCompletedBookingAndPassengerIdentity() throws Exception {
        var ride = offer(3);
        var booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking();
        var cancelled = bookings.create(ride.id(), stranger, UUID.randomUUID(), 1).booking();
        bookings.cancel(cancelled.id(), stranger, "Plans changed");
        String path = "/api/v1/bookings/" + booking.id() + "/rating";
        mvc.perform(post(path).header("Authorization", passengerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"score\":5}"))
                .andExpect(status().isConflict());
        finishRide(ride.id());
        for (String token : List.of(ownerToken, strangerToken)) {
            mvc.perform(post(path).header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"score\":5}"))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post(path).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"score\":5}"))
                .andExpect(status().isUnauthorized());
        for (String invalid : List.of("{}", "{\"score\":0}", "{\"score\":6}", "{\"score\":4.5}",
                "{\"score\":5,\"driverId\":\"other\"}")) {
            mvc.perform(post(path).header("Authorization", passengerToken)
                            .contentType(MediaType.APPLICATION_JSON).content(invalid))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.rate(cancelled.id(), stranger, 5)).status);
        assertNull(bookings.details(booking.id(), passenger).rating());
        mvc.perform(post(path).header("Authorization", passengerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"score\":5}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rating.score").value(5))
                .andExpect(jsonPath("$.rating.ratedAt").isNotEmpty());
        var persisted = bookings.details(booking.id(), owner);
        var replay = bookings.rate(booking.id(), passenger, 5);
        assertEquals(persisted.rating(), replay.rating());
        assertEquals(persisted.version(), replay.version());
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.rate(booking.id(), passenger, 4)).status);
        mvc.perform(get("/api/v1/bookings/" + booking.id()).header("Authorization", strangerToken))
                .andExpect(status().isForbidden());
        assertEquals(5, bookings.details(booking.id(), passenger).rating().score());
        invariant(ride.id());
    }

    @Test void concurrentDifferentRatingsCannotOverwriteTheWinner() throws Exception {
        var ride = offer(2);
        UUID id = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking().id();
        finishRide(ride.id());
        var ready = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> tryRate(id, 3, ready));
            var second = executor.submit(() -> tryRate(id, 5, ready));
            int a = first.get(10, TimeUnit.SECONDS), b = second.get(10, TimeUnit.SECONDS);
            assertEquals(1, java.util.stream.IntStream.of(a, b).filter(value -> value == 409).count());
            assertEquals(a == 409 ? b : a, bookings.details(id, owner).rating().score());
        }
    }

    private int tryRate(UUID id, int score, CyclicBarrier ready) throws Exception {
        ready.await(5, TimeUnit.SECONDS);
        try {
            return bookings.rate(id, passenger, score).rating().score();
        } catch (BookingFailure conflict) {
            return conflict.status;
        }
    }
    void invariant(UUID ride) {
        assertEquals(rides.details(ride, owner).totalSeats(), jdbc.queryForObject("SELECT r.available_seats + coalesce(sum(b.seats_booked) FILTER (WHERE b.status = 'CONFIRMED'),0) FROM rides r LEFT JOIN bookings b ON b.ride_id=r.id WHERE r.id=? GROUP BY r.id", Integer.class, ride));
    }
    @Test void allocationSnapshotsPriceAndReplaysWithoutAllocatingTwice() {
        var ride = offer(3); UUID key = UUID.randomUUID();
        var created = bookings.create(ride.id(), passenger, key, 2); var replay = bookings.create(ride.id(), passenger, key, 2);
        assertFalse(created.replayed()); assertTrue(replay.replayed()); assertEquals(created.booking().id(), replay.booking().id());
        assertEquals(new BigDecimal("251.00"), created.booking().totalPrice()); assertEquals(1, rides.details(ride.id(), owner).availableSeats());
        assertEquals("Passenger", created.booking().passenger().displayName());
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), passenger, key, 1)).status);
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), passenger, UUID.randomUUID(), 1)).status);
        assertEquals(1, bookings.mine(passenger, 0, 10).totalElements()); invariant(ride.id());
    }
    @Test void staleBrowserQuoteCannotSilentlyAcceptChangedPrice() {
        var ride = offer(3);
        var edit = new RideDtos.Update(ride.version(), null, null, null, null, null, null, null, new BigDecimal("300.00"), null, null, null);
        rides.update(ride.id(), owner, edit);
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), passenger, UUID.randomUUID(), 1, ride.version())).status);
        assertEquals(3, rides.details(ride.id(), owner).availableSeats()); invariant(ride.id());
    }
    @Test void cancellationIsIdempotentAndOldRequestCannotRebook() {
        var ride = offer(3); UUID key = UUID.randomUUID(); var booked = bookings.create(ride.id(), passenger, key, 2).booking();
        assertEquals("CANCELLED_BY_PASSENGER", bookings.cancel(booked.id(), passenger, "Changed plan").status());
        bookings.cancel(booked.id(), passenger, "Retry"); assertEquals(3, rides.details(ride.id(), owner).availableSeats());
        assertEquals("CANCELLED_BY_PASSENGER", bookings.create(ride.id(), passenger, key, 2).booking().status());
        assertEquals(3, rides.details(ride.id(), owner).availableSeats());
        bookings.create(ride.id(), passenger, UUID.randomUUID(), 1); invariant(ride.id());
    }
    @Test void ownerCancellationCancelsBookingsAndPreservesHistory() {
        var ride = offer(3); var booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 2).booking();
        var current = rides.details(ride.id(), owner);
        assertEquals(409, assertThrows(RideFailure.class, () -> rides.cancel(ride.id(), owner, new RideDtos.Cancel(ride.version(), null))).status);
        rides.cancel(ride.id(), owner, new RideDtos.Cancel(current.version(), "Driver plan changed"));
        assertEquals("CANCELLED_BY_DRIVER", bookings.details(booking.id(), passenger).status());
        assertEquals("Driver plan changed", bookings.details(booking.id(), passenger).cancellationReason());
        bookings.cancel(booking.id(), passenger, null); invariant(ride.id());
        assertEquals(1, bookings.manifest(ride.id(), owner, 0, 10).totalElements());
    }
    @Test void ownershipLifecycleAndReservedEditRules() {
        var ride = offer(3);
        assertEquals(400, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), owner, UUID.randomUUID(), 1)).status);
        var booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 2).booking();
        assertEquals(403, assertThrows(BookingFailure.class, () -> bookings.details(booking.id(), stranger)).status);
        assertEquals(403, assertThrows(BookingFailure.class, () -> bookings.cancel(booking.id(), owner, null)).status);
        assertEquals(403, assertThrows(BookingFailure.class, () -> bookings.manifest(ride.id(), passenger, 0, 10)).status);
        var current = rides.details(ride.id(), owner);
        var edit = new RideDtos.Update(current.version(), null, null, null, null, null, null, 4, null, null, null, null);
        assertEquals(409, assertThrows(RideFailure.class, () -> rides.update(ride.id(), owner, edit)).status);
        jdbc.update("UPDATE rides SET departure_at=CURRENT_TIMESTAMP - interval '1 hour' WHERE id=?", ride.id());
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.cancel(booking.id(), passenger, null)).status);
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), stranger, UUID.randomUUID(), 1)).status);
    }
    @Test void simultaneousLastSeatRequestsHaveOneWinner() throws Exception {
        var ride = offer(1); var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var futures = new ArrayList<Future<Boolean>>();
            for (UUID user : List.of(passenger, stranger)) futures.add(executor.submit(() -> {
                assertTrue(start.await(10, TimeUnit.SECONDS));
                try { bookings.create(ride.id(), user, UUID.randomUUID(), 1); return true; }
                catch (BookingFailure failure) { assertEquals(409, failure.status); return false; }
            }));
            start.countDown(); assertNotEquals(futures.get(0).get(15, TimeUnit.SECONDS), futures.get(1).get(15, TimeUnit.SECONDS));
        }
        assertEquals(0, rides.details(ride.id(), owner).availableSeats()); invariant(ride.id());
    }
    @Test void simultaneousRetriesAndCancellationRestoreExactlyOnce() throws Exception {
        var ride = offer(2); UUID key = UUID.randomUUID(); var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<UUID> request = () -> { start.await(10, TimeUnit.SECONDS); return bookings.create(ride.id(), passenger, key, 1).booking().id(); };
            var a = executor.submit(request); var b = executor.submit(request); start.countDown();
            UUID id = a.get(15, TimeUnit.SECONDS); assertEquals(id, b.get(15, TimeUnit.SECONDS));
            Callable<String> cancel = () -> bookings.cancel(id, passenger, null).status();
            a = executor.submit(() -> { cancel.call(); return id; }); b = executor.submit(() -> { cancel.call(); return id; });
            a.get(15, TimeUnit.SECONDS); b.get(15, TimeUnit.SECONDS);
        }
        assertEquals(2, rides.details(ride.id(), owner).availableSeats()); invariant(ride.id());
    }
    @Test void passengerAndDriverCancellationRacePreservesInvariant() throws Exception {
        var ride = offer(2); var booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking();
        var current = rides.details(ride.id(), owner); var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var passengerResult = executor.submit(() -> { start.await(10, TimeUnit.SECONDS); return bookings.cancel(booking.id(), passenger, null); });
            var driverResult = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                try { rides.cancel(ride.id(), owner, new RideDtos.Cancel(current.version(), "Driver cancellation")); }
                catch (RideFailure stale) { assertEquals(409, stale.status); var latest = rides.details(ride.id(), owner); rides.cancel(ride.id(), owner, new RideDtos.Cancel(latest.version(), "Driver cancellation")); }
                return true;
            });
            start.countDown(); passengerResult.get(15, TimeUnit.SECONDS); assertTrue(driverResult.get(15, TimeUnit.SECONDS));
        }
        assertEquals("CANCELLED", rides.details(ride.id(), owner).status()); invariant(ride.id());
        assertNotEquals("CONFIRMED", bookings.details(booking.id(), passenger).status());
    }
    @Test void httpAuthenticationValidationPrivacyAndCors() throws Exception {
        var ride = offer(3); String path = "/api/v1/rides/" + ride.id() + "/bookings"; UUID key = UUID.randomUUID();
        mvc.perform(get("/api/v1/bookings/me")).andExpect(status().isUnauthorized());
        mvc.perform(post(path).header("Authorization", passengerToken).header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content("{\"seats\":2}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.passenger.id").value(passenger.toString()))
            .andExpect(jsonPath("$.passenger.email").doesNotExist()).andExpect(jsonPath("$.totalPrice").value(251.00));
        mvc.perform(post(path).header("Authorization", passengerToken).header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content("{\"seats\":2}"))
            .andExpect(status().isOk());
        for (String body : List.of("{}", "{\"seats\":0}", "{\"seats\":7}", "{\"seats\":1.5}", "{\"seats\":1,\"passengerId\":\"injected\"}", "{\"seats\":1,\"pricePerSeat\":0}"))
            mvc.perform(post(path).header("Authorization", strangerToken).header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        mvc.perform(post(path).header("Authorization", strangerToken).contentType(MediaType.APPLICATION_JSON).content("{\"seats\":1}")).andExpect(status().isBadRequest());
        mvc.perform(get(path).header("Authorization", passengerToken)).andExpect(status().isForbidden());
        mvc.perform(get(path).header("Authorization", ownerToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].passenger.displayName").value("Passenger"));
        mvc.perform(options(path).header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "authorization,content-type,idempotency-key"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        mvc.perform(options(path).header("Origin", "https://untrusted.example").header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden());
    }
    @Test void insufficientSeatsDisabledUsersAndNonScheduledRidesAreRejected() {
        var ride = offer(2);
        assertEquals(400, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), passenger, UUID.randomUUID(), 3)).status);
        bookings.create(ride.id(), passenger, UUID.randomUUID(), 1);
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), stranger, UUID.randomUUID(), 2)).status);
        for (String status : List.of("CANCELLED", "COMPLETED", "IN_PROGRESS", "DRAFT")) {
            // CANCELLED requires cancellation metadata at the database boundary.
            if (status.equals("CANCELLED")) jdbc.update("UPDATE rides SET status=?,cancelled_at=CURRENT_TIMESTAMP WHERE id=?", status, ride.id());
            else jdbc.update("UPDATE rides SET status=?,cancelled_at=NULL WHERE id=?", status, ride.id());
            assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), stranger, UUID.randomUUID(), 1)).status);
        }
        jdbc.update("UPDATE users SET status='DISABLED' WHERE id=?", stranger);
        assertEquals(401, assertThrows(BookingFailure.class, () -> bookings.mine(stranger, 0, 10)).status);
        invariant(ride.id());
    }
    @Test void adminDoesNotBypassOwnershipAndCookieAloneCannotCreateBooking() throws Exception {
        var ride = offer(2); var booking = bookings.create(ride.id(), passenger, UUID.randomUUID(), 1).booking();
        mvc.perform(get("/api/v1/bookings/" + booking.id()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(j -> j.subject(stranger.toString())).authorities(() -> "ROLE_ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/rides/" + ride.id() + "/bookings").cookie(new jakarta.servlet.http.Cookie("hoopr_refresh", "not-a-bearer-token"))
            .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content("{\"seats\":1}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/bookings/me").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(j -> j.subject(stranger.toString())).authorities(() -> "ROLE_OTHER"))).andExpect(status().isForbidden());
    }
}
