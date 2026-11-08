package com.hoopr.ride;

import com.hoopr.security.SecurityConfig;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(value = RideController.class, properties = {
    "hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "hoopr.auth.issuer=hoopr",
    "hoopr.auth.origins=http://localhost:5173", "hoopr.auth.cookie-secure=true",
    "hoopr.auth.cookie-same-site=Lax", "hoopr.auth.refresh-lifetime=30d"
})
@Import(SecurityConfig.class)
class RideWebTest {
    @Autowired MockMvc mvc;
    @MockitoBean RideService service;
    final UUID owner = UUID.randomUUID();
    String body(String extras) {
        return "{\"origin\":\"Mumbai\",\"destination\":\"Pune\",\"departureAt\":\"2035-01-01T10:00:00Z\",\"timeZone\":\"Asia/Kolkata\",\"totalSeats\":3,\"pricePerSeat\":250.00,\"currency\":\"INR\"" + extras + "}";
    }
    @Test void authenticatedCreatePassesJwtSubjectToService() throws Exception {
        mvc.perform(post("/api/v1/rides").with(jwt().jwt(j -> j.subject(owner.toString())).authorities(() -> "ROLE_USER"))
                .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body(""))).andExpect(status().isCreated());
        verify(service).create(eq(owner), any(RideDtos.Create.class));
    }
    @Test void unauthenticatedCreateIsRejected() throws Exception {
        mvc.perform(post("/api/v1/rides").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body("")))
                .andExpect(status().isUnauthorized()); verifyNoInteractions(service);
    }
    @Test void ownerAndAvailabilityCannotBeInjected() throws Exception {
        for (String field : List.of("driverId", "availableSeats", "status"))
            mvc.perform(post("/api/v1/rides").with(jwt().jwt(j -> j.subject(owner.toString())).authorities(() -> "ROLE_USER"))
                    .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body(",\"" + field + "\":\"injected\"")))
                    .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void invalidSeatPriceDateAndMissingFieldsAreBadRequests() throws Exception {
        for (String invalid : List.of(body("").replace("\"totalSeats\":3", "\"totalSeats\":0"),
                body("").replace("\"totalSeats\":3", "\"totalSeats\":7"),
                body("").replace("\"totalSeats\":3", "\"totalSeats\":1.5"),
                body("").replace("250.00", "-1.00"), body("").replace("250.00", "1.001"),
                body("").replace("2035-01-01T10:00:00Z", "not-a-date"), "{}"))
            mvc.perform(post("/api/v1/rides").with(jwt().jwt(j -> j.subject(owner.toString())).authorities(() -> "ROLE_USER"))
                    .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void searchIsPublicButMineRequiresLogin() throws Exception {
        when(service.search(any(), any(), any(), anyString(), anyInt(), any(), anyInt(), anyInt(),
                anyString(), any(), any(), any(), anyBoolean(), anyBoolean(), anyBoolean(), any(), any()))
                .thenReturn(new RideDtos.Results(List.of(), 0, 20, 0, 0));
        mvc.perform(get("/api/v1/rides")).andExpect(status().isOk()).andExpect(jsonPath("$.content").isArray());
        mvc.perform(get("/api/v1/rides/me")).andExpect(status().isUnauthorized());
    }
    @Test void invalidSearchAndMissingVersionAreRejected() throws Exception {
        for (String query : List.of("?size=1000", "?page=-1", "?minimumSeats=0", "?maximumPrice=-1", "?departureDate=bad"))
            mvc.perform(get("/api/v1/rides" + query)).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/rides/" + UUID.randomUUID())
                .with(jwt().jwt(j -> j.subject(owner.toString())).authorities(() -> "ROLE_USER")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"notes\":\"Changed\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/rides/" + UUID.randomUUID())
                .with(jwt().jwt(j -> j.subject(owner.toString())).authorities(() -> "ROLE_USER")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0.5,\"notes\":\"Changed\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test void corsAllowsPatchFromTrustedFrontend() throws Exception {
        mvc.perform(options("/api/v1/rides/" + UUID.randomUUID()).header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "PATCH").header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }
}
