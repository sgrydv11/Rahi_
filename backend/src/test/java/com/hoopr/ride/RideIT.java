package com.hoopr.ride;

import com.hoopr.auth.AuthService;
import com.hoopr.database.TestDatabase;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static com.hoopr.ride.RideDtos.*;

@SpringBootTest(properties = {
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr-test",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
@AutoConfigureMockMvc
class RideIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> TestDatabase.required("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> TestDatabase.required("TEST_DB_USERNAME"));
        registry.add("spring.datasource.password", () -> TestDatabase.required("TEST_DB_PASSWORD"));
    }
    @Autowired AuthService auth;
    @Autowired RideService service;
    @Autowired com.hoopr.booking.BookingService bookings;
    @Autowired RideRepository rides;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired DataSource datasource;
    @Autowired PlatformTransactionManager transactions;
    UUID owner, other;
    String bearer;
    Instant tomorrow;
    @BeforeEach void fixtures() {
        tomorrow = LocalDate.now(ZoneOffset.UTC).plusDays(2).atTime(10, 0).toInstant(ZoneOffset.UTC);
        String email = "ride-it-" + UUID.randomUUID() + "@example.test";
        owner = auth.register(email, "ride-test-password", "Driver PrivateSurname").id();
        other = auth.register("ride-it-" + UUID.randomUUID() + "@example.test", "ride-test-password", "Other Driver").id();
        bearer = "Bearer " + auth.login(email, "ride-test-password").access.accessToken();
    }
    @AfterEach void cleanup() {
        for (UUID user : Arrays.asList(owner, other)) {
            if (user == null) continue;
            jdbc.update("DELETE FROM bookings WHERE ride_id IN (SELECT id FROM rides WHERE driver_id = ?)", user);
            jdbc.update("DELETE FROM rides WHERE driver_id = ?", user);
            jdbc.update("DELETE FROM vehicles WHERE driver_id = ?", user);
            jdbc.update("DELETE FROM driver_profiles WHERE user_id = ?", user);
            jdbc.update("DELETE FROM refresh_tokens WHERE session_id IN (SELECT id FROM refresh_sessions WHERE user_id = ?)", user);
            jdbc.update("DELETE FROM refresh_sessions WHERE user_id = ?", user);
            jdbc.update("DELETE FROM user_profiles WHERE user_id = ?", user);
            jdbc.update("DELETE FROM users WHERE id = ?", user);
        }
    }
    Create body(String origin, String destination, Instant departure, int seats, String price) {
        return new Create(origin, destination, "Station entrance", null, departure, "Asia/Kolkata", seats, new BigDecimal(price), "INR", null, "Test journey");
    }
    View offer() { return service.create(owner, body("Mumbai", "Pune", tomorrow, 3, "250.00")); }
    @Test void routePinsValidateOwnershipAndFreezeAfterBooking() throws Exception {
        View ride = offer();
        String path = "/api/v1/rides/" + ride.id();
        String pins = """
                {"version":%d,"pickup":{"latitude":19.076,"longitude":72.8777},
                 "dropoff":{"latitude":18.5204,"longitude":73.8567}}
                """.formatted(ride.version());
        mvc.perform(patch(path + "/route").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content(pins.replace("19.076", "91")))
                .andExpect(status().isBadRequest());
        mvc.perform(patch(path + "/route").with(jwt().jwt(j -> j.subject(other.toString())).authorities(() -> "ROLE_USER"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(pins))
                .andExpect(status().isForbidden());
        mvc.perform(patch(path + "/route").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(pins))
                .andExpect(status().isOk()).andExpect(jsonPath("$.route.pickup.latitude").value(19.076));
        mvc.perform(get(path)).andExpect(status().isOk()).andExpect(jsonPath("$.route.dropoff.longitude").value(73.8567));
        mvc.perform(patch(path + "/route").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(pins))
                .andExpect(status().isConflict());
        var booking = bookings.create(ride.id(), other, UUID.randomUUID(), 1).booking();
        assertNotNull(bookings.details(booking.id(), other).ride().route());
        long currentVersion = service.details(ride.id(), owner).version();
        mvc.perform(patch(path + "/route").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":" + currentVersion + ",\"pickup\":null,\"dropoff\":null}"))
                .andExpect(status().isConflict());
    }
    @Test void profileChangesPersistWithoutAllowingRoleChanges() throws Exception {
        String path = "/api/v1/users/me";
        mvc.perform(patch(path).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Updated Driver\",\"travelPreference\":\"DRIVER\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch(path).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\" Updated Driver \",\"travelPreference\":\"DRIVER\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("USER"));
        mvc.perform(get(path).header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Updated Driver"))
                .andExpect(jsonPath("$.travelPreference").value("DRIVER"));
    }

    @Test void vehicleOwnershipCapacityAndPrivacyApplyToRideOffers() throws Exception {
        String path = "/api/v1/vehicles";
        String input = """
                {"make":"Suzuki","model":"Swift","color":"Blue","registrationNumber":"PRIVATE123",
                 "passengerCapacity":2,"active":true}
                """;
        mvc.perform(post(path).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(input))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.registrationNumber").value("PRIVATE123"));
        UUID vehicle = jdbc.queryForObject("SELECT id FROM vehicles WHERE driver_id = ?", UUID.class, owner);
        mvc.perform(get(path).with(jwt().jwt(j -> j.subject(other.toString())).authorities(() -> "ROLE_USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(patch(path + "/" + vehicle).with(jwt().jwt(j -> j.subject(other.toString())).authorities(() -> "ROLE_USER"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(input))
                .andExpect(status().isNotFound());
        Create offer = new Create("Mumbai", "Pune", null, null, tomorrow, "Asia/Kolkata", 2,
                new BigDecimal("125.00"), "INR", null, null, vehicle);
        assertEquals(404, assertThrows(RideFailure.class, () -> service.create(other, offer)).status);
        View ride = service.create(owner, offer);
        mvc.perform(get("/api/v1/rides/" + ride.id())).andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicleDetails").value("Blue Suzuki Swift"))
                .andExpect(jsonPath("$.registrationNumber").doesNotExist());
        mvc.perform(patch(path + "/" + vehicle).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content(input.replace("Capacity\":2", "Capacity\":1")))
                .andExpect(status().isConflict());
        mvc.perform(patch(path + "/" + vehicle).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content(input.replace("true", "false")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        assertEquals(404, assertThrows(RideFailure.class, () -> service.create(owner, offer)).status);
        assertEquals("Blue Suzuki Swift", service.details(ride.id(), owner).vehicleDetails());
    }
    @Test void lifecycleRequiresOwnerDepartureAndCurrentVersion() throws Exception {
        View ride = offer();
        String path = "/api/v1/rides/" + ride.id();
        String initial = "{\"version\":" + ride.version() + "}";
        mvc.perform(post(path + "/start").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(initial))
                .andExpect(status().isUnauthorized());
        assertEquals(403, assertThrows(RideFailure.class, () -> service.start(ride.id(), other, ride.version())).status);
        assertEquals(409, assertThrows(RideFailure.class, () -> service.start(ride.id(), owner, ride.version())).status);
        assertEquals(409, assertThrows(RideFailure.class, () -> service.complete(ride.id(), owner, ride.version())).status);
        var booking = bookings.create(ride.id(), other, UUID.randomUUID(), 1).booking();
        jdbc.update("UPDATE rides SET departure_at = CURRENT_TIMESTAMP - interval '1 minute' WHERE id = ?", ride.id());
        long version = service.details(ride.id(), owner).version();
        mvc.perform(post(path + "/start").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + version + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.startedAt").isNotEmpty());
        assertEquals("IN_PROGRESS", bookings.details(booking.id(), other).ride().status());
        assertEquals(409, assertThrows(RideFailure.class, () -> service.complete(ride.id(), owner, version)).status);
        mvc.perform(post(path + "/complete").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + (version + 1) + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedAt").isNotEmpty());
        assertEquals("COMPLETED", bookings.details(booking.id(), other).ride().status());
        assertEquals(409, assertThrows(RideFailure.class, () -> service.complete(ride.id(), owner, version + 2)).status);
    }

    @Test void concurrentStartAndLastSeatBookingAtDepartureCannotAllocate() throws Exception {
        View ride = service.create(owner, body("Mumbai", "Pune", tomorrow, 1, "250.00"));
        jdbc.update("UPDATE rides SET departure_at = CURRENT_TIMESTAMP - interval '1 second' WHERE id = ?", ride.id());
        var ready = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = executor.submit(() -> {
                ready.await(5, TimeUnit.SECONDS);
                return service.start(ride.id(), owner, ride.version());
            });
            var booking = executor.submit(() -> {
                ready.await(5, TimeUnit.SECONDS);
                return assertThrows(com.hoopr.booking.BookingFailure.class,
                        () -> bookings.create(ride.id(), other, UUID.randomUUID(), 1));
            });
            assertEquals("IN_PROGRESS", start.get(10, TimeUnit.SECONDS).status());
            assertEquals(409, booking.get(10, TimeUnit.SECONDS).status);
        }
        assertEquals(1, service.details(ride.id(), owner).availableSeats());
    }

    @Test void lifecycleRejectsMalformedVersionsAndKeepsCompletedRideOutOfSearch() throws Exception {
        View ride = offer();
        String path = "/api/v1/rides/" + ride.id();
        for (String action : List.of("/start", "/complete")) {
            for (String invalid : List.of("{}", "{\"version\":-1}", "{\"version\":0.5}")) {
                mvc.perform(post(path + action).header("Authorization", bearer)
                                .contentType(MediaType.APPLICATION_JSON).content(invalid))
                        .andExpect(status().isBadRequest());
            }
        }
        assertEquals(ride.version(), service.details(ride.id(), owner).version());
        jdbc.update("UPDATE rides SET departure_at = CURRENT_TIMESTAMP - interval '1 minute' WHERE id = ?", ride.id());
        View started = service.start(ride.id(), owner, ride.version());
        assertEquals(403, assertThrows(RideFailure.class,
                () -> service.complete(ride.id(), other, started.version())).status);
        assertEquals(409, assertThrows(RideFailure.class,
                () -> service.start(ride.id(), owner, started.version())).status);
        Instant persistedStart = service.details(ride.id(), owner).startedAt();
        View completed = service.complete(ride.id(), owner, started.version());
        assertEquals(persistedStart, completed.startedAt());
        assertFalse(completed.completedAt().isBefore(completed.startedAt()));
        assertTrue(service.mine(owner, 0, 20).content().stream()
                .anyMatch(entry -> entry.id().equals(ride.id()) && entry.status().equals("COMPLETED")));
        assertFalse(service.search("Mumbai", "Pune", null, "UTC", 1, null, 0, 20).content().stream()
                .anyMatch(entry -> entry.id().equals(ride.id())));
    }
    Update update(long version, int seats) { return new Update(version, null, null, null, null, null, null, seats, null, null, null, null); }
    @Test void httpCreateUsesJwtAndPublicDetailsAreSafe() throws Exception {
        String json = "{\"origin\":\"Mumbai\",\"destination\":\"Pune\",\"departureAt\":\"" + tomorrow + "\",\"timeZone\":\"Asia/Kolkata\",\"totalSeats\":3,\"pricePerSeat\":250,\"currency\":\"INR\"}";
        mvc.perform(post("/api/v1/rides").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.driver.id").value(owner.toString()))
                .andExpect(jsonPath("$.availableSeats").value(3)).andExpect(jsonPath("$.status").value("SCHEDULED"));
        mvc.perform(get("/api/v1/rides")).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].driver.displayName").value("Driver"))
                .andExpect(jsonPath("$.content[0].driver.email").doesNotExist())
                .andExpect(jsonPath("$.content[0].driver.phoneNumber").doesNotExist());
        mvc.perform(get("/api/v1/rides/me").header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }
    @Test void filtersPaginationTimeZonesAndCancellationWorkInSql() {
        View a = offer();
        service.create(owner, body("Mumbai North", "Pune", tomorrow.plusSeconds(60), 2, "100.00"));
        service.create(owner, body("Delhi", "Agra", tomorrow, 4, "80.00"));
        View full = service.create(owner, body("Mumbai", "Pune", tomorrow.plusSeconds(120), 3, "200.00"));
        jdbc.update("UPDATE rides SET available_seats = 0 WHERE id = ?", full.id());
        View departed = service.create(owner, body("Mumbai", "Pune", tomorrow, 3, "200.00"));
        jdbc.update("UPDATE rides SET departure_at = CURRENT_TIMESTAMP - interval '1 hour' WHERE id = ?", departed.id());
        View completed = service.create(owner, body("Mumbai", "Pune", tomorrow, 3, "200.00"));
        jdbc.update("UPDATE rides SET status = 'COMPLETED' WHERE id = ?", completed.id());
        var page = service.search("mUm", "PUN", tomorrow.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate(), "Asia/Kolkata", 2, new BigDecimal("250.00"), 0, 1);
        assertEquals(2, page.totalElements()); assertEquals(2, page.totalPages()); assertEquals(a.id(), page.content().getFirst().id());
        var next = service.search("mum", "pun", null, "UTC", 2, null, 1, 1);
        assertEquals("Mumbai North", next.content().getFirst().origin());
        assertEquals(1, service.search("mum", "pun", null, "UTC", 3, null, 0, 20).totalElements());
        assertEquals(1, service.search("mum", "pun", null, "UTC", 1, new BigDecimal("100.00"), 0, 20).totalElements());
        assertEquals(0, service.search("%", null, null, "UTC", 1, null, 0, 20).totalElements());
        service.cancel(a.id(), owner, new Cancel(a.version(), "Changed plan"));
        assertEquals(1, service.search("mum", "pun", null, "UTC", 1, null, 0, 20).totalElements());
        assertEquals("CANCELLED", service.details(a.id(), owner).status());
    }
    @Test void updateOwnershipStaleVersionAndOccupiedSeats() {
        View ride = offer();
        assertEquals(403, assertThrows(RideFailure.class, () -> service.update(ride.id(), other, update(ride.version(), 2))).status);
        View changed = service.update(ride.id(), owner, update(ride.version(), 4));
        assertEquals(4, changed.availableSeats()); assertTrue(changed.version() > ride.version());
        assertEquals(409, assertThrows(RideFailure.class, () -> service.cancel(ride.id(), owner, new Cancel(ride.version(), null))).status);
        jdbc.update("UPDATE rides SET available_seats = 2 WHERE id = ?", ride.id());
        assertEquals(409, assertThrows(RideFailure.class, () -> service.update(ride.id(), owner, update(changed.version(), 3))).status);
    }
    @Test void simultaneousUpdatesHaveOneWinner() throws Exception {
        View initial = offer(); var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        var template = new TransactionTemplate(transactions);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task = () -> {
                try {
                    template.executeWithoutResult(status -> {
                        Ride ride = rides.findById(initial.id()).orElseThrow(); ready.countDown();
                        try { if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out"); }
                        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                        ride.totalSeats = ride.availableSeats = 4; rides.flush();
                    });
                    return true;
                } catch (org.springframework.dao.OptimisticLockingFailureException expected) { return false; }
            };
            var first = executor.submit(task); var second = executor.submit(task);
            assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            assertNotEquals(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
        }
        View saved = service.details(initial.id(), owner); assertEquals(4, saved.totalSeats()); assertEquals(4, saved.availableSeats());
        assertEquals(initial.version() + 1, saved.version());
    }
    @Test void postgresConstraintsRejectInvalidAvailabilityPriceAndSeats() throws Exception {
        View ride = offer();
        try (var connection = datasource.getConnection()) {
            connection.setAutoCommit(false);
            for (String mutation : List.of("available_seats = -1", "available_seats = total_seats + 1", "price_per_seat = -1", "total_seats = 7")) {
                var savepoint = connection.setSavepoint();
                try (var statement = connection.prepareStatement("UPDATE rides SET " + mutation + " WHERE id = ?")) {
                    statement.setObject(1, ride.id());
                    var error = assertThrows(java.sql.SQLException.class, statement::executeUpdate);
                    assertEquals("23514", error.getSQLState());
                } finally { connection.rollback(savepoint); }
            }
            connection.rollback();
        }
    }
    @Test void dateFilterUsesRequestedLocalCalendarDay() {
        Instant boundary = tomorrow.atOffset(ZoneOffset.UTC).toLocalDate().atStartOfDay().toInstant(ZoneOffset.UTC).minusSeconds(3600);
        service.create(owner, body("Mumbai", "Pune", boundary, 1, "0.00"));
        LocalDate localDay = boundary.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
        assertEquals(1, service.search(null, null, localDay, "Asia/Kolkata", 1, null, 0, 20).totalElements());
        assertEquals(0, service.search(null, null, localDay, "UTC", 1, null, 0, 20).totalElements());
    }
}
