package com.hoopr.health;

import com.hoopr.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(value = HealthController.class, properties = {
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "hoopr.auth.issuer=hoopr", "hoopr.auth.origins=http://localhost:5173",
    "hoopr.auth.cookie-secure=true", "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
@Import(SecurityConfig.class)
class HealthControllerTest {
    @org.springframework.test.context.bean.override.mockito.MockitoBean com.hoopr.auth.SessionRepository sessions;
    @Autowired private MockMvc mvc;

    @Test void healthIsPublic() throws Exception {
        mvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.application").value("hoopr"));
    }

    @Test void businessEndpointsAreClosed() throws Exception {
        mvc.perform(get("/api/v1/bookings")).andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test void writesAreClosed() throws Exception {
        mvc.perform(post("/api/v1/health")).andExpect(status().isForbidden());
    }
}
