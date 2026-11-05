package com.hoopr.booking;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

public final class BookingDtos {
    private BookingDtos() { }
    public record Create(@NotNull @Min(1) @Max(6) Integer seats, @PositiveOrZero Long rideVersion) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String field, Object value) { throw new IllegalArgumentException("Unknown booking field"); }
    }
    public record Cancel(@Size(max = 500) String reason) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String field, Object value) { throw new IllegalArgumentException("Unknown booking field"); }
    }
    public record Person(UUID id, String displayName) { }
    public record Rate(@NotNull @Min(1) @Max(5) Integer score) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String field, Object value) { throw new IllegalArgumentException("Unknown rating field"); }
    }
    public record Rating(int score, Instant ratedAt) { }
    public record Journey(UUID id, UUID driverId, String origin, String destination, Instant departureAt, String timeZone,
                          String status, com.hoopr.ride.RideDtos.RoutePins route) { }
    public record View(UUID id, Journey ride, Person passenger, int seats, BigDecimal pricePerSeat,
        BigDecimal totalPrice, String currency, String status, long version, boolean canCancel,
        Instant createdAt, Instant updatedAt, Instant cancelledAt, String cancellationReason, Rating rating) { }
    public record Results(List<View> content, int page, int size, long totalElements, int totalPages) { }
    public record Created(View booking, boolean replayed) { }
}
