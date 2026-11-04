package com.hoopr.common.exception;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GlobalExceptionHandlerTest {
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
            .setControllerAdvice(new GlobalExceptionHandler()).build();

    @Test void validationReturnsFieldErrorsWithoutRejectedValues() throws Exception {
        mvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"))
                .andExpect(jsonPath("$.errors[0].rejectedValue").doesNotExist());
    }

    @Test void malformedJsonIsBadRequest() throws Exception {
        mvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest());
    }

    @Test void unexpectedFailureDoesNotExposeInternals() throws Exception {
        mvc.perform(get("/probe")).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("An unexpected error occurred."));
    }

    @RestController
    static class ProbeController {
        @PostMapping("/probe") void validate(@Valid @RequestBody Probe body) { }
        @GetMapping("/probe") void fail() { throw new IllegalStateException("internal diagnostic"); }
    }
    record Probe(@NotBlank String name) { }
}
