package com.hoopr.ride;

import com.hoopr.auth.AuthService;
import com.hoopr.booking.*;
import com.hoopr.database.TestDatabase;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr-test",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
class RideChangesIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> TestDatabase.required("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> TestDatabase.required("TEST_DB_USERNAME"));
        registry.add("spring.datasource.password", () -> TestDatabase.required("TEST_DB_PASSWORD"));
    }
    @Autowired AuthService auth;
    @Autowired RideService rides;
    @Autowired BookingService bookings;
    @Autowired JdbcTemplate jdbc;
    List<UUID> users;
    LocalDate tomorrow;
    String origin;
    @BeforeEach void setup() {
        users = new ArrayList<>(); origin = "Indore-" + UUID.randomUUID();
        tomorrow = LocalDate.now(ZoneId.of("Asia/Kolkata")).plusDays(1);
        for (int i = 0; i < 3; i++) users.add(auth.register(UUID.randomUUID() + "@changes.test", "test-password-long", "Test Rider").id());
    }
    @AfterEach void cleanup() {
        for (UUID user : users) {
            jdbc.update("DELETE FROM bookings WHERE passenger_id=? OR ride_id IN (SELECT id FROM rides WHERE driver_id=?)", user, user);
            jdbc.update("DELETE FROM rides WHERE driver_id=?", user);
            jdbc.update("DELETE FROM driver_profiles WHERE user_id=?", user);
            jdbc.update("DELETE FROM user_profiles WHERE user_id=?", user);
            jdbc.update("DELETE FROM users WHERE id=?", user);
        }
    }
    RidePreferences prefs(boolean women, boolean ac) {
        return new RidePreferences(List.of("Station", "Vijay Nagar"), List.of("Tower", "Bus Stand"), true, ac, true, women, RidePreferences.RouteType.HOME_TO_OFFICE);
    }
    RideDtos.View offer(UUID owner, int hour, String price, RidePreferences preferences) {
        return rides.create(owner, new RideDtos.Create(origin, "Ujjain", null, null,
                tomorrow.atTime(hour, 0).atZone(ZoneId.of("Asia/Kolkata")).toInstant(), "Asia/Kolkata", 2,
                new BigDecimal(price), "INR", "Test car", null, null, preferences));
    }
    RideDtos.Results search(String sort, String direct, String from, String to, boolean women, boolean ac, String boarding) {
        return rides.search(origin, "Ujjain", tomorrow, "Asia/Kolkata", 1, null, 0, 20, sort, direct, from, to, women, ac, false, boarding, null);
    }
    @Test void approvalRequestsDoNotReserveSeatsAndOnlyOneDriverAcceptanceCanWin() throws Exception {
        var driver = users.get(0);
        var ride = offer(driver, 9, "120", new RidePreferences(List.of("Station"), List.of("Tower"), true, true,
                false, false, RidePreferences.RouteType.OTHER, true));
        var passenger = new BookingDtos.Passenger("Test Rider", 25, BookingDtos.Gender.FEMALE);
        var details = new BookingDtos.JourneyDetails("Station", "Tower", List.of(passenger, passenger));
        var first = bookings.create(ride.id(), users.get(1), UUID.randomUUID(), 2, ride.version(), details).booking();
        var second = bookings.create(ride.id(), users.get(2), UUID.randomUUID(), 2, ride.version(), details).booking();
        assertEquals("PENDING", first.status());
        assertNotNull(first.requestExpiresAt());
        assertEquals(2, rides.details(ride.id(), null).availableSeats());
        assertEquals(403, assertThrows(BookingFailure.class, () -> bookings.decide(first.id(), users.get(1), true)).status);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var attempts = executor.invokeAll(List.of(first.id(), second.id()).stream().map(id ->
                    (java.util.concurrent.Callable<Integer>) () -> {
                        try { bookings.decide(id, driver, true); return 200; }
                        catch (BookingFailure failure) { return failure.status; }
                    }).toList());
            assertEquals(List.of(200, 409), List.of(attempts.get(0).get(), attempts.get(1).get()).stream().sorted().toList());
        }
        assertEquals(0, rides.details(ride.id(), null).availableSeats());
        var pending = "PENDING".equals(bookings.details(first.id(), driver).status()) ? first : second;
        jdbc.update("UPDATE bookings SET request_expires_at = now() - interval '1 minute' WHERE id = ?", pending.id());
        assertEquals("EXPIRED", bookings.details(pending.id(), driver).status());
        assertEquals(409, assertThrows(BookingFailure.class, () -> bookings.decide(pending.id(), driver, true)).status);
    }
    @Test void noCitiesReturnsNoRidesAndFiltersUseActualStoredPreferences() {
        var first = offer(users.get(0), 9, "200", prefs(true, true));
        offer(users.get(1), 22, "100", prefs(false, false));
        assertEquals(0, rides.search(null, null, tomorrow, "Asia/Kolkata", 1, null, 0, 20, "TIME_ASC", null, null, null, false, false, false, null, null).totalElements());
        assertEquals(first.id(), search("TIME_ASC", "09:00", null, null, true, true, "Station").content().get(0).id());
        assertEquals(1, search("TIME_ASC", null, "20:00", "24:00", false, false, null).totalElements());
        assertEquals(new BigDecimal("100.00"), search("PRICE_ASC", null, null, null, false, false, null).content().get(0).pricePerSeat());
        assertEquals(0, search("TIME_ASC", null, null, null, false, true, "Unknown").totalElements());
    }
    @Test void bookingValidatesStopsPassengersWomenAndIdempotentPayload() {
        var ride = offer(users.get(0), 9, "200", prefs(true, true));
        var female = new BookingDtos.Passenger("Riya", 25, BookingDtos.Gender.FEMALE);
        var details = new BookingDtos.JourneyDetails("Station", "Tower", List.of(female));
        assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), users.get(1), UUID.randomUUID(), 1, ride.version()));
        assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), users.get(1), UUID.randomUUID(), 1, ride.version(),
                new BookingDtos.JourneyDetails("Unknown", "Tower", List.of(female))));
        assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), users.get(1), UUID.randomUUID(), 1, ride.version(),
                new BookingDtos.JourneyDetails("Station", "Tower", List.of(new BookingDtos.Passenger("Aarav", 25, BookingDtos.Gender.MALE)))));
        UUID key = UUID.randomUUID();
        var booked = bookings.create(ride.id(), users.get(1), key, 1, ride.version(), details);
        assertEquals(details, booked.booking().details());
        assertTrue(bookings.create(ride.id(), users.get(1), key, 1, ride.version(), details).replayed());
        assertThrows(BookingFailure.class, () -> bookings.create(ride.id(), users.get(1), key, 1, ride.version(),
                new BookingDtos.JourneyDetails("Vijay Nagar", "Tower", List.of(female))));
        assertThrows(BookingFailure.class, () -> bookings.details(booked.booking().id(), users.get(2)));
    }
    @Test void ratingAndReviewsBelongToTheCorrectDriverAndSortAcrossAllResults() {
        var completed = offer(users.get(0), 9, "200", prefs(false, true));
        var details = new BookingDtos.JourneyDetails("Station", "Tower", List.of(new BookingDtos.Passenger("Riya", 25, BookingDtos.Gender.FEMALE)));
        var booked = bookings.create(completed.id(), users.get(2), UUID.randomUUID(), 1, completed.version(), details).booking();
        jdbc.update("UPDATE rides SET departure_at=now()-interval '1 minute' WHERE id=?", completed.id());
        var started = rides.start(completed.id(), users.get(0), rides.details(completed.id(), users.get(0)).version());
        rides.complete(completed.id(), users.get(0), started.version());
        bookings.rate(booked.id(), users.get(2), 5, "Comfortable journey");
        var rated = offer(users.get(0), 13, "200", prefs(false, true));
        var other = offer(users.get(1), 14, "100", prefs(false, true));
        var result = search("RATING_DESC", null, null, null, false, false, null);
        assertEquals(rated.id(), result.content().get(0).id());
        assertEquals(5.0, result.content().get(0).driverRating());
        assertEquals("Comfortable journey", result.content().get(0).reviews().get(0).text());
        assertEquals(0.0, rides.details(other.id(), null).driverRating());
    }
}
