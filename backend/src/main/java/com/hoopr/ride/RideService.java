package com.hoopr.ride;

import com.hoopr.user.UserRepository;
import com.hoopr.user.ProfileRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.hoopr.ride.RideDtos.*;

@Service
public class RideService {
    private final RideRepository rides;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ProfileRepository profiles;
    private final com.hoopr.booking.BookingService bookings;
    public RideService(RideRepository rides, UserRepository users, JdbcTemplate jdbc, Clock clock, ProfileRepository profiles, com.hoopr.booking.BookingService bookings) {
        this.rides = rides; this.users = users; this.jdbc = jdbc; this.clock = clock; this.profiles = profiles;
        this.bookings = bookings;
    }
    @Transactional
    public View create(UUID driver, Create body) {
        active(driver);
        validateDeparture(body.departureAt(), body.timeZone());
        validateLocations(body.origin(), body.destination());
        // PostgreSQL upsert also serializes simultaneous first offers by the same driver.
        jdbc.update("INSERT INTO driver_profiles(user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING", driver);
        Ride ride = new Ride(); ride.id = UUID.randomUUID(); ride.driverId = driver;
        ride.driverProfile = profiles.findById(driver).orElse(null);
        ride.origin = body.origin().strip(); ride.destination = body.destination().strip();
        ride.originKey = locationKey(ride.origin); ride.destinationKey = locationKey(ride.destination);
        ride.pickupDescription = optional(body.pickupDescription()); ride.dropoffDescription = optional(body.dropoffDescription());
        ride.vehicleDetails = optional(body.vehicleDetails()); ride.notes = optional(body.notes());
        ride.preferences = preferences(body.preferences());
        if (body.vehicleId() != null) {
            var vehicle = jdbc.query("""
                    SELECT make, model, color, passenger_capacity FROM vehicles
                    WHERE id = ? AND driver_id = ? AND active FOR UPDATE
                    """, (row, index) -> new VehicleSnapshot(
                    String.join(" ", Objects.toString(row.getString("color"), ""),
                            row.getString("make"), row.getString("model")).strip(),
                    row.getInt("passenger_capacity")), body.vehicleId(), driver)
                    .stream().findFirst().orElseThrow(() -> new RideFailure(404, "Active vehicle not found."));
            if (body.totalSeats() > vehicle.capacity()) throw new RideFailure(400, "Seats exceed the linked vehicle capacity.");
            ride.vehicleId = body.vehicleId();
            ride.vehicleDetails = vehicle.description();
        }
        ride.departureAt = body.departureAt(); ride.timeZone = zone(body.timeZone()).getId();
        ride.totalSeats = body.totalSeats().shortValue(); ride.availableSeats = ride.totalSeats;
        ride.pricePerSeat = body.pricePerSeat(); ride.currency = body.currency(); ride.status = "SCHEDULED";
        ride.createdAt = ride.updatedAt = clock.instant();
        rides.saveAndFlush(ride);
        return view(ride);
    }
    @Transactional(readOnly = true)
    public Results search(String origin, String destination, LocalDate date, String timeZone,
            int minimumSeats, BigDecimal maximumPrice, int page, int size) {
        if (date != null && (date.getYear() < 1 || date.getYear() > 9999))
            throw new RideFailure(400, "Travel date must be between years 0001 and 9999.");
        var filter = RideSpecifications.available(clock.instant(), origin, destination, date, zone(timeZone), minimumSeats, maximumPrice);
        return results(rides.findAll(filter, paging(page, size)));
    }
    @Transactional(readOnly = true)
    public Results mine(UUID user, int page, int size) {
        active(user);
        return results(rides.findAll((root, query, cb) -> cb.equal(root.get("driverId"), user), paging(page, size)));
    }
    @Transactional(readOnly = true)
    public View details(UUID id, UUID viewer) {
        Ride ride = find(id);
        if (List.of("DRAFT", "IN_PROGRESS").contains(ride.status) && !ride.driverId.equals(viewer))
            throw new RideFailure(404, "Ride not found.");
        return view(ride);
    }
    @Transactional
    public View update(UUID id, UUID owner, Update body) {
        active(owner);
        Ride ride = editable(id, owner, body.version());
        requireUnreserved(ride);
        bookings.requireNoPendingRequests(ride.id);
        if ((body.origin() != null && !ride.origin.equals(body.origin().strip())) ||
                (body.destination() != null && !ride.destination.equals(body.destination().strip()))) {
            ride.pickupLatitude = ride.pickupLongitude = ride.dropoffLatitude = ride.dropoffLongitude = null;
        }
        if (body.origin() != null) { ride.origin = body.origin().strip(); ride.originKey = locationKey(ride.origin); }
        if (body.destination() != null) { ride.destination = body.destination().strip(); ride.destinationKey = locationKey(ride.destination); }
        validateLocations(ride.origin, ride.destination);
        if (body.departureAt() != null) ride.departureAt = body.departureAt();
        if (body.timeZone() != null) ride.timeZone = zone(body.timeZone()).getId();
        validateDeparture(ride.departureAt, ride.timeZone);
        if (body.totalSeats() != null) {
            if (ride.vehicleId != null) {
                Integer capacity = jdbc.queryForObject("SELECT passenger_capacity FROM vehicles WHERE id = ? AND driver_id = ? FOR UPDATE", Integer.class, ride.vehicleId, owner);
                if (capacity == null || body.totalSeats() > capacity) throw new RideFailure(400, "Seats exceed the linked vehicle capacity.");
            }
            ride.totalSeats = body.totalSeats().shortValue(); ride.availableSeats = ride.totalSeats;
        }
        if (body.pricePerSeat() != null) ride.pricePerSeat = body.pricePerSeat();
        if (body.currency() != null) ride.currency = body.currency();
        if (body.pickupDescription() != null) ride.pickupDescription = optional(body.pickupDescription());
        if (body.dropoffDescription() != null) ride.dropoffDescription = optional(body.dropoffDescription());
        if (body.vehicleDetails() != null) ride.vehicleDetails = optional(body.vehicleDetails());
        if (body.notes() != null) ride.notes = optional(body.notes());
        if (body.preferences() != null) ride.preferences = preferences(body.preferences());
        ride.updatedAt = clock.instant(); rides.flush();
        return view(ride);
    }
    @Transactional
    public View updateRoute(UUID id, UUID owner, RouteChange change) {
        active(owner);
        Ride ride = editable(id, owner, change.version());
        requireUnreserved(ride);
        Point pickup = change.pickup();
        Point dropoff = change.dropoff();
        if ((pickup == null) != (dropoff == null))
            throw new RideFailure(400, "Provide both pickup and drop-off pins.");
        if (pickup != null && pickup.latitude().compareTo(dropoff.latitude()) == 0 &&
                pickup.longitude().compareTo(dropoff.longitude()) == 0)
            throw new RideFailure(400, "Pickup and drop-off pins must be different.");
        ride.pickupLatitude = pickup == null ? null : pickup.latitude();
        ride.pickupLongitude = pickup == null ? null : pickup.longitude();
        ride.dropoffLatitude = dropoff == null ? null : dropoff.latitude();
        ride.dropoffLongitude = dropoff == null ? null : dropoff.longitude();
        ride.updatedAt = clock.instant();
        rides.flush();
        return view(ride);
    }

