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
    public static Specification<Ride> preferences(ZoneId zone, String departureTime, String from, String to,
            boolean womenOnly, boolean ac, boolean flexible, String boarding, String dropping) {
        boolean range = from != null || to != null;
        String minutePattern = "([01][0-9]|2[0-3]):[0-5][0-9]";
        if (departureTime != null && (!departureTime.matches(minutePattern) || range))
            throw new RideFailure(400, "Choose a departure time or a time range.");
        if (range && (from == null || to == null || !from.matches(minutePattern)
                || !(to.matches(minutePattern) || to.equals("24:00")) || from.compareTo(to) >= 0))
            throw new RideFailure(400, "Choose a valid same-day time range.");
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            for (String flag : List.of("womenOnly", "ac", "flexibleDropoff")) {
                boolean enabled = flag.equals("womenOnly") ? womenOnly : flag.equals("ac") ? ac : flexible;
                if (enabled) predicates.add(cb.equal(cb.function("jsonb_extract_path_text", String.class, root.get("preferences"), cb.literal(flag)), "true"));
            }
            String[] points = { boarding, dropping };
            String[] keys = { "boardingPoints", "droppingPoints" };
            String[] legacy = { "origin", "destination" };
            for (int i = 0; i < points.length; i++) {
                if (points[i] != null && !points[i].isBlank()) predicates.add(cb.or(
                        cb.and(cb.isNull(root.get("preferences")), cb.equal(root.get(legacy[i]), points[i].strip())),
                        cb.isTrue(cb.function("jsonb_exists", Boolean.class,
                                cb.function("jsonb_extract_path", Object.class, root.get("preferences"), cb.literal(keys[i])), cb.literal(points[i].strip())))));
            }
            var local = cb.function("timezone", LocalDateTime.class, cb.literal(zone.getId()), root.get("departureAt"));
            var time = cb.function("to_char", String.class, local, cb.literal("HH24:MI"));
            if (departureTime != null) predicates.add(cb.equal(time, departureTime));
            if (range) { predicates.add(cb.greaterThanOrEqualTo(time, from)); predicates.add(cb.lessThan(time, to)); }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
