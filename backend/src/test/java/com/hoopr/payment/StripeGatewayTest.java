package com.hoopr.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hoopr.booking.BookingFailure;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StripeGatewayTest {
    @Test void onlyTestKeysEnableStripeCheckout() {
        String origin = "http://localhost:5173";
        assertTrue(new StripeGateway("sk_test_fixture", origin).enabled());
        assertTrue(new StripeGateway("rk_test_fixture", origin).enabled());
        assertFalse(new StripeGateway("sk_live_fixture", origin).enabled());
        assertFalse(new StripeGateway("", origin).enabled());
    }

    @Test void checkoutRedirectRejectsSpoofedHostsAndInsecureUrls() {
        var session = new ObjectMapper().createObjectNode();
        String hosted = "https://checkout.stripe.com/c/pay/fixture";
        assertEquals(hosted, StripeGateway.checkoutUrl(session.put("url", hosted)));
        for (String unsafe : new String[]{"http://checkout.stripe.com/c/pay/fixture",
                "https://checkout.stripe.com.example.test/", "https://other@checkout.stripe.com/"}) {
            session.put("url", unsafe);
            assertEquals(502, assertThrows(BookingFailure.class, () -> StripeGateway.checkoutUrl(session)).status);
        }
    }
}
