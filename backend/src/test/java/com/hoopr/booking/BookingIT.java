package com.hoopr.booking;

import com.hoopr.auth.AuthService;
import com.hoopr.database.TestDatabase;
import com.hoopr.ride.*;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
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
        if (owner != null) jdbc.update("DELETE FROM bookings WHERE ride_id IN (SELECT id FROM rides WHERE driver_id = ?)", owner);
        for (UUID user : Arrays.asList(owner, passenger, stranger)) {
            if (user == null) continue;
            jdbc.update("DELETE FROM rides WHERE driver_id = ?", user);
            jdbc.update("DELETE FROM driver_profiles WHERE user_id = ?", user);
            jdbc.update("DELETE FROM refresh_tokens WHERE session_id IN (SELECT id FROM refresh_sessions WHERE user_id = ?)", user);
            jdbc.update("DELETE FROM refresh_sessions WHERE user_id = ?", user);
            jdbc.update("DELETE FROM user_profiles WHERE user_id = ?", user);
            jdbc.update("DELETE FROM users WHERE id = ?", user);
        }
    }
    RideDtos.View offer(int seats) { return rides.create(owner, new RideDtos.Create("Mumbai", "Pune", null, null, departure, "Asia/Kolkata", seats, new BigDecimal("125.50"), "INR", null, null)); }
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
