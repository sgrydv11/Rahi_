package com.hoopr.booking;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface BookingRepository extends JpaRepository<Booking, UUID> {
    @EntityGraph(attributePaths = {"ride", "passengerProfile"})
    Optional<Booking> findByPassengerIdAndIdempotencyKey(UUID passengerId, UUID idempotencyKey);
    boolean existsByRideIdAndPassengerIdAndStatus(UUID rideId, UUID passengerId, String status);
    @Override @EntityGraph(attributePaths = {"ride", "passengerProfile"})
    Optional<Booking> findById(UUID id);
    @EntityGraph(attributePaths = {"ride", "passengerProfile"})
    Page<Booking> findByPassengerId(UUID passengerId, Pageable page);
    @EntityGraph(attributePaths = {"ride", "passengerProfile"})
    Page<Booking> findByRideId(UUID rideId, Pageable page);
    @Query("select coalesce(sum(b.seatsBooked), 0) from Booking b where b.rideId = :rideId and b.status = 'CONFIRMED'")
    long confirmedSeats(UUID rideId);
    @Query("select b.rideId from Booking b where b.id = :id")
    Optional<UUID> rideIdFor(UUID id);
    // Call only after locking the ride. All writes follow ride -> booking order.
    List<Booking> findByRideIdAndStatusOrderById(UUID rideId, String status);
}