    private void requireUnreserved(Ride ride) {
        Long reserved = jdbc.queryForObject("SELECT count(*) FROM bookings WHERE ride_id = ? AND status = 'CONFIRMED'", Long.class, ride.id);
        Long holds = jdbc.queryForObject("""
                SELECT count(*) FROM group_seat_holds WHERE ride_id = ? AND status = 'HELD' AND expires_at > ?
                """, Long.class, ride.id, clock.instant().atOffset(ZoneOffset.UTC));
        if (ride.availableSeats != ride.totalSeats || (reserved != null && reserved > 0) || (holds != null && holds > 0))
            throw new RideFailure(409, "Cancel active bookings or wait for seat holds to end before editing this ride.");
    }
    @Transactional
    public View cancel(UUID id, UUID owner, Cancel body) {
        active(owner);
        Ride ride = editable(id, owner, body.version());
        bookings.cancelForDriver(ride, owner, body.reason());
        ride.status = "CANCELLED"; ride.cancellationReason = optional(body.reason());
        ride.cancelledAt = ride.updatedAt = clock.instant(); rides.flush();
        return view(ride);
    }
    @Transactional
    public View start(UUID id, UUID owner, long version) {
        active(owner);
        Ride ride = lockOwned(id, owner, version);
        Instant now = clock.instant();
        if (!canStart(ride, now))
            throw new RideFailure(409, "A scheduled ride can start at or after departure.");
        ride.status = "IN_PROGRESS";
        ride.startedAt = ride.updatedAt = now;
        rides.flush();
        return view(ride);
    }

