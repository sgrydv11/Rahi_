package com.hoopr.common.exception;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(com.hoopr.booking.BookingFailure.class)
    ProblemDetail handleBooking(com.hoopr.booking.BookingFailure exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(exception.status), exception.getMessage());
    }

    @ExceptionHandler(org.springframework.dao.PessimisticLockingFailureException.class)
    ProblemDetail handleBusy(org.springframework.dao.PessimisticLockingFailureException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Ride is busy. Reload before trying again.");
    }

    @ExceptionHandler(com.hoopr.ride.RideFailure.class)
    ProblemDetail handleRide(com.hoopr.ride.RideFailure exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(exception.status), exception.getMessage());
    }

    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    ProblemDetail handleStaleRide(org.springframework.orm.ObjectOptimisticLockingFailureException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Ride changed. Reload before trying again.");
    }

    @ExceptionHandler(com.hoopr.auth.AuthFailure.class)
    ResponseEntity<ProblemDetail> handleAuth(com.hoopr.auth.AuthFailure exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(exception.status), exception.getMessage());
        var response = ResponseEntity.status(exception.status).header("Cache-Control", "no-store");
        if (exception.status == 429) response.header("Retry-After", "900");
        return response.body(problem);
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ProblemDetail handleIntegrity(org.springframework.dao.DataIntegrityViolationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "The request conflicts with existing data.");
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    ProblemDetail handleDenied(org.springframework.security.access.AccessDeniedException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Request is not authorized.");
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception, HttpHeaders headers,
            HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed.");
        List<FieldError> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldError(error.getField(), error.getDefaultMessage())).toList();
        problem.setProperty("errors", errors);
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail handleConstraintViolation(ConstraintViolationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed.");
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception exception) {
        LOG.error("Unexpected request failure ({})", exception.getClass().getSimpleName());
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
    }

    public record FieldError(String field, String message) { }
}
