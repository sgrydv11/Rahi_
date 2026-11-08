package com.hoopr.ride;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class RideDtos {
    private RideDtos() { }
    public record Create(
        @NotBlank @Size(max = 200) String origin,
        @NotBlank @Size(max = 200) String destination,
        @Size(max = 500) String pickupDescription,
        @Size(max = 500) String dropoffDescription,
        @NotNull Instant departureAt,
        @NotBlank @Size(max = 64) String timeZone,
        @NotNull @Min(1) @Max(6) Integer totalSeats,
        @NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal pricePerSeat,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
        @Size(max = 300) String vehicleDetails,
        @Size(max = 2000) String notes,
        UUID vehicleId, @jakarta.validation.Valid RidePreferences preferences) {
        public Create(String origin, String destination, String pickupDescription, String dropoffDescription,
                      Instant departureAt, String timeZone, Integer totalSeats, BigDecimal pricePerSeat,
                      String currency, String vehicleDetails, String notes, UUID vehicleId) {
            this(origin, destination, pickupDescription, dropoffDescription, departureAt, timeZone, totalSeats,
                    pricePerSeat, currency, vehicleDetails, notes, vehicleId, null);
        }
        public Create(String origin, String destination, String pickupDescription, String dropoffDescription,
                      Instant departureAt, String timeZone, Integer totalSeats, BigDecimal pricePerSeat,
                      String currency, String vehicleDetails, String notes) {
            this(origin, destination, pickupDescription, dropoffDescription, departureAt, timeZone, totalSeats,
                    pricePerSeat, currency, vehicleDetails, notes, null);
        }
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String name, Object value) { throw new IllegalArgumentException("Unknown ride field"); }
    }
    // PATCH: null/omitted fields keep existing values. Empty optional strings clear those fields.
    public record Update(
        @NotNull @PositiveOrZero Long version,
        @Size(min = 1, max = 200) String origin,
        @Size(min = 1, max = 200) String destination,
        @Size(max = 500) String pickupDescription,
        @Size(max = 500) String dropoffDescription,
        Instant departureAt,
        @Size(min = 1, max = 64) String timeZone,
        @Min(1) @Max(6) Integer totalSeats,
        @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal pricePerSeat,
        @Pattern(regexp = "[A-Z]{3}") String currency,
        @Size(max = 300) String vehicleDetails,
        @Size(max = 2000) String notes, @jakarta.validation.Valid RidePreferences preferences) {
        public Update(Long version, String origin, String destination, String pickupDescription, String dropoffDescription,
                      Instant departureAt, String timeZone, Integer totalSeats, BigDecimal pricePerSeat,
                      String currency, String vehicleDetails, String notes) {
            this(version, origin, destination, pickupDescription, dropoffDescription, departureAt, timeZone,
                    totalSeats, pricePerSeat, currency, vehicleDetails, notes, null);
        }
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String name, Object value) { throw new IllegalArgumentException("Unknown ride field"); }
    }
    public record Cancel(@NotNull @PositiveOrZero Long version, @Size(max = 500) String reason) { }
    public record Transition(@NotNull @PositiveOrZero Long version) { }
    public record Point(
        @NotNull @DecimalMin("-90") @DecimalMax("90") @Digits(integer = 3, fraction = 6) BigDecimal latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") @Digits(integer = 3, fraction = 6) BigDecimal longitude) { }
    public record RoutePins(Point pickup, Point dropoff) { }
    public record RouteChange(@NotNull @PositiveOrZero Long version,
                             @com.fasterxml.jackson.annotation.JsonProperty(required = true) @jakarta.validation.Valid Point pickup,
                             @com.fasterxml.jackson.annotation.JsonProperty(required = true) @jakarta.validation.Valid Point dropoff) { }

    public static RoutePins routePins(Ride ride) {
        if (ride.getPickupLatitude() == null || ride.getDropoffLatitude() == null) return null;
        return new RoutePins(new Point(ride.getPickupLatitude(), ride.getPickupLongitude()),
                new Point(ride.getDropoffLatitude(), ride.getDropoffLongitude()));
    }
    public record Driver(UUID id, String displayName) { }
    public record View(UUID id, Driver driver, String origin, String destination,
        String pickupDescription, String dropoffDescription, Instant departureAt, String timeZone,
        int totalSeats, int availableSeats, BigDecimal pricePerSeat, String currency,
        String vehicleDetails, String notes, String status, long version,
        Instant createdAt, Instant updatedAt, Instant cancelledAt, String cancellationReason,
        Instant startedAt, Instant completedAt, boolean canStart, RoutePins route,
        RidePreferences preferences, double driverRating, List<Review> reviews) { }
    public record Review(int score, String text) { }
    public record Results(List<View> content, int page, int size, long totalElements, int totalPages) { }
}
