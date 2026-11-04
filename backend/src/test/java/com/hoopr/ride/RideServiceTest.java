package com.hoopr.ride;

import com.hoopr.user.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.hoopr.ride.RideDtos.*;

class RideServiceTest {
    RideRepository rides = mock(RideRepository.class);
    UserRepository users = mock(UserRepository.class);
    ProfileRepository profiles = mock(ProfileRepository.class);
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    UUID owner = UUID.randomUUID();
    Instant now = Instant.parse("2026-01-01T00:00:00Z");
    RideService service;
    Ride ride;
    Create body() { return new Create("Mumbai", "Pune", null, null, now.plusSeconds(86400), "Asia/Kolkata", 3, new BigDecimal("250.00"), "INR", "Blue car", null); }
    Update seats(long version, int seats) { return new Update(version, null, null, null, null, null, null, seats, null, null, null, null); }
    @BeforeEach void setup() {
        service = new RideService(rides, users, jdbc, Clock.fixed(now, ZoneOffset.UTC), profiles);
        UserAccount account = new UserAccount(); account.id = owner; account.status = "ACTIVE";
        when(users.findById(owner)).thenReturn(Optional.of(account));
        ride = new Ride(); ride.id = UUID.randomUUID(); ride.driverId = owner; ride.origin = "Mumbai";
        ride.destination = "Pune"; ride.status = "SCHEDULED"; ride.timeZone = "Asia/Kolkata";
        ride.departureAt = now.plusSeconds(86400); ride.totalSeats = ride.availableSeats = 3;
        ride.currency = "INR"; ride.pricePerSeat = new BigDecimal("250.00");
        when(rides.findById(ride.id)).thenReturn(Optional.of(ride));
    }
    @Test void creationDerivesDriverAndInitialAvailability() {
        var result = service.create(owner, body());
        assertEquals(owner, result.driver().id()); assertEquals(3, result.availableSeats());
        assertEquals("SCHEDULED", result.status()); assertEquals("250.00", result.pricePerSeat().toPlainString());
        verify(jdbc).update(contains("ON CONFLICT"), eq(owner)); verify(rides).saveAndFlush(any(Ride.class));
    }
    @Test void pastDepartureAndBadTimeZoneAreRejected() {
        Create value = body();
        assertEquals(400, assertThrows(RideFailure.class, () -> service.create(owner, new Create(value.origin(), value.destination(), null, null,
                now, value.timeZone(), 3, value.pricePerSeat(), "INR", null, null))).status);
        assertThrows(RideFailure.class, () -> RideService.zone("not/a-zone"));
    }
    @Test void onlyOwnerCanUpdateAndCancel() {
        UUID other = UUID.randomUUID(); UserAccount account = new UserAccount(); account.status = "ACTIVE";
        when(users.findById(other)).thenReturn(Optional.of(account));
        assertEquals(403, assertThrows(RideFailure.class, () -> service.update(ride.id, other, seats(0, 2))).status);
        assertEquals(403, assertThrows(RideFailure.class, () -> service.cancel(ride.id, other, new Cancel(0L, null))).status);
    }
    @Test void updateKeepsOwnerAndAdjustsAvailability() {
        var result = service.update(ride.id, owner, seats(0, 4));
        assertEquals(owner, result.driver().id()); assertEquals(4, result.totalSeats()); assertEquals(4, result.availableSeats());
    }
    @Test void staleVersionIsConflict() {
        ride.version = 1;
        assertEquals(409, assertThrows(RideFailure.class, () -> service.update(ride.id, owner, seats(0, 2))).status);
    }
    @Test void reservedSeatsCannotBeReset() {
        ride.availableSeats = 1;
        assertEquals(409, assertThrows(RideFailure.class, () -> service.update(ride.id, owner, seats(0, 4))).status);
        assertEquals(409, assertThrows(RideFailure.class, () -> service.cancel(ride.id, owner, new Cancel(0L, null))).status);
    }
    @Test void confirmedBookingAlsoBlocksEditsEvenIfAvailabilityWasInconsistent() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq(ride.id))).thenReturn(1L);
        assertEquals(409, assertThrows(RideFailure.class, () -> service.update(ride.id, owner, seats(0, 4))).status);
    }
    @Test void existingLinkedVehicleCapacityIsRespected() {
        ride.vehicleId = UUID.randomUUID();
        when(jdbc.queryForObject(contains("passenger_capacity"), eq(Integer.class), eq(ride.vehicleId), eq(owner))).thenReturn(2);
        assertEquals(400, assertThrows(RideFailure.class, () -> service.update(ride.id, owner, seats(0, 4))).status);
    }
    @Test void cancelledCompletedAndDepartedRidesCannotBeChanged() {
        for (String status : List.of("CANCELLED", "COMPLETED", "IN_PROGRESS")) {
            ride.status = status;
            assertEquals(409, assertThrows(RideFailure.class, () -> service.update(ride.id, owner, seats(0, 2))).status);
        }
        ride.status = "SCHEDULED"; ride.departureAt = now;
        assertEquals(409, assertThrows(RideFailure.class, () -> service.cancel(ride.id, owner, new Cancel(0L, null))).status);
    }
    @Test void cancellationPreservesHistory() {
        var result = service.cancel(ride.id, owner, new Cancel(0L, "Plan changed"));
        assertEquals("CANCELLED", result.status()); assertEquals(now, result.cancelledAt());
        assertEquals("Plan changed", result.cancellationReason()); verify(rides, never()).delete(any(Ride.class));
    }
    @Test void disabledAccountCannotOffer() {
        when(users.findById(owner)).thenReturn(Optional.empty());
        assertEquals(401, assertThrows(RideFailure.class, () -> service.create(owner, body())).status);
    }
}
