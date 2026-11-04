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
        @Size(max = 2000) String notes) {
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
        @Size(max = 2000) String notes) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String name, Object value) { throw new IllegalArgumentException("Unknown ride field"); }
    }
    public record Cancel(@NotNull @PositiveOrZero Long version, @Size(max = 500) String reason) { }
    public record Driver(UUID id, String displayName) { }
    public record View(UUID id, Driver driver, String origin, String destination,
        String pickupDescription, String dropoffDescription, Instant departureAt, String timeZone,
        int totalSeats, int availableSeats, BigDecimal pricePerSeat, String currency,
        String vehicleDetails, String notes, String status, long version,
        Instant createdAt, Instant updatedAt, Instant cancelledAt, String cancellationReason) { }
    public record Results(List<View> content, int page, int size, long totalElements, int totalPages) { }
}
