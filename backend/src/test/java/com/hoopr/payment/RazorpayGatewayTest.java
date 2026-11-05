package com.hoopr.payment;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RazorpayGatewayTest {
    @Test void signatureBindsServerOrderAndPaymentId() {
        var gateway = new RazorpayGateway("rzp_test_fixture", "fixture-secret");
        String signature = "371795ed9e1b31a67ca7492fd95e8426defb05d42a1cb4d96e4972405ea67459";
        assertTrue(gateway.validSignature("order_fixture", "pay_fixture", signature));
        assertFalse(gateway.validSignature("order_other", "pay_fixture", signature));
        assertFalse(gateway.validSignature("order_fixture", "pay_other", signature));
        assertFalse(gateway.validSignature("order_fixture", "pay_fixture", "not-hex"));
    }

    @Test void liveKeyCannotEnableTestCheckout() {
        assertFalse(new RazorpayGateway("rzp_live_fixture", "fixture-secret").enabled());
        assertFalse(new RazorpayGateway("rzp_test_fixture", "").enabled());
    }
}
