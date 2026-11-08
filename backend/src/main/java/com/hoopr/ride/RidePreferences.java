package com.hoopr.ride;

import jakarta.validation.constraints.*;
import java.util.List;

public record RidePreferences(
        @NotNull @Size(min = 1, max = 20) List<@NotBlank @Size(max = 200) String> boardingPoints,
        @NotNull @Size(min = 1, max = 20) List<@NotBlank @Size(max = 200) String> droppingPoints,
        @NotNull Boolean hasCar, Boolean ac, boolean flexibleDropoff, boolean womenOnly,
        @NotNull RouteType routeType) {
    public enum RouteType { HOME_TO_OFFICE, OFFICE_TO_HOME, OTHER }
    public static RidePreferences forRide(Ride ride) {
        return ride.preferences == null ? new RidePreferences(List.of(ride.origin), List.of(ride.destination),
                null, null, false, false, RouteType.OTHER) : ride.preferences;
    }
}
