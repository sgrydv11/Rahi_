package com.hoopr.ride;

import com.hoopr.auth.AuthService;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RideDiscountController {
    private final RideDiscounts discounts;
    private final AuthService auth;

    public RideDiscountController(RideDiscounts discounts, AuthService auth) {
        this.discounts = discounts;
        this.auth = auth;
    }

    @GetMapping("/api/v1/ride-discounts/next")
    public Next next(@AuthenticationPrincipal Jwt jwt) {
        return new Next(discounts.next(auth.profile(UUID.fromString(jwt.getSubject())).id()));
    }

    public record Next(int discountPercent) {}
}