    @Transactional
    public View complete(UUID id, UUID owner, long version) {
        active(owner);
        Ride ride = lockOwned(id, owner, version);
        if (!"IN_PROGRESS".equals(ride.status))
            throw new RideFailure(409, "Only a ride in progress can be completed.");
        Instant now = clock.instant();
        if (ride.startedAt != null && now.isBefore(ride.startedAt))
            throw new RideFailure(409, "Completion cannot precede the ride start.");
        ride.status = "COMPLETED";
        ride.completedAt = ride.updatedAt = now;
        rides.flush();
        return view(ride);
    }

    private static boolean canStart(Ride ride, Instant now) {
        return List.of("SCHEDULED", "PUBLISHED").contains(ride.status) && !ride.departureAt.isAfter(now);
    }

    private Ride lockOwned(UUID id, UUID owner, long version) {
        Ride ride = rides.lockById(id).orElseThrow(() -> new RideFailure(404, "Ride not found."));
        if (!ride.driverId.equals(owner)) throw new RideFailure(403, "Only the ride owner can manage this ride.");
        if (ride.version != version) throw new RideFailure(409, "Ride changed. Reload before trying again.");
        return ride;
    }
    private Ride editable(UUID id, UUID owner, long version) {
        Ride ride = lockOwned(id, owner, version);
        if (!List.of("SCHEDULED", "PUBLISHED").contains(ride.status) || !ride.departureAt.isAfter(clock.instant()))
            throw new RideFailure(409, "Only future scheduled rides can be changed.");
        return ride;
    }
    private record VehicleSnapshot(String description, int capacity) { }
    private void active(UUID user) {
        if (users.findById(user).filter(u -> "ACTIVE".equals(u.status)).isEmpty())
            throw new RideFailure(401, "Account is unavailable. Please log in.");
    }
    private Ride find(UUID id) { return rides.findById(id).orElseThrow(() -> new RideFailure(404, "Ride not found.")); }
    private void validateDeparture(Instant departure, String timeZone) {
        zone(timeZone);
        if (departure == null || !departure.isAfter(clock.instant())) throw new RideFailure(400, "Departure must be in the future.");
        if (!departure.isBefore(Instant.parse("+10000-01-01T00:00:00Z")))
            throw new RideFailure(400, "Departure must be before year 10000.");
    }
    public static ZoneId zone(String value) {
        try {
            if (value == null || !ZoneId.getAvailableZoneIds().contains(value)
                    || value.startsWith("SystemV/")
                    || !(value.contains("/") || value.equals("UTC") || value.equals("GMT")))
                throw new DateTimeException("Not an IANA region zone");
            return ZoneId.of(value);
        }
        catch (RuntimeException e) { throw new RideFailure(400, "Use a valid IANA time zone, for example Asia/Kolkata."); }
    }
    private static void validateLocations(String origin, String destination) {
        if (origin == null || destination == null || origin.isBlank() || destination.isBlank())
            throw new RideFailure(400, "Origin and destination are required.");
        if (origin.strip().equalsIgnoreCase(destination.strip())) throw new RideFailure(400, "Origin and destination must differ.");
    }
    private static String locationKey(String location) {
        // Stable keys fit Phase 1's locality columns without a maps/geocoding dependency.
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(location.strip().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
    private static String optional(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static RidePreferences preferences(RidePreferences value) {
        if (value == null) return null;
        if (!Boolean.TRUE.equals(value.hasCar())) throw new RideFailure(400, "A car is required to offer a carpool ride.");
        var boarding = value.boardingPoints().stream().map(String::strip).toList();
        var dropping = value.droppingPoints().stream().map(String::strip).toList();
        if (boarding.stream().map(String::toLowerCase).distinct().count() != boarding.size()
                || dropping.stream().map(String::toLowerCase).distinct().count() != dropping.size())
            throw new RideFailure(400, "Remove duplicate boarding or dropping points.");
        return new RidePreferences(boarding, dropping, true, value.ac(), value.flexibleDropoff(), value.womenOnly(), value.routeType(), value.requiresApproval());
    }
    @Transactional(readOnly = true)
    public Results search(String origin, String destination, LocalDate date, String timeZone,
            int minimumSeats, BigDecimal maximumPrice, int page, int size, String sort,
            String departureTime, String timeFrom, String timeTo, boolean womenOnly, boolean ac,
            boolean flexibleDropoff, String boardingPoint, String droppingPoint) {
        if (origin == null || origin.isBlank() || destination == null || destination.isBlank())
            return new Results(List.of(), page, size, 0, 0);
        validateLocations(origin, destination);
        if (date == null) date = LocalDate.now(clock.withZone(zone(timeZone)));
        if (date.getYear() < 1 || date.getYear() > 9999) throw new RideFailure(400, "Invalid travel date.");
        String property = switch (sort) {
            case "TIME_ASC", "TIME_DESC" -> "departureAt";
            case "PRICE_ASC", "PRICE_DESC" -> "pricePerSeat";
            case "RATING_ASC", "RATING_DESC" -> "driverRating";
            default -> throw new RideFailure(400, "Choose a supported sort order.");
        };
        var order = Sort.by(sort.endsWith("DESC") ? Sort.Direction.DESC : Sort.Direction.ASC, property).and(Sort.by("id"));
        var available = RideSpecifications.available(clock.instant(), origin, destination, date, zone(timeZone), minimumSeats, maximumPrice);
        var extra = RideSpecifications.preferences(zone(timeZone), departureTime, timeFrom, timeTo, womenOnly, ac, flexibleDropoff, boardingPoint, droppingPoint);
        return results(rides.findAll(available.and(extra), PageRequest.of(page, size, order)));
    }
    private static Pageable paging(int page, int size) { return PageRequest.of(page, size, Sort.by("departureAt").ascending().and(Sort.by("id"))); }
    private Results results(Page<Ride> page) {
        var content = page.getContent();
        Map<UUID, Integer> held = new HashMap<>();
        if (!content.isEmpty()) {
            var params = new ArrayList<Object>();
            params.add(clock.instant().atOffset(ZoneOffset.UTC));
            content.forEach(ride -> params.add(ride.id));
            // One inventory query per page, not one query per card.
            jdbc.query("SELECT ride_id, sum(seats) FROM group_seat_holds WHERE status='HELD' AND expires_at > ? AND ride_id IN ("
                    + String.join(",", Collections.nCopies(content.size(), "?")) + ") GROUP BY ride_id",
                    (row, index) -> { held.put(row.getObject(1, UUID.class), row.getInt(2)); return row.getInt(2); },
                    params.toArray());
        }
        var reviews = reviews(content.stream().map(ride -> ride.driverId).distinct().toList());
        return new Results(content.stream().map(ride -> view(ride, held.getOrDefault(ride.id, 0), reviews.getOrDefault(ride.driverId, List.of()))).toList(),
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
    private View view(Ride ride) {
        Integer held = jdbc.queryForObject("SELECT coalesce(sum(seats),0) FROM group_seat_holds WHERE ride_id=? AND status='HELD' AND expires_at > ?",
                Integer.class, ride.id, clock.instant().atOffset(ZoneOffset.UTC));
        return view(ride, held == null ? 0 : held, reviews(List.of(ride.driverId)).getOrDefault(ride.driverId, List.of()));
    }
    private Map<UUID, List<Review>> reviews(List<UUID> drivers) {
        Map<UUID, List<Review>> result = new HashMap<>();
        if (drivers.isEmpty()) return result;
        String placeholders = String.join(",", Collections.nCopies(drivers.size(), "?"));
        jdbc.query("SELECT driver_id,driver_rating,review_text FROM (SELECT rated.driver_id,b.driver_rating,b.review_text,row_number() OVER (PARTITION BY rated.driver_id ORDER BY b.rated_at DESC,b.id) AS position FROM bookings b JOIN rides rated ON rated.id=b.ride_id WHERE rated.driver_id IN ("
                        + placeholders + ") AND b.driver_rating IS NOT NULL) ranked WHERE position<=3", row -> {
            result.computeIfAbsent(row.getObject(1, UUID.class), key -> new ArrayList<>()).add(new Review(row.getInt(2), row.getString(3)));
        }, drivers.toArray());
        return result;
    }
    private View view(Ride ride, int held, List<Review> reviews) {
        // Repository entity graphs fetch the safe driver profile in the page query.
        String name = ride.driverProfile == null ? "Hoopr driver" : ride.driverProfile.getFullName();
        if (name == null || name.isBlank()) name = "Hoopr driver";
        else name = name.strip().split("\\s+", 2)[0];
        return new View(ride.id, new Driver(ride.driverId, name), ride.origin, ride.destination,
                ride.pickupDescription, ride.dropoffDescription, ride.departureAt, ride.timeZone,
                ride.totalSeats, Math.max(0, ride.availableSeats - held), ride.pricePerSeat, ride.currency, ride.vehicleDetails,
                ride.notes, "PUBLISHED".equals(ride.status) ? "SCHEDULED" : ride.status, ride.version,
                ride.createdAt, ride.updatedAt, ride.cancelledAt, ride.cancellationReason,
                ride.startedAt, ride.completedAt, canStart(ride, clock.instant()), routePins(ride),
                RidePreferences.forRide(ride), ride.driverRating, reviews);
    }
}
