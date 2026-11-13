package com.hoopr.auth;

import com.hoopr.user.TravelPreference;
import jakarta.validation.constraints.*;
import java.util.UUID;

public final class OtpRequests {
    private OtpRequests() { }
    public static class Request {
        @NotBlank @Size(max = 254) public String identifier;
        @Size(max = 24) public String mobileNumber;
        @NotNull public TravelPreference travelPreference = TravelPreference.PASSENGER;
        @Override public String toString() { return "OtpRequest[redacted]"; }
    }
    public static class Verify {
        @NotNull public UUID challengeId;
        @NotBlank @Pattern(regexp = "[0-9]{6}") public String code;
        @Override public String toString() { return "OtpVerify[redacted]"; }
    }
    public static class Registration extends Request {
        @NotBlank @Size(min=12,max=72) public String password;
        @Override public String toString() { return "Registration[redacted]"; }
    }
}
