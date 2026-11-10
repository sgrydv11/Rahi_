package com.hoopr.booking;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

public final class BookingDtos {
    private BookingDtos() { }
    public record Passenger(@NotBlank @Size(max = 120) @Pattern(regexp = "\\p{L}[\\p{L}\\p{M} .'-]{0,119}") String name,
                            @NotNull @Min(0) @Max(120) Integer age, @NotNull Gender gender) { }
    public enum Gender { FEMALE, MALE, OTHER }
    public record JourneyDetails(@NotBlank @Size(max = 200) String boardingPoint,
                                 @NotBlank @Size(max = 200) String droppingPoint,
                                 @NotNull @Size(min = 1, max = 6) List<@NotNull @jakarta.validation.Valid Passenger> passengers) { }
    public record Create(@NotNull @Min(1) @Max(6) Integer seats, @PositiveOrZero Long rideVersion,
                         @jakarta.validation.Valid JourneyDetails details) {
        public Create(Integer seats, Long rideVersion) { this(seats, rideVersion, null); }
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String field, Object value) { throw new IllegalArgumentException("Unknown booking field"); }
    }
    public record Cancel(@Size(max = 500) String reason) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String field, Object value) { throw new IllegalArgumentException("Unknown booking field"); }
    }
    public record Person(UUID id, String displayName) { }
    public record Rate(@NotNull @Min(1) @Max(5) Integer score, @Size(max = 1000) String review) {
        public Rate(Integer score) { this(score, null); }
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String field, Object value) { throw new IllegalArgumentException("Unknown rating field"); }
    }
    public record Rating(int score, Instant ratedAt, String review) { }
    public record Journey(UUID id, UUID driverId, String origin, String destination, Instant departureAt, String timeZone,
                          String status, com.hoopr.ride.RideDtos.RoutePins route) { }
    public record View(UUID id, Journey ride, Person passenger, int seats, BigDecimal pricePerSeat,
        BigDecimal totalPrice, String currency, String status, long version, boolean canCancel,
        Instant createdAt, Instant updatedAt, Instant cancelledAt, String cancellationReason, Rating rating,
        JourneyDetails details, Instant requestExpiresAt) { }
    public record Results(List<View> content, int page, int size, long totalElements, int totalPages) { }
    public record Created(View booking, boolean replayed) { }
}
