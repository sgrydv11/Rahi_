package com.hoopr.ride;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

public final class RideSpecifications {
    private RideSpecifications() { }
    public static Specification<Ride> available(Instant now, String origin, String destination,
            LocalDate date, ZoneId zone, int seats, BigDecimal price) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(root.get("status").in("SCHEDULED", "PUBLISHED"));
            predicates.add(cb.greaterThan(root.get("departureAt"), now));
            var heldSeats = query.subquery(Long.class);
            var hold = heldSeats.from(SeatHoldInventory.class);
            heldSeats.select(cb.coalesce(cb.sum(hold.<Short>get("seats")).as(Long.class), 0L))
                    .where(cb.equal(hold.get("rideId"), root.get("id")),
                            cb.equal(hold.get("status"), "HELD"), cb.greaterThan(hold.get("expiresAt"), now));
            predicates.add(cb.ge(cb.diff(root.get("availableSeats").as(Long.class), heldSeats), (long) seats));
            if (origin != null && !origin.isBlank()) predicates.add(cb.like(cb.lower(root.get("origin")), prefix(origin), '\\'));
            if (destination != null && !destination.isBlank()) predicates.add(cb.like(cb.lower(root.get("destination")), prefix(destination), '\\'));
            if (date != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("departureAt"), date.atStartOfDay(zone).toInstant()));
                predicates.add(cb.lessThan(root.get("departureAt"), date.plusDays(1).atStartOfDay(zone).toInstant()));
            }
            if (price != null) predicates.add(cb.lessThanOrEqualTo(root.get("pricePerSeat"), price));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
    private static String prefix(String input) {
        return input.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
